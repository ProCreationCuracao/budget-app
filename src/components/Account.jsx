import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Input,
  Button,
  VStack,
  HStack,
  Text,
  CircularProgress,
  CircularProgressLabel
} from '@chakra-ui/react';

export default function Account({ user, refreshTransactions }) {
  // ————— Hooks always at top —————
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  // only fetch when we have a user
  useEffect(() => {
    if (!user) return;

    // fetch accounts for this user
    fetch('/.netlify/functions/get-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    })
      .then(res => res.json())
      .then(data => setAccounts(data))
      .catch(console.error);

    // fetch savings goals
    fetch('/.netlify/functions/get-goals')
      .then(res => res.json())
      .then(data => setGoals(data.filter(g => g.user_id === user.id)))
      .catch(console.error);
  }, [user, refreshTransactions]);

  // add a new goal
  const addGoal = async e => {
    e.preventDefault();
    if (!user) return;

    await fetch('/.netlify/functions/create-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        name: goalName,
        target_amount: parseFloat(goalTarget)
      })
    });

    setGoalName('');
    setGoalTarget('');
    // refresh goals list
    const res = await fetch('/.netlify/functions/get-goals');
    const data = await res.json();
    setGoals(data.filter(g => g.user_id === user.id));
  };

  // ————— guard for unauthenticated —————

  // ————— main UI —————
  return (
    <Box p={4}>
      <Heading mb={4}>Accounts & Savings Goals</Heading>

      {/* Savings Goals */}
      <Box mb={6}>
        <Heading size="md" mb={4}>Savings Goals</Heading>
        <Box as="form" onSubmit={addGoal} mb={6}>
          <HStack spacing={4}>
            <Input
              placeholder="Goal Name"
              value={goalName}
              onChange={e => setGoalName(e.target.value)}
              required
            />
            <Input
              placeholder="Target Amount"
              type="number"
              step="0.01"
              value={goalTarget}
              onChange={e => setGoalTarget(e.target.value)}
              required
            />
            <Button type="submit" colorScheme="blue">Add Goal</Button>
          </HStack>
        </Box>

        <HStack spacing={8} align="center">
          {goals.map(g => (
            <VStack key={g.id} spacing={2}>
              <CircularProgress
                value={0} // TODO: wire up actual progress
                size="100px"
                thickness="8px"
                color="green.400"
              >
                <CircularProgressLabel>
                  {g.name}
                  <Text fontSize="sm">${g.target_amount.toFixed(2)}</Text>
                </CircularProgressLabel>
              </CircularProgress>
            </VStack>
          ))}
        </HStack>
      </Box>

      {/* Accounts List */}
      <VStack spacing={3} align="stretch">
        {accounts.map(a => (
          <Box key={a.id} p={3} bg="gray.100" borderRadius="md">
            <Text fontWeight="bold">{a.name}</Text>
            <Text>${parseFloat(a.balance).toFixed(2)}</Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
