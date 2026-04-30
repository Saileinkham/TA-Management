import React, { useEffect, useState } from 'react';
import { fetchStats } from '../api.js';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${THAI_MONTHS[dt.getMonth()]}`;
}

function fmtDateShort(d) {
  const dt = new Date(d + 'T00:00:00');
  return String(dt.getDate()).padStart(2, '0');
}

function DotCell({ d, todayStr }) {
  const isToday = d.date === todayStr;
  let cls = 'dot-none', symbol = '—';
  if (d.dayType === 'off') { cls = 'dot-off'; symbol = 'F'; }
  else if (d.match === 'ok')    { cls = 'dot-ok';    symbol = '✓';  }
  else if (d.match === 'late')  { cls = 'dot-late';  symbol = '!';  }
  else if (d.match === 'early') { cls = 'dot-early'; symbol = '↑';  }

  const title = d.dayType === 'off'
    ? `${fmtDate(d.date)} — หยุด`
    : `${fmtDate(d.date)}${d.plan ? ` | Plan: ${d.plan}` : ''}${d.check ? ` | Check: ${d.check}` : ''}`;

  return (
    <div
      className={`check-day-dot ${cls} ${isToday ? 'dot-today' : ''}`}
      title={title}
    >
      <span>{fmtDateShort(d.date)}</span>
      <span style={{ fontSize: 8 }}>{symbol}</span>
    </div>
  );
}

function EmpCard({ emp, todayStr, defaultExpand }) {
  const [open, setOpen] = useState(defaultExpand || false);

  const hasData   = emp.workDays > 0 || emp.offDays > 0;
  const allMatch  = emp.mismatchDays === 0 && emp.details?.some(d => d.check);
  const noTA      = !emp.details?.some(d => d.check) && emp.workDays > 0;
  const status    = !hasData ? 'no-data' : noTA ? 'no-ta' : allMatch ? 'ok' : 'mismatch';

  const theme = {
    ok:        { border: '#27ae60', bg: '#f0fff4', label: '✓ ตรงตามแผน',      color: '#27ae60' },
    mismatch:  { border: '#e74c3c', bg: '#fff5f5', label: '✗ ไม่ตรงแผน',      color: '#e74c3c' },
    'no-ta':   { border: '#f39c12', bg: '#fffaf0', label: '⚠ ยังไม่บันทึก TA', color: '#f39c12' },
    'no-data': { border: '#ccc',    bg: '#fafafa', label: '— ไม่มีข้อมูล',     color: '#aaa'    },
  }[status];

  return (
    <div className="emp-check-card" style={{ borderLeftColor: theme.border, background: theme.bg }}>
      <div className="emp-check-header" onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <span className="emp-check-name">{emp.name}</span>
          {emp.nickname && <span className="emp-check-nick">({emp.nickname})</span>}
          <span className="position-badge" style={{ marginLeft: 8 }}>{emp.position}</span>
        </div>

        {/* Summary stats */}
        <div className="emp-check-stats">
          <span>ทำงาน <strong>{emp.workDays}</strong> วัน</span>
          <span style={{ color: '#e74c3c' }}>หยุด <strong>{emp.offDays}</strong> วัน</span>
          {emp.lateDays    > 0 && <span style={{ color: '#bf360c' }}>สาย <strong>{emp.lateDays}</strong> วัน</span>}
          {emp.earlyDays   > 0 && <span style={{ color: '#1565c0' }}>เข้าก่อน <strong>{emp.earlyDays}</strong> วัน</span>}
          {noTA && <span style={{ color: '#f39c12' }}>ไม่มี TA <strong>{emp.workDays}</strong> วัน</span>}
        </div>

        <div className="emp-check-status" style={{ color: theme.color }}>
          {theme.label}
          {emp.mismatchDays > 0 && ` (${emp.mismatchDays} วัน)`}
        </div>
        <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div>
          {/* Day dot grid */}
          <div className="check-day-grid">
            {emp.allDates?.map(d => (
              <DotCell key={d.date} d={d} todayStr={todayStr} />
            ))}
          </div>

          {/* Mismatch detail table */}
          {emp.details?.filter(d => d.match && d.match !== 'ok').length > 0 && (
            <div style={{ padding: '0 14px 12px' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>วันที่</th>
                    <th style={{ padding: '4px 8px', textAlign: 'center' }}>ตาราง (Plan)</th>
                    <th style={{ padding: '4px 8px', textAlign: 'center' }}>OT</th>
                    <th style={{ padding: '4px 8px', textAlign: 'center' }}>Check (จริง)</th>
                    <th style={{ padding: '4px 8px', textAlign: 'center' }}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.details.filter(d => d.match && d.match !== 'ok').map(d => (
                    <tr key={d.date}
                      style={{ background: d.match === 'late' ? '#ffebee' : '#e3f2fd' }}>
                      <td style={{ padding: '3px 8px', fontWeight: 700 }}>{fmtDate(d.date)}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>{d.plan ?? '—'}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center', color: '#f39c12' }}>{d.ot ?? ''}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>{d.check ?? '—'}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'center', fontWeight: 700,
                        color: d.match === 'late' ? '#e74c3c' : '#1565c0' }}>
                        {d.match === 'late' ? '⚠ สาย' : '↑ เข้าก่อน'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Leave / off summary */}
          {(emp.offDays > 0) && (
            <div style={{ padding: '0 14px 12px', fontSize: 11, color: '#888' }}>
              <strong>วันหยุด:</strong>{' '}
              {emp.allDates?.filter(d => d.dayType === 'off').map(d => fmtDate(d.date)).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CheckTAView({ cycleId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    fetchStats(cycleId).then(d => { setData(d); setLoading(false); });
  }, [cycleId]);

  if (!cycleId) return (
    <div className="empty-state"><h3>เลือกรอบตารางงาน</h3><p>เลือกรอบที่ต้องการจากแถบซ้าย</p></div>
  );
  if (loading) return <div style={{ padding: 20, color: '#888' }}>กำลังโหลด...</div>;
  if (!data)   return null;

  const { cycle, summary } = data;

  const totalOK       = summary.filter(e => e.mismatchDays === 0 && e.details?.some(d => d.check)).length;
  const totalMismatch = summary.filter(e => e.mismatchDays > 0).length;
  const totalNoTA     = summary.filter(e => e.workDays > 0 && !e.details?.some(d => d.check)).length;

  // Group by branch
  const branches = {};
  for (const emp of summary) {
    const br = emp.branch?.trim() || 'ไม่ระบุสาขา';
    if (!branches[br]) branches[br] = [];
    branches[br].push(emp);
  }

  return (
    <div className="check-ta-wrapper">
      {/* Summary bar */}
      <div className="check-ta-summary-bar">
        {[
          { label: 'ตรงตามแผน',         val: totalOK,       color: '#27ae60' },
          { label: 'ไม่ตรง / สาย',      val: totalMismatch, color: '#e74c3c' },
          { label: 'ยังไม่บันทึก TA',   val: totalNoTA,     color: '#f39c12' },
          { label: 'รวมพนักงาน',        val: summary.length, color: '#555'   },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
            <div className="val" style={{ color: s.color }}>{s.val}</div>
            <div className="lbl">{s.label}</div>
          </div>
        ))}

        {/* Legend dots */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '10px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: 11, display: 'flex',
          flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { cls: 'dot-ok',    label: '✓ ตรง'      },
              { cls: 'dot-late',  label: '! สาย'       },
              { cls: 'dot-early', label: '↑ เข้าก่อน' },
              { cls: 'dot-none',  label: '— ไม่มี TA'  },
              { cls: 'dot-off',   label: 'หยุด'        },
            ].map(l => (
              <div key={l.cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div className={`check-day-dot ${l.cls}`}
                  style={{ width: 20, height: 20, fontSize: 9 }}>{l.label.slice(0,1)}</div>
                <span style={{ color: '#666' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cycle label */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '10px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '3px solid #1a1a2e', flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>
            {cycle.label || `${cycle.start_date} – ${cycle.end_date}`}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>รอบตาราง</div>
        </div>
      </div>

      {/* Employee cards — grouped by branch */}
      {Object.entries(branches).map(([branch, emps]) => (
        <div key={branch} style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 8, paddingLeft: 4,
          }}>
            <span style={{ fontSize: 16 }}>🏪</span>
            <strong style={{ fontSize: 14 }}>{branch}</strong>
            <span style={{ fontSize: 11, color: '#888' }}>{emps.length} คน</span>
          </div>
          {emps.map(emp => (
            <EmpCard key={emp.id} emp={emp} todayStr={todayStr} />
          ))}
        </div>
      ))}
    </div>
  );
}
