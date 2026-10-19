import { Title } from "@mantine/core";
import { Link } from "react-router";

import MaloSays from "@/components/MaloSays";
import { malo, ui } from "@/copy";
import { CATALOG_PATH } from "@/routes/paths";
import pages from "@/styles/pages.module.css";

const ProductNotFound = () => (
  <>
    <Title order={1}>{ui.product.notFoundHeading}</Title>
    <MaloSays>{malo.productNotFound}</MaloSays>
    <Link to={CATALOG_PATH} className={pages.backLink}>
      {ui.product.backToCatalog}
    </Link>
  </>
);

export default ProductNotFound;
