import { Chip, Group, NativeSelect } from "@mantine/core";
import { Category, CategorySchema } from "@mm/lib/products";

import orderClasses from "@/components/orders/orders.module.css";
import { ui } from "@/copy";
import classes from "./admin.module.css";

const ALL = "all";

const STOCK_FILTERS = [
  { value: ALL, label: ui.admin.stockFilters.all },
  { value: "true", label: ui.admin.stockFilters.inStock },
  { value: "false", label: ui.admin.stockFilters.outOfStock }
];

type ProductFilters = { category?: Category; inStock?: boolean };

type AdminProductFiltersProps = ProductFilters & {
  onChange: (filters: Partial<ProductFilters>) => void;
};

const AdminProductFilters = ({ category, inStock, onChange }: AdminProductFiltersProps) => (
  <div className={classes.filters}>
    <NativeSelect
      label={ui.admin.category}
      className={classes.categorySelect}
      value={category ?? ALL}
      data={[{ value: ALL, label: ui.admin.allCategories }, ...Object.values(Category)]}
      onChange={event => {
        const { value } = event.currentTarget;
        onChange({ category: value === ALL ? undefined : CategorySchema.parse(value) });
      }}
    />
    <fieldset className={orderClasses.filter}>
      <legend className={orderClasses.filterLegend}>{ui.admin.stockFilter}</legend>
      <Chip.Group
        value={inStock === undefined ? ALL : String(inStock)}
        onChange={value => onChange({ inStock: value === ALL ? undefined : value === "true" })}
      >
        <Group gap="xs">
          {STOCK_FILTERS.map(({ value, label }) => (
            <Chip key={value} type="radio" name="stock" value={value} classNames={{ label: orderClasses.chip }}>
              {label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </fieldset>
  </div>
);

export default AdminProductFilters;
