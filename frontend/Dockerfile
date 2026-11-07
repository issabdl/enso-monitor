# Étape 1 : compilation de l'application React
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : fichiers statiques servis par Caddy (qui relaie aussi /api vers FastAPI)
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
