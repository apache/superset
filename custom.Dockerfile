FROM hsnbd/superset_from_source:1.0.01

USER root

# Refresh package list, clean any cache, and install dependencies
RUN apt-get update && \
    apt-get install -y libaio1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the oracledb Python package
RUN echo "Installing oracledb Python package..." && \
    pip install --upgrade pip && \
    pip install oracledb && \
    echo "oracledb installation completed."


docker run -it -p 8088:8088 -h 0.0.0.0:0.0.0.0 -e SUPERSET_CONFIG_PATH=/app/superset/superset_config.py \
-v /home/hasan/workstation/superset-from-source/superset/_superset_config.py:/app/superset/superset_config.py \
hello:latest

# docker run -it -e SUPERSET_CONFIG_PATH=/app/superset/superset_config.py hello:latest