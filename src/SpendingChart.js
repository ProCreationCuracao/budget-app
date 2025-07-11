// src/SpendingChart.js
import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Props: txns = array of transactions { date, amount, category }
export default function SpendingChart({ txns }) {
  // Aggregate spend by category
  const data = useMemo(() => {
    const totals = {};
    txns.forEach(({ category, amount }) => {
      totals[category] = (totals[category] || 0) + parseFloat(amount);
    });
    const labels = Object.keys(totals);
    const values = labels.map(label => totals[label]);
    return {
      labels,
      datasets: [
        {
          label: 'Spend by Category',
          data: values,
          borderWidth: 1
        }
      ]
    };
  }, [txns]);

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Spending Breakdown' }
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <Bar options={options} data={data} />
    </div>
  );
}
