const { supabase } = require('../../src/supabaseClient');

exports.handler = async (event) => {
  // returns sum of progress per goal
  const { data, error } = await supabase
    .from('goal_progress')
    .select('goal_id, sum(amount) as progress')
    .group('goal_id');

  if (error) {
    return { statusCode: 500, body: JSON.stringify(error) };
  }
  return { statusCode: 200, body: JSON.stringify(data) };
};
