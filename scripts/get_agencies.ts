import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await supabase.from('opportunities').select('agency').eq('source', 'caleprocure');
  if (error) console.error(error);
  else {
    const agencies = [...new Set(data.map(d => d.agency))];
    console.log("AGENCIES:\n" + agencies.sort().join('\n'));
  }
})();
