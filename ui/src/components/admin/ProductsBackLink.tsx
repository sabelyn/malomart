import { Link } from "react-router";

import { ADMIN_PRODUCTS_PATH } from "@/routes/paths";
import pages from "@/styles/pages.module.css";

const ProductsBackLink = () => (
  <Link to={ADMIN_PRODUCTS_PATH} className={pages.backLink}>
    All products
  </Link>
);

export default ProductsBackLink;
