import { Button } from "@mantine/core";
import type { ReactNode } from "react";

type RetryAlertProps = {
  children: ReactNode;
  onRetry: () => void;
};

const RetryAlert = ({ children, onRetry }: RetryAlertProps) => (
  <div role="alert">
    {children}
    <Button mt="lg" variant="outline" onClick={onRetry}>
      Try again
    </Button>
  </div>
);

export default RetryAlert;
