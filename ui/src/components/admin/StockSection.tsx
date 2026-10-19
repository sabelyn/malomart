import { Button, NumberInput, Text } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import type { ProductDto } from "@mm/lib/products";
import { adjustProductStock, MAX_STOCK_CHANGE, products } from "@mm/lib/products";
import { useState } from "react";

import { useEndpointMutation } from "@/api";
import { alerts, statusMessages, ui } from "@/copy";
import classes from "./admin.module.css";

const errorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 409) {
    return error.message;
  }
  if (error instanceof ApiRequestError && error.status === 404) {
    return alerts.admin.productGone;
  }
  return alerts.admin.stockFailed;
};

const StockSection = ({ product }: { product: ProductDto }) => {
  const [amount, setAmount] = useState<number | string>(1);
  const [inputError, setInputError] = useState<string>();
  const [status, setStatus] = useState("");

  const adjust = useEndpointMutation(adjustProductStock, {
    invalidates: [products],
    onSuccess: (updated, { body: { change } }) => {
      setStatus(statusMessages.admin.stockChanged(change, updated.stockCount));
    }
  });

  const submit = (direction: 1 | -1) => {
    if (adjust.isPending) {
      return;
    }
    setStatus("");
    adjust.reset();
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_STOCK_CHANGE) {
      setInputError(alerts.admin.stockAmountRange(MAX_STOCK_CHANGE));
      return;
    }
    setInputError(undefined);
    adjust.mutate({ params: { id: product.id }, body: { change: direction * amount } });
  };

  return (
    <>
      <Text className={classes.stockCount}>{ui.admin.stockLabel(product.stockCount)}.</Text>
      <div className={classes.stockControls}>
        <NumberInput
          label={ui.admin.stockAmount}
          min={1}
          max={MAX_STOCK_CHANGE}
          allowDecimal={false}
          allowNegative={false}
          value={amount}
          error={inputError}
          className={classes.stockAmount}
          onChange={setAmount}
        />
        <Button variant="outline" onClick={() => submit(1)}>
          {ui.admin.addStock}
        </Button>
        <Button variant="outline" color="red.4" onClick={() => submit(-1)}>
          {ui.admin.removeStock}
        </Button>
      </div>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {adjust.isError && (
        <Text role="alert" className={classes.error}>
          {errorMessage(adjust.error)}
        </Text>
      )}
    </>
  );
};

export default StockSection;
