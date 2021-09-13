<<<<<<< HEAD
FROM uchimera.azurecr.io/cccs/superset-base:cccs-1.3_20210909191324_b1940
=======
FROM uchimera.azurecr.io/cccs/superset-base:fix_CLDN-983_20210913164041_b1958
>>>>>>> 18697f28f... [CLDN-983] updating base image

USER root

COPY requirements.txt /tmp

ARG BUILD_NUMBER=0-development
RUN sed -i '/^VERSION_SHA_LENGTH = .*/i # CCCS Superset Azure pipeline injection\nBUILD_NUMBER = '${BUILD_NUMBER}'\n' /app/superset/config.py \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

USER superset
