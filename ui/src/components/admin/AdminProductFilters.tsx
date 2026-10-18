import { Chip, Group, NativeSelect } from "@mantine/core";
import { Category, CategorySchema } from "@mm/lib/products";

import orderClasses from "@/components/orders/orders.module.css";
import classes from "./admin.module.css";

const ALL = "all";

const STOCK_FILTERS = [
  { value: ALL, label: "All" },
  { value: "true", label: "In stock" },
  { value: "false", label: "Out of stock" }
];

type ProductFilters = { category?: Category; inStock?: boolean };

type AdminProductFiltersProps = ProductFilters & {
  onChange: (filters: Partial<ProductFilters>) => void;
};

const AdminProductFilters = ({ category, inStock, onChange }: AdminProductFiltersProps) => (
  <div className={classes.filters}>
    <NativeSelect
      label="Category"
      className={classes.categorySelect}
      value={category ?? ALL}
      data={[{ value: ALL, label: "All categories" }, ...Object.values(Category)]}
      onChange={event => {
        const { value } = event.currentTarget;
        onChange({ category: value === ALL ? undefined : CategorySchema.parse(value) });
      }}
    />
    <fieldset className={orderClasses.filter}>
      <legend className={orderClasses.filterLegend}>Stock</legend>
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
