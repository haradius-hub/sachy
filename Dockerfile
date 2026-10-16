# Šachy – multiplayer server
# Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
# SPDX-License-Identifier: GPL-3.0-or-later

FROM node:20-alpine

WORKDIR /app

# Kompilační nástroje pro better-sqlite3 (native modul)
RUN apk add --no-cache python3 make g++

# Nejdřív závislosti (cache)
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# Statické soubory klienta (celá složka sachy/)
COPY . .

WORKDIR /app/server

ENV PORT=8081 HOST=0.0.0.0
EXPOSE 8081

CMD ["node", "server.js"]
