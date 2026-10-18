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
import classes from "./admin.module.css";

const MAX_DESCRIPTION = 500;

const blankTo = (fallback: undefined | null) => (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? fallback : value;

const rupees = (missing: string) =>
  number({ error: missing }).int({ error: "Use whole rupees." }).positive({ error: "Has to be at least 1 rupee." });

const EditFields = object({
  title: Product.shape.title,
  category: preprocess(blankTo(undefined), zenum(Category, { error: "Choose a category." })),
  description: Product.shape.description,
  price: preprocess(blankTo(undefined), rupees("Enter a price.")),
  originalPrice: preprocess(blankTo(null), rupees("Enter the original price or leave it blank.").nullable()),
  features: Product.shape.features
});

const priceBelowOriginal = ({ price, originalPrice }: { price: number; originalPrice: number | null }) =>
  originalPrice === null || originalPrice > price;

const Prices = EditFields.pick({ price: true, originalPrice: true });

const priceBelowOriginalError = {
  path: ["originalPrice"],
  error: "The original price has to be higher than the price, or leave it blank.",
  when: ({ value }: { value: unknown }) => Prices.safeParse(value).success
};

const EditForm = EditFields.refine(priceBelowOriginal, priceBelowOriginalError);

const CreateForm = EditFields.extend({
  stockCount: preprocess(
    blankTo(undefined),
    number({ error: "Enter how many are in stock." })
      .int({ error: "Use a whole number." })
      .nonnegative({ error: "Stock can't be negative." })
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
    return "That product is gone. Someone deleted it.";
  }
  if (error instanceof ApiRequestError && error.status === 413) {
    return "That's too much text to store. Trim the description or features.";
  }
  return "Couldn't save the product. Try again.";
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
      setNotice("Nothing changed.");
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
        <TextInput label="Title" required maxLength={64} {...form.getInputProps("title")} />
        <NativeSelect
          label="Category"
          required
          data={[{ value: "", label: "Choose a category", disabled: true }, ...Object.values(Category)]}
          {...form.getInputProps("category")}
        />
        <Textarea
          label="Description"
          description={`${descriptionLength} of ${MAX_DESCRIPTION} characters.`}
          required
          rows={5}
          maxLength={MAX_DESCRIPTION}
          {...form.getInputProps("description")}
        />
        <div className={classes.priceRow}>
          <NumberInput
            label="Price"
            description="In rupees."
            required
            min={1}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator=","
            {...form.getInputProps("price")}
          />
          <NumberInput
            label="Original price"
            description="Optional. Set it above the price to put the product on sale."
            min={1}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator=","
            {...form.getInputProps("originalPrice")}
          />
        </div>
        {!product && (
          <NumberInput
            label="Starting stock"
            required
            min={0}
            allowDecimal={false}
            allowNegative={false}
            className={classes.stockAmount}
            {...form.getInputProps("stockCount")}
          />
        )}
        <fieldset className={classes.features}>
          <legend className={classes.featuresLegend}>Features</legend>
          <ul ref={featureListRef} className={classes.featureList}>
            {features.map((_, index) => (
              <li key={form.key(`features.${index}`)} className={classes.featureRow}>
                <TextInput aria-label={`Feature ${index + 1}`} {...form.getInputProps(`features.${index}`)} />
                <CloseButton aria-label={`Remove feature ${index + 1}`} mt={4} onClick={() => removeFeature(index)} />
              </li>
            ))}
          </ul>
          <Button variant="subtle" size="compact-sm" data-add-feature onClick={addFeature}>
            Add a feature
          </Button>
        </fieldset>
        <Group justify="flex-end" align="center">
          <span role="status" className={classes.status}>
            {notice}
          </span>
          <Button type="submit" loading={save.isPending}>
            {product ? "Save changes" : "Create product"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default ProductForm;
