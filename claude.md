# Claude.md

Project context and instructions for Claude Code.

## Project Overview

This is a fantasy-themed online store application meant as a learning exercise and portfolio piece. The goal is to build a full-stack web application leaning heavily into Amazon Web Services (AWS) cloud infrastructure and resources. However, as this is meant to be a display piece, monitary cost is a concern, so free-tier or lowest-cost options are preferred; application uptime and high throughput are not critical. This means that while application code should be designed as if accounting for scale and real-world production environments, resources configured in CDK and features used should be geared toward a very small budget.

## Architecture and AWS Services

This list will grow as the user learns and discovers new tools and requirements.

- Infrastructure-as-Code with CDK: All resources should be provisioned and configured using CDK code.
- Backend Node/Express API service hosted on ECS with Fargate for most synchronous (user-driven) work.
- A few Lambda functions responding to triggers for small, infrequent tasks.
- Cognito for auth: a user pool with email OTP and Google sign-in.
- API Gateway sitting in front of the ECS service to route and authorize requests with Cognito integration.
- DynamoDB for data persistence.
- S3 for asset (photo) storage and analytics data dumps.
- SQS, SNS, and Event Bridge for a responsive and event-driven approach.
- User event tracking using Data Firehose to collect and route data.
- Client app hosted on Cloud Front, built with React+Vite.

## Tech Stack

- TypeScript
- Node + Express
- React
- Vite
- Vitest
- PNPM
- AWS CDK
