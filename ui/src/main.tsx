import "@fontsource-variable/inter/index.css";
import "@fontsource/shrikhand/400.css";
import "@mantine/core/styles.css";
import "@/styles/global.css";

import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { queryClient } from "@/api";
import App from "@/App";
import theme from "./theme";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <App />
        </MantineProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>
);
