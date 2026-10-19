import {
  Alert,
  Button,
  CloseButton,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Textarea,
  TextInput
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { ApiRequestError } from "@mm/lib/api";
import type { ProductDto, UpdateProductBody } from "@mm/lib/products";
import { Category, createProduct, Product, products, updateProduct } from "@mm/lib/products";
import { useRef, useState } from "react";
import { number, object, preprocess, enum as zenum } from "zod";

import { useEndpointMutation } from "@/api";
import { alerts, statusMessages, ui } from "@/copy";
import classes from "./admin.module.css";

const MAX_DESCRIPTION = 500;

const blankTo = (fallback: undefined | null) => (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? fallback : value;

const rupees = (missing: string) =>
  number({ error: missing }).int({ error: alerts.admin.wholeRupees }).positive({ error: alerts.admin.atLeastOneRupee });

const EditFields = object({
  title: Product.shape.title,
  category: preprocess(blankTo(undefined), zenum(Category, { error: alerts.admin.chooseCategory })),
  description: Product.shape.description,
  price: preprocess(blankTo(undefined), rupees(alerts.admin.enterPrice)),
  originalPrice: preprocess(blankTo(null), rupees(alerts.admin.enterOriginalPrice).nullable()),
  features: Product.shape.features
});

const priceBelowOriginal = ({ price, originalPrice }: { price: number; originalPrice: number | null }) =>
  originalPrice === null || originalPrice > price;

const Prices = EditFields.pick({ price: true, originalPrice: true });

const priceBelowOriginalError = {
  path: ["originalPrice"],
  error: alerts.admin.priceBelowOriginal,
  when: ({ value }: { value: unknown }) => Prices.safeParse(value).success
};

const EditForm = EditFields.refine(priceBelowOriginal, priceBelowOriginalError);

const CreateForm = EditFields.extend({
  stockCount: preprocess(
    blankTo(undefined),
    number({ error: alerts.admin.enterStock })
      .int({ error: alerts.admin.wholeNumber })
      .nonnegative({ error: alerts.admin.negativeStock })
  )
}).refine(priceBelowOriginal, priceBelowOriginalError);

const sameFeatures = (a: string[], b: string[]) => a.length === b.length && a.every((feature, i) => feature === b[i]);

const changedFields = (product: ProductDto, values: ReturnType<typeof EditForm.parse>): UpdateProductBody => {
  const changes: UpdateProductBody = {};
  if (values.title !== product.title) {
    changes.title = values.title;
  }
  if (values.category !== product.category) {
    changes.category = values.category;
  }
  if (values.description !== product.description) {
    changes.description = values.description;
  }
  if (values.price !== product.price) {
    changes.price = values.price;
  }
  if (values.originalPrice !== (product.originalPrice ?? null)) {
    changes.originalPrice = values.originalPrice;
  }
  if (!sameFeatures(values.features, product.features)) {
    changes.features = values.features;
  }
  return changes;
};

const saveErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 404) {
    return alerts.admin.productGone;
  }
  if (error instanceof ApiRequestError && error.status === 413) {
    return alerts.admin.productTooLarge;
  }
  return alerts.admin.productSaveFailed;
};

type ProductFormProps = {
  product?: ProductDto;
  onSaved: (product: ProductDto) => void;
};

