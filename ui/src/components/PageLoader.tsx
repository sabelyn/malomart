import { Center, Loader, VisuallyHidden } from "@mantine/core";

import { ui } from "@/copy";

const PageLoader = () => (
  <Center role="status" py="xl">
    <Loader />
    <VisuallyHidden>{ui.common.loading}</VisuallyHidden>
  </Center>
);

export default PageLoader;
