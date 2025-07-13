import React, { useState, useEffect } from 'react';
import {
  Box, Heading, VStack, HStack, Text, Select
} from '@chakra-ui/react';
import { supabase } from '../supabaseClient';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      let q = supabase.from('transactions').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') {
        q = q.eq('category', filter);
      }
      const { data } = await q;
      setTransactions(data || []);
    }
    load();
  }, [filter]);

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="lg">Transactions</Heading>
        <Select w="200px" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          {/* You could dynamically load categories from supabase too */}
          <option value="Groceries">Groceries</option>
          <option value="Salary">Salary</option>
        </Select>
      </HStack>
      <VStack spacing={2} align="stretch">
        {transactions.map(tx => (
          <HStack key={tx.id} justify="space-between" p={2} bg="gray.50" borderRadius="md">
            <Text>{new Date(tx.created_at).toLocaleDateString()}</Text>
            <Text>{tx.category}</Text>
            <Text>${tx.amount.toFixed(2)}</Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
