import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  HStack,
  Input,
} from '@chakra-ui/react';

export default function Account({ user }) {
  const [goals, setGoals] = useState([]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  useEffect(() => {
    fetch('/.netlify/functions/get-goals')
      .then(r => r.json())
      .then(arr => {
        setGoals(arr.filter(g => g.user_id === user.id));
      });
  }, [user.id]);

  const addGoal = async e => {
    e.preventDefault();
    await fetch('/.netlify/functions/create-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        name: goalName,
        target_amount: parseFloat(goalTarget),
      }),
    });
    setGoalName('');
    setGoalTarget('');
    // re-fetch
    const arr = await fetch('/.netlify/functions/get-goals').then(r => r.json());
    setGoals(arr.filter(g => g.user_id === user.id));
  };

  return (
    <VStack spacing={6} align="stretch">
      <Box as="form" onSubmit={addGoal}>
        <HStack>
          <Input
            placeholder="New Goal"
            value={goalName}
            onChange={e => setGoalName(e.target.value)}
            required
          />
          <Input
            placeholder="Target"
            type="number"
            step="0.01"
            value={goalTarget}
            onChange={e => setGoalTarget(e.target.value)}
            required
          />
          <Button type="submit" colorScheme="blue">
            Add Goal
          </Button>
        </HStack>
      </Box>

      <Box>
        <Heading size="md">Savings Goals</Heading>
        {goals.map(g => (
          <Text key={g.id}>
            {g.name}: ${g.target_amount.toFixed(2)}
          </Text>
        ))}
      </Box>
    </VStack>
  );
}
