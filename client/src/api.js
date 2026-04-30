const BASE = '/api';

export async function fetchEmployees() {
  const r = await fetch(`${BASE}/employees`);
  return r.json();
}

export async function fetchCloudStatus() {
  const r = await fetch(`${BASE}/cloud/status`);
  return r.json();
}

export async function loginWithFirebase(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}

export async function createEmployee(data) {
  const r = await fetch(`${BASE}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateEmployee(id, data) {
  const r = await fetch(`${BASE}/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteEmployee(id) {
  const r = await fetch(`${BASE}/employees/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function syncEmployees() {
  const r = await fetch(`${BASE}/employees/sync`, { method: 'POST' });
  return r.json();
}

export async function syncManpower(email, password) {
  const r = await fetch(`${BASE}/employees/sync-manpower`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}

export async function fetchCycles() {
  const r = await fetch(`${BASE}/cycles`);
  return r.json();
}

export async function createCycle(data) {
  const r = await fetch(`${BASE}/cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteCycle(id) {
  const r = await fetch(`${BASE}/cycles/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function fetchSchedule(cycleId) {
  const r = await fetch(`${BASE}/schedule/${cycleId}`);
  return r.json();
}

export async function saveEntry(data) {
  const r = await fetch(`${BASE}/schedule/entry`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function importExcel(cycleId, file, branch = '') {
  const fd = new FormData();
  fd.append('cycle_id', cycleId);
  fd.append('branch',   branch);
  fd.append('file',     file);
  const r = await fetch(`${BASE}/schedule/import`, { method: 'POST', body: fd });
  return r.json();
}

export function exportScheduleUrl(cycleId) {
  return `/api/schedule/${cycleId}/export`;
}

export async function fetchStats(cycleId) {
  const r = await fetch(`${BASE}/stats/${cycleId}`);
  return r.json();
}

// ── File management ────────────────────────────────────────────────────────────

export async function fetchFiles(cycleId) {
  const url = cycleId ? `${BASE}/files?cycle_id=${cycleId}` : `${BASE}/files`;
  const r = await fetch(url);
  return r.json();
}

export async function deleteFile(id) {
  const r = await fetch(`${BASE}/files/${id}`, { method: 'DELETE' });
  return r.json();
}
