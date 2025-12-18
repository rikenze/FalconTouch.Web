# frontend-prod.dockerfile - ambiente de produção para Angular
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=optional

COPY . .

# Build da aplicação Angular para produção
RUN npm run build -- --configuration production

# Corrige o nome do arquivo gerado pelo Angular SSR
RUN mv dist/falcontouch/browser/index.csr.html dist/falcontouch/browser/index.html

# Servir os arquivos estáticos via nginx
FROM nginx:stable-alpine

# Remove os arquivos default do nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia os arquivos buildados para a pasta de conteúdo do nginx
COPY --from=build /app/dist/falcontouch/browser/. /usr/share/nginx/html/

# Copia configuração customizada do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
