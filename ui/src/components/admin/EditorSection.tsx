import { Title } from "@mantine/core";
import type { ReactNode } from "react";

import classes from "./admin.module.css";

type EditorSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
};

const EditorSection = ({ id, title, children }: EditorSectionProps) => (
  <section aria-labelledby={id} className={classes.editorSection}>
    <Title order={2} id={id} className={classes.editorSectionTitle}>
      {title}
    </Title>
    {children}
  </section>
);

export default EditorSection;
