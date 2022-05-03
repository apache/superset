FROM uchimera.azurecr.io/cccs/superset-base:cccs-1.4_20220411144824_b3288

USER root

COPY requirements.txt /tmp

ARG BUILD_NUMBER=0-development
RUN sed -i '/^VERSION_SHA_LENGTH = .*/i # CCCS Superset Azure pipeline injection\nBUILD_NUMBER = '${BUILD_NUMBER}'\n' /app/superset/config.py \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

ENV BUILD_NUMBER_VAR=${BUILD_NUMBER}

# Make pip use analytical-platform feed
# Can't currently use uid=$NB_UID while mounting, using uid=1000 instead. See: https://github.com/moby/buildkit/issues/815
# IMPORTANT: This is the extension that handles auditing (for policy compliance) - DO NOT REMOVE!
RUN --mount=type=secret,id=pipconfig,target=/tmp/pip.conf,uid=1000 \
    PIP_CONFIG_FILE="/tmp/pip.conf" python -m pip install --no-cache-dir -r analytical-platform-requirements.txt && \
    rm analytical-platform-requirements.txt && \
    fix-permissions $CONDA_DIR

USER superset

