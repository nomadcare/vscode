import { createClient } from "@supabase/supabase-js";

// Hardcoded Supabase credentials
const supabaseUrl = "";
const supabaseAnonKey = "";

// Create a single Supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
