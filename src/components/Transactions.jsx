// src/components/Transactions.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Spinner
} from '@chakra-ui/react';

export default function Transactions({ user, refreshTransactions }) {
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetch('/.netlify/functions/get-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    })
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching transactions:', err);
        setLoading(false);
      });
  }, [user, refreshTransactions]);

  // guard unauthenticated


  // loading state
  if (loading || transactions === null) {
    return (
      <Box p={4} textAlign="center">
        <Spinner size="lg" />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Heading mb={4}>Recent Transactions</Heading>

      {transactions.length === 0 ? (
        <Text>No transactions yet.</Text>
      ) : (
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th isNumeric>Amount</Th>
              <Th>Category</Th>
              <Th>Description</Th>
            </Tr>
          </Thead>
          <Tbody>
            {transactions.map(tx => (
              <Tr key={tx.id}>
                <Td>{new Date(tx.created_at).toLocaleDateString()}</Td>
                <Td>{tx.transaction_type}</Td>
                <Td isNumeric>${parseFloat(tx.amount).toFixed(2)}</Td>
                <Td>{tx.category || '—'}</Td>
                <Td>{tx.note || '—'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
}
