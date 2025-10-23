import { createClient } from '@supabase/supabase-js'

// Supabase configuration (keeping for auth)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aniddaigsdcbjnmncxhl.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWRkYWlnc2RjYmpubW5jeGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NDgzODYsImV4cCI6MjA3NjIyNDM4Nn0.H_6E-G1dqoRpNz-cuTcsjvRim6ZJduipTMRdKUHzqgw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// CockroachDB client - using a simple fetch-based approach for browser compatibility
const cockroachUrl = import.meta.env.VITE_COCKROACHDB_URL || 'postgresql://marijeeducativa:uBQQSwn-pWNygC3SvlRx1Q@navy-python-17387.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'

export const cockroachClient = {
  query: async (sql, params = []) => {
    try {
      // Updated to use Render backend URL
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://sigcenv-backend.onrender.com/api/query';
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('CockroachDB query error:', error);
      throw error;
    }
  }
};