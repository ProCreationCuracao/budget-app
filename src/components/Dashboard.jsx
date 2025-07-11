import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Heading,
  Button,
  VStack,
  Text,
  useColorModeValue
} from '@chakra-ui/react';
import {
  AiFillBell,
  AiFillInfoCircle,
  AiOutlineBarChart,
  AiFillDollarCircle,
  AiOutlinePieChart,
  AiOutlineSetting,
  AiOutlineGroup,
  AiOutlinePlus
} from 'react-icons/ai';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

// placeholder color palette matching your logo/theme
const COLORS = ['#3182CE', '#D53F8C', '#ECC94B', '#805AD5', '#4FD1C5'];

export default function Dashboard({ user, accounts = [], transactions = [], categories = [], goals = [], sharedGoals = [] }) {
  const cardBg = useColorModeValue('white', 'gray.700');

  // TODO: replace with real fetching logic
  const [cashFlowData, setCashFlowData] = useState([]);

  useEffect(() => {
    // simulate fetch
    setCashFlowData([
      { date: 'Day 1', balance: 1200 },
      { date: 'Day 5', balance: 900 },
      { date: 'Day 10', balance: 1500 },
      { date: 'Day 15', balance: 1300 },
      { date: 'Day 20', balance: 1700 },
      { date: 'Day 25', balance: 1600 },
    ]);
  }, []);

  const onQuickAdd = () => {
    // open quick-add modal
    console.log('Quick Add opening...');
  };

  return (
    <Box p={6}>
      <Heading mb={4}>Dashboard</Heading>
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr', lg: 'repeat(3,1fr)' }} gap={6}>

        {/* 1. Alerts & Reminders */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <VStack align="start">
            <Heading size="sm">
              <AiFillBell style={{ display: 'inline', marginRight: 8 }} />
              Alerts & Reminders
            </Heading>
            {goals.length === 0
              ? <Text>No upcoming reminders.</Text>
              : goals.map(g => <Text key={g.id}>{g.name}: due soon</Text>)
            }
            <Button size="sm" leftIcon={<AiOutlinePlus />}>Add Reminder</Button>
          </VStack>
        </Box>

        {/* 2. Smart Insights */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <VStack align="start">
            <Heading size="sm">
              <AiFillInfoCircle style={{ display: 'inline', marginRight: 8 }} />
              Smart Insights
            </Heading>
            <Text>You've spent 20% more on dining this month vs last.</Text>
            <Text fontSize="xs" color="gray.500">Based on your expenses</Text>
          </VStack>
        </Box>

        {/* 3. Cash-Flow Forecast */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm">
            <AiOutlineBarChart style={{ display: 'inline', marginRight: 8 }} />
            Cash-Flow Forecast
          </Heading>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={cashFlowData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#3182CE" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <Button size="sm" mt={2}>Refresh</Button>
        </Box>

        {/* 4. Multi-Currency Accounts */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm">
            <AiFillDollarCircle style={{ display: 'inline', marginRight: 8 }} />
            Accounts
          </Heading>
          {accounts.map(acc => (
            <Text key={acc.id}>
              {acc.name}: {acc.balance.toFixed(2)} {acc.currency}
            </Text>
          ))}
          <Button size="sm" leftIcon={<AiOutlinePlus />} mt={2}>Add Account</Button>
        </Box>

        {/* 5. Category Drill-Down */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm">
            <AiOutlinePieChart style={{ display: 'inline', marginRight: 8 }} />
            Top Categories
          </Heading>
          <ResponsiveContainer width="100%" height={120}>
            <RePieChart>
              <Pie data={categories} dataKey="value" nameKey="name" outerRadius={50} label>
                {categories.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
          <Button size="sm" mt={2}>View All</Button>
        </Box>

        {/* 6. Customizable Widgets */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm">
            <AiOutlineSetting style={{ display: 'inline', marginRight: 8 }} />
            Widgets
          </Heading>
          <Text>Drag to reorder your cards.</Text>
        </Box>

        {/* 7. Shared Goals/Collaborations */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <Heading size="sm">
            <AiOutlineGroup style={{ display: 'inline', marginRight: 8 }} />
            Shared Goals
          </Heading>
          {sharedGoals.length > 0 ? (
            sharedGoals.map(g => (
              <Text key={g.id}>{g.name}: {g.progress}%</Text>
            ))
          ) : (
            <Text>No shared goals.</Text>
          )}
        </Box>

        {/* 8. Quick Add Shortcut */}
        <Box bg={cardBg} p={4} borderRadius="md" boxShadow="sm">
          <Button
            width="100%"
            height="100px"
            colorScheme="yellow"
            fontSize="lg"
            leftIcon={<AiOutlinePlus />}
            onClick={onQuickAdd}
          >
            Quick Add
          </Button>
        </Box>

      </Grid>
    </Box>
  );
}
