const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const { user_id, category, amount, month } = JSON.parse(event.body);
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id, category, amount, month },
      { onConflict: ['user_id', 'category', 'month'] }
    );
  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
  return { statusCode: 200, body: JSON.stringify(data[0]) };
};