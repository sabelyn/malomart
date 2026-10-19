import SectionNavLayout from "@/components/layout/SectionNavLayout";
import { ui } from "@/copy";
import {
  ACCOUNT_PATH,
  ACCOUNT_ADDRESSES_PATH,
  ACCOUNT_PAYMENT_METHODS_PATH,
  ACCOUNT_ORDERS_PATH
} from "@/routes/paths";

const SECTIONS = [
  { to: ACCOUNT_PATH, label: ui.account.sections.profile, end: true },
  { to: ACCOUNT_ADDRESSES_PATH, label: ui.account.sections.addresses },
  { to: ACCOUNT_PAYMENT_METHODS_PATH, label: ui.account.sections.cards },
  { to: ACCOUNT_ORDERS_PATH, label: ui.account.sections.orders }
];

const AccountPage = () => <SectionNavLayout title={ui.account.heading} navLabel={ui.account.nav} sections={SECTIONS} />;

export default AccountPage;
