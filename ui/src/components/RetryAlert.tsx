import { Button } from "@mantine/core";
import type { ReactNode } from "react";

import { ui } from "@/copy";

type RetryAlertProps = {
  children: ReactNode;
  onRetry: () => void;
};

const RetryAlert = ({ children, onRetry }: RetryAlertProps) => (
  <div role="alert">
    {children}
    <Button mt="lg" variant="outline" onClick={onRetry}>
      {ui.common.tryAgain}
    </Button>
  </div>
);

export default RetryAlert;
