# MaloMart Concept

This is a project meant to practice building an AWS-based application. It is an online store, but themed after the Legend of Zelda game series.

## Feature Brainstorm

- API for products and orders
- Use DynamoDB for basic product, order, and customer information.
- Product image upload and processing
  - S3 storage
  - Lambda for processing triggered by S3 upload
- Login for customers and vendors (Cognito)
- Event tracking with data firehose
- SNS and push notifications for order status updates.
- IaC with CDK
- Use SQS, SNS, and Event Bridge to make things asynchronous when applicable
- AI chat bot?
