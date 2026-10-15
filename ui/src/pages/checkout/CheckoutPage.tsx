import { Badge, Button, Container, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import type { AddressDto, PaymentMethodDto } from "@mm/lib/customers";
import { isCardExpired, listAddresses, listPaymentMethods } from "@mm/lib/customers";
import { createOrder, getOrder, orders, ShippingMethod, ShippingOptions } from "@mm/lib/orders";
import { products as productsRoute } from "@mm/lib/products";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router";

import { endpointQuery, routeKey, useEndpointMutation } from "@/api";
import { isEmptyCart } from "@/cart/cartItems";
import { serverCartQuery } from "@/cart/CartProvider";
import { useCartProducts } from "@/cart/useCartProducts";
import { addressLines, addressName, paymentMethodExpiry, paymentMethodName } from "@/components/account/accountDisplay";
import AddPaymentMethodModal from "@/components/account/AddPaymentMethodModal";
import AddressFormModal from "@/components/account/AddressFormModal";
import cartClasses from "@/components/cart/cart.module.css";
import CartAdjustmentsAlert from "@/components/cart/CartAdjustmentsAlert";
import checkoutClasses from "@/components/checkout/checkout.module.css";
import CheckoutItems from "@/components/checkout/CheckoutItems";
import CheckoutSummary from "@/components/checkout/CheckoutSummary";
import type { Choice } from "@/components/checkout/ChoiceSection";
import ChoiceSection from "@/components/checkout/ChoiceSection";
import ShippingSection from "@/components/checkout/ShippingSection";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "../pages.module.css";

type Saved = { id: string; isDefault: boolean };

type StepErrors = { address?: string; payment?: string };

const defaultFirst = (a: Saved, b: Saved) => Number(b.isDefault) - Number(a.isDefault);

const pickChoice = <T extends Saved>(
  saved: T[] | undefined,
  chosenId: string | undefined,
  usable: (item: T) => boolean
) => {
  const chosen = saved?.find(item => item.id === chosenId && usable(item));
  const fallback = saved?.find(item => item.isDefault && usable(item));
  return (chosen ?? fallback)?.id ?? null;
};

const toChoices = <T extends Saved>(saved: T[] | undefined, toChoice: (item: T) => Choice) =>
  saved && [...saved].sort(defaultFirst).map(toChoice);

const defaultBadge = (isDefault: boolean) => isDefault && <Badge variant="outline">Default</Badge>;

const addressChoice = (address: AddressDto): Choice => ({
  id: address.id,
  label: (
    <>
      {addressName(address)}
      {defaultBadge(address.isDefault)}
    </>
  ),
  description: addressLines(address).map(line => <span key={line}>{line}</span>)
});

const paymentChoice = (method: PaymentMethodDto): Choice => ({
  id: method.id,
  label: (
    <>
      {paymentMethodName(method)}
      {defaultBadge(method.isDefault)}
    </>
  ),
  description: paymentMethodExpiry(method),
  disabled: isCardExpired(method)
});

const orderErrorMessage = (err: unknown) => {
  if (err instanceof ApiRequestError && (err.status === 404 || err.status === 409)) {
    return "Something changed while you were looking. I updated everything, so check it over and try again.";
  }
  if (err instanceof ApiRequestError && err.status === 400) {
    return "Something's off with your order. Check your address and card, then try again.";
  }
  return "Couldn't place your order. Try again.";
};

const focusFirstControl = (section: HTMLElement | null) =>
  section?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)")?.focus();

