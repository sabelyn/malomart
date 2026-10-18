import { Button, Container, Text, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { Id } from "@mm/lib/common";
import type { ProductDto } from "@mm/lib/products";
import { deleteProduct, getProduct, products } from "@mm/lib/products";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { endpointQuery, routeKey, useEndpointMutation } from "@/api";
import classes from "@/components/admin/admin.module.css";
import { adminProductPath } from "@/components/admin/adminDisplay";
import ImagesSection from "@/components/admin/ImagesSection";
import ProductForm from "@/components/admin/ProductForm";
import StockSection from "@/components/admin/StockSection";
import ConfirmModal from "@/components/ConfirmModal";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { notify } from "@/notifications/notify";
import pages from "../pages.module.css";

const PRODUCTS_PATH = "/admin/products";

const isMissing = (err: unknown) => err instanceof ApiRequestError && (err.status === 404 || err.status === 400);

const EditorSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id} className={classes.editorSection}>
    <Title order={2} id={id} className={classes.editorSectionTitle}>
      {title}
    </Title>
    {children}
  </section>
);

const BackLink = () => (
  <Link to={PRODUCTS_PATH} className={pages.backLink}>
    All products
  </Link>
);

const NewProduct = () => {
  const navigate = useNavigate();
  useDocumentTitle("New product · Back office");

  const created = (product: ProductDto) => {
    notify({ message: `Created ${product.title}. Add some images next.` });
    void navigate(adminProductPath(product.id), { replace: true });
  };

  return (
    <>
      <Title order={1}>New product</Title>
      <EditorSection id="product-details-heading" title="Details">
        <ProductForm onSaved={created} />
      </EditorSection>
      <BackLink />
    </>
  );
};

const EditProduct = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const validId = Id.safeParse(id).success;
  const { data: product, error } = useQuery({
    ...endpointQuery(getProduct, { params: { id } }),
    enabled: validId,
    throwOnError: err => !isMissing(err)
  });
  const notFound = !validId || isMissing(error);
  useDocumentTitle(`${notFound ? "Product not found" : (product?.title ?? "Product")} · Back office`);

  const remove = useEndpointMutation(deleteProduct, {
    onSuccess: async () => {
      notify({ message: `Deleted ${product?.title ?? "the product"}.` });
      await navigate(PRODUCTS_PATH, { replace: true });
      await queryClient.invalidateQueries({ queryKey: routeKey(products) });
    }
  });

  if (notFound) {
    return (
      <>
        <Title order={1}>Product not found</Title>
        <Text mt="md">It may have been deleted.</Text>
        <BackLink />
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
        <Link to={`/products/${product.id}`} className={pages.backLink}>
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

      <EditorSection id="product-delete-heading" title="Delete product">
        <Text className={classes.dangerZone}>
          Takes it out of the catalog and deletes its images. Past orders keep its name.
        </Text>
        <Button
          mt="md"
          variant="outline"
          color="red.4"
          onClick={() => {
            remove.reset();
            setConfirmingDelete(true);
          }}
        >
          Delete {product.title}
        </Button>
      </EditorSection>

      <BackLink />

      <ConfirmModal
        opened={confirmingDelete}
        title={`Delete ${product.title}?`}
        confirmLabel="Delete product"
        dismissLabel="Keep it"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't delete the product. Try again." : undefined}
        onConfirm={() => remove.mutate({ params: { id: product.id } })}
        onClose={() => setConfirmingDelete(false)}
      >
        There's no undo.
      </ConfirmModal>
    </>
  );
};

const ProductEditorPage = () => {
  const { id } = useParams();

  return (
    <Container size="lg" className={`${pages.page} ${classes.editor}`}>
      {id ? <EditProduct key={id} id={id} /> : <NewProduct />}
    </Container>
  );
};

export default ProductEditorPage;
