import { Container } from "@mantine/core";
import { useParams } from "react-router";

import classes from "@/components/admin/admin.module.css";
import EditProduct from "@/components/admin/EditProduct";
import NewProduct from "@/components/admin/NewProduct";
import pages from "@/styles/pages.module.css";

const ProductEditorPage = () => {
  const { id } = useParams();

  return (
    <Container size="lg" className={`${pages.page} ${classes.editor}`}>
      {id ? <EditProduct key={id} id={id} /> : <NewProduct />}
    </Container>
  );
};

export default ProductEditorPage;
