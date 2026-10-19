import { Checkbox, Chip, Group } from "@mantine/core";
import { Category } from "@mm/lib/products";

import { ui } from "@/copy";
import classes from "./CatalogFilters.module.css";

const ALL = "all";

export type CatalogFilterValues = {
  category?: Category;
  inStock?: boolean;
};

type CatalogFiltersProps = CatalogFilterValues & {
  onChange: (changes: CatalogFilterValues) => void;
};

const CatalogFilters = ({ category, inStock, onChange }: CatalogFiltersProps) => (
  <section aria-label={ui.catalog.filters} className={classes.filters}>
    <fieldset className={classes.fieldset}>
      <legend className={classes.legend}>{ui.catalog.category}</legend>
      <Chip.Group value={category ?? ALL} onChange={value => onChange({ category: value === ALL ? undefined : value })}>
        <Group gap="xs">
          <Chip type="radio" name="category" value={ALL} classNames={{ label: classes.chip }}>
            {ui.common.all}
          </Chip>
          {Object.values(Category).map(value => (
            <Chip key={value} type="radio" name="category" value={value} classNames={{ label: classes.chip }}>
              {value}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </fieldset>
    <Checkbox
      label={ui.catalog.hideSoldOut}
      checked={inStock ?? false}
      onChange={event => onChange({ inStock: event.currentTarget.checked || undefined })}
    />
  </section>
);

export default CatalogFilters;
