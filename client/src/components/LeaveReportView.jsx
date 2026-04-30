import React, { useEffect, useState } from 'react';
import { fetchStats } from '../api.js';
import { DAY_TYPES } from './TAView.jsx';

const LEAVE_TYPES = DAY_TYPES.filter(d => d.key !== 'work');

// ── helpers ───────────────────────────────────────────────────────────────────

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${THAI_MONTHS[dt.getMonth()]}`;
}

function displayCode(key) {
  return key === 'off' ? 'F' : key;
}

// ── Summary card at the top ───────────────────────────────────────────────────

function TopSummary({ totals }) {
  const hasCounts = LEAVE_TYPES.filter(dt => totals[dt.key] > 0);
  if (hasCounts.length === 0) return null;

  return (
    <div className="lr-top-summary">
      {hasCounts.map(dt => (
        <div key={dt.key} className="lr-summary-card" style={{ borderTop: `3px solid ${dt.color}` }}>
          <div className="lr-summary-badge" style={{ background: dt.color }}>
            {displayCode(dt.key)}
          </div>
          <div className="lr-summary-label">{dt.label}</div>
          <div className="lr-summary-count" style={{ color: dt.color }}>{totals[dt.key]}</div>
          <div className="lr-summary-unit">วัน</div>
        </div>
      ))}
    </div>
  );
}

// ── Per-employee row in the table ─────────────────────────────────────────────

function EmpLeaveRow({ emp, activeTypes }) {
  const [open, setOpen] = useState(false);

  // collect dates per type
  const typeMap = {};
  for (const d of emp.allDates || []) {
    const dt = d.dayType;
    if (!dt || dt === 'work') continue;
    if (!typeMap[dt]) typeMap[dt] = [];
    typeMap[dt].push(d.date);
  }

  const hasLeave = Object.keys(typeMap).length > 0;

  return (
    <>
      <tr
        className={`lr-emp-row ${hasLeave ? 'has-leave' : 'no-leave'}`}
        onClick={() => hasLeave && setOpen(o => !o)}
        style={{ cursor: hasLeave ? 'pointer' : 'default' }}
      >
        <td className="lr-td-name">
          <span className="lr-name">{emp.name}</span>
          {emp.nickname && <span className="lr-nick">({emp.nickname})</span>}
        </td>
        <td className="lr-td-pos">
          <span className="position-badge">{emp.position}</span>
        </td>
        {activeTypes.map(dt => {
          const days = typeMap[dt.key];
          return (
            <td key={dt.key} className="lr-td-count">
              {days?.length > 0 && (
                <span className="lr-count-badge" style={{ background: dt.color }}>
                  {days.length}
                </span>
              )}
            </td>
          );
        })}
        <td className="lr-td-total">
          {hasLeave
            ? <span style={{ fontWeight: 700, color: '#e74c3c' }}>{Object.values(typeMap).flat().length}</span>
            : <span style={{ color: '#bbb' }}>—</span>
          }
        </td>
        {hasLeave && (
          <td className="lr-td-toggle">{open ? '▲' : '▼'}</td>
        )}
        {!hasLeave && <td />}
      </tr>

      {/* Detail row — date list per type */}
      {open && (
        <tr className="lr-detail-row">
          <td colSpan={activeTypes.length + 4}>
            <div className="lr-detail-inner">
              {LEAVE_TYPES.filter(dt => typeMap[dt.key]?.length > 0).map(dt => (
                <div key={dt.key} className="lr-detail-type">
                  <span className="lr-detail-badge" style={{ background: dt.color }}>
                    {displayCode(dt.key)} {dt.label}
                  </span>
                  <div className="lr-detail-dates">
                    {typeMap[dt.key].map(date => (
                      <span key={date} className="lr-date-chip">{fmtDate(date)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Branch section ────────────────────────────────────────────────────────────

function BranchLeaveTable({ branch, emps, activeTypes }) {
  return (
    <div className="lr-branch-block">
      <div className="lr-branch-header">
        <span>🏪</span>
        <strong>{branch}</strong>
        <span className="lr-branch-count">{emps.length} คน</span>
      </div>

      <div className="lr-table-wrap">
        <table className="lr-table">
          <thead>
            <tr>
              <th className="lr-th-name">ชื่อ-นามสกุล</th>
              <th className="lr-th-pos">ตำแหน่ง</th>
              {activeTypes.map(dt => (
                <th key={dt.key} className="lr-th-type">
                  <div className="lr-th-badge" style={{ background: dt.color }}>
                    {displayCode(dt.key)}
                  </div>
                  <div className="lr-th-type-label">{dt.label}</div>
                </th>
              ))}
              <th className="lr-th-total">รวม</th>
              <th style={{ width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {emps.map(emp => (
              <EmpLeaveRow key={emp.id} emp={emp} activeTypes={activeTypes} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LeaveReportView({ cycleId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    fetchStats(cycleId).then(d => { setData(d); setLoading(false); });
  }, [cycleId]);

  if (!cycleId) return (
    <div className="empty-state">
      <h3>เลือกรอบตารางงาน</h3>
      <p>เลือกรอบที่ต้องการจากแถบซ้าย</p>
    </div>
  );
  if (loading) return <div style={{ padding: 24, color: '#888' }}>กำลังโหลด...</div>;
  if (!data)   return null;

  const { cycle, summary } = data;

  // Compute global totals
  const totals = {};
  for (const emp of summary) {
    for (const d of emp.allDates || []) {
      const dt = d.dayType;
      if (dt && dt !== 'work') totals[dt] = (totals[dt] || 0) + 1;
    }
  }

  // Which leave types actually appear in this cycle?
  const activeTypes = LEAVE_TYPES.filter(dt => totals[dt.key] > 0);

  // Group by branch
  const branches = {};
  for (const emp of summary) {
    const br = emp.branch?.trim() || 'ไม่ระบุสาขา';
    if (!branches[br]) branches[br] = [];
    branches[br].push(emp);
  }

  const cycleLabel = cycle.label || `${cycle.start_date} – ${cycle.end_date}`;

  return (
    <div className="lr-wrapper">
      {/* Header */}
      <div className="lr-page-header">
        <div>
          <h2 className="lr-page-title">📊 รายงานการลา</h2>
          <div className="lr-page-sub">{cycleLabel}</div>
        </div>
      </div>

      {/* Top summary cards */}
      <div style={{ padding: '12px 20px 0' }}>
        <TopSummary totals={totals} />
      </div>

      {/* No leave data */}
      {activeTypes.length === 0 && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <h3>ไม่มีข้อมูลวันลา</h3>
          <p>ยังไม่มีการบันทึกวันลาในรอบนี้</p>
        </div>
      )}

      {/* Branch tables */}
      {activeTypes.length > 0 && (
        <div style={{ padding: '12px 20px 40px' }}>
          {Object.entries(branches).map(([branch, emps]) => (
            <BranchLeaveTable
              key={branch}
              branch={branch}
              emps={emps}
              activeTypes={activeTypes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
