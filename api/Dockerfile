FROM --platform=$BUILDPLATFORM node:24-alpine AS base
RUN npm install -g pnpm@12.6.0 turbo@2.11.3

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @mm/api --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN turbo run build --filter=@mm/api

FROM gcr.io/distroless/nodejs24-debian13:nonroot
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /repo/api/dist ./
EXPOSE 4000
CMD ["--enable-source-maps", "index.mjs"]
