// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  HStack,
  VStack,
  Text,
  Button,
  ButtonGroup,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Select
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
  Legend
} from 'recharts';
import { supabase } from '../supabaseClient';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Dashboard() {
  // Date-range state
  const [range, setRange] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString());

  // Data state
  const [transactions, setTransactions] = useState([]);

  // Widget visibility toggles
  const [widgets, setWidgets] = useState({
    summary: true,
    trend: true,
    categories: true,
    recent: true
  });

  // Load transactions once
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setTransactions(data);
      else console.error(error);
    }
    load();
  }, []);

  // Filter by date range
  const filtered = transactions.filter(t => {
    const d = new Date(t.created_at).toISOString();
    return d >= startDate && d <= endDate;
  });

  // --- 1) Summary widget data ---
  const totalIncome = filtered
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filtered
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // --- 2) Trend widget data ---
  const trendData = Object.entries(
    filtered.reduce((acc, t) => {
      const dateKey = new Date(t.created_at).toISOString().split('T')[0];
      acc[dateKey] = (acc[dateKey] || 0) + t.amount;
      return acc;
    }, {})
  )
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // --- 3) Category widget data ---
  const categoryData = Object.entries(
    filtered.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // layout for grid
  const layout = [
    { i: 'summary', x: 0, y: 0, w: 4, h: 2 },
    { i: 'trend', x: 4, y: 0, w: 8, h: 2 },
    { i: 'categories', x: 0, y: 2, w: 6, h: 2 },
    { i: 'recent', x: 6, y: 2, w: 6, h: 2 }
  ];

  // colors
  const bg = useColorModeValue('white', 'gray.800');

  return (
    <Box p={4}>
      <Heading mb={4}>Dashboard</Heading>

      {/* Date & widget toggles */}
      <HStack mb={4} spacing={4}>
        <Select
          w="200px"
          value={range}
          onChange={e => setRange(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
        <ButtonGroup>
          {Object.keys(widgets).map(key => (
            <Button
              key={key}
              size="sm"
              variant={widgets[key] ? 'solid' : 'outline'}
              onClick={() =>
                setWidgets(w => ({ ...w, [key]: !w[key] }))
              }
            >
              {key[0].toUpperCase() + key.slice(1)}
            </Button>
          ))}
        </ButtonGroup>
      </HStack>

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200 }}
        cols={{ lg: 12 }}
        rowHeight={100}
        isResizable
        isDraggable
      >
        {widgets.summary && (
          <Box key="summary" bg={bg} p={4} borderRadius="md">
            <Heading size="md" mb={2}>Summary</Heading>
            <HStack justify="space-between">
              <VStack>
                <Text fontSize="lg" fontWeight="bold">
                  ${totalIncome.toFixed(2)}
                </Text>
                <Text>Income</Text>
              </VStack>
              <VStack>
                <Text fontSize="lg" fontWeight="bold">
                  ${totalExpense.toFixed(2)}
                </Text>
                <Text>Expense</Text>
              </VStack>
            </HStack>
          </Box>
        )}

        {widgets.trend && (
          <Box key="trend" bg={bg} p={4} borderRadius="md">
            <Heading size="md" mb={2}>Trend ({range})</Heading>
            <LineChart width={600} height={200} data={trendData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#3182CE" />
            </LineChart>
          </Box>
        )}

        {widgets.categories && (
          <Box key="categories" bg={bg} p={4} borderRadius="md">
            <Heading size="md" mb={2}>By Category</Heading>
            <PieChart width={400} height={200}>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                fill="#E53E3E"
                label
              >
                {categoryData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      ['#3182CE', '#D53F8C', '#ECC94B', '#38A169'][idx % 4]
                    }
                  />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </Box>
        )}

        {widgets.recent && (
          <Box key="recent" bg={bg} p={4} borderRadius="md" overflowY="auto">
            <Heading size="md" mb={2}>Recent Transactions</Heading>
            <VStack align="stretch" spacing={2}>
              {filtered.slice(0, 5).map(tx => (
                <HStack key={tx.id} justify="space-between">
                  <Text>{new Date(tx.created_at).toLocaleDateString()}</Text>
                  <Text>{tx.category}</Text>
                  <Text>${tx.amount.toFixed(2)}</Text>
                </HStack>
              ))}
            </VStack>
            {filtered.length > 5 && (
              <Button mt={2} size="sm" onClick={() => {/* expand logic */}}>
                Show more…
              </Button>
            )}
          </Box>
        )}
      </ResponsiveGridLayout>
    </Box>
  );
}
