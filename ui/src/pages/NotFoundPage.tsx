import { Container, Title } from "@mantine/core";
import { Link } from "react-router";

import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import voices from "@/styles/voices.module.css";
import classes from "./pages.module.css";

const NotFoundPage = () => {
  useDocumentTitle("Not found");

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1} className={voices.hype}>
        Nothing on this shelf! Not even dust!
      </Title>
      <MaloSays>Wrong aisle.</MaloSays>
      <Link to="/" className={classes.backLink}>
        Back to the shop
      </Link>
    </Container>
  );
};

export default NotFoundPage;
