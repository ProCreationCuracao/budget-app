import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Input,
  Button,
  VStack,
  HStack,
  Text
} from '@chakra-ui/react';

export default function Settings({ user }) {
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    fetch('/.netlify/functions/get-budgets')
      .then(res => res.json())
      .then(data => setBudgets(data.filter(b => b.user_id === user.id)))
      .catch(err => console.error('Error loading budgets:', err));
  }, [user.id]);

  const addBudget = async (e) => {
    e.preventDefault();
    await fetch('/.netlify/functions/create-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        category,
        amount: parseFloat(amount),
        month
      })
    });
    setCategory('');
    setAmount('');
    setMonth('');
    // refresh list
    const res = await fetch('/.netlify/functions/get-budgets');
    const data = await res.json();
    setBudgets(data.filter(b => b.user_id === user.id));
  };

  return (
    <Box>
      <Heading size="md" mb={4}>Monthly Budgets</Heading>
      <Box as="form" onSubmit={addBudget} mb={6}>
        <HStack spacing={4}>
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            required
          />
          <Input
            placeholder="Category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
          />
          <Input
            placeholder="Amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          <Button type="submit" colorScheme="blue">Set Budget</Button>
        </HStack>
      </Box>

      <VStack spacing={3} align="stretch">
        {budgets.map(b => (
          <Box key={b.id} p={3} bg="gray.100" borderRadius="md">
            <Text fontWeight="bold">{b.month} &mdash; {b.category}</Text>
            <Text>${b.amount.toFixed(2)}</Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}