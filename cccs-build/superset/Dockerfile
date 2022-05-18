# Vault CA container import
ARG VAULT_CA_CONTAINER=uchimera.azurecr.io/cccs/hogwarts/vault-ca:master_2921_22315d60
FROM $VAULT_CA_CONTAINER AS vault_ca
FROM uchimera.azurecr.io/cccs/superset-base:cccs-1.4_20220518171425_b3546


USER root

COPY *requirements.txt /tmp/

ARG BUILD_NUMBER=0-development
RUN sed -i '/^VERSION_SHA_LENGTH = .*/i # CCCS Superset Azure pipeline injection\nBUILD_NUMBER = '${BUILD_NUMBER}'\n' /app/superset/config.py \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

ENV BUILD_NUMBER_VAR=${BUILD_NUMBER}

# Copy Vault CA certs
COPY --from=vault_ca /usr/local/share/ca-certificates/ /usr/local/share/ca-certificates/
# Make pip use analytical-platform feed
RUN --mount=type=secret,id=pipconfig,target=/tmp/pip.conf,uid=1000 \
    PIP_CONFIG_FILE="/tmp/pip.conf" python -m pip install --no-cache-dir -r /tmp/analytical-platform-requirements.txt && \
    rm /tmp/analytical-platform-requirements.txt

USER superset