const ProductForm = ({ product, onSaved }: ProductFormProps) => {
  const featureListRef = useRef<HTMLUListElement>(null);
  const [notice, setNotice] = useState("");
  const form = useForm({
    initialValues: {
      title: product?.title ?? "",
      category: product?.category ?? "",
      description: product?.description ?? "",
      price: product?.price ?? "",
      originalPrice: product?.originalPrice ?? "",
      stockCount: product ? product.stockCount : "",
      features: product?.features ?? []
    },
    validate: schemaResolver(product ? EditForm : CreateForm, { sync: true })
  });

  const create = useEndpointMutation(createProduct, { invalidates: [products], onSuccess: onSaved });
  const update = useEndpointMutation(updateProduct, {
    invalidates: [products],
    onSuccess: saved => {
      form.resetDirty();
      onSaved(saved);
    }
  });
  const save = product ? update : create;

  const submit = form.onSubmit(values => {
    setNotice("");
    if (!product) {
      const { originalPrice, ...fields } = CreateForm.parse(values);
      create.mutate({ body: { ...fields, ...(originalPrice === null ? {} : { originalPrice }) } });
      return;
    }
    const changes = changedFields(product, EditForm.parse(values));
    if (Object.keys(changes).length === 0) {
      setNotice(statusMessages.admin.nothingChanged);
      return;
    }
    update.mutate({ params: { id: product.id }, body: changes });
  });

  const addFeature = () => {
    const index = form.getValues().features.length;
    form.insertListItem("features", "");
    requestAnimationFrame(() => featureListRef.current?.querySelectorAll("input")[index]?.focus());
  };

  const removeFeature = (index: number) => {
    form.removeListItem("features", index);
    requestAnimationFrame(() => {
      const inputs = featureListRef.current?.querySelectorAll("input");
      const next = inputs?.[Math.min(index, inputs.length - 1)];
      if (next) {
        next.focus();
      } else {
        featureListRef.current?.parentElement?.querySelector<HTMLButtonElement>("[data-add-feature]")?.focus();
      }
    });
  };

  const descriptionLength = form.getValues().description.length;
  const features = form.getValues().features;

  return (
    <form onSubmit={submit} noValidate className={classes.form}>
      <Stack>
        {save.error && (
          <Alert color="red" variant="light">
            {saveErrorMessage(save.error)}
          </Alert>
        )}
        <TextInput label={ui.admin.form.title} required maxLength={64} {...form.getInputProps("title")} />
        <NativeSelect
          label={ui.admin.form.category}
          required
          data={[{ value: "", label: ui.admin.form.chooseCategory, disabled: true }, ...Object.values(Category)]}
          {...form.getInputProps("category")}
        />
        <Textarea
          label={ui.admin.form.description}
          description={ui.admin.form.descriptionCount(descriptionLength, MAX_DESCRIPTION)}
          required
          rows={5}
          maxLength={MAX_DESCRIPTION}
          {...form.getInputProps("description")}
        />
        <div className={classes.priceRow}>
          <NumberInput
            label={ui.admin.form.price}
            description={ui.admin.form.priceHint}
            required
            min={1}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator=","
            {...form.getInputProps("price")}
          />
          <NumberInput
            label={ui.admin.form.originalPrice}
            description={ui.admin.form.originalPriceHint}
            min={1}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator=","
            {...form.getInputProps("originalPrice")}
          />
        </div>
        {!product && (
          <NumberInput
            label={ui.admin.form.startingStock}
            required
            min={0}
            allowDecimal={false}
            allowNegative={false}
            className={classes.stockAmount}
            {...form.getInputProps("stockCount")}
          />
        )}
        <fieldset className={classes.features}>
          <legend className={classes.featuresLegend}>{ui.admin.form.features}</legend>
          <ul ref={featureListRef} className={classes.featureList}>
            {features.map((_, index) => (
              <li key={form.key(`features.${index}`)} className={classes.featureRow}>
                <TextInput aria-label={ui.admin.form.feature(index + 1)} {...form.getInputProps(`features.${index}`)} />
                <CloseButton
                  aria-label={ui.admin.form.removeFeature(index + 1)}
                  mt={4}
                  onClick={() => removeFeature(index)}
                />
              </li>
            ))}
          </ul>
          <Button variant="subtle" size="compact-sm" data-add-feature onClick={addFeature}>
            {ui.admin.form.addFeature}
          </Button>
        </fieldset>
        <Group justify="flex-end" align="center">
          <span role="status" className={classes.status}>
            {notice}
          </span>
          <Button type="submit" loading={save.isPending}>
            {product ? ui.admin.form.saveChanges : ui.admin.form.create}
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default ProductForm;
