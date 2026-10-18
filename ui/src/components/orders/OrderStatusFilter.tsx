import { Chip, Group } from "@mantine/core";
import type { OrderStatus } from "@mm/lib/orders";
import { OrderStatusSchema } from "@mm/lib/orders";

import classes from "./orders.module.css";

const ALL = "all";

type OrderStatusFilterProps = {
  status?: OrderStatus;
  onChange: (status?: OrderStatus) => void;
};

const OrderStatusFilter = ({ status, onChange }: OrderStatusFilterProps) => (
  <fieldset className={classes.filter}>
    <legend className={classes.filterLegend}>Status</legend>
    <Chip.Group
      value={status ?? ALL}
      onChange={value => onChange(value === ALL ? undefined : OrderStatusSchema.parse(value))}
    >
      <Group gap="xs">
        <Chip type="radio" name="status" value={ALL} classNames={{ label: classes.chip }}>
          All
        </Chip>
        {OrderStatusSchema.options.map(value => (
          <Chip key={value} type="radio" name="status" value={value} classNames={{ label: classes.chip }}>
            {value}
          </Chip>
        ))}
      </Group>
    </Chip.Group>
  </fieldset>
);

export default OrderStatusFilter;
