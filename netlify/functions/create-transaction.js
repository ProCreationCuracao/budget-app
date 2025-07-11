const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async ({ body }) => {
  const { user_id, amount, description } = JSON.parse(body);
  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id, amount, description });
  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error }) };
  }
  return { statusCode: 200, body: JSON.stringify(data) };
};
