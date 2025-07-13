import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#ebf8ff',
    100: '#cee4ff',
    200: '#aed0ff',
    300: '#8ebcff',
    400: '#6ea8ff',
    500: '#4e94ff',
    600: '#407fd9',
    700: '#305bae',
    800: '#204783',
    900: '#102459',
  },
  secondary: {
    50: '#ffe5f0',
    100: '#ffbed3',
    200: '#ff95b5',
    300: '#ff6c97',
    400: '#ff4479',
    500: '#ff1b5b',
    600: '#d31549',
    700: '#a10f37',
    800: '#700a25',
    900: '#400512',
  },
  accent: {
    50: '#fffbe6',
    100: '#fff4bf',
    200: '#ffec96',
    300: '#ffe36d',
    400: '#ffdb44',
    500: '#ffd31b',
    600: '#d1ab17',
    700: '#a18311',
    800: '#71590b',
    900: '#402d06',
  },
};

export default extendTheme({ config, colors });
