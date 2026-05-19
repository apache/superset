#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

FROM nginx:1.28.2-alpine

# Copia arquivos de configuração e templates utilizados pelo entrypoint
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/conf.d /etc/nginx/conf.d
COPY docker/nginx/templates /etc/nginx/templates

# Copia certificados Loonar (podem ser substituídos antes do build)
COPY loonar/ssl-certs /etc/nginx/certs

# Ajustar permissões dos certificados SSL
# A chave privada (privkey.pem) deve ter permissão 600 (leitura/escrita apenas para root)
# Os certificados podem ter permissão 644 (leitura para todos)
RUN chmod 600 /etc/nginx/certs/privkey.pem && \
    chmod 644 /etc/nginx/certs/cert.pem /etc/nginx/certs/chain.pem /etc/nginx/certs/fullchain.pem 2>/dev/null || true && \
    chown root:root /etc/nginx/certs/* && \
    ls -la /etc/nginx/certs/
