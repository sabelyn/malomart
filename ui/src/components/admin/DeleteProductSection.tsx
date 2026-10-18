import { Button, Text } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";
import { deleteProduct, products } from "@mm/lib/products";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { routeKey, useEndpointMutation } from "@/api";
import ConfirmModal from "@/components/ConfirmModal";
import { ADMIN_PRODUCTS_PATH } from "@/routes/paths";
import { notify } from "@/utils/notify";
import classes from "./admin.module.css";
import EditorSection from "./EditorSection";

const DeleteProductSection = ({ product }: { product: ProductDto }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useEndpointMutation(deleteProduct, {
    onSuccess: async () => {
      notify({ message: `Deleted ${product.title}.` });
      await navigate(ADMIN_PRODUCTS_PATH, { replace: true });
      await queryClient.invalidateQueries({ queryKey: routeKey(products) });
    }
  });

  return (
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
          setConfirming(true);
        }}
      >
        Delete {product.title}
      </Button>

      <ConfirmModal
        opened={confirming}
        title={`Delete ${product.title}?`}
        confirmLabel="Delete product"
        dismissLabel="Keep it"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't delete the product. Try again." : undefined}
        onConfirm={() => remove.mutate({ params: { id: product.id } })}
        onClose={() => setConfirming(false)}
      >
        There's no undo.
      </ConfirmModal>
    </EditorSection>
  );
};

export default DeleteProductSection;
