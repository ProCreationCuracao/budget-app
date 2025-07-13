import React from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme'
import AppTabs from './components/AppTabs'
import { TransactionsProvider } from './context/TransactionsContext'

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <TransactionsProvider>
        <AppTabs />
      </TransactionsProvider>
    </ChakraProvider>
  )
}
