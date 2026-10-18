import SectionNavLayout from "@/components/layout/SectionNavLayout";
import {
  ACCOUNT_PATH,
  ACCOUNT_ADDRESSES_PATH,
  ACCOUNT_PAYMENT_METHODS_PATH,
  ACCOUNT_ORDERS_PATH
} from "@/routes/paths";

const SECTIONS = [
  { to: ACCOUNT_PATH, label: "Profile", end: true },
  { to: ACCOUNT_ADDRESSES_PATH, label: "Addresses" },
  { to: ACCOUNT_PAYMENT_METHODS_PATH, label: "Payment methods" },
  { to: ACCOUNT_ORDERS_PATH, label: "Orders" }
];

const AccountPage = () => <SectionNavLayout title="Your account" navLabel="Account sections" sections={SECTIONS} />;

export default AccountPage;
