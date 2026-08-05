require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
  const { data, error } = await supabase.storage.createBucket('avatars', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    fileSizeLimit: 5242880
  });
  if (error) {
    if (error.message.includes('already exists')) {
        console.log('Bucket already exists');
    } else {
        console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket created:', data);
  }
}

setup();
