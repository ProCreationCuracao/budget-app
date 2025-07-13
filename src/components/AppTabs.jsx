import React from 'react';
import { Tabs, TabList, TabPanels, Tab, TabPanel, Box } from '@chakra-ui/react';
import Dashboard from './Dashboard';
import Account from './Account';
import Transactions from './Transactions';
import QuickAdd from './QuickAdd';
import Settings from './Settings';

export default function AppTabs() {
  return (
    <Tabs isFitted variant="enclosed">
      <TabList mb="1em">
        <Tab>Dashboard</Tab>
        <Tab>Wallets</Tab>
        <Tab>Transactions</Tab>
        <Tab>Quick Add</Tab>
        <Tab>Settings</Tab>
      </TabList>

      <TabPanels>
        <TabPanel><Dashboard /></TabPanel>
        <TabPanel><Account /></TabPanel>
        <TabPanel><Transactions /></TabPanel>
        <TabPanel><QuickAdd /></TabPanel>
        <TabPanel><Settings /></TabPanel>
      </TabPanels>
    </Tabs>
  );
}
