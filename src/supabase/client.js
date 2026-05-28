import { createClient } from "@supabase/supabase-js"

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ""
const supabaseUrl = rawUrl
  .replace("/rest/v1", "")
  .replace(/\/$/, "")

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

if (!supabaseUrl) {
  console.error("VITE_SUPABASE_URL missing")
} else {
  console.log("Supabase URL: Set", supabaseUrl)
}

if (!supabaseKey) {
  console.error("VITE_SUPABASE_ANON_KEY missing")
} else {
  console.log("Supabase Key: Set")
}

export const supabase = createClient(supabaseUrl, supabaseKey)
