// src/components/AccountDetail.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Divider,
  Spinner,
  useColorModeValue
} from '@chakra-ui/react';
import { supabase } from '../supabaseClient';

export default function AccountDetail({ account }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account.id)
      .order('transaction_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setTransactions(data);
      })
      .finally(() => setLoading(false));
  }, [account]);

  // Group transactions by date (YYYY-MM-DD)
  const byDate = transactions.reduce((acc, tx) => {
    const d = tx.transaction_date.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(tx);
    return acc;
  }, {});

  // Compute running balances
  let runningBal = account.opening_balance;
  const withRunning = transactions.map(tx => {
    runningBal += tx.amount * (tx.type === 'income' ? 1 : -1);
    return { ...tx, runningBalance: runningBal };
  });

  const bg = useColorModeValue('white', 'gray.700');
  const headerBg = useColorModeValue('gray.100', 'gray.600');

  if (!account) return <Text>Select an account to see details.</Text>;
  if (loading) return <Spinner />;

  return (
    <Box p={4} bg={bg} borderRadius="md" shadow="sm">
      <Heading size="md" mb={4}>{account.name}</Heading>
      <Text mb={6}>Opening balance: ${account.opening_balance.toFixed(2)}</Text>

      {Object.entries(byDate).map(([date, txs]) => (
        <Box key={date} mb={4}>
          <Box bg={headerBg} p={2} borderRadius="sm">
            <Text fontWeight="bold">{date}</Text>
          </Box>
          <VStack align="stretch" mt={2}>
            {txs.map(tx => {
              const r = withRunning.find(w => w.id === tx.id);
              return (
                <Box
                  key={tx.id}
                  p={3}
                  bg={useColorModeValue('gray.50', 'gray.600')}
                  borderRadius="sm"
                >
                  <HStack justify="space-between">
                    <Text>{tx.description || tx.category}</Text>
                    <Text color={tx.type === 'income' ? 'green.500' : 'red.500'}>
                      {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                    </Text>
                    <Text fontSize="sm">Bal: ${r.runningBalance.toFixed(2)}</Text>
                  </HStack>
                </Box>
              );
            })}
          </VStack>
          <Divider my={4} />
        </Box>
      ))}
    </Box>
  );
}
