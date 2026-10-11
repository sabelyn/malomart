import classes from "./SaleSticker.module.css";

type SaleStickerProps = {
  percentOff: number;
  className?: string;
};

const SaleSticker = ({ percentOff, className }: SaleStickerProps) =>
  percentOff > 0 ? (
    <p className={className ? `${classes.sticker} ${className}` : classes.sticker}>{percentOff}% off? Why not!</p>
  ) : null;

export default SaleSticker;
