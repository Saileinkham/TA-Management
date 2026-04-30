import React, { useState, useEffect, useCallback } from 'react';
import { fetchEmployees, fetchCycles, createCycle, deleteCycle, fetchSchedule, fetchCloudStatus, exportScheduleUrl } from './api.js';
import TAView          from './components/TAView.jsx';
import CheckTAView     from './components/CheckTAView.jsx';
import EmployeeManager from './components/EmployeeManager.jsx';
import UploadView      from './components/UploadView.jsx';
import LeaveReportView from './components/LeaveReportView.jsx';
import LoginView, { clearAuthSession, readAuthSession } from './components/LoginView.jsx';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function cycleLabel(c) {
  if (c.label) return c.label;
  const s = new Date(c.start_date + 'T00:00:00');
  const e = new Date(c.end_date   + 'T00:00:00');
  return `21 ${THAI_MONTHS[s.getMonth()]} – 20 ${THAI_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

const MENU = [
  { key: 'ta',        icon: '📋', label: 'TA'          },
  { key: 'check-ta',  icon: '✅', label: 'Check TA'    },
  { key: 'leave',     icon: '📊', label: 'รายงานการลา' },
  { key: 'employees', icon: '👥', label: 'พนักงาน'     },
  { key: 'upload',    icon: '📁', label: 'อัพโหลดไฟล์' },
];

// ── New Cycle Modal ───────────────────────────────────────────────────────────

function NewCycleModal({ onClose, onSave }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(
    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-21`
  );
  const [label, setLabel]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!startDate) return;
    setSaving(true);
    const res = await createCycle({ start_date: startDate, label });
    setSaving(false);
    onSave(res);
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>📅 สร้างรอบตารางงานใหม่</h2>
        <div className="form-group">
          <label>วันเริ่มต้น (ควรเป็นวันที่ 21)</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>ชื่อรอบ <span style={{ fontWeight: 400, color: '#aaa' }}>(ไม่บังคับ)</span></label>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="เช่น เม.ย.–พ.ค. 2026" />
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
          สิ้นสุดอัตโนมัติ: วันที่ 20 ของเดือนถัดไป
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={saving || !startDate}>
            {saving ? 'กำลังสร้าง...' : 'สร้าง'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [authSession, setAuthSession] = useState(() => readAuthSession());
  const [page, setPage]           = useState('ta');
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles]       = useState([]);
  const [cycleId, setCycleId]     = useState('');
  const [scheduleData, setScheduleData] = useState(null);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [toast, setToast]         = useState('');
  const [cloudStatus, setCloudStatus] = useState({ ok: null, provider: 'Firebase Firestore' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const loadEmployees = useCallback(() => fetchEmployees().then(setEmployees), []);

  const loadCycles = useCallback(() => fetchCycles().then(cs => {
    setCycles(cs);
    if (cs.length > 0 && !cycleId) setCycleId(String(cs[0].id));
  }), [cycleId]);

  const loadSchedule = useCallback(() => {
    if (!cycleId) return;
    fetchSchedule(cycleId).then(setScheduleData);
  }, [cycleId]);

  useEffect(() => {
    if (!authSession) return;
    loadEmployees();
    loadCycles();
  }, [authSession]);
  useEffect(() => {
    if (!authSession) return;
    loadSchedule();
  }, [authSession, cycleId]);
  useEffect(() => {
    if (!authSession) return;
    let mounted = true;
    fetchCloudStatus()
      .then(status => { if (mounted) setCloudStatus(status); })
      .catch(e => { if (mounted) setCloudStatus({ ok: false, error: e.message, provider: 'Firebase Firestore' }); });
    return () => { mounted = false; };
  }, [authSession]);

  async function handleDeleteCycle(id) {
    if (!confirm('ลบรอบนี้และข้อมูลตารางทั้งหมด?')) return;
    await deleteCycle(id);
    setCycleId('');
    setScheduleData(null);
    loadCycles();
    showToast('ลบรอบเรียบร้อยแล้ว');
  }

  const selectedCycle = cycles.find(c => String(c.id) === String(cycleId));
  const needsCycle    = page === 'ta' || page === 'check-ta' || page === 'leave';

  function handleLogout() {
    clearAuthSession();
    setAuthSession(null);
    setScheduleData(null);
    setEmployees([]);
    setCycles([]);
    setCycleId('');
  }

  if (!authSession) return <LoginView onLogin={setAuthSession} />;

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button
        className="sidebar-toggle-open"
        onClick={() => setSidebarCollapsed(false)}
        aria-label="เปิดเมนูด้านข้าง"
        title="เปิดเมนูด้านข้าง"
      >
        ☰
      </button>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">TA</div>
          <div>
            <div className="sidebar-logo-title">TA Management</div>
            <div className="sidebar-logo-sub">ระบบตรวจสอบตารางงาน</div>
          </div>
          <button
            className="sidebar-toggle-close"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="ซ่อนเมนูด้านข้าง"
            title="ซ่อนเมนูด้านข้าง"
          >
            ‹
          </button>
        </div>

        <div className={`cloud-status ${cloudStatus.ok === false ? 'offline' : cloudStatus.ok === true ? 'online' : 'checking'}`}>
          <span className="cloud-status-dot" />
          <div className="cloud-status-text">
            <span>{cloudStatus.ok === false ? 'Cloud offline' : cloudStatus.ok === true ? 'Cloud connected' : 'Checking cloud'}</span>
            <small>
              {cloudStatus.ok === true
                ? `${cloudStatus.projectId || 'Firestore'}${cloudStatus.latencyMs ? ` · ${cloudStatus.latencyMs}ms` : ''}`
                : cloudStatus.ok === false
                  ? cloudStatus.error || 'เชื่อมต่อไม่ได้'
                  : cloudStatus.provider}
            </small>
          </div>
        </div>

        {/* Cycle selector (only for TA / Check TA pages) */}
        {needsCycle && (
          <div className="sidebar-cycle">
            <div className="sidebar-section-label">รอบตาราง</div>
            <select
              className="sidebar-cycle-select"
              value={cycleId}
              onChange={e => setCycleId(e.target.value)}>
              <option value="">— เลือกรอบ —</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{cycleLabel(c)}</option>
              ))}
            </select>

            <button className="sidebar-btn sidebar-btn-primary"
              onClick={() => setShowNewCycle(true)}>
              + สร้างรอบใหม่
            </button>

            {selectedCycle && page === 'ta' && (
              <a
                href={exportScheduleUrl(selectedCycle.id)}
                download
                className="sidebar-btn sidebar-btn-export"
              >
                ⬇ Export Excel
              </a>
            )}

            {selectedCycle && (
              <button className="sidebar-btn sidebar-btn-ghost"
                onClick={() => handleDeleteCycle(selectedCycle.id)}>
                ลบรอบนี้
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {MENU.map(m => (
            <button key={m.key}
              className={`sidebar-item ${page === m.key ? 'active' : ''}`}
              onClick={() => setPage(m.key)}>
              <span className="sidebar-icon">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div>
            <span>เข้าสู่ระบบ</span>
            <small>{authSession.user.email}</small>
          </div>
          <button onClick={handleLogout}>ออก</button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="main-content">
        {page === 'ta' && (
          <TAView data={scheduleData} onRefresh={loadSchedule} />
        )}

        {page === 'check-ta' && (
          <CheckTAView cycleId={cycleId} />
        )}

        {page === 'leave' && (
          <LeaveReportView cycleId={cycleId} />
        )}

        {page === 'employees' && (
          <EmployeeManager employees={employees} onRefresh={() => { loadEmployees(); loadSchedule(); }} />
        )}

        {page === 'upload' && (
          <UploadView
            cycles={cycles}
            onImportDone={() => {
              loadCycles();
              loadSchedule();
              showToast('นำเข้าข้อมูลสำเร็จ');
            }}
          />
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {showNewCycle && (
        <NewCycleModal
          onClose={() => setShowNewCycle(false)}
          onSave={c => {
            setCycleId(String(c.id));
            loadCycles();
            setShowNewCycle(false);
            showToast('สร้างรอบเรียบร้อย');
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
