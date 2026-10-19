import { Container, Title } from "@mantine/core";
import { isCardExpired, listAddresses, listPaymentMethods } from "@mm/lib/customers";
import { ShippingMethod, ShippingOptions } from "@mm/lib/orders";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { endpointQuery } from "@/api";
import cartClasses from "@/components/cart/cart.module.css";
import CartAdjustmentsAlert from "@/components/cart/CartAdjustmentsAlert";
import CartGate from "@/components/cart/CartGate";
import { useCartProducts } from "@/components/cart/useCartProducts";
import AddressStep from "@/components/checkout/AddressStep";
import checkoutClasses from "@/components/checkout/checkout.module.css";
import type { StepErrors } from "@/components/checkout/checkoutChoices";
import { pickChoice, stepErrors } from "@/components/checkout/checkoutChoices";
import { orderErrorMessage } from "@/components/checkout/checkoutDisplay";
import CheckoutItemsSection from "@/components/checkout/CheckoutItemsSection";
import CheckoutSummary from "@/components/checkout/CheckoutSummary";
import PaymentStep from "@/components/checkout/PaymentStep";
import ShippingSection from "@/components/checkout/ShippingSection";
import { usePlaceOrder } from "@/components/checkout/usePlaceOrder";
import { malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "@/styles/pages.module.css";

const focusFirstControl = (section: HTMLElement | null) =>
  (
    section?.querySelector<HTMLElement>("input:not(:disabled)") ??
    section?.querySelector<HTMLElement>("button:not(:disabled)")
  )?.focus();

const CheckoutPage = () => {
  useDocumentTitle(ui.pageTitles.checkout);
  const { cart, products, lines, subtotal, notices, isError, refetch } = useCartProducts();
  const addresses = useQuery(endpointQuery(listAddresses, {}));
  const paymentMethods = useQuery(endpointQuery(listPaymentMethods, {}));
  const placeOrder = usePlaceOrder();
  const addressRef = useRef<HTMLElement>(null);
  const paymentRef = useRef<HTMLElement>(null);
  const [orderId] = useState(() => crypto.randomUUID());
  const [chosenAddressId, setChosenAddressId] = useState<string>();
  const [chosenPaymentId, setChosenPaymentId] = useState<string>();
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(ShippingMethod.Standard);
  const [errors, setErrors] = useState<StepErrors>({});

  const addressId = pickChoice(addresses.data, chosenAddressId, () => true);
  const paymentMethodId = pickChoice(paymentMethods.data, chosenPaymentId, method => !isCardExpired(method));
  const shippingCost = ShippingOptions[shippingMethod].cost;

  const submit = () => {
    const nextErrors = stepErrors(addressId, addresses.data, paymentMethodId, paymentMethods.data);
    flushSync(() => setErrors(nextErrors));
    if (!addressId || !paymentMethodId) {
      focusFirstControl(nextErrors.address ? addressRef.current : paymentRef.current);
      return;
    }
    placeOrder.mutate({
      body: {
        id: orderId,
        addressId,
        paymentMethodId,
        shippingMethod,
        items: cart.items,
        expectedTotal: subtotal + shippingCost
      }
    });
  };

  const chooseAddress = (id: string) => {
    setChosenAddressId(id);
    setErrors(current => ({ ...current, address: undefined }));
  };

  const choosePayment = (id: string) => {
    setChosenPaymentId(id);
    setErrors(current => ({ ...current, payment: undefined }));
  };

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>{ui.checkout.heading}</Title>
      {notices.length > 0 && <CartAdjustmentsAlert notices={notices} onClose={cart.clearAdjustments} />}
      <CartGate
        productsLoaded={!!products}
        productsFailed={isError}
        emptyMessage={malo.checkout.empty}
        onRetryProducts={() => void refetch()}
      >
        <div className={cartClasses.layout}>
          <div className={checkoutClasses.steps}>
            <AddressStep
              ref={addressRef}
              addresses={addresses}
              value={addressId}
              error={errors.address}
              onChange={chooseAddress}
            />
            <ShippingSection value={shippingMethod} onChange={setShippingMethod} />
            <PaymentStep
              ref={paymentRef}
              paymentMethods={paymentMethods}
              value={paymentMethodId}
              error={errors.payment}
              onChange={choosePayment}
            />
            <CheckoutItemsSection
              items={lines.map(({ id, title, thumbnailKey, price }) => ({
                id,
                title,
                thumbnailKey,
                amount: cart.items[id],
                pricePerUnit: price
              }))}
            />
          </div>
          <CheckoutSummary
            subtotal={subtotal}
            shippingCost={shippingCost}
            error={placeOrder.isError ? orderErrorMessage(placeOrder.error) : undefined}
            placing={placeOrder.isPending}
            onPlaceOrder={submit}
          />
        </div>
      </CartGate>
    </Container>
  );
};

export default CheckoutPage;
