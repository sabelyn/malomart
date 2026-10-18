import type { Category } from "@mm/lib/products";
import { Link } from "react-router";

import { CATALOG_PATH, categoryPath } from "@/routes/paths";
import classes from "./ProductBreadcrumbs.module.css";

type ProductBreadcrumbsProps = {
  category: Category;
  title: string;
};

const ProductBreadcrumbs = ({ category, title }: ProductBreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={classes.breadcrumbs}>
    <ol>
      <li>
        <Link to={CATALOG_PATH}>Catalog</Link>
      </li>
      <li>
        <Link to={categoryPath(category)}>{category}</Link>
      </li>
      <li aria-current="page">{title}</li>
    </ol>
  </nav>
);

export default ProductBreadcrumbs;
