// src/components/AccountDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VStack, Box, Text, Button, HStack } from '@chakra-ui/react';
import { supabase } from '../supabaseClient';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AccountDetail() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    async function load() {
      // fetch account
      let { data: acc } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();
      setAccount(acc);

      // fetch transactions
      let { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: true });
      setTransactions(tx);

      // build running-balance chart
      let balance = acc.opening_balance;
      const d = tx.map(t => {
        balance += t.amount;
        return { date: t.date, balance };
      });
      setChartData(d);
    }
    load();
  }, [accountId]);

  if (!account) return <Text>Loading account…</Text>;

  return (
    <VStack p={4} spacing={6} align="stretch">
      <Button size="sm" variant="link" onClick={() => navigate('/accounts')}>
        ← Back to Wallets
      </Button>

      <Box>
        <Text fontSize="2xl" fontWeight="bold">{account.name}</Text>
        <Text fontSize="lg" color="gray.500">${account.balance.toFixed(2)}</Text>
      </Box>

      <Box h="200px">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="balance" stroke="#3182ce" />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <HStack justify="space-between">
        <Text fontWeight="bold">Transactions</Text>
        <Button size="sm" onClick={() => {/* open NewTx modal prefilled to this account */}}>
          + New Tx
        </Button>
      </HStack>
      <VStack spacing={2} align="stretch">
        {transactions.map(t => (
          <HStack key={t.id} justify="space-between">
            <Text>{new Date(t.date).toLocaleDateString()}</Text>
            <Text>{t.description}</Text>
            <Text fontFamily="mono">${t.amount.toFixed(2)}</Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
