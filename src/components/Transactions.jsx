import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';

export default function Transactions({ user }) {
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    fetch('/.netlify/functions/get-transactions')
      .then(r => r.json())
      .then(arr => {
        setTxns(arr.filter(t => t.user_id === user.id));
      });
  }, [user.id]);

  return (
    <Box>
      <Heading size="md" mb={4}>
        All Transactions
      </Heading>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th isNumeric>Amount</Th>
          </Tr>
        </Thead>
        <Tbody>
          {txns.map(t => (
            <Tr key={t.id}>
              <Td>{new Date(t.created_at).toLocaleDateString()}</Td>
              <Td>{t.description}</Td>
              <Td isNumeric>${t.amount.toFixed(2)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}
