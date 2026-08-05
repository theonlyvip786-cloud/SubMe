/**
 * SubKo API smoke test — run with backend up: node scripts/smoke-test.js
 * Optional: API_URL=http://localhost:5000 node scripts/smoke-test.js
 */
const BASE = process.env.API_URL || 'http://localhost:5000';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 120) }; }
  return { status: res.status, json, isJson: text.trim().startsWith('{') };
}

async function run() {
  const failures = [];
  const ok = (name) => console.log(`  OK  ${name}`);
  const fail = (name, detail) => {
    console.log(`  FAIL ${name}: ${detail}`);
    failures.push(name);
  };

  console.log(`Smoke test → ${BASE}\n`);

  const api404 = await req('GET', '/api/nonexistent');
  if (api404.status === 404 && api404.isJson && api404.json.error) ok('API 404 returns JSON');
  else fail('API 404 returns JSON', JSON.stringify(api404));

  const noAuth = await req('GET', '/api/users/me');
  if (noAuth.status === 401) ok('Protected route requires auth');
  else fail('Protected route requires auth', `status ${noAuth.status}`);

  const login = await req('POST', '/api/auth/login', {
    email: 'admin@subko.app',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });
  if (login.status === 200 && login.json.token) ok('Admin login');
  else fail('Admin login', JSON.stringify(login.json));

  if (login.json?.token) {
    const me = await req('GET', '/api/users/me', null, login.json.token);
    if (me.status === 200 && me.json.username) ok('GET /api/users/me (admin)');
    else fail('GET /api/users/me (admin)', JSON.stringify(me));

    const analytics = await req('GET', '/api/admin/analytics', null, login.json.token);
    if (analytics.status === 200 && analytics.json.stats && analytics.json.charts) ok('GET /api/admin/analytics (admin)');
    else fail('GET /api/admin/analytics (admin)', JSON.stringify(analytics));

    const exportCsv = await req('GET', '/api/admin/transactions/export', null, login.json.token);
    if (exportCsv.status === 200 && exportCsv.json.csv) ok('GET /api/admin/transactions/export (admin)');
    else fail('GET /api/admin/transactions/export (admin)', JSON.stringify(exportCsv));
  }

  console.log('');
  if (failures.length) {
    console.error(`Failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('All smoke checks passed.');
}

run().catch((e) => {
  console.error('Smoke test error (is backend running?):', e.message);
  process.exit(1);
});
