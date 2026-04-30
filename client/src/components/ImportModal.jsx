import React, { useState } from 'react';
import { importExcel } from '../api.js';

export default function ImportModal({ cycles, onClose, onDone }) {
  const [cycleId, setCycleId]   = useState(cycles[0]?.id ?? '');
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  async function handleImport() {
    if (!cycleId || !file) { setError('กรุณาเลือกรอบและไฟล์'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await importExcel(cycleId, file);
      if (res.error) { setError(res.error); }
      else { setResult(res.imported); onDone(); }
    } catch {
      setError('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>📥 Import ตารางงานจาก Excel</h2>

        <div className="form-group">
          <label>รอบตาราง</label>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)}>
            {cycles.map(c => (
              <option key={c.id} value={c.id}>{c.label || `${c.start_date} – ${c.end_date}`}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>ไฟล์ Excel (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setFile(e.target.files[0])}
            style={{ padding: '4px 0' }}
          />
        </div>

        <div style={{ fontSize: 11, color: '#888', marginBottom: 12, lineHeight: 1.6 }}>
          รูปแบบที่รองรับ: คอลัมน์วันที่ 21–20, แถวพนักงานมีรหัส 5-8 หลัก, ตามด้วยแถว OT<br />
          เซลล์สีแดง = วันหยุด · ค่าตัวเลขจะ import เป็น <strong>Plan hours</strong>
        </div>

        {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {result != null && (
          <div style={{ color: '#27ae60', fontSize: 13, marginBottom: 10 }}>
            ✓ Import สำเร็จ {result} เซลล์
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>ปิด</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
            {loading ? 'กำลัง import...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
