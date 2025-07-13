import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const TransactionsContext = createContext()

export function TransactionsProvider({ children }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTransactions = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error loading transactions:', error)
    else setTransactions(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  return (
    <TransactionsContext.Provider value={{ transactions, loading, refresh: fetchTransactions }}>
      {children}
    </TransactionsContext.Provider>
  )
}

export function useTransactions() {
  return useContext(TransactionsContext)
}
