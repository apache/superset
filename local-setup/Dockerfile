FROM shipmnts/superset:production as dev

COPY ./superset_config.py  /app/pythonpath/superset_config.py
COPY ./docker/.env /app/docker/.env
COPY ./superset/utils /app/superset/utils
USER root
COPY requirements-local.txt /app/
RUN pip install -r /app/requirements-local.txt
EXPOSE 8088
USER superset
