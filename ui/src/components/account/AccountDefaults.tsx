import { getCustomer } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { endpointQuery } from "@/api";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { malo, ui } from "@/copy";
import { ACCOUNT_ADDRESSES_PATH, ACCOUNT_PAYMENT_METHODS_PATH } from "@/routes/paths";
import classes from "./account.module.css";
import { addressLines, paymentMethodExpiry, paymentMethodName } from "./accountDisplay";

const AccountDefaults = () => {
  const { data: customer, isPending, refetch } = useQuery(endpointQuery(getCustomer, {}));

  if (isPending) {
    return <PageLoader />;
  }
  if (!customer) {
    return (
      <RetryAlert onRetry={() => void refetch()}>
        <MaloSays>{malo.profile.defaultsFailed}</MaloSays>
      </RetryAlert>
    );
  }

  const { defaultAddress, defaultPaymentMethod } = customer;
  return (
    <dl className={classes.facts}>
      <dt>{ui.profile.shippingAddress}</dt>
      <dd>
        {defaultAddress ? (
          <address>
            {addressLines(defaultAddress).map(line => (
              <span key={line}>{line}</span>
            ))}
          </address>
        ) : (
          <span>{ui.profile.noneSet}</span>
        )}
        <Link to={ACCOUNT_ADDRESSES_PATH} className={classes.factLink}>
          {ui.profile.manageAddresses}
        </Link>
      </dd>
      <dt>{ui.profile.paymentMethod}</dt>
      <dd>
        {defaultPaymentMethod ? (
          <>
            <span>{paymentMethodName(defaultPaymentMethod)}</span>
            <span>{paymentMethodExpiry(defaultPaymentMethod)}</span>
          </>
        ) : (
          <span>{ui.profile.noneSet}</span>
        )}
        <Link to={ACCOUNT_PAYMENT_METHODS_PATH} className={classes.factLink}>
          {ui.profile.manageCards}
        </Link>
      </dd>
    </dl>
  );
};

export default AccountDefaults;
