import React from 'react';
import { Tabs, TabList, TabPanels, Tab, TabPanel, Box } from '@chakra-ui/react';
import Dashboard from './Dashboard';
import Account from './Account';
import Transactions from './Transactions';
import Settings from './Settings';

export default function AppTabs({ user }) {
  return (
    <Box p={4}>
      <Tabs variant="enclosed">
        <TabList>
          <Tab>Dashboard</Tab>
          <Tab>Accounts</Tab>
          <Tab>Transactions</Tab>
          <Tab>Settings</Tab>
        </TabList>
        <TabPanels>
          <TabPanel><Dashboard user={user} /></TabPanel>
          <TabPanel><Account user={user} /></TabPanel>
          <TabPanel><Transactions user={user} /></TabPanel>
          <TabPanel><Settings user={user} /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
