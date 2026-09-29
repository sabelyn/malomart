import { Center, Loader, VisuallyHidden } from "@mantine/core";

const PageLoader = () => (
  <Center role="status" py="xl">
    <Loader />
    <VisuallyHidden>Loading…</VisuallyHidden>
  </Center>
);

export default PageLoader;
