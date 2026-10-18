import SectionNavLayout from "@/components/SectionNavLayout";

const SECTIONS = [
  { to: "/account", label: "Profile", end: true },
  { to: "/account/addresses", label: "Addresses" },
  { to: "/account/payment-methods", label: "Payment methods" },
  { to: "/account/orders", label: "Orders" }
];

const AccountPage = () => <SectionNavLayout title="Your account" navLabel="Account sections" sections={SECTIONS} />;

export default AccountPage;
