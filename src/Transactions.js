// src/Transactions.js
import React, { useState, useEffect } from 'react';

export default function Transactions({ user }) {
  const [txns, setTxns] = useState([]);
  const [form, setForm] = useState({
    date: '',
    amount: '',
    description: '',
    category: ''
  });

  // Fetch transactions for this user
  useEffect(() => {
    async function load() {
      const res = await fetch('/.netlify/functions/get-transactions');
      const data = await res.json();
      setTxns(data.filter(t => t.user_id === user.id));
    }
    load();
  }, [user.id]);

  // Add a new transaction
  const addTxn = async e => {
    e.preventDefault();
    await fetch('/.netlify/functions/create-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, user_id: user.id })
    });
    setForm({ date: '', amount: '', description: '', category: '' });
    // re-fetch
    const res = await fetch('/.netlify/functions/get-transactions');
    const data = await res.json();
    setTxns(data.filter(t => t.user_id === user.id));
  };

  return (
    <div style={{ maxWidth: 600, margin: '1rem auto' }}>
      <h2>Your Transactions</h2>
      <form onSubmit={addTxn} style={{ display: 'grid', gap: '.5rem' }}>
        <input
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Category"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          required
        />
        <button type="submit">Add Transaction</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Date</th><th>Amt</th><th>Desc</th><th>Cat</th>
          </tr>
        </thead>
        <tbody>
          {txns.map(t => (
            <tr key={t.id}>
              <td>{t.date}</td>
              <td>{parseFloat(t.amount).toFixed(2)}</td>
              <td>{t.description}</td>
              <td>{t.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
