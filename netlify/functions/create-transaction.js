const { supabase } = require('../../src/supabaseClient');

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { account_id, amount, category, label, note } = body;

  const { data, error } = await supabase
    .from('transactions')
    .insert([{ account_id, amount, category, label, note }]);

  if (error) {
    return { statusCode: 500, body: JSON.stringify(error) };
  }
  return { statusCode: 200, body: JSON.stringify(data[0]) };
};
