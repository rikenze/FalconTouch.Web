#!/usr/bin/env bash

NGROK_DOMAIN="$1"

if [ -z "$NGROK_DOMAIN" ]; then
  echo "❗ Informe o domínio do ngrok como argumento. Exemplo:"
  echo "./generate-cert.sh 82fa40af28bd.ngrok-free.app"
  exit 1
fi

cat > openssl-san.cnf <<EOF
[ req ]
default_bits       = 2048
prompt             = no
default_md         = sha256
req_extensions     = req_ext
distinguished_name = dn

[ dn ]
C  = BR
ST = SaoPaulo
L  = SaoPaulo
O  = falcontouch
CN = localhost

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
DNS.2 = $NGROK_DOMAIN
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -days 365 \
  -config openssl-san.cnf

cp server.crt certificate-chain-homolog.crt

echo "✅ Certificados gerados para:"
echo "- localhost"
echo "- $NGROK_DOMAIN"
