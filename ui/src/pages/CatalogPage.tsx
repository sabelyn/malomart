import { Container, Title } from "@mantine/core";
import { ListProductsQuery } from "@mm/lib/products";

import CatalogFilters from "@/components/catalog/CatalogFilters";
import CatalogResults from "@/components/catalog/CatalogResults";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { chudley, malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import classes from "@/styles/pages.module.css";

const CatalogSearch = ListProductsQuery.pick({ category: true, inStock: true });

const CatalogPage = () => {
  const [{ category, inStock }, updateSearch] = useSchemaSearch(CatalogSearch);
  useDocumentTitle(category ?? ui.pageTitles.catalog);

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1} className={classes.eyebrow}>
        {ui.catalog.eyebrow}
      </Title>
      <ChudleyHype heading={false}>{chudley.catalog}</ChudleyHype>
      <MaloSays>{malo.catalog.intro}</MaloSays>
      <CatalogFilters category={category} inStock={inStock} onChange={updateSearch} />
      <CatalogResults category={category} inStock={inStock} />
    </Container>
  );
};

export default CatalogPage;
