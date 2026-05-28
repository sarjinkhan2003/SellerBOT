import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL ? "Set" : "MISSING")
console.log("Supabase Key:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "Set" : "MISSING")

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials missing in .env. RAG search is disabled until configured.")
}

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
