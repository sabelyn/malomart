import { Container, Text, Title, Typography } from "@mantine/core";
import type { ReactNode } from "react";

import MaloSays from "@/components/MaloSays";
import { ui } from "@/copy";
import classes from "@/styles/pages.module.css";

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

type LegalDocumentProps = {
  heading: string;
  lastUpdated: string;
  maloSays: string;
  plainVersion: string;
  sections: LegalSection[];
};

const LegalDocument = ({ heading, lastUpdated, maloSays, plainVersion, sections }: LegalDocumentProps) => (
  <Container size="md" className={classes.page}>
    <Title order={1}>{heading}</Title>
    <Text mt="xs" c="dimmed">
      {ui.legal.lastUpdated(lastUpdated)}
    </Text>
    <MaloSays>{maloSays}</MaloSays>
    <Text mt="lg">{plainVersion}</Text>
    <Typography className={classes.prose}>
      {sections.map(({ id, heading: sectionHeading, body }) => (
        <section key={id}>
          <h2 id={id}>{sectionHeading}</h2>
          {body}
        </section>
      ))}
    </Typography>
  </Container>
);

export default LegalDocument;
