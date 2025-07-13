// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  HStack,
  VStack,
  Text,
  Select,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { supabase } from '../supabaseClient';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';


const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Dashboard() {
  const toast = useToast();

  // Date‐range state
  const [range, setRange] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString());

  // Data state
  const [transactions, setTransactions] = useState([]);

  // Widget visibility
  const [widgets, setWidgets] = useState({
    summary: true,
    trend: true,
    categories: true,
    recent: true,
  });

  // Recompute startDate whenever range changes
  useEffect(() => {
    const now = new Date();
    let start;
    switch (range) {
      case 'daily':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'monthly':
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    setStartDate(start.toISOString());
  }, [range]);

  // Load data whenever date‐window changes
  useEffect(() => {
    async function load() {
      try {
        // get logged‐in user
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        // fetch transactions in window
        const { data, error: txErr } = await supabase
          .from('transactions')
          .select('id, amount, transaction_type, category, created_at')
          .eq('user_id', user.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        if (txErr) throw txErr;
        setTransactions(data || []);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        console.error('Full error:', JSON.stringify(err, null, 2));
        toast({
          title: 'Failed to load data',
          description: err.message ?? 'Unknown error',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }
    load();
  }, [startDate, endDate, toast]);

  // prepare summary numbers
  const income = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const net = income - expense;

  // prepare trend data grouping by day
  const trendData = Object.entries(
    transactions.reduce((acc, t) => {
      const day = t.created_at.slice(0, 10);
      acc[day] = (acc[day] || 0) + (t.transaction_type === 'income' ? t.amount : -t.amount);
      return acc;
    }, {})
  )
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, value]) => ({ date, value }));

  // prepare category pie
  const categoryMap = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + (t.transaction_type === 'expense' ? t.amount : 0);
    return acc;
  }, {});
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  // recent 5
  const recent = [...transactions]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 5);

  // grid layout
  const layouts = {
    lg: [
      { i: 'summary', x: 0, y: 0, w: 3, h: 1 },
      { i: 'trend', x: 3, y: 0, w: 9, h: 3 },
      { i: 'categories', x: 0, y: 1, w: 6, h: 3 },
      { i: 'recent', x: 6, y: 1, w: 6, h: 3 },
    ],
  };

  const bg = useColorModeValue('white', 'gray.700');
  const border = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box p={4}>
      <HStack mb={4} justify="space-between">
        <Heading size="lg">Dashboard</Heading>
        <Select w="150px" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </HStack>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
        rowHeight={80}
        isResizable
        isDraggable
      >
        {widgets.summary && (
          <Box
            key="summary"
            bg={bg}
            border="1px"
            borderColor={border}
            borderRadius="md"
            p={4}
          >
            <VStack spacing={2} align="stretch">
              <Text fontWeight="bold">Income</Text>
              <Text>${income.toFixed(2)}</Text>
              <Text fontWeight="bold">Expenses</Text>
              <Text>${expense.toFixed(2)}</Text>
              <Text fontWeight="bold">Net</Text>
              <Text>${net.toFixed(2)}</Text>
            </VStack>
          </Box>
        )}

        {widgets.trend && (
          <Box
            key="trend"
            bg={bg}
            border="1px"
            borderColor={border}
            borderRadius="md"
            p={4}
          >
            <Text fontWeight="bold" mb={2}>
              Balance Trend
            </Text>
            <LineChart width={800} height={200} data={trendData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3182CE" />
            </LineChart>
          </Box>
        )}

        {widgets.categories && (
          <Box
            key="categories"
            bg={bg}
            border="1px"
            borderColor={border}
            borderRadius="md"
            p={4}
          >
            <Text fontWeight="bold" mb={2}>
              Top Expense Categories
            </Text>
            <PieChart width={400} height={200}>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label
              >
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={['#3182CE', '#D53F8C', '#ECC94B'][idx % 3]} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </Box>
        )}

        {widgets.recent && (
          <Box
            key="recent"
            bg={bg}
            border="1px"
            borderColor={border}
            borderRadius="md"
            p={4}
          >
            <Text fontWeight="bold" mb={2}>
              Recent Transactions
            </Text>
            <VStack spacing={2} align="stretch">
              {recent.map((t) => (
                <HStack key={t.id} justify="space-between">
                  <Text>{new Date(t.created_at).toLocaleDateString()}</Text>
                  <Text>{t.category}</Text>
                  <Text
                    color={t.transaction_type === 'income' ? 'green.500' : 'red.500'}
                  >
                    {t.transaction_type === 'income' ? '+' : '-'}$
                    {t.amount.toFixed(2)}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}
      </ResponsiveGridLayout>
    </Box>
  );
}
