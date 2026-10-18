import { Title } from "@mantine/core";
import type { ReactNode, Ref } from "react";

import classes from "./SectionHeader.module.css";

type SectionHeaderProps = {
  id: string;
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
};

const SectionHeader = ({ id, title, headingRef, children }: SectionHeaderProps) => (
  <div className={classes.header}>
    <Title order={2} id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className={classes.title}>
      {title}
    </Title>
    {children}
  </div>
);

export default SectionHeader;
