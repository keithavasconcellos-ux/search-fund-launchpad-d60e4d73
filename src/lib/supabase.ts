import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dzepmywtihvjgewdrynx.supabase.co';
const supabaseAnonKey = 'sb_publishable_k8x5sXlE68v8xWXFgAokbQ_wtY7MwP4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
