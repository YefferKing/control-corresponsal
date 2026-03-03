const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rsvvunmdfyggnljzxtup.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzdnZ1bm1kZnlnZ25senp4dHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMDc3NjQsImV4cCI6MjA1NTY4Mzc2NH0.8OshN6ByXX4mso8ZMxj0YeBP1hpVcY-XRsgl5Ty');

async function checkSchema() {
  const { data, error } = await supabase.from('roles').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample data:', data);
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    }
  }
}
checkSchema();
