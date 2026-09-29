import { Button, Container, Title } from "@mantine/core";

import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "@/pages/pages.module.css";

type PageErrorProps = {
  onRetry: () => void;
};

const PageError = ({ onRetry }: PageErrorProps) => {
  useDocumentTitle("Something broke");

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>Something broke.</Title>
      <MaloSays>Not my fault. Try again.</MaloSays>
      <Button mt="xl" color="gilt" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </Container>
  );
};

export default PageError;
