import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://twxuxrnmrvfjrpvzelza.supabase.co';
const supabaseKey = 'sb_publishable_wKOSQ4lItNoiMh8SnC7S-g_FN_FzpLP';

export const supabase = createClient(supabaseUrl, supabaseKey);
