import { Button, Text } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";
import { deleteProduct, products } from "@mm/lib/products";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { routeKey, useEndpointMutation } from "@/api";
import ConfirmModal from "@/components/ConfirmModal";
import { alerts, toasts, ui } from "@/copy";
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
      notify({ message: toasts.admin.deleted(product.title) });
      await navigate(ADMIN_PRODUCTS_PATH, { replace: true });
      await queryClient.invalidateQueries({ queryKey: routeKey(products) });
    }
  });

  return (
    <EditorSection id="product-delete-heading" title={ui.admin.deleteSection}>
      <Text className={classes.dangerZone}>{ui.admin.deleteSectionBlurb}</Text>
      <Button
        mt="md"
        variant="outline"
        color="red.4"
        onClick={() => {
          remove.reset();
          setConfirming(true);
        }}
      >
        {ui.admin.deleteButton(product.title)}
      </Button>

      <ConfirmModal
        opened={confirming}
        title={ui.admin.deleteTitle(product.title)}
        confirmLabel={ui.admin.deleteConfirm}
        dismissLabel={ui.common.keepIt}
        pending={remove.isPending}
        error={remove.isError ? alerts.admin.deleteProductFailed : undefined}
        onConfirm={() => remove.mutate({ params: { id: product.id } })}
        onClose={() => setConfirming(false)}
      >
        {ui.admin.noUndo}
      </ConfirmModal>
    </EditorSection>
  );
};

export default DeleteProductSection;
