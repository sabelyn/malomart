import { Radio, Title, VisuallyHidden } from "@mantine/core";
import type { ShippingMethod } from "@mm/lib/orders";
import { ShippingOptions } from "@mm/lib/orders";

import { ui } from "@/copy";
import classes from "./checkout.module.css";

type ShippingSectionProps = {
  value: ShippingMethod;
  onChange: (method: ShippingMethod) => void;
};

const methods = Object.keys(ShippingOptions) as ShippingMethod[];

const ShippingSection = ({ value, onChange }: ShippingSectionProps) => (
  <section aria-labelledby="checkout-shipping-heading">
    <div className={classes.sectionHeader}>
      <Title order={2} id="checkout-shipping-heading" className={classes.sectionTitle}>
        {ui.checkout.delivery}
      </Title>
    </div>
    <Radio.Group
      label={<VisuallyHidden>{ui.checkout.deliverySpeed}</VisuallyHidden>}
      labelProps={{ "aria-hidden": true }}
      value={value}
      onChange={method => onChange(method)}
    >
      <div className={classes.choices}>
        {methods.map(method => {
          const { name, description, cost } = ShippingOptions[method];
          return (
            <Radio
              key={method}
              value={method}
              label={name}
              description={ui.checkout.shippingOption(description, cost)}
              classNames={{ root: classes.choice, label: classes.choiceLabel, description: classes.choiceDescription }}
            />
          );
        })}
      </div>
    </Radio.Group>
  </section>
);

export default ShippingSection;
