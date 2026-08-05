require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const tables = ['tasks', 'users', 'submissions', 'promotions', 'payment_requests', 'task_sessions', 'transactions', 'referrals'];
  for (const t of tables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (error) { console.log(`${t}: ERROR ${error.message}`); continue; }
    console.log(`${t}: ${count} rows`);
  }
  console.log('--- active tasks sample ---');
  const { data: tasks } = await sb.from('tasks').select('id,title,is_active,is_vip,platform,required_watch_time').limit(5);
  console.log(JSON.stringify(tasks, null, 2));
})();
