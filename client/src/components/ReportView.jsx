import React, { useEffect, useState } from 'react';
import { fetchStats } from '../api.js';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${THAI_MONTHS[dt.getMonth()]}`;
}

function StatusBadge({ match }) {
  if (match == null)     return <span style={{ color: '#bbb', fontSize: 11 }}>—</span>;
  if (match === 'ok')    return <span style={{ color: '#27ae60', fontWeight: 700, fontSize: 11 }}>✓ ตรง</span>;
  if (match === 'late')  return <span style={{ color: '#e74c3c', fontWeight: 700, fontSize: 11 }}>⚠ สาย</span>;
  if (match === 'early') return <span style={{ color: '#2196f3', fontWeight: 700, fontSize: 11 }}>↑ เข้าก่อน</span>;
  return <span style={{ color: '#e74c3c', fontWeight: 700, fontSize: 11 }}>✗ ไม่ตรง</span>;
}

export default function ReportView({ cycleId }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    fetchStats(cycleId).then(d => { setData(d); setLoading(false); });
  }, [cycleId]);

  if (!cycleId) return <div className="empty-state"><h3>เลือกรอบตารางงาน</h3></div>;
  if (loading)  return <div style={{ padding: 20, color: '#888' }}>กำลังโหลด...</div>;
  if (!data)    return null;

  const { cycle, summary } = data;

  const totalOK      = summary.filter(e => e.mismatchDays === 0 && e.workDays > 0).length;
  const totalMismatch = summary.filter(e => e.mismatchDays > 0).length;
  const totalNoTA    = summary.filter(e => e.workDays > 0 && e.totalTA === 0).length;

  function toggle(id) { setExpanded(p => ({ ...p, [id]: !p[id] })); }

  return (
    <div style={{ padding: 20 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'ตรงตามแผน',          val: totalOK,       color: '#27ae60' },
          { label: 'ไม่ตรง/สาย',       val: totalMismatch, color: '#e74c3c' },
          { label: 'ยังไม่บันทึก Check', val: totalNoTA,   color: '#f39c12' },
          { label: 'รวมพนักงาน',        val: summary.length, color: '#555' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: 10, padding: '12px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 120,
            borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{
          background: '#fff', borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 180,
          borderTop: '3px solid #1a1a2e', flex: 1,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
            {cycle.label || `${cycle.start_date} – ${cycle.end_date}`}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>รอบตาราง</div>
        </div>
      </div>

      {/* Employee cards */}
      {summary.map(emp => {
        const hasData  = emp.workDays > 0;
        const allMatch = emp.mismatchDays === 0 && emp.details?.some(d => d.check);
        const noTA     = !emp.details?.some(d => d.check) && emp.workDays > 0;
        const status   = !hasData ? 'no-data' : noTA ? 'no-ta' : allMatch ? 'ok' : 'mismatch';

        const statusColors = {
          ok:       { border: '#27ae60', bg: '#f0fff4', label: '✓ ตรงตามแผน',   color: '#27ae60' },
          mismatch: { border: '#e74c3c', bg: '#fff5f5', label: '✗ ไม่ตรงแผน',   color: '#e74c3c' },
          'no-ta':  { border: '#f39c12', bg: '#fffaf0', label: '⚠ ยังไม่บันทึก TA', color: '#f39c12' },
          'no-data':{ border: '#ccc',    bg: '#fafafa', label: '— ไม่มีข้อมูล', color: '#aaa' },
        }[status];

        const mismatchDetails = emp.details?.filter(d => d.match && d.match !== 'ok') || [];

        return (
          <div key={emp.id} style={{
            background: statusColors.bg,
            border: `1px solid ${statusColors.border}`,
            borderLeft: `4px solid ${statusColors.border}`,
            borderRadius: 8,
            marginBottom: 10,
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
              onClick={() => toggle(emp.id)}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</span>
                {emp.nickname && <span style={{ color: '#e94560', fontSize: 11, marginLeft: 6 }}>({emp.nickname})</span>}
                <span className="position-badge" style={{ marginLeft: 8 }}>{emp.position}</span>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span>ทำงาน <strong>{emp.workDays}</strong> วัน</span>
                <span>หยุด <strong>{emp.offDays}</strong> วัน</span>
                {emp.mismatchDays > 0 && <span style={{ color: '#e74c3c' }}>ไม่ตรง <strong>{emp.mismatchDays}</strong> วัน</span>}
                {emp.lateDays > 0 && <span style={{ color: '#f39c12' }}>สาย <strong>{emp.lateDays}</strong> วัน</span>}
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: statusColors.color, minWidth: 110 }}>
                {statusColors.label}
                {emp.mismatchDays > 0 && ` (${emp.mismatchDays} วัน)`}
              </div>
              <div style={{ color: '#aaa', fontSize: 12 }}>{expanded[emp.id] ? '▲' : '▼'}</div>
            </div>

            {/* Expanded detail */}
            {expanded[emp.id] && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid #e0e0e0' }}>
                {emp.details?.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#aaa', paddingTop: 10 }}>ยังไม่มีข้อมูล</div>
                ) : (
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginTop: 10 }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>วันที่</th>
                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>Plan (ตาราง)</th>
                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>OT</th>
                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>Check (จริง)</th>
                        <th style={{ padding: '4px 8px', textAlign: 'center' }}>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emp.details.map((d, i) => (
                        <tr
                          key={d.date}
                          style={{
                            background: d.match === 'late' ? '#ffebee' : d.match === 'early' ? '#e3f2fd' : i % 2 === 0 ? '#fff' : '#fafafa',
                          }}
                        >
                          <td style={{ padding: '3px 8px', fontWeight: d.match && d.match !== 'ok' ? 700 : 400 }}>{fmtDate(d.date)}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'center' }}>{d.plan ?? '—'}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'center', color: '#f39c12' }}>{d.ot ?? ''}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'center' }}>{d.check ?? '—'}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                            <StatusBadge match={d.match} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {mismatchDetails.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#ffebee', borderRadius: 6, fontSize: 11 }}>
                    <strong style={{ color: '#e74c3c' }}>วันที่ไม่ตรงแผน:</strong>{' '}
                    {mismatchDetails.map(d =>
                      `${fmtDate(d.date)} (Plan ${d.plan} / Check ${d.check}) → ${d.match === 'late' ? 'สาย' : 'เข้าก่อน'}`
                    ).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
