import React, { useState, useEffect, useMemo } from 'react';
import { Box, Heading, Text, Progress } from '@chakra-ui/react';

export default function Dashboard({ user }) {
  const [txns, setTxns] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    // load transactions
    fetch('/.netlify/functions/get-transactions')
      .then(res => res.json())
      .then(data => setTxns(data.filter(t => t.user_id === user.id)))
      .catch(err => console.error(err));
    // load budgets
    fetch('/.netlify/functions/get-budgets')
      .then(res => res.json())
      .then(data => setBudgets(data.filter(b => b.user_id === user.id)))
      .catch(err => console.error(err));
  }, [user.id]);

  // spend per category this month
  const spendByCategory = useMemo(() => {
    const now = new Date();
    const sums = {};
    txns.forEach(t => {
      const d = new Date(t.date);
      const key = t.category;
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      ) {
        sums[key] = (sums[key] || 0) + parseFloat(t.amount);
      }
    });
    return sums;
  }, [txns]);

  return (
    <Box>
      <Heading>Dashboard</Heading>

      {/* Budget Progress */}
      <Box mt={6}>
        <Heading size="md" mb={4}>Budget Progress</Heading>
        {budgets.map(b => {
          const spent = spendByCategory[b.category] || 0;
          const pct = Math.min((spent / b.amount) * 100, 100);
          return (
            <Box key={b.id} mb={4}>
              <Text fontSize="sm" mb={1}>
                {b.category}: ${spent.toFixed(2)} / ${b.amount.toFixed(2)}
              </Text>
              <Progress
                value={pct}
                colorScheme={spent > b.amount ? 'red' : 'green'}
                borderRadius="md"
              />
            </Box>
          );
        })}
      </Box>

      {/* existing metrics & charts here... */}
    </Box>
  );
}