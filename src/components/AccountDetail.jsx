import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  Text,
  VStack,
  HStack,
  useToast,
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { supabase } from '../supabaseClient';

export default function AccountDetail({ account, onBack }) {
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [running, setRunning] = useState([]);

  // load this account’s transactions
  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const { data, error } = await supabase
          .from('transactions')
          .select('id, amount, transaction_type, created_at')
          .eq('user_id', user.id)
          .eq('account_id', account.id)
          .order('created_at', { ascending: true });
        if (error) throw error;

        setTransactions(data || []);

        // build running balance over time
        let bal = account.opening_balance;
        const run = data.map((t) => {
          bal += t.transaction_type === 'income' ? t.amount : -t.amount;
          return {
            date: t.created_at.slice(0, 10),
            balance: bal,
          };
        });
        setRunning(run);
      } catch (err) {
        console.error('Error loading account detail:', err);
        toast({
          title: 'Failed to load detail',
          description: err.message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    }
    load();
  }, [account, toast]);

  return (
    <Box>
      <Button mb={4} onClick={onBack}>
        ← Back to Wallets
      </Button>

      <Heading size="md" mb={2}>
        {account.name}
      </Heading>
      <Text mb={4} fontSize="lg">
        Current Balance: ${account.balance.toFixed(2)}
      </Text>

      <Box mb={6}>
        <Text fontWeight="bold" mb={2}>
          Balance Over Time
        </Text>
        <LineChart width={600} height={200} data={running}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#3182CE"
            dot={false}
          />
        </LineChart>
      </Box>

      <Box mb={6}>
        <Text fontWeight="bold" mb={2}>
          Transactions
        </Text>
        <VStack spacing={3} align="stretch">
          {transactions.map((t) => (
            <HStack key={t.id} justify="space-between">
              <Text>{new Date(t.created_at).toLocaleDateString()}</Text>
              <Text
                color={t.transaction_type === 'income' ? 'green.500' : 'red.500'}
              >
                {t.transaction_type === 'income' ? '+' : '-'}$
                {t.amount.toFixed(2)}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>

      <Button colorScheme="blue" mb={4}>
        Budget for this account
      </Button>
    </Box>
  );
}
