// src/components/Account.jsx
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
import { supabase } from '../supabaseClient';

export default function Account({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  // Load accounts for this user
  useEffect(() => {
    if (!user?.id) return;
    async function loadAccounts() {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading accounts:', error);
      } else {
        setAccounts(data);
      }
    }
    loadAccounts();
  }, [user]);

  // Load savings goals
  useEffect(() => {
    if (!user?.id) return;
    async function loadGoals() {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading goals:', error);
      } else {
        setGoals(data);
      }
    }
    loadGoals();
  }, [user]);

  // Add a new goal
  const addGoal = async e => {
    e.preventDefault();
    const target = parseFloat(goalTarget) || 0;
    const { error } = await supabase
      .from('goals')
      .insert([{ user_id: user.id, name: goalName, target_amount: target }]);
    if (error) console.error('Error creating goal:', error);
    else {
      setGoalName('');
      setGoalTarget('');
      // reload
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id);
      setGoals(data || []);
    }
  };

  return (
    <Box p={4}>
      <Heading mb={6}>Account & Savings Goals</Heading>

      {/* Savings Goals */}
      <Box mb={8}>
        <Heading size="md" mb={4}>Savings Goals</Heading>
        <Box as="form" onSubmit={addGoal} mb={6}>
          <HStack spacing={3}>
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
        <HStack spacing={6} align="start">
          {goals.map(g => (
            <VStack key={g.id} spacing={2}>
              <CircularProgress
                value={Math.min(
                  100,
                  (g.current_amount ?? 0) / (g.target_amount || 1) * 100
                )}
                size="80px"
                thickness="8px"
                color="green.400"
              >
                <CircularProgressLabel>
                  <Text fontSize="sm" fontWeight="bold">{g.name}</Text>
                  <Text fontSize="xs">
                    ${((g.current_amount ?? 0).toFixed(2))} / ${((g.target_amount ?? 0).toFixed(2))}
                  </Text>
                </CircularProgressLabel>
              </CircularProgress>
            </VStack>
          ))}
        </HStack>
      </Box>

      {/* Account List */}
      <VStack spacing={4} align="stretch">
        {accounts.map(acc => (
          <Box
            key={acc.id}
            p={4}
            bg="gray.50"
            borderRadius="md"
            boxShadow="sm"
          >
            <HStack justify="space-between">
              <Text fontWeight="bold">{acc.name}</Text>
              <Text>${((acc.balance ?? 0).toFixed(2))}</Text>
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {new Date(acc.created_at).toLocaleDateString()}
            </Text>
          </Box>
        ))}
        {accounts.length === 0 && (
          <Text color="gray.500">No accounts yet.</Text>
        )}
      </VStack>
    </Box>
  );
}
