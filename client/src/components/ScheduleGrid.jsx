import React, { useState, useRef, useEffect } from 'react';
import { saveEntry } from '../api.js';

const THAI_DAYS   = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const ROW_TYPES = [
  { key: 'plan',  label: 'ตาราง' },
  { key: 'ot',    label: 'OT'    },
  { key: 'check', label: 'Check' },
];

// ── Time helpers ──────────────────────────────────────────────────────────────

/** "7.3" → "07:30"  |  "7.3B2" → "07:30 ☕2ชม."  |  "13" → "13:00" */
function formatTimeVal(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();

  // Extract break suffix: B2, b1.5 etc.
  const breakMatch = s.match(/[Bb](\d+(?:\.\d+)?)$/);
  const breakHr    = breakMatch ? parseFloat(breakMatch[1]) : null;
  const timeStr    = s.replace(/\s*[Bb]\d+(?:\.\d+)?$/, '').trim();

  const parts = timeStr.split('.');
  const h = parseInt(parts[0]) || 0;
  let m = 0;
  if (parts[1]) {
    // single digit .3 → 30 min | two digits .30 → 30 min
    m = parts[1].length === 1 ? parseInt(parts[1]) * 10 : parseInt(parts[1].padEnd(2,'0'));
  }
  const hh = String(h).padStart(2,'0');
  const mm = String(m).padStart(2,'0');
  const time = `${hh}:${mm}`;
  return breakHr != null ? `${time} B${breakHr}` : time;
}

/** Returns minutes from midnight, or null */
function parseTimeMin(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().replace(/\s*[Bb]\d+(?:\.\d+)?$/, '').trim();
  const parts = s.split('.');
  const h = parseInt(parts[0]) || 0;
  let m = 0;
  if (parts[1]) m = parts[1].length === 1 ? parseInt(parts[1]) * 10 : parseInt(parts[1].padEnd(2,'0'));
  return h * 60 + m;
}

function getCycleDates(startDate) {
  const start = new Date(startDate);
  const year  = start.getFullYear();
  const month = start.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let d = 21; d <= daysInMonth; d++) dates.push(new Date(year, month, d));
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  for (let d = 1; d <= 20; d++)  dates.push(new Date(ny, nm, d));
  return dates;
}

function dateKey(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditCell({ value, onSave, disabled, isTime = true }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const ref = useRef();

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    const v = draft.trim();
    onSave(v === '' ? null : v);
  }
  function onKey(e) {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') setEditing(false);
  }

  if (editing) return (
    <input ref={ref} className="cell-input" value={draft}
      onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} />
  );

  const display = value != null ? (isTime ? formatTimeVal(value) : String(value)) : '';
  return (
    <span className="cell-val" onDoubleClick={() => { if (!disabled) { setDraft(value??''); setEditing(true); } }}>
      {display}
    </span>
  );
}

// ── Single day cell ───────────────────────────────────────────────────────────

function DayCell({ rowType, entry, date, empId, cycleId, onUpdate }) {
  const dayType = entry?.day_type ?? 'work';
  const isOff   = dayType === 'off';

  function toggleOff(e) {
    e.preventDefault();
    if (rowType !== 'plan' && rowType !== 'check') return;
    onUpdate(cycleId, empId, date, { ...entry, day_type: isOff ? 'work' : 'off' });
  }

  function handleSave(val) {
    const patch = { ...(entry || {}), day_type: dayType };
    if (rowType === 'plan')  patch.plan_val  = val;
    if (rowType === 'ot')    patch.ot_val    = val;
    if (rowType === 'check') patch.check_val = val;
    onUpdate(cycleId, empId, date, patch);
  }

  // Check mismatch for Check row
  const planMin  = rowType === 'check' ? parseTimeMin(entry?.plan_val)  : null;
  const checkMin = rowType === 'check' ? parseTimeMin(entry?.check_val) : null;
  const mismatch = planMin != null && checkMin != null && planMin !== checkMin;
  const isLate   = mismatch && checkMin > planMin;
  const isEarly  = mismatch && checkMin < planMin;

  let cellClass = 'day-work';
  if (isOff)   cellClass = 'day-off';
  else if (isLate)  cellClass = 'day-late';
  else if (isEarly) cellClass = 'day-early';

  const val = rowType === 'plan' ? entry?.plan_val : rowType === 'ot' ? entry?.ot_val : entry?.check_val;

  return (
    <td className={cellClass} onContextMenu={toggleOff}>
      {isOff && (rowType === 'plan' || rowType === 'check')
        ? <span style={{ fontSize: 10, fontWeight: 700 }}>หยุด</span>
        : <EditCell value={val} onSave={handleSave} disabled={isOff} isTime={rowType !== 'ot'} />
      }
    </td>
  );
}

