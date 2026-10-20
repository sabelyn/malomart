import type { ReactNode } from "react";

type CreditSection = {
  id: string;
  heading: string;
  intro?: ReactNode;
  items?: ReactNode[];
};

export const credits: CreditSection[] = [
  {
    id: "artwork",
    heading: "Artwork",
    items: ["Item icons ripped by Colbydude.", "Rupee art by Side__Steppa."]
  },
  {
    id: "fonts",
    heading: "Fonts",
    intro: "Both fonts are used under the SIL Open Font License.",
    items: [
      <>
        <a href="https://fonts.google.com/specimen/Shrikhand">Shrikhand</a> by Jonny Pinhorn.
      </>,
      <>
        <a href="https://rsms.me/inter/">Inter</a> by Rasmus Andersson.
      </>
    ]
  },
  {
    id: "built-with",
    heading: "Built with",
    intro: "Malo Mart runs on Amazon Web Services and a lot of open source.",
    items: [
      "AWS: CloudFront, S3, API Gateway, ECS on Fargate, Lambda, Cognito, DynamoDB, KMS, SES, SQS, SNS, EventBridge, Route 53, CloudWatch, and Secrets Manager, all set up with the AWS CDK.",
      <>
        <a href="https://react.dev">React</a>, <a href="https://reactrouter.com">React Router</a>,{" "}
        <a href="https://tanstack.com/query">TanStack Query</a>, and <a href="https://mantine.dev">Mantine</a> in the
        browser.
      </>,
      <>
        <a href="https://expressjs.com">Express</a> and <a href="https://github.com/microsoft/tsyringe">TSyringe</a> on
        the server, with <a href="https://zod.dev">Zod</a> checking data on both ends.
      </>,
      <>
        <a href="https://vite.dev">Vite</a>, <a href="https://vitest.dev">Vitest</a>,{" "}
        <a href="https://playwright.dev">Playwright</a>, <a href="https://pnpm.io">pnpm</a>, and{" "}
        <a href="https://turborepo.com">Turborepo</a> for building and testing.
      </>
    ]
  },
  {
    id: "nintendo",
    heading: "Nintendo",
    intro:
      "The Legend of Zelda and its names, characters, places, and items belong to Nintendo. Malo Mart is a non-commercial fan project and isn't affiliated with, sponsored by, or endorsed by Nintendo."
  }
];
