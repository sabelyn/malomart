import { Container, SimpleGrid } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { Id } from "@mm/lib/common";
import { getProduct } from "@mm/lib/products";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { endpointQuery, useSession } from "@/api";
import PageLoader from "@/components/PageLoader";
import ProductBreadcrumbs from "@/components/product/ProductBreadcrumbs";
import { percentOff } from "@/components/product/productDisplay";
import ProductGallery from "@/components/product/ProductGallery";
import ProductNotFound from "@/components/product/ProductNotFound";
import ProductSummary from "@/components/product/ProductSummary";
import { ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { adminProductPath } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

const isMissing = (err: unknown) => err instanceof ApiRequestError && (err.status === 404 || err.status === 400);

const ProductPage = () => {
  const { id = "" } = useParams();
  const { data: user } = useSession();
  const validId = Id.safeParse(id).success;
  const { data: product, error } = useQuery({
    ...endpointQuery(getProduct, { params: { id } }),
    enabled: validId,
    throwOnError: err => !isMissing(err)
  });
  const notFound = !validId || isMissing(error);
  useDocumentTitle(notFound ? ui.pageTitles.productNotFound : product?.title);

  const renderContent = () => {
    if (notFound) {
      return <ProductNotFound />;
    }
    if (!product) {
      return <PageLoader />;
    }
    return (
      <>
        <ProductBreadcrumbs category={product.category} title={product.title} />
        {user?.isAdmin && (
          <Link to={adminProductPath(product.id)} className={classes.adminLink}>
            {ui.product.editLink}
          </Link>
        )}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48} verticalSpacing="xl">
          <ProductGallery
            key={product.id}
            title={product.title}
            thumbnailKey={product.thumbnailKey}
            imageKeys={product.imageKeys}
            percentOff={percentOff(product.price, product.originalPrice)}
          />
          <ProductSummary product={product} />
        </SimpleGrid>
      </>
    );
  };

  return (
    <Container size="lg" className={classes.page}>
      {renderContent()}
    </Container>
  );
};

export default ProductPage;
