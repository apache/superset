FROM apache/superset:latest as dev
 
COPY ./docker/pythonpath_dev/superset_config.py  /app/pythonpath/superset_config.py
COPY ./docker/.env /app/docker/.env
COPY ./superset/utils /app/superset/utils
COPY requirements-local.txt /app/requirements-local.txt
USER root
RUN pip install -r /app/requirements-local.txt
EXPOSE 8088
USER superset

