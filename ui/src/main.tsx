import "@fontsource-variable/inter/index.css";
import "@fontsource/shrikhand/400.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@/styles/global.css";

import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { queryClient } from "@/api";
import App from "@/App";
import { CartProvider } from "@/components/cart/CartProvider";
import AppNotifications from "@/components/layout/AppNotifications";
import { SessionExitProvider } from "@/routes/sessionExit";
import theme from "./theme";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionExitProvider>
          <MantineProvider theme={theme} forceColorScheme="dark">
            <AppNotifications />
            <CartProvider>
              <App />
            </CartProvider>
          </MantineProvider>
        </SessionExitProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>
);
