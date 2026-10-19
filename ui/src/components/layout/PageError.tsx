import { Button, Container, Title } from "@mantine/core";

import MaloSays from "@/components/MaloSays";
import { malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "@/styles/pages.module.css";

type PageErrorProps = {
  onRetry: () => void;
};

const PageError = ({ onRetry }: PageErrorProps) => {
  useDocumentTitle(ui.pageTitles.pageError);

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>{ui.pageError.heading}</Title>
      <MaloSays>{malo.pageError}</MaloSays>
      <Button mt="xl" variant="outline" onClick={onRetry}>
        {ui.common.tryAgain}
      </Button>
    </Container>
  );
};

export default PageError;
