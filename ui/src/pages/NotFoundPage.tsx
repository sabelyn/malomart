import { Container } from "@mantine/core";
import { Link } from "react-router";

import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { chudley, malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { HOME_PATH } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

const NotFoundPage = () => {
  useDocumentTitle(ui.pageTitles.notFound);

  return (
    <Container size="lg" className={classes.page}>
      <ChudleyHype>{chudley.notFound}</ChudleyHype>
      <MaloSays>{malo.notFound}</MaloSays>
      <Link to={HOME_PATH} className={classes.backLink}>
        {ui.notFound.backLink}
      </Link>
    </Container>
  );
};

export default NotFoundPage;
