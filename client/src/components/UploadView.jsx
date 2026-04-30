import React, { useState, useEffect, useRef } from 'react';
import { fetchFiles, deleteFile, importExcel, createCycle, fetchCycles } from '../api.js';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function cycleLabel(c) {
  if (c.label) return c.label;
  const s = new Date(c.start_date + 'T00:00:00');
  const e = new Date(c.end_date   + 'T00:00:00');
  return `21 ${THAI_MONTHS[s.getMonth()]} – 20 ${THAI_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ cycles, onClose, onDone }) {
  const [cycleId, setCycleId]   = useState(cycles[0]?.id || '');
  const [branch, setBranch]     = useState('');
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Create new cycle inline
  const today = new Date();
  const [newCycleStart, setNewCycleStart] = useState(
    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-21`
  );
  const [newCycleLabel, setNewCycleLabel] = useState('');
  const [showNewCycle, setShowNewCycle]   = useState(cycles.length === 0);
  const [creating, setCreating]           = useState(false);

  const fileRef = useRef();

  async function handleCreateCycle() {
    if (!newCycleStart) return;
    setCreating(true);
    try {
      const res = await createCycle({ start_date: newCycleStart, label: newCycleLabel });
      const fresh = await fetchCycles();
      setCycleId(String(res.id));
      setShowNewCycle(false);
      onDone(null, fresh); // refresh cycle list without closing modal
    } catch (e) { setError(e.message); }
    finally { setCreating(false); }
  }

  async function handleUpload() {
    if (!cycleId) { setError('กรุณาเลือกรอบ'); return; }
    if (!file)    { setError('กรุณาเลือกไฟล์ Excel'); return; }
    setLoading(true); setError('');
    try {
      const res = await importExcel(cycleId, file, branch);
      if (res.error) { setError(res.error); }
      else           { onDone(res); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <h2>📤 อัพโหลดไฟล์ตารางงาน</h2>

        {/* Step 1: Select cycle / month */}
        <div className="upload-step">
          <div className="upload-step-title">
            <span className="upload-step-num">1</span> เลือกรอบ / เดือน
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>รอบตารางงาน</label>
            <select value={cycleId} onChange={e => setCycleId(e.target.value)}>
              <option value="">— เลือกรอบ —</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{cycleLabel(c)}</option>
              ))}
            </select>
          </div>
          {!showNewCycle ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewCycle(true)}>
              + สร้างรอบใหม่
            </button>
          ) : (
            <div style={{ border: '1px dashed #ccc', borderRadius: 6, padding: 12, marginTop: 6 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>สร้างรอบใหม่</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>วันเริ่มต้น (วันที่ 21)</label>
                  <input type="date" value={newCycleStart} onChange={e => setNewCycleStart(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 12 }} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 3 }}>ชื่อรอบ (ไม่บังคับ)</label>
                  <input value={newCycleLabel} onChange={e => setNewCycleLabel(e.target.value)}
                    placeholder="เช่น เม.ย.–พ.ค. 2026"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 12 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleCreateCycle} disabled={creating || !newCycleStart}>
                  {creating ? 'กำลังสร้าง...' : 'สร้างรอบ'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewCycle(false)}>ยกเลิก</button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Branch */}
        <div className="upload-step">
          <div className="upload-step-title">
            <span className="upload-step-num">2</span> ระบุสาขา
            <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>(ไม่บังคับ)</span>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>ชื่อสาขา</label>
            <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="เช่น สาขา 1, บางนา, สยาม" />
          </div>
        </div>

        {/* Step 3: File */}
        <div className="upload-step">
          <div className="upload-step-title">
            <span className="upload-step-num">3</span> เลือกไฟล์ Excel
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0] || null)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              📂 เลือกไฟล์
            </button>
            {file
              ? <span style={{ fontSize: 12, color: '#27ae60' }}>✓ {file.name}</span>
              : <span style={{ fontSize: 12, color: '#aaa' }}>ยังไม่ได้เลือกไฟล์</span>
            }
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            รองรับไฟล์ .xlsx / .xls — แถวพนักงานต้องมีรหัสตัวเลข 5-8 หลัก และมีแถววันที่ที่มีเลข 1-31
          </div>
        </div>

        {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>⚠ {error}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleUpload}
            disabled={loading || !cycleId || !file}>
            {loading ? 'กำลังนำเข้า...' : '📥 นำเข้าข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function UploadView({ cycles: initCycles, onImportDone }) {
  const [files, setFiles]       = useState([]);
  const [cycles, setCycles]     = useState(initCycles || []);
  const [loading, setLoading]   = useState(false);
  const [showModal, setModal]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast]       = useState('');

  useEffect(() => { setCycles(initCycles || []); }, [initCycles]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function loadFiles() {
    setLoading(true);
    try { setFiles(await fetchFiles()); }
    catch { setFiles([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadFiles(); }, []);

  async function handleDelete(f) {
    if (!confirm(`ลบไฟล์ "${f.name}" และข้อมูลที่นำเข้าทั้งหมด ${f.entry_count} แถว?`)) return;
    setDeleting(f.id);
    try {
      await deleteFile(f.id);
      showToast('ลบไฟล์เรียบร้อย');
      loadFiles();
      onImportDone?.();
    } catch (e) { alert(e.message); }
    finally { setDeleting(null); }
  }

  function getCycleLabel(cycleId) {
    const c = cycles.find(x => String(x.id) === String(cycleId));
    return c ? cycleLabel(c) : cycleId;
  }

  return (
    <div className="upload-view">
      <div className="upload-section-header">
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>📁 ไฟล์ตารางงาน</h2>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          + อัพโหลดไฟล์ใหม่
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#888', padding: 20 }}>กำลังโหลด...</div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <h3>ยังไม่มีไฟล์ที่อัพโหลด</h3>
          <p>กด "+ อัพโหลดไฟล์ใหม่" เพื่อนำเข้าตารางงานจาก Excel</p>
        </div>
      ) : (
        <table className="file-list-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>ชื่อไฟล์</th>
              <th>สาขา</th>
              <th>รอบ / เดือน</th>
              <th>นำเข้าเมื่อ</th>
              <th style={{ textAlign: 'center' }}>แถวข้อมูล</th>
              <th style={{ width: 100 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={f.id}>
                <td style={{ textAlign: 'center' }}><span className="file-icon">📄</span></td>
                <td style={{ fontWeight: 600 }}>{f.name}</td>
                <td>
                  {f.branch
                    ? <span style={{ background: '#e8eaf6', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{f.branch}</span>
                    : <span style={{ color: '#aaa', fontSize: 11 }}>—</span>}
                </td>
                <td style={{ fontSize: 11, color: '#555' }}>{getCycleLabel(f.cycle_id)}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{fmtDateTime(f.uploaded_at)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#2d3561' }}>{f.entry_count || 0}</span>
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-xs"
                    onClick={() => handleDelete(f)}
                    disabled={deleting === f.id}
                  >
                    {deleting === f.id ? '...' : 'ลบ'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <UploadModal
          cycles={cycles}
          onClose={() => setModal(false)}
          onDone={(result, freshCycles) => {
            if (freshCycles) {
              setCycles(freshCycles);
              return; // don't close, just refresh
            }
            setModal(false);
            showToast(`นำเข้าสำเร็จ ${result?.imported || ''} แถว`);
            loadFiles();
            onImportDone?.();
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
