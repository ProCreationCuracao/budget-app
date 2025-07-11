import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import Auth from './components/Auth';
import AppTabs from './components/AppTabs';

// ★ Wrap your tabs (and thus Dashboard) in the DateFilterProvider
import { DateFilterProvider } from './context/DateFilterContext';

export default function App() {
  return (
    <Auth>
      <ChakraProvider theme={theme}>
        <DateFilterProvider>
          <AppTabs />
        </DateFilterProvider>
      </ChakraProvider>
    </Auth>
  );
}
