# Stage 1: Build the frontend
FROM node:20-slim AS build
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build

# Stage 2: Prepare the runtime image
FROM node:20-slim AS runtime
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
# Install only production dependencies
RUN pnpm install --prod

# Copy necessary files for runtime from the build stage
# dist is the built frontend
# server.js is the entry point
# api/ and config/ are required by server.js
# public/ is for static assets
COPY --from=build /app/dist /app/dist
COPY --from=build /app/server.js /app/server.js
COPY --from=build /app/api /app/api
COPY --from=build /app/config /app/config
COPY --from=build /app/public /app/public

# Set environment variables and expose port
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
