import { Container, Title } from "@mantine/core";
import { ListProductsQuery } from "@mm/lib/products";

import CatalogFilters from "@/components/catalog/CatalogFilters";
import CatalogResults from "@/components/catalog/CatalogResults";
import { useLayoutContext } from "@/components/Layout";
import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import classes from "./pages.module.css";

const CatalogSearch = ListProductsQuery.pick({ category: true, inStock: true });

const CatalogPage = () => {
  const { addToCart } = useLayoutContext();
  const [{ category, inStock }, updateSearch] = useSchemaSearch(CatalogSearch);
  useDocumentTitle(category ?? "Catalog");

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>Catalog</Title>
      <MaloSays>Everything here is for sale. Pick something.</MaloSays>
      <CatalogFilters category={category} inStock={inStock} onChange={updateSearch} />
      <CatalogResults category={category} inStock={inStock} onAddToCart={addToCart} />
    </Container>
  );
};

export default CatalogPage;
