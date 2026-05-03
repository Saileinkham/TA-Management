const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const XLSX    = require('xlsx');
const fs      = require('fs');
const path    = require('path');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const rows = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const row of rows) {
    const line = row.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] == null) process.env[key] = val;
  }
}

loadLocalEnv();

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ─── Firebase config ─────────────────────────────────────────────────────────

function firebaseConfig(prefix, fallback) {
  return {
    apiKey:            process.env[`${prefix}_API_KEY`]            || fallback.apiKey,
    authDomain:        process.env[`${prefix}_AUTH_DOMAIN`]        || fallback.authDomain,
    projectId:         process.env[`${prefix}_PROJECT_ID`]         || fallback.projectId,
    storageBucket:     process.env[`${prefix}_STORAGE_BUCKET`]     || fallback.storageBucket,
    messagingSenderId: process.env[`${prefix}_MESSAGING_SENDER_ID`] || fallback.messagingSenderId,
    appId:             process.env[`${prefix}_APP_ID`]             || fallback.appId,
  };
}

const TA_CONFIG = firebaseConfig('TA_FIREBASE', {
  apiKey:            'AIzaSyBWkgiA9iDCu-WgBpspJsp3mPHHXOVxnOg',
  authDomain:        'ta-management-9a521.firebaseapp.com',
  projectId:         'ta-management-9a521',
  storageBucket:     'ta-management-9a521.firebasestorage.app',
  messagingSenderId: '1085750995828',
  appId:             '1:1085750995828:web:93a91cb0e3515c4a965a21',
});

const MANPOWER_CONFIG = firebaseConfig('MANPOWER_FIREBASE', {
  apiKey:            'AIzaSyC_HXhjYI6mIWl5Mh73qpeyU02FEkPMz9Y',
  authDomain:        'manpower-turnover.firebaseapp.com',
  projectId:         'manpower-turnover',
  storageBucket:     'manpower-turnover.firebasestorage.app',
  messagingSenderId: '763855698997',
  appId:             '1:763855698997:web:29148d618bbeb98798857c',
});

const MGMT_POSITIONS = [
  'Manager','Assistant 1','Assistant 2 Service','Assistant 2 Kitchen',
  'Supervisor Service','Supervisor Cold','Supervisor Hot','Supervisor Beverage',
];

// ─── Firebase init ────────────────────────────────────────────────────────────

let taDb = null;
let firebaseReady = null;

async function initFirebase() {
  if (firebaseReady) return firebaseReady;
  firebaseReady = (async () => {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getFirestore }           = await import('firebase/firestore');

  if (!getApps().find(a => a.name === 'ta')) {
    const fbApp = initializeApp(TA_CONFIG, 'ta');
    taDb = getFirestore(fbApp);
  } else {
    taDb = getFirestore(getApps().find(a => a.name === 'ta'));
  }
  console.log('Firestore (ta-management) ready');
  })();
  return firebaseReady;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const POSITION_ORDER = ['Manager','Assistant 1','Assistant 2 Service','Assistant 2 Kitchen','Supervisor Service','Supervisor Cold','Supervisor Hot','Supervisor Beverage'];

function posRank(pos) {
  const p = (pos || '').trim();
  const i = POSITION_ORDER.indexOf(p);
  if (i !== -1) return i;
  // fallback: group by prefix
  if (p.startsWith('Manager'))    return 0;
  if (p.startsWith('Assistant 1')) return 1;
  if (p.startsWith('Assistant 2')) return 2;
  if (p.startsWith('Supervisor'))  return 3;
  return 99;
}

function sortEmps(arr) {
  return arr.sort((a,b) =>
    (a.branch||'').localeCompare(b.branch||'') ||
    posRank(a.position) - posRank(b.position)  ||
    (a.name||'').localeCompare(b.name||'')
  );
}

