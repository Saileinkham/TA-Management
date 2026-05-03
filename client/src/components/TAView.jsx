import React, { useState, useRef, useEffect, useCallback } from 'react';
import { saveEntry } from '../api.js';

const THAI_DAYS   = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const ROW_TYPES = [
  { key: 'plan',  label: 'ตาราง' },
  { key: 'ot',    label: 'OT'    },
  { key: 'check', label: 'Check' },
];

export const DAY_TYPES = [
  { key: 'work', label: 'ทำงาน',                 color: null       },
  { key: 'off',  label: 'วันหยุด',               color: '#fecaca'  },
  { key: 'นท',   label: 'ปฏิบัติงานนอกสถานที่', color: '#fde68a'  },
  { key: 'อ',    label: 'อบรมนอกสถานที่',        color: '#fbcfe8'  },
  { key: 'ข',    label: 'ขาดงาน',                color: '#fca5a5'  },
  { key: 'ปไ',   label: 'ป่วยไม่มีใบฯ',          color: '#a5f3fc'  },
  { key: 'ปม',   label: 'ป่วยมีใบฯ',             color: '#bfdbfe'  },
  { key: 'ก',    label: 'ลากิจ',                 color: '#e9d5ff'  },
  { key: 'ร',    label: 'พักร้อน',               color: '#d9f99d'  },
  { key: 'ค',    label: 'ลาคลอด',                color: '#fed7aa'  },
  { key: 'บ',    label: 'ลาบวช',                 color: '#99f6e4'  },
  { key: 'น',    label: 'นักขัดิ',               color: '#bbf7d0'  },
  { key: 'กพ',   label: 'ลากิจพิเศษ',            color: '#c7d2fe'  },
  { key: 'พง',   label: 'พักงาน',                color: '#fde8d8'  },
  { key: 'วก',   label: 'วันเกิด',               color: '#fef08a'  },
];

