import SectionNavLayout from "@/components/layout/SectionNavLayout";
import { ADMIN_PRODUCTS_PATH, ADMIN_ORDERS_PATH } from "@/routes/paths";

const SECTIONS = [
  { to: ADMIN_PRODUCTS_PATH, label: "Products" },
  { to: ADMIN_ORDERS_PATH, label: "Orders" }
];

const AdminPage = () => <SectionNavLayout title="Back office" navLabel="Back office sections" sections={SECTIONS} />;

export default AdminPage;
