import { Container } from "@mantine/core";
import { Link } from "react-router";

import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./pages.module.css";

const NotFoundPage = () => {
  useDocumentTitle("Not found");

  return (
    <Container size="lg" className={classes.page}>
      <ChudleyHype>Nothing on this shelf! Not even dust!</ChudleyHype>
      <MaloSays>Wrong aisle.</MaloSays>
      <Link to="/" className={classes.backLink}>
        Back to the shop
      </Link>
    </Container>
  );
};

export default NotFoundPage;
