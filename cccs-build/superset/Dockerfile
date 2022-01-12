FROM uchimera.azurecr.io/cccs/superset-base:cccs-1.4-image_20220111202151_b2815


USER root

COPY requirements.txt /tmp

ENV BUILD_NUMBER=0-development
RUN sed -i '/^VERSION_SHA_LENGTH = .*/i # CCCS Superset Azure pipeline injection\nBUILD_NUMBER = '${BUILD_NUMBER}'\n' /app/superset/config.py \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

USER superset
