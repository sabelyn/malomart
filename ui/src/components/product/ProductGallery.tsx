import { UnstyledButton } from "@mantine/core";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import { productImageSrc, productImageSrcSet } from "@/components/product/productDisplay";
import SaleSticker from "@/components/product/SaleSticker";
import classes from "./ProductGallery.module.css";

type ProductGalleryProps = {
  title: string;
  thumbnailKey?: string | null;
  imageKeys?: string[];
  percentOff: number;
};

const THUMBNAIL_WIDTH = 320;
const MAX_UPSCALE = 4;

const orderImages = (thumbnailKey?: string | null, imageKeys: string[] = []) =>
  thumbnailKey ? [thumbnailKey, ...imageKeys.filter(key => key !== thumbnailKey)] : imageKeys;

const capUpscale = (event: SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget;
  image.style.setProperty("--max-width", `${image.naturalWidth * MAX_UPSCALE}px`);
};

const ProductGallery = ({ title, thumbnailKey, imageKeys, percentOff }: ProductGalleryProps) => {
  const images = orderImages(thumbnailKey, imageKeys);
  const [selected, setSelected] = useState(0);
  const current = images[selected];

  return (
    <div className={classes.gallery}>
      <div className={classes.stage}>
        <SaleSticker percentOff={percentOff} />
        {current ? (
          <img
            key={current}
            src={productImageSrc(current, THUMBNAIL_WIDTH)}
            srcSet={productImageSrcSet(current)}
            sizes="(min-width: 62em) 36rem, 100vw"
            alt={images.length > 1 ? `${title}, image ${selected + 1} of ${images.length}` : title}
            onLoad={capUpscale}
            className={classes.image}
          />
        ) : (
          <p className={classes.empty}>No picture. Use your imagination.</p>
        )}
      </div>
      {images.length > 1 && (
        <div role="group" aria-label="Product images" className={classes.thumbnails}>
          {images.map((key, index) => (
            <UnstyledButton
              key={key}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
              className={classes.thumbnail}
            >
              <img src={productImageSrc(key, THUMBNAIL_WIDTH)} alt="" />
            </UnstyledButton>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
