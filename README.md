# Malo Mart

Welcome, Adventurer, to the code behind the [Malo Mart](https://malomart.link/) web app. This is a web development portfolio piece demonstrating my application development skill while also serving as my first real dive into Amazon Web Services.

## Overview

This is an online shop exercise with a Legend of Zelda flavor - because I'm trying not to bore you or myself. It's themed after the Malo Mart branch in The Legend of Zelda: Twilight Princess's Castle Town, which is all property of (Please Don't Sue Me) Nintendo.

### Tech Stack

- Language: TypeScript
- Frameworks: Node.js, Express.js, React.js
- Validation: Zod
- Styling: Mantine
- Backend Libraries: TSyringe (IoC/DI)
- Frontend Libraries: React Router, Tanstack Query
- SDKs: Amazon Web Services SDK for JavaScript
- Build/Bundling: Vite, React Compiler, Docker
- Infrastructure: AWS CDK
- Testing: Vitest, Supertest
- Linting/Formating: EsLint, Prettier
- Tooling: PNPM Workspaces, Turborepo, Husky, Lint-Staged, SyncPack
- AI Assistance: Claude Code

### AWS Services

- API Gateway
- Cloud Development Kit (CDK)
- Cloud Front
- Cloud Watch
- Cognito
- DynamoDB
- Elastic Compute Service (ECS)
- Fargate
- Event Bridge
- Key Management Service (KMS)
- Lambda
- Secrets Manager
- Simple Email service (SES)
- Simple Notification Service (SNS)
- Simple Queue Service (SQS)
- Simple Storage Service (S3)
- Virtual Private Cloud (VPC)

## How It Works

This is just a list of features and processes and how I implemented them in a quick summary. Explore the code for more details.

- Data Persistence: DynamoDB is used for all data persistence that isn't file storage. Global Secondary Indexes are used for read performance, queries, and sorting. Pagination is handled with "Load More" buttons on the UI and cursor-based pagination in the backend.
- Images: To upload images, an admin account receives a signed POST request from the backend to directly upload to S3 from the browser, avoiding images hitting the API or having to generate individual presigned URLs for every image. These are stored in a temporary uploads bucket, where new objects trigger an image processor lambda. The lambda uses Sharp to validate the file is an image and create 3 different size variants, which it uploads to a separate S3 bucket that can be accessed directly from Cloud Front. This allows images to display on the site and be cached without signed download URLs and without making the image bucket public.
- Authentication: The app uses Amazon Cognito to handle auth, but it doesn't use cognito-managed pages. Email OTP and Google are the 2 signup/signin options, and requests are routed through the backend api service. Cognito manages the user pool and token creation, and an HTTP cookie is set for session tracking. Because of Cloud Front path rewrites, the cookie can use a strict same-site policy, eliminating the need for a CORS config in API gateway or the backend.
- API Backend: A Node/Express app is used to handle most API operations. This is hosted on ECS with Fargate to simplify the setup. Almost all synchronous (user request-response) actions are handled this way, with the exception of card tokenization.
- Payment methods: Though the site warns against entering real card information, the system exercises a realistic flow. When a card is added, a lambda encrypts the card number to store it alongside its metadata (brand, expiration, last four) in a separate DynamoDB table with limited access and generates a token of random bytes as a reference. That token is returned to the client, which makes a second request to store the payment method's metadata and relate it to the customer in a table the API can access. This is the only time the token is seen by the client, and the user's ID is used as context to encrypt the card number in the vault so a user can't end up accessing someone else's card. The only thing with permission to decrypt the card number is the lambda that pretends to process payments.
  - The "vault" concept is only ever touched by lambda functions, keeping the data in there out of the API.
- Cart handling: When a site visitor isn't signed in, items added to their cart are stored in the browser's local storage. When they log in or create an account, that local cart is merged with whatever might be on the server, then the DDB cart is updated. All DDB cart updates are full replaces, and stock checks occur every time. If an item's stock has decreased or depleted, the client receives the updates so the cart reflects what is actually possible to purchase, complete with an alert for the user.
- Order placement:
  - An order takes a cart, an address, a payment method, and a shipping method. When placing the order, all of these have to exist, and the API performs another stock check on products.
  - The UI generates the order ID once and sends it to prevent an order from submitting twice on the same browser tab.
  - The backend performs stock updates, creates the order record, and clears the customer's cart within a single transaction. Clearing the cart is conditional on it matching what's sent in the request, preventing duplicate orders from separate browsers/tabs. Stock updates are conditional on the stock existing on the product as a final check that a competing order hasn't already drained it.
  - Once an order with the "Placed" status is inserted, a durable lambda function is triggered to simulate an order moving through statuses. The timing is based on the shipping method chosen, though days are translated to minutes.
  - the function decrypts the card number, and there are 2 test card numbers that will be declined and cancel the order. Otherwise, the order is marked as confirmed.
  - The durable function then waits a certain amount of time to move the order to "Shipped" then to "Delivered".
  - The order can be cancelled by the user before it is in the Shipped status, and the durable function won't do anything in that case.
  - When an order is cancelled, a lambda is triggered that adds the products in the order back to the stock counts.
- Emails and Notifications: A user receives an email each time their order changes status. They don't get one when the order is placed, only when it's confirmed, shipped, delivered, or cancelled. The only other emails are OTP signup/signin emails, all handled by a custom email domain and using SES.
- Asynchronous lambda failures: All lambda functions that are invoked asyncronously have a dead-letter queue. Cloud Watch has alarms on these queues, and those alarms are posted to an SNS topic which sends emails (to me).
  - Some lambdas are triggered using DynamoDB streams and Event Bridge. These use the BatchItemFailures return to retry items that failed in ways that could eventually succeed. Broken input data is excluded here since it will never succeed and is sent to a separate queue to be reviewed.

## Testing Notes

Most things just work as expected, but here are some notes to test specific cases:

- I don't validate card numbers (because I don't want your actual card number), but there are a couple of test card numbers that will be declined if you want to see that result:
  - 4000000000000002
  - 4000000000009995
- Open a second tab / window with your account, place an order on one, then try to place the order with the same cart on the other. It should fail.

## AI Usage

I used Claude Code as a major part of this development project. I did write much of the backend code myself, but I used Claude for code generation for the UI and infrastructure-as-code most heavily, for generating tests, and to help me understand AWS and rubber-duck the approaches that made the most sense for a portfolio piece with a low budget. I reviewed all architecture decisions, plans, and approaches, and I had a couple of human testers for design and functionality. I performed a few cleanup and organization passes, and I've edited a lot of the copy myself.

So this project represents what I can do alongside my preferred AI agent. It shows off my code style and my ability to direct AI to get better results. This was partially a learning exercise for AWS, thus I often had Claude implement a feature so I could see how it was done, then asked questions and made suggestions on how things could be streamlined and simplified.
