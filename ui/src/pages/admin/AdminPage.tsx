import SectionNavLayout from "@/components/SectionNavLayout";

const SECTIONS = [
  { to: "/admin/products", label: "Products" },
  { to: "/admin/orders", label: "Orders" }
];

const AdminPage = () => <SectionNavLayout title="Back office" navLabel="Back office sections" sections={SECTIONS} />;

export default AdminPage;
