import { ui } from "@/copy";
import classes from "./SaleSticker.module.css";

type SaleStickerProps = {
  percentOff: number;
  className?: string;
};

const SaleSticker = ({ percentOff, className }: SaleStickerProps) =>
  percentOff > 0 ? (
    <p className={className ? `${classes.sticker} ${className}` : classes.sticker}>{ui.product.sale(percentOff)}</p>
  ) : null;

export default SaleSticker;
