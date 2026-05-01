# client/Dockerfile
# Multi-stage: build React (Vite) app then serve with nginx

# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy app source and build
COPY . .
# If using Vite, build script usually "build"

ARG VITE_CLIENT_URL
ENV VITE_CLIENT_URL=${VITE_CLIENT_URL}
ARG VITE_PYTHON_API_URL
ENV VITE_PYTHON_API_URL=${VITE_PYTHON_API_URL}
ARG VITE_VOICE_API_URL
ENV VITE_VOICE_API_URL=${VITE_VOICE_API_URL}
ARG VITE_SD_API_URL
ENV VITE_SD_API_URL=${VITE_SD_API_URL}
RUN npm run build
# Production stage (nginx)
FROM nginx:alpine AS production
# Remove default nginx static
RUN rm -rf /usr/share/nginx/html/*
# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing (optional)
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
