import { Badge, Button, FileInput, Text, VisuallyHidden } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";
import { deleteProductImage, getProduct, MAX_UPLOAD_BYTES, products, setImageAsThumbnail } from "@mm/lib/products";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { endpointKey, routeKey, useEndpointMutation } from "@/api";
import ConfirmModal from "@/components/ConfirmModal";
import { productImageSrc } from "@/components/product/productDisplay";
import { announce } from "@/utils/notify";
import classes from "./admin.module.css";
import type { ImageUploadItem, UploadState } from "./useImageUploads";
import { isUploadDone, useImageUploads } from "./useImageUploads";

const PREVIEW_WIDTH = 320;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

const UPLOAD_TEXT: Record<UploadState, string> = {
  uploading: "Uploading…",
  processing: "Processing…",
  added: "Added.",
  duplicate: "Already one of this product's images.",
  rejected: "Couldn't read it as an image.",
  notImage: "Not an image file.",
  tooLarge: `Over the ${MAX_UPLOAD_MB} MB limit.`,
  timedOut: "Still processing. Check back in a minute.",
  failed: "Upload failed. Try again."
};

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
    announce(`${upload.name}: ${UPLOAD_TEXT[upload.state]}`, ERROR_STATES.has(upload.state));
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
      setStatus("Thumbnail updated. It's now image 1.");
      setFocusThumbnail(true);
    }
  });

  const remove = useEndpointMutation(deleteProductImage, {
    invalidates: [products],
    onSuccess: updated => {
      updateCachedProduct(updated);
      deletedRef.current = true;
      setStatus(`Deleted ${deleting.label ?? "the image"}.`);
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
        <Text mb="lg">No images yet. The catalog shows a blank placard until you add one.</Text>
      ) : (
        <ul ref={imageListRef} className={classes.imageGrid}>
          {images.map((imageKey, index) => {
            const label = `Image ${index + 1}`;
            const isThumbnail = imageKey === product.thumbnailKey;
            return (
              <li key={imageKey} className={classes.imageCard} data-thumbnail={isThumbnail || undefined}>
                <img src={productImageSrc(imageKey, PREVIEW_WIDTH)} alt="" loading="lazy" className={classes.image} />
                <p className={classes.imageLabel} tabIndex={isThumbnail ? -1 : undefined}>
                  {label}
                  {isThumbnail && (
                    <Badge component="span" variant="outline" color="gold">
                      Thumbnail
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
                    Delete <VisuallyHidden>{label.toLowerCase()}</VisuallyHidden>
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
          Couldn't change the thumbnail. Try again.
        </Text>
      )}

      <FileInput
        ref={uploadInputRef}
        label="Add images"
        description={`PNG, JPEG, WebP, or GIF up to ${MAX_UPLOAD_MB} MB each. Big ones are resized.`}
        placeholder="Choose files"
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
          <ul aria-label="Uploads" className={classes.uploads}>
            {uploads.map(({ id, name, state }) => (
              <li key={id} data-tone={ERROR_STATES.has(state) ? "error" : undefined}>
                {name}: {UPLOAD_TEXT[state]}
              </li>
            ))}
          </ul>
          {uploadsDone && (
            <Button variant="subtle" size="compact-sm" mt="xs" onClick={clearFinished}>
              Clear the upload list
            </Button>
          )}
        </>
      )}

      <ConfirmModal
        opened={deleting.opened}
        title={`Delete ${deleting.label ?? "this image"}?`}
        confirmLabel="Delete image"
        dismissLabel="Keep it"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't delete the image. Try again." : undefined}
        onConfirm={() =>
          deleting.imageKey && remove.mutate({ params: { id: product.id, hash: imageHash(deleting.imageKey) } })
        }
        onClose={() => setDeleting(current => ({ ...current, opened: false }))}
        onExitTransitionEnd={afterDeleteClosed}
      >
        {deleting.imageKey === product.thumbnailKey
          ? "It's the thumbnail, so the product goes without one until you pick another."
          : "It's removed from the product page right away."}
      </ConfirmModal>
    </>
  );
};

export default ImagesSection;
