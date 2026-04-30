import React, { useState } from 'react';
import { createEmployee, updateEmployee, deleteEmployee, syncEmployees, syncManpower } from '../api.js';

function ManpowerLoginModal({ onClose, onDone }) {
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSync() {
    if (!email || !pass) { setError('กรุณากรอก email และ password'); return; }
    setLoading(true); setError('');
    try {
      const res = await syncManpower(email, pass);
      if (res.error) { setError(res.error); }
      else { onDone(res.synced); }
    } catch { setError('เกิดข้อผิดพลาด'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>🔗 Sync จาก Manpower System</h2>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          ดึงรายชื่อระดับ Management จาก manpower-turnover.web.app
        </p>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSync} disabled={loading}>
            {loading ? 'กำลัง Sync...' : 'Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmpModal({ emp, onClose, onSave }) {
  const [form, setForm] = useState(emp || { id: '', name: '', nickname: '', phone: '', position: '', branch: '' });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.id || !form.name) return;
    setSaving(true);
    try {
      if (emp) await updateEmployee(emp.id, form);
      else      await createEmployee(form);
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>{emp ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>

        {[
          { key: 'id',       label: 'รหัสพนักงาน', required: true, disabled: !!emp },
          { key: 'name',     label: 'ชื่อ-นามสกุล', required: true },
          { key: 'nickname', label: 'ชื่อเล่น' },
          { key: 'phone',    label: 'เบอร์โทร' },
          { key: 'position', label: 'ตำแหน่ง' },
          { key: 'branch',   label: 'สาขา' },
        ].map(f => (
          <div className="form-group" key={f.key}>
            <label>{f.label}{f.required && ' *'}</label>
            <input
              value={form[f.key] || ''}
              disabled={f.disabled}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.label}
            />
          </div>
        ))}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.id || !form.name}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeManager({ employees, onRefresh }) {
  const [modal, setModal]           = useState(null);
  const [showManpower, setManpower] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState('');

  async function handleDelete(emp) {
    if (!confirm(`ลบ ${emp.name} ออกจากระบบ?`)) return;
    await deleteEmployee(emp.id);
    onRefresh();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await syncEmployees();
      setSyncMsg(res.error ? res.error : `Sync สำเร็จ: ${res.synced} คน`);
      onRefresh();
    } catch {
      setSyncMsg('ไม่สามารถเชื่อมต่อ HR Management ได้');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="emp-manager">
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ เพิ่มพนักงาน</button>
        <button className="btn btn-sm" style={{ background: '#e94560', color: '#fff' }}
          onClick={() => setManpower(true)}>
          🔗 Sync จาก Manpower System
        </button>
        <button className="btn btn-sm" style={{ background: '#2d3561', color: '#fff' }}
          onClick={handleSync} disabled={syncing}>
          {syncing ? 'กำลัง Sync...' : '🔄 Sync จาก HR Local'}
        </button>
        {syncMsg && <span style={{ fontSize: 12, color: '#27ae60' }}>{syncMsg}</span>}
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">
          <h3>ยังไม่มีพนักงาน</h3>
          <p>เพิ่มพนักงานใหม่ หรือ Sync จาก HR Management</p>
        </div>
      ) : (
        <table className="emp-table">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ-นามสกุล</th>
              <th>ชื่อเล่น</th>
              <th>ตำแหน่ง</th>
              <th>สาขา</th>
              <th>เบอร์</th>
              <th style={{ width: 100 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{emp.id}</td>
                <td style={{ fontWeight: 600 }}>{emp.name}</td>
                <td>{emp.nickname || '-'}</td>
                <td><span className="position-badge">{emp.position || '-'}</span></td>
                <td style={{ fontSize: 11, color: '#888' }}>{emp.branch || '-'}</td>
                <td style={{ fontSize: 11 }}>{emp.phone || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(emp)}>แก้ไข</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(emp)}>ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <EmpModal
          emp={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); onRefresh(); }}
        />
      )}

      {showManpower && (
        <ManpowerLoginModal
          onClose={() => setManpower(false)}
          onDone={n => { setManpower(false); setSyncMsg(`Sync สำเร็จ: ${n} คน`); onRefresh(); }}
        />
      )}
    </div>
  );
}
