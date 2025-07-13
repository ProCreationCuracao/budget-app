import React, { useState, useEffect } from 'react';
import {
  VStack,
  Box,
  Text,
  HStack,
  Progress,
  useToast,
} from '@chakra-ui/react';
import { supabase } from '../supabaseClient';

export default function AccountsList({ onSelect }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id);
        if (error) throw error;

        setAccounts(data || []);
      } catch (err) {
        console.error('Error loading accounts:', err);
        toast({
          title: 'Failed to load accounts',
          description: err.message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    }
    load();
  }, [toast]);

  return (
    <VStack spacing={4} align="stretch">
      {accounts.map((a) => {
        // percent of opening balance for a little visual
        const pct = a.opening_balance
          ? Math.min((a.balance / a.opening_balance) * 100, 100)
          : 0;
        return (
          <Box
            key={a.id}
            p={4}
            bg="white"
            borderRadius="md"
            shadow="sm"
            cursor="pointer"
            onClick={() => onSelect(a)}
          >
            <HStack justify="space-between">
              <Text fontWeight="bold">{a.name}</Text>
              <Text>${a.balance.toFixed(2)}</Text>
            </HStack>
            <Progress value={pct} size="sm" mt={2} />
          </Box>
        );
      })}
    </VStack>
  );
}
