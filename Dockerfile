######################################################################
# Official Superset image
######################################################################
ARG SUPERSET_VER=1.1.0
FROM apache/superset:${SUPERSET_VER} AS superset-official

# copy patch files to official image
ARG SUPERSET_VER
COPY ./${SUPERSET_VER}/superset /app/superset
COPY ./${SUPERSET_VER}/superset-frontend /app/superset-frontend

######################################################################
# Node stage to deal with static asset construction
######################################################################
FROM node:14 AS superset-node

ARG NPM_VER=7
RUN npm install -g npm@${NPM_VER}

ARG NPM_BUILD_CMD="build"
ENV BUILD_CMD=${NPM_BUILD_CMD}

# NPM ci first, as to NOT invalidate previous steps except for when package.json changes
RUN mkdir -p /app/superset-frontend
RUN mkdir -p /app/superset/assets
COPY ./docker/frontend-mem-nag.sh /
COPY --from=superset-official /app/superset-frontend/package* /app/superset-frontend/
RUN /frontend-mem-nag.sh \
        && cd /app/superset-frontend \
        && npm ci

# Next, copy in the rest and let webpack do its thing
COPY --from=superset-official /app/superset-frontend /app/superset-frontend

# This is BY FAR the most expensive step (thanks Terser!)
RUN cd /app/superset-frontend \
        && npm run ${BUILD_CMD} \
        && rm -rf node_modules

######################################################################
# Final image
######################################################################
FROM superset-official AS superset-xlsx

USER root

RUN pip install --no-cache openpyxl==3.0.3

COPY --from=superset-node /app/superset/static/assets /app/superset/static/assets

USER superset
