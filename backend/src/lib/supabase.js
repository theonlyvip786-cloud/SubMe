const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://otbcyccbonxwaqslqtto.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN5Y2Nib254d2Fxc2xxdHRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjM5MDQzOSwiZXhwIjoyMDk3OTY2NDM5fQ.4yTYhD9GTF4FjeGTs0kkW_MCEIEnEPZ_BIg69294FcM';

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
);

supabase.checkConnection = async () => {
    try {
        console.log('Testing connection to Supabase...');
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) {
            console.error('Supabase connection check failed:', error.message || error);
            return { ok: false, error };
        }
        console.log('Supabase connection verified successfully! Database is reachable.');
        return { ok: true };
    } catch (err) {
        console.error('Critical: Failed to connect to Supabase:', err.message || err);
        return { ok: false, error: err };
    }
};

module.exports = supabase;

