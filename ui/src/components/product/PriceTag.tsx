import { VisuallyHidden } from "@mantine/core";

import rupeeImage from "@/assets/rupee-green.png";
import { formatRupees, rupees, ui } from "@/copy";
import classes from "./PriceTag.module.css";

type PriceTagProps = {
  price: number;
  chudleyPrice?: number;
};

const PriceTag = ({ price, chudleyPrice }: PriceTagProps) => (
  <div className={classes.tag}>
    {chudleyPrice !== undefined && chudleyPrice > price && (
      <p className={classes.was}>
        {ui.product.chudleyPrice} <s>{rupees(chudleyPrice)}</s>
      </p>
    )}
    <p className={classes.now}>
      <img src={rupeeImage} alt="" width={23} height={44} className={classes.rupee} />
      <span aria-hidden="true">{formatRupees(price)}</span>
      <VisuallyHidden>{rupees(price)}</VisuallyHidden>
    </p>
  </div>
);

export default PriceTag;
