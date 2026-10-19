import { Badge, Button, FileInput, Text, VisuallyHidden } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";
import { deleteProductImage, getProduct, products, setImageAsThumbnail } from "@mm/lib/products";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { endpointKey, routeKey, useEndpointMutation } from "@/api";
import ConfirmModal from "@/components/ConfirmModal";
import { productImageSrc } from "@/components/product/productDisplay";
import { alerts, statusMessages, ui } from "@/copy";
import { announce } from "@/utils/notify";
import classes from "./admin.module.css";
import type { ImageUploadItem, UploadState } from "./useImageUploads";
import { isUploadDone, useImageUploads } from "./useImageUploads";

const PREVIEW_WIDTH = 320;

const ERROR_STATES = new Set<UploadState>(["rejected", "notImage", "tooLarge", "failed"]);

const imageHash = (imageKey: string) => imageKey.split("/").at(-1)!;

const orderedImages = ({ imageKeys = [], thumbnailKey }: ProductDto) =>
  [...imageKeys].sort((a, b) => Number(b === thumbnailKey) - Number(a === thumbnailKey) || a.localeCompare(b));

type DeleteState = { opened: boolean; imageKey?: string; label?: string };

const ImagesSection = ({ product }: { product: ProductDto }) => {
  const queryClient = useQueryClient();
  const uploadInputRef = useRef<HTMLButtonElement>(null);
  const imageListRef = useRef<HTMLUListElement>(null);
  const [focusThumbnail, setFocusThumbnail] = useState(false);
  const deletedRef = useRef(false);
  const [deleting, setDeleting] = useState<DeleteState>({ opened: false });
  const [status, setStatus] = useState("");
  const images = orderedImages(product);

  const refreshProduct = () => queryClient.invalidateQueries({ queryKey: routeKey(products) });

  const { uploads, start, clearFinished } = useImageUploads(product.id, (upload: ImageUploadItem) => {
    announce(ui.admin.upload(upload.name, upload.state), ERROR_STATES.has(upload.state));
    if (upload.state === "added" || upload.state === "duplicate" || upload.state === "timedOut") {
      void refreshProduct();
    }
  });

  const updateCachedProduct = (updated: ProductDto) =>
    queryClient.setQueryData(endpointKey(getProduct, { params: { id: product.id } }), updated);

  const makeThumbnail = useEndpointMutation(setImageAsThumbnail, {
    invalidates: [products],
    onSuccess: updated => {
      updateCachedProduct(updated);
      setStatus(statusMessages.admin.thumbnailUpdated);
      setFocusThumbnail(true);
    }
  });

  const remove = useEndpointMutation(deleteProductImage, {
    invalidates: [products],
    onSuccess: updated => {
      updateCachedProduct(updated);
      deletedRef.current = true;
      setStatus(statusMessages.admin.imageDeleted(deleting.label));
      setDeleting(current => ({ ...current, opened: false }));
    }
  });

  const openDelete = (imageKey: string, label: string) => {
    remove.reset();
    setDeleting({ opened: true, imageKey, label });
  };

  const afterDeleteClosed = () => {
    if (deletedRef.current) {
      deletedRef.current = false;
      uploadInputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (focusThumbnail) {
      imageListRef.current?.querySelector<HTMLParagraphElement>("[data-thumbnail] p")?.focus();
      setFocusThumbnail(false);
    }
  }, [focusThumbnail]);

  const uploadsDone = uploads.length > 0 && uploads.every(upload => isUploadDone(upload.state));

  return (
    <>
      {images.length === 0 ? (
        <Text mb="lg">{ui.admin.imagesEmpty}</Text>
      ) : (
        <ul ref={imageListRef} className={classes.imageGrid}>
          {images.map((imageKey, index) => {
            const label = ui.admin.imageLabel(index + 1);
            const isThumbnail = imageKey === product.thumbnailKey;
            return (
              <li key={imageKey} className={classes.imageCard} data-thumbnail={isThumbnail || undefined}>
                <img src={productImageSrc(imageKey, PREVIEW_WIDTH)} alt="" loading="lazy" className={classes.image} />
                <p className={classes.imageLabel} tabIndex={isThumbnail ? -1 : undefined}>
                  {label}
                  {isThumbnail && (
                    <Badge component="span" variant="outline" color="gold">
                      {ui.admin.thumbnail}
                    </Badge>
                  )}
                </p>
                <div className={classes.imageActions}>
                  {!isThumbnail && (
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      onClick={() =>
                        !makeThumbnail.isPending &&
                        makeThumbnail.mutate({ params: { id: product.id, hash: imageHash(imageKey) } })
                      }
                    >
                      <span>
                        Make <VisuallyHidden>{label.toLowerCase()} the</VisuallyHidden> thumbnail
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="subtle"
                    color="red.4"
                    size="compact-sm"
                    onClick={() => openDelete(imageKey, label.toLowerCase())}
                  >
                    {ui.common.delete} <VisuallyHidden>{label.toLowerCase()}</VisuallyHidden>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {makeThumbnail.isError && (
        <Text role="alert" className={classes.error}>
          {alerts.admin.thumbnailFailed}
        </Text>
      )}

      <FileInput
        ref={uploadInputRef}
        label={ui.admin.addImages}
        description={ui.admin.addImagesHint}
        placeholder={ui.admin.chooseFiles}
        accept="image/*"
        multiple
        clearable={false}
        value={[]}
        onChange={files => start(files)}
        mt="lg"
        maw="40rem"
      />
      {uploads.length > 0 && (
        <>
          <ul aria-label={ui.admin.uploads} className={classes.uploads}>
            {uploads.map(({ id, name, state }) => (
              <li key={id} data-tone={ERROR_STATES.has(state) ? "error" : undefined}>
                {ui.admin.upload(name, state)}
              </li>
            ))}
          </ul>
          {uploadsDone && (
            <Button variant="subtle" size="compact-sm" mt="xs" onClick={clearFinished}>
              {ui.admin.clearUploads}
            </Button>
          )}
        </>
      )}

      <ConfirmModal
        opened={deleting.opened}
        title={ui.admin.deleteImageTitle(deleting.label)}
        confirmLabel={ui.admin.deleteImageConfirm}
        dismissLabel={ui.common.keepIt}
        pending={remove.isPending}
        error={remove.isError ? alerts.admin.deleteImageFailed : undefined}
        onConfirm={() =>
          deleting.imageKey && remove.mutate({ params: { id: product.id, hash: imageHash(deleting.imageKey) } })
        }
        onClose={() => setDeleting(current => ({ ...current, opened: false }))}
        onExitTransitionEnd={afterDeleteClosed}
      >
        {deleting.imageKey === product.thumbnailKey ? ui.admin.deleteThumbnailWarning : ui.admin.deleteImageWarning}
      </ConfirmModal>
    </>
  );
};

export default ImagesSection;
