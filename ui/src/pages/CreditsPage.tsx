import { Container, Title, Typography } from "@mantine/core";

import MaloSays from "@/components/MaloSays";
import { credits } from "@/content/credits";
import { malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "@/styles/pages.module.css";

const CreditsPage = () => {
  useDocumentTitle(ui.pageTitles.credits);

  return (
    <Container size="md" className={classes.page}>
      <Title order={1}>{ui.credits.heading}</Title>
      <MaloSays>{malo.credits}</MaloSays>
      <Typography className={classes.prose}>
        {credits.map(({ id, heading, intro, items }) => (
          <section key={id}>
            <h2 id={id}>{heading}</h2>
            {intro && <p>{intro}</p>}
            {items && (
              <ul>
                {items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </Typography>
    </Container>
  );
};

export default CreditsPage;
