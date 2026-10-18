import { Title } from "@mantine/core";
import { Link } from "react-router";

import MaloSays from "@/components/MaloSays";
import { CATALOG_PATH } from "@/routes/paths";
import pages from "@/styles/pages.module.css";

const ProductNotFound = () => (
  <>
    <Title order={1}>Not on the shelves</Title>
    <MaloSays>Never heard of it. Maybe Chudley sold it.</MaloSays>
    <Link to={CATALOG_PATH} className={pages.backLink}>
      Back to the catalog
    </Link>
  </>
);

export default ProductNotFound;
