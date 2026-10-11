import type { Category } from "@mm/lib/products";
import { Link } from "react-router";

import classes from "./ProductBreadcrumbs.module.css";

type ProductBreadcrumbsProps = {
  category: Category;
  title: string;
};

const ProductBreadcrumbs = ({ category, title }: ProductBreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={classes.breadcrumbs}>
    <ol>
      <li>
        <Link to="/products">Catalog</Link>
      </li>
      <li>
        <Link to={`/products?${new URLSearchParams({ category })}`}>{category}</Link>
      </li>
      <li aria-current="page">{title}</li>
    </ol>
  </nav>
);

export default ProductBreadcrumbs;
