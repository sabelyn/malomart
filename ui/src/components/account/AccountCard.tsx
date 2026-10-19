import { Badge, Button, Group, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { ui } from "@/copy";
import classes from "./AccountCard.module.css";

type AccountCardProps = {
  id: string;
  title: string;
  isDefault: boolean;
  badges?: ReactNode;
  children: ReactNode;
  focusEdit: boolean;
  makingDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
};

const AccountCard = ({
  id,
  title,
  isDefault,
  badges,
  children,
  focusEdit,
  makingDefault,
  onEdit,
  onDelete,
  onMakeDefault
}: AccountCardProps) => {
  const editRef = useRef<HTMLButtonElement>(null);
  const headingId = `card-${id}`;

  useEffect(() => {
    if (focusEdit) {
      editRef.current?.focus();
    }
  }, [focusEdit]);

  return (
    <article className={classes.card} aria-labelledby={headingId}>
      <Title order={3} id={headingId} className={classes.title}>
        {title}
        {isDefault && <Badge variant="outline">{ui.common.defaultBadge}</Badge>}
        {badges}
      </Title>
      {children}
      <Group gap="xs" className={classes.actions}>
        <Button ref={editRef} size="xs" variant="outline" aria-describedby={headingId} onClick={onEdit}>
          {ui.common.edit}
        </Button>
        {!isDefault && (
          <Button
            size="xs"
            variant="subtle"
            aria-describedby={headingId}
            loading={makingDefault}
            onClick={onMakeDefault}
          >
            {ui.common.makeDefault}
          </Button>
        )}
        <Button size="xs" variant="subtle" color="red.4" aria-describedby={headingId} onClick={onDelete}>
          {ui.common.delete}
        </Button>
      </Group>
    </article>
  );
};

export default AccountCard;
