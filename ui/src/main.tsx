import "@fontsource-variable/inter/index.css";
import "@mantine/core/styles.css";
import "@/styles/global.css";

import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import theme from "./theme";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
        <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>
);
