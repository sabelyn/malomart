import { Badge, Button, Group, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

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
        {isDefault && <Badge variant="outline">Default</Badge>}
        {badges}
      </Title>
      {children}
      <Group gap="xs" className={classes.actions}>
        <Button ref={editRef} size="xs" variant="outline" aria-describedby={headingId} onClick={onEdit}>
          Edit
        </Button>
        {!isDefault && (
          <Button size="xs" variant="subtle" aria-describedby={headingId} loading={makingDefault} onClick={onMakeDefault}>
            Make default
          </Button>
        )}
        <Button size="xs" variant="subtle" color="red.4" aria-describedby={headingId} onClick={onDelete}>
          Delete
        </Button>
      </Group>
    </article>
  );
};

export default AccountCard;
