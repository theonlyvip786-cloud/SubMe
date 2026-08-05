const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
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

