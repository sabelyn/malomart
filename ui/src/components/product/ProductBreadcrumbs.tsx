import type { Category } from "@mm/lib/products";
import { Link } from "react-router";

import { ui } from "@/copy";
import { CATALOG_PATH, categoryPath } from "@/routes/paths";
import classes from "./ProductBreadcrumbs.module.css";

type ProductBreadcrumbsProps = {
  category: Category;
  title: string;
};

const ProductBreadcrumbs = ({ category, title }: ProductBreadcrumbsProps) => (
  <nav aria-label={ui.product.breadcrumb} className={classes.breadcrumbs}>
    <ol>
      <li>
        <Link to={CATALOG_PATH}>{ui.product.catalog}</Link>
      </li>
      <li>
        <Link to={categoryPath(category)}>{category}</Link>
      </li>
      <li aria-current="page">{title}</li>
    </ol>
  </nav>
);

export default ProductBreadcrumbs;
