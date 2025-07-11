// src/theme.js
import { extendTheme } from '@chakra-ui/react'

// 1️⃣ Color tokens based on your logo
const colors = {
  primary: '#1A73E8',    // your blue
  secondary: '#6A1B9A',  // your “pink” (purple-ish)
  accent: '#FBC02D',     // your yellow
}

// 2️⃣ Optional: global styles so things feel cohesive
const styles = {
  global: {
    body: {
      bg: 'gray.50',
      color: 'gray.800',
    },
    'a:hover': {
      textDecoration: 'none',
    },
  },
}

// 3️⃣ Font setup (you can keep or swap out)
const fonts = {
  heading: `'Inter', sans-serif`,
  body:    `'Inter', sans-serif`,
}

// 4️⃣ Bring it all together
const theme = extendTheme({
  colors,
  styles,
  fonts,
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
})

export default theme
