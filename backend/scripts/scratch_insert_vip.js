require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('Inserting more dummy tasks (VIP and normal)...');
    
    const tasks = [
        {
            title: "Vlog #142: Exploring Hidden Waterfalls in Bali",
            video_url: "https://www.youtube.com/watch?v=q6EoRBvdVPQ",
            reward_points: 15,
            is_vip: true,
            required_watch_time: 120,
            mcq_question: "Which country is this waterfall in?",
            mcq_options: ["Thailand", "Bali", "Vietnam", "India"],
            mcq_answer: "Bali",
            platform: "youtube",
            is_active: true
        },
        {
            title: "My 10-Minute Morning Routine (Productivity Hacks)",
            video_url: "https://www.youtube.com/watch?v=FjHGZj2IjA4",
            reward_points: 20,
            is_vip: true,
            required_watch_time: 150,
            mcq_question: "What time does the creator wake up?",
            mcq_options: ["5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM"],
            mcq_answer: "6:00 AM",
            platform: "youtube",
            is_active: true
        },
        {
            title: "Ultimate PC Build Guide 2026",
            video_url: "https://www.youtube.com/watch?v=Qc1v1x6GjC0",
            reward_points: 30,
            is_vip: true,
            required_watch_time: 200,
            mcq_question: "Which GPU was used?",
            mcq_options: ["RTX 4090", "RX 7900 XTX", "RTX 5090", "Arc A770"],
            mcq_answer: "RTX 5090",
            platform: "youtube",
            is_active: true
        },
        {
            title: "Street Food Tour in Tokyo",
            video_url: "https://www.youtube.com/watch?v=9L2PvwKz7u0",
            reward_points: 10,
            is_vip: false,
            required_watch_time: 60,
            mcq_question: "What was the first dish eaten?",
            mcq_options: ["Sushi", "Takoyaki", "Ramen", "Mochi"],
            mcq_answer: "Takoyaki",
            platform: "youtube",
            is_active: true
        },
        {
            title: "My New UI/UX Design Portfolio",
            video_url: "https://www.instagram.com/reel/abcdefg123/",
            reward_points: 12,
            is_vip: true,
            required_watch_time: 30,
            mcq_question: "What color is the main button?",
            mcq_options: ["Red", "Blue", "Green", "Lime"],
            mcq_answer: "Lime",
            platform: "instagram",
            is_active: true
        }
    ];

    const { data, error } = await supabase.from('tasks').insert(tasks).select();
    
    if (error) {
        console.error("Error inserting tasks:", error);
    } else {
        console.log("Successfully inserted tasks:", data.map(t => t.title));
    }
}

run();
