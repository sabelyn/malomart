import { Container, Title } from "@mantine/core";
import { ListProductsQuery } from "@mm/lib/products";

import CatalogFilters from "@/components/catalog/CatalogFilters";
import CatalogResults from "@/components/catalog/CatalogResults";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import classes from "@/styles/pages.module.css";

const CatalogSearch = ListProductsQuery.pick({ category: true, inStock: true });

const CatalogPage = () => {
  const [{ category, inStock }, updateSearch] = useSchemaSearch(CatalogSearch);
  useDocumentTitle(category ?? "Catalog");

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1} className={classes.eyebrow}>
        Catalog
      </Title>
      <ChudleyHype heading={false}>You'll buy it now, if you're smart, at MAAAA-LOOOO MART!</ChudleyHype>
      <MaloSays>Everything here is for sale. Pick something.</MaloSays>
      <CatalogFilters category={category} inStock={inStock} onChange={updateSearch} />
      <CatalogResults category={category} inStock={inStock} />
    </Container>
  );
};

export default CatalogPage;
