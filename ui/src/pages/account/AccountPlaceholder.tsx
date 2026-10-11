import { Title } from "@mantine/core";
import { useId } from "react";

import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./account.module.css";

type AccountPlaceholderProps = {
  title: string;
};

const AccountPlaceholder = ({ title }: AccountPlaceholderProps) => {
  useDocumentTitle(title);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <div className={classes.sectionHeader}>
        <Title order={2} id={headingId} className={classes.sectionTitle}>
          {title}
        </Title>
      </div>
      <MaloSays>Not built yet. Come back later.</MaloSays>
    </section>
  );
};

export default AccountPlaceholder;
