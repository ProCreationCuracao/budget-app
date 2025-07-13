import React from 'react';
import {
  Box, Heading, SimpleGrid, Card, CardBody, Text, Button
} from '@chakra-ui/react';

const settings = [
  { key: 'wallets', title: 'Manage Wallets', desc: 'Add, edit or remove accounts' },
  { key: 'categories', title: 'Categories', desc: 'Configure expense/income categories' },
  { key: 'labels', title: 'Labels', desc: 'Configure labels' },
  { key: 'dashboard', title: 'Dashboard', desc: 'Add or remove dashboard widgets' },
];

export default function Settings() {
  return (
    <Box>
      <Heading size="lg" mb={4}>Settings</Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {settings.map(s => (
          <Card key={s.key} boxShadow="sm">
            <CardBody>
              <Heading size="md">{s.title}</Heading>
              <Text mb={4}>{s.desc}</Text>
              <Button size="sm" colorScheme="blue">
                Configure
              </Button>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}
