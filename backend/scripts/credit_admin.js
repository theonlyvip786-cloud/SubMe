require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function creditAdmin() {
    console.log('Crediting 1000 BUG\'s to Admin...');
    
    // Find admin user(s)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@subko.app';
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${adminEmail},email.eq.admin@subko.app`);

    if (userError) {
        console.error('Error finding admin user:', userError);
        process.exit(1);
    }

    if (!users || users.length === 0) {
        console.log('No admin user found with email:', adminEmail);
        // Let's get the first user or create one
        const { data: allUsers } = await supabase.from('users').select('*').limit(5);
        console.log('All available users:', allUsers);
        if (allUsers && allUsers.length > 0) {
            for (const u of allUsers) {
                console.log(`Crediting 1000 BUG's to user ${u.username} (${u.email || u.id})...`);
                await supabase.rpc('credit_points', { user_uuid: u.id, amount: 1000 });
                await supabase.from('transactions').insert([{
                    user_id: u.id,
                    type: 'topup',
                    amount: 1000,
                    description: 'Admin bonus balance topup'
                }]);
            }
        }
    } else {
        for (const adminUser of users) {
            console.log(`Found Admin User: ${adminUser.username} (${adminUser.id}), current balance: ${adminUser.points}`);
            const { error: creditErr } = await supabase.rpc('credit_points', { user_uuid: adminUser.id, amount: 1000 });
            if (creditErr) {
                console.error('RPC credit_points error:', creditErr);
                // Fallback to direct update if RPC fails
                await supabase.from('users').update({ points: (adminUser.points || 0) + 1000 }).eq('id', adminUser.id);
            }
            
            await supabase.from('transactions').insert([{
                user_id: adminUser.id,
                type: 'topup',
                amount: 1000,
                description: 'Admin bonus balance topup (+1000 BUG\'s)'
            }]);

            const { data: updated } = await supabase.from('users').select('points').eq('id', adminUser.id).single();
            console.log(`SUCCESS! New balance for ${adminUser.username}: ${updated?.points} BUG's`);
        }
    }
}

creditAdmin().then(() => {
    console.log('Done crediting admin points.');
    process.exit(0);
}).catch(err => {
    console.error('Script error:', err);
    process.exit(1);
});
