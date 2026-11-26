FROM node:22-alpine AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --filter @memories/web... --frozen-lockfile
COPY apps/web apps/web
COPY packages/ui packages/ui
COPY packages/types packages/types
RUN pnpm --filter @memories/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@memories/web", "start"]
