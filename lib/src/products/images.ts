export const IMAGE_WIDTHS = [320, 640, 1280];
export const IMAGE_KEY_PREFIX = "images/";
export const imageVariantKey = (imageKey: string, width: number) => `${IMAGE_KEY_PREFIX}${imageKey}-${width}.webp`;
