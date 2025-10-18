import { createClient } from '@supabase/supabase-js'

// Reemplaza estos valores con los que copiaste de Supabase
const supabaseUrl = 'https://aniddaigsdcbjnmncxhl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWRkYWlnc2RjYmpubW5jeGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NDgzODYsImV4cCI6MjA3NjIyNDM4Nn0.H_6E-G1dqoRpNz-cuTcsjvRim6ZJduipTMRdKUHzqgw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)