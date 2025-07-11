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

export default function Account({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  useEffect(() => {
    // Placeholder: load accounts
    setAccounts([]);

    // Load goals and their saved progress
    async function loadGoals() {
      try {
        const [goalsRes, progressRes] = await Promise.all([
          fetch('/.netlify/functions/get-goals'),
          fetch('/.netlify/functions/get-goal-progress')
        ]);
        const goalsData = await goalsRes.json();
        const progressSums = await progressRes.json();

        const userGoals = goalsData
          .filter(g => g.user_id === user.id)
          .map(g => ({
            ...g,
            saved: progressSums[g.id] || 0
          }));
        setGoals(userGoals);
      } catch (err) {
        console.error('Error loading goals:', err);
      }
    }
    loadGoals();
  }, [user.id]);

  const addGoal = async (e) => {
    e.preventDefault();
    try {
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
      // reload goals and progress
      const [newGoalsRes, newProgressRes] = await Promise.all([
        fetch('/.netlify/functions/get-goals'),
        fetch('/.netlify/functions/get-goal-progress')
      ]);
      const newGoalsData = await newGoalsRes.json();
      const newProgressSums = await newProgressRes.json();
      const updatedGoals = newGoalsData
        .filter(g => g.user_id === user.id)
        .map(g => ({
          ...g,
          saved: newProgressSums[g.id] || 0
        }));
      setGoals(updatedGoals);
    } catch (err) {
      console.error('Error adding goal:', err);
    }
  };

  return (
    <Box>
      <Heading mb={4}>Account & Savings Goals</Heading>

      {/* Savings Goals Section */}
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
          {goals.map(g => {
            const pct = g.target_amount > 0
              ? Math.min((g.saved / g.target_amount) * 100, 100)
              : 0;
            return (
              <VStack key={g.id} spacing={2}>
                <CircularProgress
                  value={pct}
                  size="100px"
                  thickness="8px"
                  color={pct >= 100 ? 'green.400' : 'blue.400'}
                >
                  <CircularProgressLabel>
                    <Text fontSize="sm" fontWeight="bold">{g.name}</Text>
                    <Text fontSize="xs">
                      ${g.saved.toFixed(2)} / ${g.target_amount.toFixed(2)}
                    </Text>
                  </CircularProgressLabel>
                </CircularProgress>
              </VStack>
            );
          })}
        </HStack>
      </Box>

      {/* Existing Account List */}
      <VStack spacing={3} align="stretch">
        {accounts.map(a => (
          <Box key={a.id} p={3} bg="gray.100" borderRadius="md">
            <Text fontWeight="bold">{a.name}</Text>
            <Text>${a.balance.toFixed(2)}</Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
