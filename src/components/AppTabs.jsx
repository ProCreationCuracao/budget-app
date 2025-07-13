import React, { useEffect, useState } from 'react';
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel
} from '@chakra-ui/react';

import Dashboard from './Dashboard';
import Account from './Account';
import Transactions from './Transactions';
import Settings from './Settings';
import QuickAdd from './QuickAdd';

export default function AppTabs() {
  const [transactions, setTransactions] = useState([]);

  // Fetch all transactions
  const fetchTransactions = async () => {
    try {
      const res = await fetch('/.netlify/functions/get-transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <Tabs variant="enclosed" isFitted>
      <TabList mb="1em">
        <Tab>Dashboard</Tab>
        <Tab>Account</Tab>
        <Tab>Transactions</Tab>
        <Tab>Settings</Tab>
      </TabList>

      {/* QuickAdd lives above the panels so it's always available */}
      <QuickAdd onSuccess={fetchTransactions} />

      <TabPanels>
        <TabPanel>
          <Dashboard
            transactions={transactions}
            refreshTransactions={fetchTransactions}
          />
        </TabPanel>
        <TabPanel>
          <Account
            transactions={transactions}
            refreshTransactions={fetchTransactions}
          />
        </TabPanel>
        <TabPanel>
          <Transactions
            transactions={transactions}
            refreshTransactions={fetchTransactions}
          />
        </TabPanel>
        <TabPanel>
          <Settings />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
