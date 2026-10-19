import { Title } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";
import { useNavigate } from "react-router";

import { toasts, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { adminProductPath } from "@/routes/paths";
import { notify } from "@/utils/notify";
import EditorSection from "./EditorSection";
import ProductForm from "./ProductForm";
import ProductsBackLink from "./ProductsBackLink";

const NewProduct = () => {
  const navigate = useNavigate();
  useDocumentTitle(ui.pageTitles.adminNewProduct);

  const created = (product: ProductDto) => {
    notify({ message: toasts.admin.created(product.title) });
    void navigate(adminProductPath(product.id), { replace: true });
  };

  return (
    <>
      <Title order={1}>{ui.admin.newProduct}</Title>
      <EditorSection id="product-details-heading" title={ui.admin.details}>
        <ProductForm onSaved={created} />
      </EditorSection>
      <ProductsBackLink />
    </>
  );
};

export default NewProduct;
