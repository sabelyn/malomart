import { Container, Title } from "@mantine/core";

import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./pages.module.css";

type PlaceholderPageProps = {
  title: string;
};

const PlaceholderPage = ({ title }: PlaceholderPageProps) => {
  useDocumentTitle(title);

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>{title}</Title>
      <MaloSays>Not built yet. Come back later.</MaloSays>
    </Container>
  );
};

export default PlaceholderPage;