const CheckoutPage = () => {
  useDocumentTitle("Checkout");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cart, products, lines, subtotal, notices, isError, refetch } = useCartProducts();
  const addresses = useQuery(endpointQuery(listAddresses, {}));
  const paymentMethods = useQuery(endpointQuery(listPaymentMethods, {}));
  const addressRef = useRef<HTMLElement>(null);
  const paymentRef = useRef<HTMLElement>(null);
  const [orderId] = useState(() => crypto.randomUUID());
  const [chosenAddressId, setChosenAddressId] = useState<string>();
  const [chosenPaymentId, setChosenPaymentId] = useState<string>();
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(ShippingMethod.Standard);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [errors, setErrors] = useState<StepErrors>({});
  const [addressStatus, setAddressStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const addressId = pickChoice(addresses.data, chosenAddressId, () => true);
  const paymentMethodId = pickChoice(paymentMethods.data, chosenPaymentId, method => !isCardExpired(method));
  const shippingCost = ShippingOptions[shippingMethod].cost;

  const placeOrder = useEndpointMutation(createOrder, {
    scope: { id: "cart" },
    invalidates: [orders],
    onSuccess: order => {
      queryClient.setQueryData(endpointQuery(getOrder, { params: { id: order.id } }).queryKey, order);
      queryClient.setQueryData(serverCartQuery(order.customerId).queryKey, {});
      void navigate(`/orders/${order.id}/placed`, { replace: true });
    },
    onError: err => {
      if (err instanceof ApiRequestError && (err.status === 404 || err.status === 409)) {
        void queryClient.invalidateQueries({ queryKey: routeKey(productsRoute) });
        cart.retryLoad();
      }
    }
  });

  const submit = () => {
    const nextErrors: StepErrors = {
      address: addressId
        ? undefined
        : addresses.data?.length
          ? "Choose where this is going."
          : "Add an address first. I need somewhere to send it.",
      payment: paymentMethodId
        ? undefined
        : paymentMethods.data?.some(method => !isCardExpired(method))
          ? "Choose a card to pay with."
          : "Add a card first. No rupees, no goods."
    };
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

  const addressAdded = (address: AddressDto) => {
    chooseAddress(address.id);
    setAddressStatus(`Added ${addressName(address)} and picked it for this order.`);
    setAddingAddress(false);
  };

  const cardAdded = (method: PaymentMethodDto) => {
    choosePayment(method.id);
    setPaymentStatus(`Added ${paymentMethodName(method)} and picked it for this order.`);
    setAddingCard(false);
  };

  const hasExpiredCard = paymentMethods.data?.some(method => isCardExpired(method));

  const renderContent = () => {
    if (cart.loadFailed) {
      return (
        <div role="alert">
          <MaloSays>Lost track of your cart. Not my fault.</MaloSays>
          <Button mt="lg" variant="outline" onClick={cart.retryLoad}>
            Try again
          </Button>
        </div>
      );
    }
    if (!cart.ready) {
      return <PageLoader />;
    }
    if (isEmptyCart(cart.items)) {
      return (
        <>
          <MaloSays>Nothing to check out. Bold strategy.</MaloSays>
          <Button component={Link} to="/products" mt="xl">
            Go shopping
          </Button>
        </>
      );
    }
    if (isError && !products) {
      return (
        <div role="alert">
          <MaloSays>Couldn't find what's in your cart. Probably the shelves.</MaloSays>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (!products) {
      return <PageLoader />;
    }
    return (
      <div className={cartClasses.layout}>
        <div className={checkoutClasses.steps}>
          <ChoiceSection
            ref={addressRef}
            id="checkout-address"
            title="Ship to"
            groupLabel="Shipping address"
            choices={toChoices(addresses.data, addressChoice)}
            isPending={addresses.isPending}
            loadFailedMessage="Couldn't find your addresses. Not my fault."
            emptyMessage="No addresses yet. Can't deliver to nowhere."
            addLabel="Add an address"
            value={addressId}
            error={errors.address}
            status={addressStatus}
            onRetry={() => void addresses.refetch()}
            onAdd={() => setAddingAddress(true)}
            onChange={chooseAddress}
          />
          <ShippingSection value={shippingMethod} onChange={setShippingMethod} />
          <ChoiceSection
            ref={paymentRef}
            id="checkout-payment"
            title="Pay with"
            groupLabel="Payment card"
            choices={toChoices(paymentMethods.data, paymentChoice)}
            isPending={paymentMethods.isPending}
            loadFailedMessage="Couldn't find your cards. Not my fault."
            emptyMessage="No cards on file. I don't do IOUs."
            addLabel="Add a card"
            value={paymentMethodId}
            error={errors.payment}
            status={paymentStatus}
            note={
              hasExpiredCard && (
                <>
                  Expired cards can't be used. <Link to="/account/payment-methods">Update them in your account</Link>.
                </>
              )
            }
            onRetry={() => void paymentMethods.refetch()}
            onAdd={() => setAddingCard(true)}
            onChange={choosePayment}
          />
          <section aria-labelledby="checkout-items-heading">
            <div className={checkoutClasses.sectionHeader}>
              <Title order={2} id="checkout-items-heading" className={checkoutClasses.sectionTitle}>
                Your items
              </Title>
              <Link to="/cart" className={checkoutClasses.headerLink}>
                Edit cart
              </Link>
            </div>
            <CheckoutItems
              items={lines.map(({ id, title, thumbnailKey, price }) => ({
                id,
                title,
                thumbnailKey,
                amount: cart.items[id],
                pricePerUnit: price
              }))}
            />
          </section>
        </div>
        <CheckoutSummary
          count={cart.count}
          subtotal={subtotal}
          shippingCost={shippingCost}
          error={placeOrder.isError ? orderErrorMessage(placeOrder.error) : undefined}
          placing={placeOrder.isPending}
          onPlaceOrder={submit}
        />
      </div>
    );
  };

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>Checkout</Title>
      {notices.length > 0 && <CartAdjustmentsAlert notices={notices} onClose={cart.clearAdjustments} />}
      {renderContent()}

      <AddressFormModal opened={addingAddress} onCancel={() => setAddingAddress(false)} onSaved={addressAdded} />
      <AddPaymentMethodModal opened={addingCard} onCancel={() => setAddingCard(false)} onSaved={cardAdded} />
    </Container>
  );
};

export default CheckoutPage;
