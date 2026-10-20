import { ActionIcon, Button, Popover, Stack, Text } from "@mantine/core";
import { useId, useState } from "react";

import { ui } from "@/copy";

const WarningIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 3 2 21h20L12 3z" />
    <path d="M12 10v5" />
    <path d="M12 18h.01" />
  </svg>
);

const CardNumberWarning = () => {
  const [opened, setOpened] = useState(false);
  const messageId = useId();

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={260}
      withArrow
      trapFocus
      returnFocus
      withinPortal={false}
      floatingStrategy="fixed"
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="rose"
          size="sm"
          pos="absolute"
          top={0}
          right={0}
          aria-label={ui.cards.numberWarning}
          onClick={() => setOpened(current => !current)}
        >
          <WarningIcon />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown aria-describedby={messageId} data-mantine-stop-propagation="true">
        <Stack gap="xs">
          <Text id={messageId} size="sm">
            {ui.cards.fakeNumbersOnly}
          </Text>
          <Button size="xs" variant="default" data-mantine-stop-propagation="true" onClick={() => setOpened(false)}>
            {ui.cards.gotIt}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default CardNumberWarning;
