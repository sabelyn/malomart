import { Text, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { Id } from "@mm/lib/common";
import { getProduct } from "@mm/lib/products";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { endpointQuery } from "@/api";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { productPath } from "@/routes/paths";
import pages from "@/styles/pages.module.css";
import { notify } from "@/utils/notify";
import classes from "./admin.module.css";
import DeleteProductSection from "./DeleteProductSection";
import EditorSection from "./EditorSection";
import ImagesSection from "./ImagesSection";
import ProductForm from "./ProductForm";
import ProductsBackLink from "./ProductsBackLink";
import StockSection from "./StockSection";

const isMissing = (err: unknown) => err instanceof ApiRequestError && (err.status === 404 || err.status === 400);

const EditProduct = ({ id }: { id: string }) => {
  const validId = Id.safeParse(id).success;
  const { data: product, error } = useQuery({
    ...endpointQuery(getProduct, { params: { id } }),
    enabled: validId,
    throwOnError: err => !isMissing(err)
  });
  const notFound = !validId || isMissing(error);
  useDocumentTitle(`${notFound ? "Product not found" : (product?.title ?? "Product")} · Back office`);

  if (notFound) {
    return (
      <>
        <Title order={1}>Product not found</Title>
        <Text mt="md">It may have been deleted.</Text>
        <ProductsBackLink />
      </>
    );
  }
  if (!product) {
    return <PageLoader />;
  }

  return (
    <>
      <div className={classes.editorHeader}>
        <Title order={1}>Edit {product.title}</Title>
        <Link to={productPath(product.id)} className={pages.backLink}>
          View in the shop
        </Link>
      </div>

      <EditorSection id="product-details-heading" title="Details">
        <ProductForm
          key={product.id}
          product={product}
          onSaved={saved => notify({ message: `Saved ${saved.title}.` })}
        />
      </EditorSection>

      <EditorSection id="product-stock-heading" title="Stock">
        <StockSection product={product} />
      </EditorSection>

      <EditorSection id="product-images-heading" title="Images">
        <ImagesSection product={product} />
      </EditorSection>

      <DeleteProductSection product={product} />

      <ProductsBackLink />
    </>
  );
};

export default EditProduct;