// ── Day Type Context Menu ──────────────────────────────────────────────────────
function DayTypeMenu({ x, y, current, onSelect, onClose }) {
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Adjust position so menu stays inside viewport
  const menuW = 220, menuH = 360;
  const left = Math.min(x, window.innerWidth  - menuW - 8);
  const top  = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <div ref={ref} className="day-type-menu" style={{ left, top }}>
      {DAY_TYPES.map(dt => (
        <button key={dt.key}
          className={`day-type-menu-item ${current === dt.key ? 'active' : ''}`}
          onClick={() => { onSelect(dt.key); onClose(); }}>
          <span className="day-type-dot"
            style={{ background: dt.color || '#eef2ff', border: dt.color ? 'none' : '1px solid #ccc' }} />
          <span>{dt.key === 'work' ? 'ทำงาน' : `${dt.key} – ${dt.label}`}</span>
        </button>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatTimeVal(val) {
  if (val == null || val === '') return '';
  const s = normalizeTimeInput(val);
  const breakMatch = s.match(/[Bb](\d+(?:\.\d+)?)$/);
  const breakHr    = breakMatch ? parseFloat(breakMatch[1]) : null;
  const timeStr    = s.replace(/\s*[Bb]\d+(?:\.\d+)?$/, '').trim();
  const parts = timeStr.split('.');
  const h = parseInt(parts[0]) || 0;
  let m = 0;
  if (parts[1]) m = parts[1].length === 1 ? parseInt(parts[1]) * 10 : parseInt(parts[1].padEnd(2,'0'));
  const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  return breakHr != null ? `${time} B${breakHr}` : time;
}

function parseTimeMin(val) {
  if (val == null || val === '') return null;
  const s = normalizeTimeInput(val).replace(/\s*[Bb]\d+(?:\.\d+)?$/, '').trim();
  const parts = s.split('.');
  const h = parseInt(parts[0]) || 0;
  let m = 0;
  if (parts[1]) m = parts[1].length === 1 ? parseInt(parts[1]) * 10 : parseInt(parts[1].padEnd(2,'0'));
  return h * 60 + m;
}

function parseOtHours(val) {
  if (val == null || val === '') return 0;
  const n = parseFloat(String(val).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatHours(n) {
  if (!n) return '';
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))} ชม.`;
}

function getCycleDates(startDate) {
  const start = new Date(startDate);
  const year  = start.getFullYear(), month = start.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let d = 21; d <= daysInMonth; d++) dates.push(new Date(year, month, d));
  const nm = month === 11 ? 0 : month + 1, ny = month === 11 ? year + 1 : year;
  for (let d = 1; d <= 20; d++) dates.push(new Date(ny, nm, d));
  return dates;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function patchForCell(entry, rowType, rawValue) {
  const patch = { ...(entry || {}), day_type: entry?.day_type ?? 'work' };
  const v = rawValue == null ? '' : String(rawValue).trim();
  const codeMap = { f: 'off', F: 'off' };
  DAY_TYPES.filter(d => d.key !== 'work').forEach(d => { codeMap[d.key] = d.key; });
  const matched = codeMap[v];

  if (matched) {
    patch.day_type  = matched;
    patch.plan_val  = null;
    patch.ot_val    = null;
    patch.check_val = null;
  } else {
    if (patch.day_type !== 'work') patch.day_type = 'work';
    if (rowType === 'plan')  patch.plan_val  = v === '' ? null : normalizeTimeInput(v);
    if (rowType === 'ot')    patch.ot_val    = v === '' ? null : v;
    if (rowType === 'check') patch.check_val = v === '' ? null : normalizeTimeInput(v);
  }

  return patch;
}

function parseClipboardTable(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((row, idx, arr) => row !== '' || idx < arr.length - 1)
    .map(row => row.split('\t'));
}

// ── EditCell ──────────────────────────────────────────────────────────────────

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
    <span className="cell-val"
      onDoubleClick={() => { if (!disabled) { setDraft(value ?? ''); setEditing(true); } }}>
      {display}
    </span>
  );
}

// ── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({ rowType, entry, date, empId, cycleId, onUpdate, todayClass, onMenu, onPasteBlock }) {
  const dayType  = entry?.day_type ?? 'work';
  const isWork   = dayType === 'work';
  const dtInfo   = DAY_TYPES.find(d => d.key === dayType);

  function handleContextMenu(e) {
    e.preventDefault();
    if (rowType !== 'plan' && rowType !== 'check') return;
    onMenu(e.clientX, e.clientY, dayType, (newType) => {
      onUpdate(cycleId, empId, date, { ...(entry || {}), day_type: newType });
    });
  }

  function handleSave(val) {
    onUpdate(cycleId, empId, date, patchForCell(entry, rowType, val));
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || !onPasteBlock) return;
    const rows = parseClipboardTable(text);
    if (rows.length === 0) return;
    e.preventDefault();
    onPasteBlock(rows);
  }

  // Mismatch detection (check row)
  const planMin  = rowType === 'check' ? parseTimeMin(entry?.plan_val)  : null;
  const checkMin = rowType === 'check' ? parseTimeMin(entry?.check_val) : null;
  const mismatch = planMin != null && checkMin != null && planMin !== checkMin;
  const isLate   = mismatch && checkMin > planMin;
  const isEarly  = mismatch && checkMin < planMin;

  let cellClass = 'day-work';
  if (!isWork)       cellClass = `day-${dayType}`;
  if (isWork && isLate)  cellClass = 'day-late';
  if (isWork && isEarly) cellClass = 'day-early';

  const val = rowType === 'plan' ? entry?.plan_val : rowType === 'ot' ? entry?.ot_val : entry?.check_val;

  return (
    <td className={`${cellClass} ${todayClass}`} onContextMenu={handleContextMenu} onPaste={handlePaste} tabIndex={0}>
      {!isWork && (rowType === 'plan' || rowType === 'check')
        ? <span style={{ fontSize: 10, fontWeight: 700 }}>{dayType === 'off' ? 'F' : dayType}</span>
        : <EditCell value={val} onSave={handleSave} disabled={!isWork} isTime={rowType !== 'ot'} />
      }
    </td>
  );
}

// ── EmployeeBlock ─────────────────────────────────────────────────────────────

function EmployeeBlock({ emp, dates, entries, cycleId, onUpdate, isLast, today, onMenu, rowBaseIndex, onPasteBlock }) {
  const planCount  = dates.filter(d => entries[dateKey(d)]?.plan_val  && entries[dateKey(d)]?.day_type !== 'off').length;
  const checkCount = dates.filter(d => entries[dateKey(d)]?.check_val && entries[dateKey(d)]?.day_type !== 'off').length;
  const otTotal    = dates.reduce((sum, d) => sum + parseOtHours(entries[dateKey(d)]?.ot_val), 0);

  let mismatch = 0;
  for (const d of dates) {
    const e = entries[dateKey(d)];
    if (!e || e.day_type === 'off') continue;
    const pm = parseTimeMin(e.plan_val), cm = parseTimeMin(e.check_val);
    if (pm != null && cm != null && pm !== cm) mismatch++;
  }

  const totals = {
    plan:  planCount  > 0 ? `${planCount} วัน` : '',
    ot:    formatHours(otTotal),
    check: mismatch   > 0 ? `ไม่ตรง ${mismatch}` : checkCount > 0 ? `✓ ${checkCount}` : '',
  };

  const totalStyle = {
    plan:  { color: '#555' },
    ot:    otTotal > 0 ? { color: '#334155', fontWeight: 700 } : {},
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

          {idx === 0 && <td rowSpan={3} className="col-sticky-0 emp-id-cell">{emp.id}</td>}
          {idx === 0 && <td rowSpan={3} className="col-sticky-1 emp-name-cell">{emp.name}</td>}

          {idx === 0 && (
            <td className="col-sticky-2" style={{ textAlign: 'center' }}>
              <span className="position-badge">{emp.position}</span>
            </td>
          )}
          {idx === 1 && <td className="col-sticky-2 emp-phone-cell">{emp.phone || ''}</td>}
          {idx === 2 && <td className="col-sticky-2" />}

          <td className="col-sticky-3 row-label-cell">
            {idx === 0
              ? <span className="nickname-cell">{emp.nickname || ''}</span>
              : <span style={{ color: '#555' }}>{rt.label}</span>
            }
          </td>

          {dates.map((d, di) => {
            const dk = dateKey(d);
            const isToday = dk === today;
            // Frame: top cell of column / bottom cell / middle
            const totalRows = ROW_TYPES.length; // 3
            let tc = '';
            if (isToday) {
              if (idx === 0 && isLast && totalRows === 1) tc = 'td-today-col';
              else if (idx === 0) tc = 'td-today-col-top';
              else if (idx === totalRows - 1 && isLast) tc = 'td-today-col-bot';
              else tc = 'td-today-col';
            }
            return (
              <DayCell key={dk} rowType={rt.key} entry={entries[dk]}
                date={dk} empId={emp.id} cycleId={cycleId}
                onUpdate={onUpdate} todayClass={tc} onMenu={onMenu}
                onPasteBlock={rows => onPasteBlock(rowBaseIndex + idx, di, rows)} />
            );
          })}

          <td className="col-total" style={{ fontSize: 10, ...totalStyle[rt.key] }}>
            {totals[rt.key]}
          </td>
        </tr>
      ))}
    </>
  );
}

// ── BranchTable ───────────────────────────────────────────────────────────────

function BranchTable({ branchEmps, dates, entries, cycleId, onUpdate, today, onMenu }) {
  const monthSpans = [];
  let cur = null;
  for (const d of dates) {
    const lbl = `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!cur || cur.label !== lbl) { cur = { label: lbl, count: 0 }; monthSpans.push(cur); }
    cur.count++;
  }

  function handlePasteBlock(startRow, startCol, pastedRows) {
    const gridRows = branchEmps.flatMap(emp => ROW_TYPES.map(rt => ({ emp, rowType: rt.key })));

    pastedRows.forEach((cells, rOffset) => {
      const targetRow = gridRows[startRow + rOffset];
      if (!targetRow) return;

      cells.forEach((value, cOffset) => {
        const targetDate = dates[startCol + cOffset];
        if (!targetDate) return;
        const dk = dateKey(targetDate);
        const currentEntry = entries[targetRow.emp.id]?.[dk];
        const patch = patchForCell(currentEntry, targetRow.rowType, value);
        onUpdate(cycleId, targetRow.emp.id, dk, patch);
      });
    });
  }

  return (
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
              const isWE    = dow === 0 || dow === 6;
              const isToday = dk === today;
              return (
                <th key={dk} className={isToday ? 'th-today' : isWE ? 'th-weekend' : ''}
                  style={{ minWidth: 36 }}>
                  <div>{d.getDate()}</div>
                  <div style={{ fontSize: 9, opacity: 0.8 }}>{THAI_DAYS[dow]}</div>
                </th>
              );
            })}
            <th className="col-total-header">รวม</th>
          </tr>
        </thead>
        <tbody>
          {branchEmps.map((emp, idx) => (
            <EmployeeBlock
              key={emp.id} emp={emp} dates={dates}
              entries={entries[emp.id] || {}} cycleId={cycleId}
              onUpdate={onUpdate} isLast={idx === branchEmps.length - 1}
              today={today} onMenu={onMenu}
              rowBaseIndex={idx * ROW_TYPES.length}
              onPasteBlock={handlePasteBlock}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Leave Summary Panel ───────────────────────────────────────────────────────

function LeaveSummaryPanel({ entries, employees }) {
  const typeTotals = {};
  const empTotals  = {};

  for (const emp of employees) {
    empTotals[emp.id] = {};
    const empEntries = entries[emp.id] || {};
    for (const dk of Object.keys(empEntries)) {
      const dt = empEntries[dk]?.day_type;
      if (dt && dt !== 'work') {
        typeTotals[dt] = (typeTotals[dt] || 0) + 1;
        empTotals[emp.id][dt] = (empTotals[emp.id][dt] || 0) + 1;
      }
    }
  }

  const activeDayTypes = DAY_TYPES.filter(dt => dt.key !== 'work' && typeTotals[dt.key]);
  const empsWithLeave  = employees.filter(emp => Object.keys(empTotals[emp.id] || {}).length > 0);

  return (
    <div className="leave-summary-panel">
      <div className="leave-summary-header">📊 สรุปวันลา</div>

      {/* Overall totals */}
      <div className="leave-summary-section">
        <div className="leave-summary-section-label">รวมทุกประเภท</div>
        {activeDayTypes.length === 0
          ? <div className="leave-summary-empty">ไม่มีข้อมูลวันลา</div>
          : activeDayTypes.map(dt => (
            <div key={dt.key} className="leave-summary-row">
              <span className="leave-summary-badge"
                style={{ background: dt.color || '#eef2ff' }}>
                {dt.key === 'off' ? 'F' : dt.key}
              </span>
              <span className="leave-summary-type-label">{dt.label}</span>
              <span className="leave-summary-count">{typeTotals[dt.key]}</span>
            </div>
          ))
        }
      </div>

      {/* Per employee */}
      {empsWithLeave.length > 0 && (
        <div className="leave-summary-section">
          <div className="leave-summary-section-label">รายบุคคล</div>
          {empsWithLeave.map(emp => (
            <div key={emp.id} className="leave-emp-row">
              <div className="leave-emp-name">{emp.nickname || emp.name.split(' ')[0]}</div>
              <div className="leave-emp-tags">
                {DAY_TYPES.filter(dt => dt.key !== 'work' && empTotals[emp.id]?.[dt.key]).map(dt => (
                  <span key={dt.key} className="leave-emp-tag"
                    style={{ background: dt.color || '#eef2ff' }}>
                    {dt.key === 'off' ? 'F' : dt.key}:{empTotals[emp.id][dt.key]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TAView({ data, onRefresh }) {
  const [collapsed, setCollapsed] = useState({});
  const [local, setLocal]         = useState({});
  const [menu, setMenu]           = useState(null); // { x, y, current, onSelect }

  const openMenu = useCallback((x, y, current, onSelect) => {
    setMenu({ x, y, current, onSelect });
  }, []);

  useEffect(() => {
    if (data?.entries) setLocal(data.entries);
  }, [data?.entries]);

  const topBar = (
    <div className="ta-topbar">
      <div className="ta-topbar-title">
        <strong>TA Management</strong>
        <span>{data?.cycle?.label || '21 – 20 รอบตาราง'}</span>
      </div>
    </div>
  );

  if (!data) return (
    <div>
      {topBar}
      <div className="empty-state">
        <h3>เลือกรอบตารางงาน</h3>
        <p>เลือกรอบที่ต้องการจากแถบซ้าย หรือกด "+ สร้างรอบใหม่"</p>
      </div>
    </div>
  );

  const { cycle, employees } = data;
  const dates = getCycleDates(cycle.start_date);
  const today = new Date().toISOString().split('T')[0];

  // Group by branch
  const branches = {};
  for (const emp of employees) {
    const br = emp.branch?.trim() || 'ไม่ระบุสาขา';
    if (!branches[br]) branches[br] = [];
    branches[br].push(emp);
  }

  async function handleUpdate(cycleId, empId, date, patch) {
    setLocal(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), [date]: { ...((prev[empId] || {})[date] || {}), ...patch } },
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

  function toggleBranch(br) {
    setCollapsed(p => ({ ...p, [br]: !p[br] }));
  }

  if (employees.length === 0) return (
    <div>
      {topBar}
      <div className="empty-state">
        <h3>ยังไม่มีพนักงานในรอบนี้</h3>
        <p>เพิ่มพนักงานในแท็บ "พนักงาน" หรือ Sync จาก Manpower</p>
      </div>
    </div>
  );

  return (
    <div>
      {topBar}

      {/* Day type context menu */}
      {menu && (
        <DayTypeMenu
          x={menu.x} y={menu.y} current={menu.current}
          onSelect={menu.onSelect}
          onClose={() => setMenu(null)}
        />
      )}

      {/* Branch sections */}
      {Object.entries(branches).map(([branch, emps]) => (
        <div key={branch} className="branch-section">
          <div className="branch-header" onClick={() => toggleBranch(branch)}>
            <span style={{ fontSize: 15 }}>🏪</span>
            <h3>{branch}</h3>
            <span className="branch-badge">{emps.length} คน</span>
            <button className="branch-collapse-btn" tabIndex={-1}>
              {collapsed[branch] ? '▶' : '▼'}
            </button>
          </div>
          {!collapsed[branch] && (
            <BranchTable
              branchEmps={emps} dates={dates}
              entries={local} cycleId={cycle.id}
              onUpdate={handleUpdate} today={today} onMenu={openMenu}
            />
          )}
        </div>
      ))}
    </div>
  );
}
