import React from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme";
import App from "./App";
<link
  href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;1,400&display=swap"
  rel="stylesheet"
/>


const container = document.getElementById("root");
const root = createRoot(container);


root.render(
  <ChakraProvider theme={theme}>
    <App />
  </ChakraProvider>
);
