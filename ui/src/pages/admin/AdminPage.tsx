import SectionNavLayout from "@/components/layout/SectionNavLayout";
import { ui } from "@/copy";
import { ADMIN_PRODUCTS_PATH, ADMIN_ORDERS_PATH } from "@/routes/paths";

const SECTIONS = [
  { to: ADMIN_PRODUCTS_PATH, label: ui.admin.sections.products },
  { to: ADMIN_ORDERS_PATH, label: ui.admin.sections.orders }
];

const AdminPage = () => <SectionNavLayout title={ui.admin.heading} navLabel={ui.admin.nav} sections={SECTIONS} />;

export default AdminPage;
