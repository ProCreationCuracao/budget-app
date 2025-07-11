import React from 'react';
import { Center, VStack, Heading, Button } from '@chakra-ui/react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'github' });
  };

  return (
    <Center h="100vh">
      <VStack spacing={6}>
        <Heading>Welcome to Budget App</Heading>
        <Button colorScheme="teal" onClick={signIn}>
          Sign in with GitHub
        </Button>
      </VStack>
    </Center>
  );
}
