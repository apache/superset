FROM uchimera.azurecr.io/cccs/superset-base:feature_CLDN-1397_20220510175708_b3440

USER root

COPY requirements.txt /tmp

ARG BUILD_NUMBER=0-development
RUN sed -i '/^VERSION_SHA_LENGTH = .*/i # CCCS Superset Azure pipeline injection\nBUILD_NUMBER = '${BUILD_NUMBER}'\n' /app/superset/config.py \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

ENV BUILD_NUMBER_VAR=${BUILD_NUMBER}

USER superset
