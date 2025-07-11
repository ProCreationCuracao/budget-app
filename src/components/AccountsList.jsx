import React from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';

export default function AccountsList({ accounts }) {
  if (!accounts) return null;

  return (
    <VStack spacing={3} align="stretch">
      {accounts.map(a => (
        <Box key={a.id} p={3} bg="gray.100" borderRadius="md">
          <Text fontWeight="bold">{a.name}</Text>
          <Text>${(a.balance ?? 0).toFixed(2)}</Text>
        </Box>
      ))}
    </VStack>
  );
}
