const { supabase } = require('../../src/supabaseClient');

exports.handler = async () => {
  const { data, error } = await supabase
    .from('goals')
    .select('*');
  if (error) return { statusCode: 500, body: error.message };
  return { statusCode: 200, body: JSON.stringify(data) };
};
