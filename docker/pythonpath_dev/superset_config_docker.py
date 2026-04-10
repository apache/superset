import logging
import os
import sys
import subprocess
import duckdb
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL

logger = logging.getLogger()

# Allow sqlite to be used 
# via https://github.com/apache/superset/issues/9748
# Superset configuration file
PREVENT_UNSAFE_DB_CONNECTIONS=False


@event.listens_for(Engine, "connect")
def init_duckdb_connection(dbapi_connection, connection_record):
    if type(dbapi_connection).__module__.startswith("duckdb"):
        cursor = dbapi_connection.cursor()
        
        proxy = os.environ["HTTP_PROXY"].rstrip("/")  # remove the trailing '/' otherwise duckdb errors
        connection = os.environ["DUCKLAKE_CONNECTION"]
        attach = f"""ATTACH '{connection}' AS camino (READ_ONLY);"""

        cursor.execute(f"SET http_proxy='{proxy}';")
        cursor.execute("INSTALL postgres; LOAD postgres;")
        cursor.execute("INSTALL ducklake; LOAD ducklake;")
        try:
            cursor.execute(attach)
        except Exception as e:
            logger.exception(f"Failed to attach DuckLake with query '{attach}': {e}")

        cursor.close()

# Add DuckDB to allowed databases
PREFERRED_DATABASES = ['postgresql', 'duckdb']
