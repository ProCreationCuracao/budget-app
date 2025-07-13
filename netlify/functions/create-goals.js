const { supabase } = require('../../src/supabaseClient');

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { user_id, name, target_amount } = body;

  const { data, error } = await supabase
    .from('goals')
    .insert([{ user_id, name, target_amount }]);

  if (error) {
    return { statusCode: 500, body: JSON.stringify(error) };
  }
  return { statusCode: 200, body: JSON.stringify(data[0]) };
};
