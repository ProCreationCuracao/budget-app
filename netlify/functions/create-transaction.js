// netlify/functions/create-transaction.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { user_id, date, amount, description, category } = JSON.parse(event.body);

  const { error } = await supabase
    .from('transactions')
    .insert([{ user_id, date, amount, description, category }]);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
  return { statusCode: 201, body: JSON.stringify({ status: 'ok' }) };
};
