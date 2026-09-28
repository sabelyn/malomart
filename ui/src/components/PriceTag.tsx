import { VisuallyHidden } from "@mantine/core";

import rupeeImage from "@/assets/rupee-green.png";
import classes from "./PriceTag.module.css";

type PriceTagProps = {
  price: number;
  chudleyPrice?: number;
};

const formatRupees = (amount: number) => amount.toLocaleString("en-US");

const PriceTag = ({ price, chudleyPrice }: PriceTagProps) => (
  <div className={classes.tag}>
    {chudleyPrice !== undefined && chudleyPrice > price && (
      <p className={classes.was}>
        Chudley's price: <s>{formatRupees(chudleyPrice)} rupees</s>
      </p>
    )}
    <p className={classes.now}>
      <img src={rupeeImage} alt="" width={23} height={44} className={classes.rupee} />
      {formatRupees(price)}
      <VisuallyHidden>rupees</VisuallyHidden>
    </p>
  </div>
);

export default PriceTag;
