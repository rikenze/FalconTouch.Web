# Imagem base leve do Node.js
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia apenas os arquivos de dependência primeiro para melhor cache
COPY package*.json ./

# Argumento e variável de ambiente
ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

# Instala dependências de forma condicional
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm ci --omit=dev; \
    else \
      npm install && npm install -g nodemon; \
    fi

# Copia o restante da aplicação
COPY . .

# Expõe a porta do app
EXPOSE 3001

# Define o healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q --spider http://localhost:3001/health || exit 1

# Comando de inicialização
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then node server.js; else nodemon server.js; fi"]
