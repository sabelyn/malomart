import { Link } from "react-router";

import { ui } from "@/copy";
import { ADMIN_PRODUCTS_PATH } from "@/routes/paths";
import pages from "@/styles/pages.module.css";

const ProductsBackLink = () => (
  <Link to={ADMIN_PRODUCTS_PATH} className={pages.backLink}>
    {ui.admin.allProducts}
  </Link>
);

export default ProductsBackLink;
