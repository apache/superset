FROM uchimera.azurecr.io/cccs/superset-base:cccs-1.4_20220411144824_b3288

USER root

COPY requirements.txt /tmp

ARG BUILD_NUMBER=0-development
RUN sed -i '/^VERSION_SHA_LENGTH = .*/i # CCCS Superset Azure pipeline injection\nBUILD_NUMBER = '${BUILD_NUMBER}'\n' /app/superset/config.py \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

ENV BUILD_NUMBER_VAR=${BUILD_NUMBER}
COPY analytical-platform-requirements.txt /tmp
# Make pip use analytical-platform feed
RUN --mount=type=secret,id=pipconfig,target=/tmp/pip2.conf,uid=1000 \
    PIP_CONFIG_FILE="/tmp/pip2.conf" python -m pip install --no-cache-dir -r /tmp/analytical-platform-requirements.txt && \
    rm /tmp/analytical-platform-requirements.txt

USER superset

