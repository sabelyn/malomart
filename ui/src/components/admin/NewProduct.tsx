import { Title } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";
import { useNavigate } from "react-router";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { adminProductPath } from "@/routes/paths";
import { notify } from "@/utils/notify";
import EditorSection from "./EditorSection";
import ProductForm from "./ProductForm";
import ProductsBackLink from "./ProductsBackLink";

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
      <ProductsBackLink />
    </>
  );
};

export default NewProduct;