function getCycleDates(startDate) {
  const start = new Date(startDate);
  const y = start.getFullYear(), mo = start.getMonth();
  const dim = new Date(y, mo + 1, 0).getDate();
  const dates = [];
  for (let d = 21; d <= dim; d++)
    dates.push(`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  const nm = mo === 11 ? 0 : mo + 1, ny = mo === 11 ? y + 1 : y;
  for (let d = 1; d <= 20; d++)
    dates.push(`${ny}-${String(nm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  return dates;
}

function normalizeTimeInput(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (/^\d{3}$/.test(s) && s.endsWith('0')) {
    const h = parseInt(s.slice(0, 2), 10);
    if (h >= 10 && h <= 23) return `${h}.00B2`;
  }
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.padStart(4, '0');
    const h = parseInt(raw.slice(0, 2), 10);
    const m = parseInt(raw.slice(2, 4), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${h}.${String(m).padStart(2, '0')}B2`;
  }
  return s;
}

function parseTimeMin(val) {
  if (!val) return null;
  const s = normalizeTimeInput(val).replace(/\s*[Bb]\d+(?:\.\d+)?$/, '');
  const parts = s.split('.');
  const h = parseInt(parts[0]) || 0;
  let m = 0;
  if (parts[1]) m = parts[1].length === 1 ? parseInt(parts[1]) * 10 : parseInt(parts[1].padEnd(2,'0'));
  return h * 60 + m;
}

function isRedCell(cell) {
  const rgb = cell?.s?.fill?.fgColor?.rgb || '';
  const hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  return r > 180 && g < 80 && b < 80;
}

function entryId(cycleId, empId, date) {
  return `${cycleId}_${empId}_${date}`;
}

// Firestore shortcuts
async function col(name) {
  const { collection } = await import('firebase/firestore');
  return collection(taDb, name);
}
async function docRef(colName, id) {
  const { doc } = await import('firebase/firestore');
  return doc(taDb, colName, id);
}

// ─── Cloud status ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });

  try {
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${TA_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const data = await authRes.json();

    if (!authRes.ok) {
      const code = data?.error?.message || 'LOGIN_FAILED';
      const messageMap = {
        EMAIL_NOT_FOUND: 'ไม่พบบัญชีนี้ใน Firebase',
        INVALID_PASSWORD: 'รหัสผ่านไม่ถูกต้อง',
        INVALID_LOGIN_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        USER_DISABLED: 'บัญชีนี้ถูกปิดใช้งาน',
      };
      return res.status(401).json({ error: messageMap[code] || 'เข้าสู่ระบบไม่สำเร็จ' });
    }

    res.json({
      ok: true,
      user: {
        uid: data.localId,
        email: data.email,
      },
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: Number(data.expiresIn || 3600),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/cloud/status', async (req, res) => {
  try {
    const { getDocs, query, limit } = await import('firebase/firestore');
    const startedAt = Date.now();
    await getDocs(query(await col('cycles'), limit(1)));
    res.json({
      ok: true,
      provider: 'Firebase Firestore',
      projectId: TA_CONFIG.projectId,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(503).json({
      ok: false,
      provider: 'Firebase Firestore',
      projectId: TA_CONFIG.projectId,
      error: e.message,
      checkedAt: new Date().toISOString(),
    });
  }
});

// ─── Employees ────────────────────────────────────────────────────────────────

app.get('/api/employees', async (req, res) => {
  try {
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(await col('employees'), where('status','==','active'));
    const snap = await getDocs(q);
    const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sortEmps(emps);
    res.json(emps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { setDoc } = await import('firebase/firestore');
    const { id, name, nickname='', phone='', position='', branch='' } = req.body;
    await setDoc(await docRef('employees', id), { name, nickname, phone, position, branch, status:'active' });
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { updateDoc } = await import('firebase/firestore');
    const { name, nickname='', phone='', position='', branch='', status='active' } = req.body;
    await updateDoc(await docRef('employees', req.params.id), { name, nickname, phone, position, branch, status });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(await docRef('employees', req.params.id), { status: 'inactive' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sync Management from Manpower Firebase
app.post('/api/employees/sync-manpower', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'ต้องระบุ email และ password' });
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, getDocs, collection } = await import('firebase/firestore');
    const { setDoc } = await import('firebase/firestore');

    let mpApp = getApps().find(a => a.name === 'mp');
    if (!mpApp) mpApp = initializeApp(MANPOWER_CONFIG, 'mp');
    const mpAuth = getAuth(mpApp);
    const mpDb   = getFirestore(mpApp);

    await signInWithEmailAndPassword(mpAuth, email, password);

    // Get current active employees in TA
    const { getDocs: getD, query: q2, where: w2 } = await import('firebase/firestore');
    const taSnap = await getD(q2(await col('employees'), w2('status','==','active')));
    const currentActiveIds = new Set(taSnap.docs.map(d => d.id));

    const snap = await getDocs(collection(mpDb, 'employees'));

    let synced = 0, deactivated = 0;
    const processedIds = new Set();
    const statusSeen = {}; // debug

    for (const d of snap.docs) {
      const e = d.data();
      if (!MGMT_POSITIONS.includes(e.position)) continue;

      const id = String(e.empId || e.id || d.id);
      const st = (e.status || '').toLowerCase();

      // Collect all unique status values for debugging
      statusSeen[String(e.status ?? 'null')] = (statusSeen[String(e.status ?? 'null')] || 0) + 1;

      // Whitelist: เก็บเฉพาะ status ที่ชัดเจนว่า "ยังทำงานอยู่" — ค่าอื่นทั้งหมดถือว่าออกแล้ว
      const ACTIVE_STATUSES = ['ปัจจุบัน', 'active', 'Active', 'ACTIVE', 'working', 'Working', 'ปกติ', 'probation'];
      const hasLeft = !ACTIVE_STATUSES.includes(e.status);

      processedIds.add(id);

      if (hasLeft) {
        await setDoc(await docRef('employees', id), { status: 'inactive' }, { merge: true });
        deactivated++;
      } else {
        await setDoc(await docRef('employees', id), {
          name:     e.name     || '',
          nickname: e.nickname || '',
          phone:    e.phone    || e.tel || '',
          position: e.position || '',
          branch:   e.branch   || e.store || '',
          status:   'active',
        }, { merge: true });
        synced++;
      }
    }

    // Deactivate TA employees not found in Manpower at all
    for (const id of currentActiveIds) {
      if (!processedIds.has(id)) {
        await setDoc(await docRef('employees', id), { status: 'inactive' }, { merge: true });
        deactivated++;
      }
    }

    res.json({ ok: true, synced, deactivated, statusSeen });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Cycles ───────────────────────────────────────────────────────────────────

app.get('/api/cycles', async (req, res) => {
  try {
    const { getDocs, query, orderBy } = await import('firebase/firestore');
    const q = query(await col('cycles'), orderBy('start_date', 'desc'));
    const snap = await getDocs(q);
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cycles', async (req, res) => {
  try {
    const { addDoc, serverTimestamp } = await import('firebase/firestore');
    const { start_date, label = '' } = req.body;
    const s  = new Date(start_date);
    const nm = s.getMonth() === 11 ? 0 : s.getMonth() + 1;
    const ny = s.getMonth() === 11 ? s.getFullYear() + 1 : s.getFullYear();
    const end_date = `${ny}-${String(nm+1).padStart(2,'0')}-20`;
    const ref = await addDoc(await col('cycles'), { start_date, end_date, label, createdAt: serverTimestamp() });
    res.status(201).json({ id: ref.id, start_date, end_date, label });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cycles/:id', async (req, res) => {
  try {
    const { deleteDoc, getDocs, query, where } = await import('firebase/firestore');
    // Delete all entries for this cycle
    const q = query(await col('entries'), where('cycle_id','==',req.params.id));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(await docRef('cycles', req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Schedule ─────────────────────────────────────────────────────────────────

app.get('/api/schedule/:cycleId', async (req, res) => {
  try {
    const { getDoc, getDocs, query, where } = await import('firebase/firestore');
    const cycleSnap = await getDoc(await docRef('cycles', req.params.cycleId));
    if (!cycleSnap.exists()) return res.status(404).json({ error: 'ไม่พบรอบตาราง' });
    const cycle = { id: cycleSnap.id, ...cycleSnap.data() };

    const [empSnap, entrySnap] = await Promise.all([
      getDocs(query(await col('employees'), where('status','==','active'))),
      getDocs(query(await col('entries'), where('cycle_id','==',req.params.cycleId))),
    ]);

    const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    sortEmps(employees);

    const map = {};
    entrySnap.docs.forEach(d => {
      const e = d.data();
      if (!map[e.employee_id]) map[e.employee_id] = {};
      map[e.employee_id][e.date] = { id: d.id, ...e };
    });

    res.json({ cycle, employees, entries: map });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/schedule/entry', async (req, res) => {
  try {
    const { setDoc } = await import('firebase/firestore');
    const { cycle_id, employee_id, date, plan_val=null, ot_val=null, check_val=null, day_type='work' } = req.body;
    const id = entryId(cycle_id, employee_id, date);
    await setDoc(await docRef('entries', id), { cycle_id, employee_id, date, plan_val, ot_val, check_val, day_type }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Import Excel ─────────────────────────────────────────────────────────────

app.post('/api/schedule/import', upload.single('file'), async (req, res) => {
  try {
    const { setDoc, addDoc, serverTimestamp } = await import('firebase/firestore');
    const { cycle_id, branch = '' } = req.body;

    const { getDoc } = await import('firebase/firestore');
    const cycleSnap = await getDoc(await docRef('cycles', cycle_id));
    if (!cycleSnap.exists()) return res.status(404).json({ error: 'ไม่พบรอบตาราง' });
    const cycle = cycleSnap.data();

    const wb  = XLSX.read(req.file.buffer, { type:'buffer', cellStyles:true });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });
    const cycleDates = getCycleDates(cycle.start_date);

    let dateRow = -1;
    const dateColMap = {};
    for (let r = 0; r < raw.length; r++) {
      const row = raw[r];
      if (row.filter(v => typeof v==='number' && v>=1 && v<=31).length >= 15) {
        dateRow = r;
        let idx = 0;
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (typeof v==='number' && v>=1 && v<=31 && idx < cycleDates.length)
            dateColMap[c] = cycleDates[idx++];
        }
        break;
      }
    }
    if (dateRow === -1) return res.status(400).json({ error: 'ไม่พบแถววันที่' });

    // Create file record first to get file_id
    const fileRef = await addDoc(await col('files'), {
      name:        req.file.originalname,
      branch:      branch || '',
      cycle_id,
      entry_count: 0,
      uploaded_at: Date.now(),
    });
    const file_id = fileRef.id;

    let imported = 0, currentEmp = null, mode = null;
    const batch = [];

    for (let r = dateRow + 1; r < raw.length; r++) {
      const row = raw[r];
      if (!row || row.every(v => v === null)) continue;
      const first = String(row[0]||'').trim();
      const isEmpRow = /^\d{5,8}$/.test(first);

      if (isEmpRow) {
        currentEmp = { id: first, name: String(row[1]||'').trim(), nickname: String(row[2]||'').trim(), position: String(row[3]||'').trim() };
        batch.push(setDoc(await docRef('employees', currentEmp.id),
          { name:currentEmp.name, nickname:currentEmp.nickname, position:currentEmp.position, status:'active' }, { merge:true }));
        mode = 'plan';

        for (const [colStr, dateStr] of Object.entries(dateColMap)) {
          const col  = parseInt(colStr);
          const val  = row[col];
          const cell = ws[XLSX.utils.encode_cell({ r, c:col })];
          const dayType = isRedCell(cell) ? 'off' : 'work';
          let planStr = null;
          if (typeof val === 'number') {
            const h = Math.floor(val), m = Math.round((val-h)*100);
            planStr = m > 0 ? `${h}.${String(m).replace(/0+$/,'')}` : String(h);
          } else if (val != null) planStr = String(val).trim();

          if (planStr || dayType === 'off') {
            const id = entryId(cycle_id, currentEmp.id, dateStr);
            batch.push(setDoc(await docRef('entries', id),
              { cycle_id, employee_id: currentEmp.id, date: dateStr,
                plan_val: planStr, ot_val: null, check_val: null,
                day_type: dayType, file_id },
              { merge: true }));
            imported++;
          }
        }
        continue;
      }

      if (!currentEmp) continue;
      const label = String(row[0]||row[1]||row[2]||row[3]||'').trim().toUpperCase();
      if (label === 'OT') mode = 'ot';

      if (mode === 'ot') {
        for (const [colStr, dateStr] of Object.entries(dateColMap)) {
          const val = row[parseInt(colStr)];
          if (val != null && val !== '') {
            const id = entryId(cycle_id, currentEmp.id, dateStr);
            batch.push(setDoc(await docRef('entries', id), { ot_val: String(val), file_id }, { merge: true }));
          }
        }
      }
    }

    await Promise.all(batch);

    // Update file record with actual count
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(fileRef, { entry_count: imported });

    res.json({ ok: true, imported, file_id });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ─── Stats / Report ───────────────────────────────────────────────────────────

app.get('/api/stats/:cycleId', async (req, res) => {
  try {
    const { getDoc, getDocs, query, where } = await import('firebase/firestore');
    const cycleSnap = await getDoc(await docRef('cycles', req.params.cycleId));
    if (!cycleSnap.exists()) return res.status(404).json({ error: 'Not found' });

    const [empSnap, entrySnap] = await Promise.all([
      getDocs(query(await col('employees'), where('status','==','active'))),
      getDocs(query(await col('entries'), where('cycle_id','==',req.params.cycleId))),
    ]);

    const byEmp = {};
    empSnap.docs.forEach(d => {
      const e = d.data();
      byEmp[d.id] = { id:d.id, name:e.name, position:e.position, nickname:e.nickname, branch:e.branch,
        workDays:0, offDays:0, mismatchDays:0, lateDays:0, earlyDays:0, details:[], allDates:[] };
    });

    entrySnap.docs.forEach(d => {
      const en = d.data();
      const emp = byEmp[en.employee_id];
      if (!emp) return;
      if (en.day_type === 'off') {
        emp.offDays++;
        emp.allDates.push({ date:en.date, dayType:'off', plan:null, check:null, match:null });
        return;
      }
      emp.workDays++;
      const pm = parseTimeMin(en.plan_val), cm = parseTimeMin(en.check_val);
      let match = null;
      if (pm != null && cm != null) match = pm === cm ? 'ok' : cm > pm ? 'late' : 'early';
      if (match && match !== 'ok') emp.mismatchDays++;
      if (match === 'late')  emp.lateDays++;
      if (match === 'early') emp.earlyDays++;
      const row = { date:en.date, plan:en.plan_val, ot:en.ot_val, check:en.check_val, match, dayType:'work' };
      emp.allDates.push(row);
      if (en.plan_val || en.check_val) emp.details.push(row);
    });

    for (const e of Object.values(byEmp)) {
      e.details.sort((a,b) => a.date.localeCompare(b.date));
      e.allDates.sort((a,b) => a.date.localeCompare(b.date));
    }

    const emps = Object.values(byEmp);
    sortEmps(emps);

    res.json({ cycle: { id: cycleSnap.id, ...cycleSnap.data() }, summary: emps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── File management ──────────────────────────────────────────────────────────

app.get('/api/files', async (req, res) => {
  try {
    const { getDocs, query, where, orderBy } = await import('firebase/firestore');
    let q;
    if (req.query.cycle_id) {
      q = query(await col('files'), where('cycle_id','==',req.query.cycle_id));
    } else {
      q = await col('files');
    }
    const snap = await getDocs(q);
    const files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    files.sort((a,b) => (b.uploaded_at||0) - (a.uploaded_at||0));
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/files/:id', async (req, res) => {
  try {
    const { getDoc, deleteDoc, getDocs, query, where } = await import('firebase/firestore');
    const fileSnap = await getDoc(await docRef('files', req.params.id));
    if (!fileSnap.exists()) return res.status(404).json({ error: 'ไม่พบไฟล์' });
    const fileData = fileSnap.data();

    // Delete entries that came from this file (matched by cycle_id + file_id)
    // Since we track file_id on entries, delete those
    const entrySnap = await getDocs(
      query(await col('entries'), where('file_id','==',req.params.id))
    );
    await Promise.all(entrySnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(await docRef('files', req.params.id));

    res.json({ ok: true, deleted: entrySnap.docs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Debug: ดู status ทั้งหมดใน Manpower
app.post('/api/employees/debug-manpower', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'ต้องระบุ email และ password' });
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, getDocs, collection } = await import('firebase/firestore');

    let mpApp = getApps().find(a => a.name === 'mp');
    if (!mpApp) mpApp = initializeApp(MANPOWER_CONFIG, 'mp');
    const mpAuth = getAuth(mpApp);
    const mpDb   = getFirestore(mpApp);
    await signInWithEmailAndPassword(mpAuth, email, password);

    const snap = await getDocs(collection(mpDb, 'employees'));
    const mgmtOnly = [];
    snap.docs.forEach(d => {
      const e = d.data();
      if (!MGMT_POSITIONS.includes(e.position)) return;
      mgmtOnly.push({
        id:       String(e.empId || e.id || d.id),
        name:     e.name,
        position: e.position,
        status:   e.status,       // ค่าจริงใน Manpower
        statusRaw: JSON.stringify(e.status),
      });
    });
    res.json(mgmtOnly);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Export Excel ────────────────────────────────────────────────────────────

app.get('/api/schedule/:cycleId/export', async (req, res) => {
  try {
    const { getDoc, getDocs, query, where } = await import('firebase/firestore');
    const cycleSnap = await getDoc(await docRef('cycles', req.params.cycleId));
    if (!cycleSnap.exists()) return res.status(404).json({ error: 'ไม่พบรอบตาราง' });
    const cycle = { id: cycleSnap.id, ...cycleSnap.data() };

    const [empSnap, entrySnap] = await Promise.all([
      getDocs(query(await col('employees'), where('status','==','active'))),
      getDocs(query(await col('entries'), where('cycle_id','==',req.params.cycleId))),
    ]);

    let employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    sortEmps(employees);

    // Build entry map
    const entryMap = {};
    entrySnap.docs.forEach(d => {
      const e = d.data();
      if (!entryMap[e.employee_id]) entryMap[e.employee_id] = {};
      entryMap[e.employee_id][e.date] = e;
    });

    const dates = getCycleDates(cycle.start_date);

    // Build worksheet data
    const wb = XLSX.utils.book_new();

    // Group by branch
    const branches = {};
    for (const emp of employees) {
      const br = emp.branch || 'ไม่ระบุสาขา';
      if (!branches[br]) branches[br] = [];
      branches[br].push(emp);
    }

    for (const [branch, emps] of Object.entries(branches)) {
      const rows = [];

      // Header row 1: month spans
      const monthRow = ['รหัส', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'ตำแหน่ง'];
      let lastMonth = '';
      for (const d of dates) {
        const mo = d.slice(0, 7);
        monthRow.push(mo !== lastMonth ? d.slice(5, 7) + '/' + d.slice(0, 4) : '');
        lastMonth = mo;
      }
      monthRow.push('รวม');
      rows.push(monthRow);

      // Header row 2: dates
      const dateRow = ['รหัส', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'ตำแหน่ง'];
      for (const d of dates) dateRow.push(parseInt(d.slice(8)));
      dateRow.push('');
      rows.push(dateRow);

      // Employee rows
      for (const emp of emps) {
        const emp_entries = entryMap[emp.id] || {};

        // Plan row
        const planRow = [emp.id, emp.name, emp.nickname || '', emp.position];
        let workDays = 0;
        for (const d of dates) {
          const e = emp_entries[d];
          if (e?.day_type === 'off') planRow.push('F');
          else { planRow.push(e?.plan_val || ''); if (e?.plan_val) workDays++; }
        }
        planRow.push(workDays > 0 ? workDays + ' วัน' : '');
        rows.push(planRow);

        // OT row
        const otRow = ['', '', '', 'OT'];
        for (const d of dates) {
          const e = emp_entries[d];
          otRow.push(e?.ot_val || '');
        }
        otRow.push('');
        rows.push(otRow);

        // Check row
        const checkRow = ['', '', '', 'Check'];
        let mismatch = 0;
        for (const d of dates) {
          const e = emp_entries[d];
          if (e?.day_type === 'off') { checkRow.push('F'); continue; }
          checkRow.push(e?.check_val || '');
          if (e?.plan_val && e?.check_val) {
            const pm = parseTimeMin(e.plan_val), cm = parseTimeMin(e.check_val);
            if (pm != null && cm != null && pm !== cm) mismatch++;
          }
        }
        checkRow.push(mismatch > 0 ? `ไม่ตรง ${mismatch}` : '');
        rows.push(checkRow);

        // Blank spacer
        rows.push([]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Column widths
      ws['!cols'] = [
        { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 22 },
        ...dates.map(() => ({ wch: 6 })),
        { wch: 10 },
      ];

      const sheetName = branch.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const s = new Date(cycle.start_date + 'T00:00:00');
    const filename = `TA_${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3002;
if (require.main === module) {
  initFirebase().then(() => {
    app.listen(PORT, () => console.log(`TA Management server → http://localhost:${PORT}`));
  }).catch(e => { console.error('Firebase init failed:', e); process.exit(1); });
}

module.exports = { app, initFirebase };
