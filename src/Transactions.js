// src/Transactions.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Select,
  Button,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from '@chakra-ui/react';

export default function Transactions({ user }) {
  const [txns, setTxns] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [goals, setGoals] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState('');

  useEffect(() => {
    // load transactions
    fetch('/.netlify/functions/get-transactions')
      .then(res => res.json())
      .then(data => {
        setTxns(data.filter(t => t.user_id === user.id));
      })
      .catch(console.error);

    // load goals for tagging
    fetch('/.netlify/functions/get-goals')
      .then(res => res.json())
      .then(data => {
        setGoals(data.filter(g => g.user_id === user.id));
      })
      .catch(console.error);
  }, [user.id]);

  const addTransaction = async (e) => {
    e.preventDefault();
    await fetch('/.netlify/functions/create-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:    user.id,
        description,
        amount:     parseFloat(amount),
        category,
        date,
        goal_id:    selectedGoal || null
      }),
    });
    // clear form
    setDescription('');
    setAmount('');
    setCategory('');
    setDate('');
    setSelectedGoal('');
    // refresh lists
    const [txnRes, goalRes] = await Promise.all([
      fetch('/.netlify/functions/get-transactions'),
      fetch('/.netlify/functions/get-goals')
    ]);
    const txnData = await txnRes.json();
    const goalData = await goalRes.json();
    setTxns(txnData.filter(t => t.user_id === user.id));
    setGoals(goalData.filter(g => g.user_id === user.id));
  };

  return (
    <Box>
      <Heading mb={4}>Your Transactions</Heading>

      {/* Add Transaction Form */}
      <Box as="form" onSubmit={addTransaction} mb={6}>
        <VStack spacing={4} align="start">
          <FormControl>
            <FormLabel>Description</FormLabel>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </FormControl>

          <HStack spacing={4} w="100%">
            <FormControl>
              <FormLabel>Amount</FormLabel>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </FormControl>

            <FormControl>
              <FormLabel>Category</FormLabel>
              <Input
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              />
            </FormControl>

            <FormControl>
              <FormLabel>Date</FormLabel>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </FormControl>
          </HStack>

          <FormControl>
            <FormLabel>Tag to Goal (optional)</FormLabel>
            <Select
              placeholder="Select Goal"
              value={selectedGoal}
              onChange={e => setSelectedGoal(e.target.value)}
            >
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FormControl>

          <Button type="submit" colorScheme="blue">Add Transaction</Button>
        </VStack>
      </Box>

      {/* Transactions Table */}
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th>Category</Th>
            <Th isNumeric>Amount</Th>
            <Th>Goal</Th>
          </Tr>
        </Thead>
        <Tbody>
          {txns.map(t => (
            <Tr key={t.id}>
              <Td>{t.date}</Td>
              <Td>{t.description}</Td>
              <Td>{t.category}</Td>
              <Td isNumeric>${parseFloat(t.amount).toFixed(2)}</Td>
              <Td>{goals.find(g => g.id === t.goal_id)?.name || '-'}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}
