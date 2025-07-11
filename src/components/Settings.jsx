import React from 'react';
import { VStack, Box, Heading, Switch, FormControl, FormLabel } from '@chakra-ui/react';

export default function Settings() {
  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="md" mb={2}>
          Preferences
        </Heading>
        <FormControl display="flex" alignItems="center">
          <FormLabel htmlFor="dark-mode" mb="0">
            Enable Dark Mode
          </FormLabel>
          <Switch id="dark-mode" />
        </FormControl>
      </Box>

      <Box>
        <Heading size="md" mb={2}>
          Data Export
        </Heading>
        {/* placeholders for CSV / JSON buttons */}
        <VStack align="start">
          <Box as="button" p={2} border="1px solid" borderRadius="md">
            Export as CSV
          </Box>
          <Box as="button" p={2} border="1px solid" borderRadius="md">
            Export as JSON
          </Box>
        </VStack>
      </Box>
    </VStack>
  );
}
