import { Text, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { Id } from "@mm/lib/common";
import { getProduct } from "@mm/lib/products";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { endpointQuery } from "@/api";
import PageLoader from "@/components/PageLoader";
import { toasts, ui } from "@/copy";
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
  useDocumentTitle(ui.pageTitles.adminProduct(notFound ? ui.pageTitles.productNotFound : product?.title));

  if (notFound) {
    return (
      <>
        <Title order={1}>{ui.admin.productNotFound}</Title>
        <Text mt="md">{ui.admin.productMaybeDeleted}</Text>
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
        <Title order={1}>{ui.admin.editTitle(product.title)}</Title>
        <Link to={productPath(product.id)} className={pages.backLink}>
          {ui.admin.viewInShop}
        </Link>
      </div>

      <EditorSection id="product-details-heading" title={ui.admin.details}>
        <ProductForm
          key={product.id}
          product={product}
          onSaved={saved => notify({ message: toasts.admin.saved(saved.title) })}
        />
      </EditorSection>

      <EditorSection id="product-stock-heading" title={ui.admin.stock}>
        <StockSection product={product} />
      </EditorSection>

      <EditorSection id="product-images-heading" title={ui.admin.images}>
        <ImagesSection product={product} />
      </EditorSection>

      <DeleteProductSection product={product} />

      <ProductsBackLink />
    </>
  );
};

export default EditProduct;
