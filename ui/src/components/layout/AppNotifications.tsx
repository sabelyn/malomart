import { VisuallyHidden } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useSyncExternalStore } from "react";

import { getAnnouncement, subscribeAnnouncements } from "@/utils/notify";

const AppNotifications = () => {
  const { id, message, urgent } = useSyncExternalStore(subscribeAnnouncements, getAnnouncement);

  return (
    <>
      <Notifications position="bottom-right" limit={3} />
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {!urgent && <span key={id}>{message}</span>}
      </VisuallyHidden>
      <VisuallyHidden aria-live="assertive" aria-atomic="true">
        {urgent && <span key={id}>{message}</span>}
      </VisuallyHidden>
    </>
  );
};

export default AppNotifications;