// ── Employee block — 3 rows ───────────────────────────────────────────────────

function EmployeeBlock({ emp, dates, entries, cycleId, onUpdate, isLast }) {
  const planCount  = dates.filter(d => entries[dateKey(d)]?.plan_val  && entries[dateKey(d)]?.day_type !== 'off').length;
  const checkCount = dates.filter(d => entries[dateKey(d)]?.check_val && entries[dateKey(d)]?.day_type !== 'off').length;
  const offDays    = dates.filter(d => entries[dateKey(d)]?.day_type === 'off').length;

  // Count mismatches
  let mismatch = 0, late = 0;
  for (const d of dates) {
    const e = entries[dateKey(d)];
    if (!e || e.day_type === 'off') continue;
    const pm = parseTimeMin(e.plan_val);
    const cm = parseTimeMin(e.check_val);
    if (pm != null && cm != null && pm !== cm) { mismatch++; if (cm > pm) late++; }
  }

  const totals = {
    plan:  planCount  > 0 ? `${planCount} วัน` : '',
    ot:    '',
    check: mismatch   > 0 ? `ไม่ตรง ${mismatch}` : checkCount > 0 ? `✓ ${checkCount}` : '',
  };

  const totalStyle = {
    plan:  { color: '#555' },
    ot:    {},
    check: mismatch > 0 ? { color: '#e74c3c', fontWeight: 700 } : { color: '#27ae60', fontWeight: 700 },
  };

  return (
    <>
      {ROW_TYPES.map((rt, idx) => (
        <tr key={rt.key} className={[
          `row-${rt.key}`,
          idx === 0 ? 'emp-first' : '',
          idx === 2 && isLast ? 'emp-last' : '',
        ].join(' ')}>

          {/* Sticky left columns */}
          {idx === 0 && <td rowSpan={3} className="col-sticky-0 emp-id-cell">{emp.id}</td>}
          {idx === 0 && <td rowSpan={3} className="col-sticky-1 emp-name-cell">{emp.name}</td>}

          {idx === 0 && (
            <td className="col-sticky-2" style={{ textAlign: 'center' }}>
              <span className="position-badge">{emp.position}</span>
            </td>
          )}
          {idx === 1 && <td className="col-sticky-2 emp-phone-cell">{emp.phone||''}</td>}
          {idx === 2 && <td className="col-sticky-2" />}

          <td className="col-sticky-3 row-label-cell">
            {idx === 0
              ? <span className="nickname-cell">{emp.nickname||''}</span>
              : <span style={{ color: '#555' }}>{rt.label}</span>
            }
          </td>

          {/* Day cells */}
          {dates.map(d => (
            <DayCell key={dateKey(d)} rowType={rt.key} entry={entries[dateKey(d)]}
              date={dateKey(d)} empId={emp.id} cycleId={cycleId} onUpdate={onUpdate} />
          ))}

          {/* Total */}
          <td className="col-total" style={{ fontSize: 10, ...totalStyle[rt.key] }}>
            {totals[rt.key]}
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ScheduleGrid({ data }) {
  if (!data) return <div className="empty-state"><h3>เลือกรอบตารางงาน</h3><p>หรือกด "+ สร้างรอบใหม่"</p></div>;

  const { cycle, employees, entries } = data;
  const [local, setLocal] = useState(entries);
  useEffect(() => setLocal(entries), [entries]);

  const dates = getCycleDates(cycle.start_date);
  const today = new Date().toISOString().split('T')[0];

  async function handleUpdate(cycleId, empId, date, patch) {
    setLocal(prev => ({
      ...prev,
      [empId]: { ...(prev[empId]||{}), [date]: { ...((prev[empId]||{})[date]||{}), ...patch } },
    }));
    await saveEntry({
      cycle_id:    cycleId,
      employee_id: empId,
      date,
      plan_val:    patch.plan_val  ?? null,
      ot_val:      patch.ot_val   ?? null,
      check_val:   patch.check_val ?? null,
      day_type:    patch.day_type  ?? 'work',
    });
  }

  // Build month span headers
  const monthSpans = [];
  let cur = null;
  for (const d of dates) {
    const lbl = `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!cur || cur.label !== lbl) { cur = { label: lbl, count: 0 }; monthSpans.push(cur); }
    cur.count++;
  }

  return (
    <div>
      {/* Legend */}
      <div className="legend">
        <strong>คำอธิบาย:</strong>
        <div className="legend-item"><div className="legend-box" style={{ background: '#e8eaf6' }} /> Plan — ตารางงาน</div>
        <div className="legend-item"><div className="legend-box" style={{ background: '#e8f5e9' }} /> Check — ตรงเวลา</div>
        <div className="legend-item"><div className="legend-box" style={{ background: '#ffccbc' }} /> Check — สาย</div>
        <div className="legend-item"><div className="legend-box" style={{ background: '#e3f2fd' }} /> Check — เข้าก่อน</div>
        <div className="legend-item"><div className="legend-box" style={{ background: '#ff6b6b' }} /> หยุด</div>
        <div className="legend-item"><div className="legend-box" style={{ background: '#fff9c4' }} /> OT</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>
          ดับเบิลคลิกแก้ไข · คลิกขวาแถว Plan/Check สลับวันหยุด · รูปแบบ: 7.3 = 07:30, 7.3B2 = พัก 2 ชม.
        </div>
      </div>

      {/* Grid */}
      <div className="schedule-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th colSpan={4} className="col-sticky-0">พนักงาน</th>
              {monthSpans.map(m => <th key={m.label} colSpan={m.count}>{m.label}</th>)}
              <th className="col-total-header">รวม</th>
            </tr>
            <tr>
              <th className="col-sticky-0">รหัส</th>
              <th className="col-sticky-1">ชื่อ-นามสกุล</th>
              <th className="col-sticky-2">ตำแหน่ง/เบอร์</th>
              <th className="col-sticky-3">ชื่อเล่น</th>
              {dates.map(d => {
                const dk  = dateKey(d);
                const dow = d.getDay();
                const isWE   = dow === 0 || dow === 6;
                const isToday = dk === today;
                return (
                  <th key={dk} className={isToday ? 'th-today' : isWE ? 'th-weekend' : ''} style={{ minWidth: 38 }}>
                    <div>{d.getDate()}</div>
                    <div style={{ fontSize: 9, opacity: 0.8 }}>{THAI_DAYS[dow]}</div>
                  </th>
                );
              })}
              <th className="col-total-header">รวม</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={4 + dates.length + 1} style={{ padding: 20, color: '#aaa', textAlign: 'center' }}>
                  ยังไม่มีพนักงาน — เพิ่มในแท็บ "พนักงาน" หรือ Sync จาก Manpower
                </td>
              </tr>
            )}
            {employees.map((emp, idx) => (
              <EmployeeBlock key={emp.id} emp={emp} dates={dates}
                entries={local[emp.id]||{}} cycleId={cycle.id}
                onUpdate={handleUpdate} isLast={idx === employees.length - 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
