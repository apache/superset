# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from __future__ import annotations

import os
from typing import Any

import yaml

from superset.constants import TimeGrain
from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec


# Documentation metadata for databases
# This provides comprehensive connection info for generating documentation
# All content from docs/docs/configuration/databases.mdx should be captured here
DATABASE_DOCS: dict[str, dict[str, Any]] = {
    "PostgreSQL": {
        "description": "PostgreSQL is an advanced open-source relational database.",
        "logo": "postgresql.svg",
        "homepage_url": "https://www.postgresql.org/",
        "pypi_packages": ["psycopg2"],
        "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}",
        "default_port": 5432,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "For localhost: localhost or 127.0.0.1. For AWS: endpoint URL",
            "port": "Default 5432",
            "database": "Database name",
        },
        "notes": "The psycopg2 library comes bundled with Superset Docker images.",
        "connection_examples": [
            {
                "description": "Basic connection",
                "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}",
            },
            {
                "description": "With SSL required",
                "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}?sslmode=require",
            },
        ],
        "docs_url": "https://www.postgresql.org/docs/",
        "sqlalchemy_docs_url": "https://docs.sqlalchemy.org/en/13/dialects/postgresql.html",
        "compatible_databases": [
            {
                "name": "Hologres",
                "description": "Alibaba Cloud real-time interactive analytics service, fully compatible with PostgreSQL 11.",
                "logo": "hologres.png",
                "homepage_url": "https://www.alibabacloud.com/product/hologres",
                "pypi_packages": ["psycopg2"],
                "connection_string": "postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}",
                "parameters": {
                    "username": "AccessKey ID of your Alibaba Cloud account",
                    "password": "AccessKey secret of your Alibaba Cloud account",
                    "host": "Public endpoint of the Hologres instance",
                    "port": "Port number of the Hologres instance",
                    "database": "Name of the Hologres database",
                },
            },
            {
                "name": "TimescaleDB",
                "description": "Open-source relational database for time-series and analytics, built on PostgreSQL.",
                "logo": "timescale.png",
                "homepage_url": "https://www.timescale.com/",
                "pypi_packages": ["psycopg2"],
                "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}",
                "connection_examples": [
                    {
                        "description": "Timescale Cloud (SSL required)",
                        "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}?sslmode=require",
                    },
                ],
                "notes": "psycopg2 comes bundled with Superset Docker images.",
                "docs_url": "https://docs.timescale.com/",
            },
            {
                "name": "YugabyteDB",
                "description": "Distributed SQL database built on top of PostgreSQL.",
                "logo": "yugabyte.png",
                "homepage_url": "https://www.yugabyte.com/",
                "pypi_packages": ["psycopg2"],
                "connection_string": "postgresql://{username}:{password}@{host}:{port}/{database}",
                "notes": "psycopg2 comes bundled with Superset Docker images.",
                "docs_url": "https://www.yugabyte.com/",
            },
        ],
    },
    "MySQL": {
        "description": "MySQL is a popular open-source relational database.",
        "logo": "mysql.jpg",
        "homepage_url": "https://www.mysql.com/",
        "pypi_packages": ["mysqlclient"],
        "connection_string": "mysql://{username}:{password}@{host}/{database}",
        "default_port": 3306,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "localhost, 127.0.0.1, IP address, or hostname",
            "database": "Database name",
        },
        "host_examples": [
            {"platform": "Localhost", "host": "localhost or 127.0.0.1"},
            {"platform": "Docker on Linux", "host": "172.18.0.1"},
            {"platform": "Docker on macOS", "host": "docker.for.mac.host.internal"},
            {"platform": "On-premise", "host": "IP address or hostname"},
        ],
        "drivers": [
            {
                "name": "mysqlclient",
                "pypi_package": "mysqlclient",
                "connection_string": "mysql://{username}:{password}@{host}/{database}",
                "is_recommended": True,
                "notes": "Recommended driver. May fail with caching_sha2_password auth.",
            },
            {
                "name": "mysql-connector-python",
                "pypi_package": "mysql-connector-python",
                "connection_string": "mysql+mysqlconnector://{username}:{password}@{host}/{database}",
                "is_recommended": False,
                "notes": "Required for newer MySQL databases using caching_sha2_password authentication.",
            },
        ],
    },
    "SQLite": {
        "description": "SQLite is a self-contained, serverless SQL database engine.",
        "logo": "sqlite.jpg",
        "homepage_url": "https://www.sqlite.org/",
        "pypi_packages": [],
        "connection_string": "sqlite:///path/to/file.db?check_same_thread=false",
        "notes": "No additional library needed. SQLite is bundled with Python.",
    },
    "AWS Athena": {
        "description": "Amazon Athena is an interactive query service for analyzing data in S3 using SQL.",
        "logo": "amazon-athena.jpg",
        "homepage_url": "https://aws.amazon.com/athena/",
        "drivers": [
            {
                "name": "PyAthena (REST)",
                "pypi_package": "pyathena[pandas]",
                "connection_string": "awsathena+rest://{aws_access_key_id}:{aws_secret_access_key}@athena.{region_name}.amazonaws.com/{schema_name}?s3_staging_dir={s3_staging_dir}",
                "is_recommended": True,
                "notes": "No Java required. URL-encode special characters (e.g., s3:// -> s3%3A//).",
            },
            {
                "name": "PyAthenaJDBC",
                "pypi_package": "PyAthenaJDBC",
                "connection_string": "awsathena+jdbc://{aws_access_key_id}:{aws_secret_access_key}@athena.{region_name}.amazonaws.com/{schema_name}?s3_staging_dir={s3_staging_dir}",
                "is_recommended": False,
                "notes": "Requires Amazon Athena JDBC driver.",
            },
        ],
        "engine_parameters": [
            {
                "name": "IAM Role Assumption",
                "description": "Assume a specific IAM role for queries",
                "json": {"connect_args": {"role_arn": "<role arn>"}},
            },
        ],
        "notes": "URL-encode special characters in s3_staging_dir (e.g., s3:// becomes s3%3A//).",
    },
    "AWS DynamoDB": {
        "description": "Amazon DynamoDB is a fully managed NoSQL database service.",
        "homepage_url": "https://aws.amazon.com/dynamodb/",
        "pypi_packages": ["pydynamodb"],
        "connection_string": "dynamodb://{access_key_id}:{secret_access_key}@dynamodb.{region_name}.amazonaws.com:443?connector=superset",
        "docs_url": "https://github.com/passren/PyDynamoDB/wiki/5.-Superset",
    },
    "AWS Redshift": {
        "description": "Amazon Redshift is a fully managed data warehouse service.",
        "logo": "redshift.png",
        "homepage_url": "https://aws.amazon.com/redshift/",
        "pypi_packages": ["sqlalchemy-redshift"],
        "default_port": 5439,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "AWS Endpoint",
            "port": "Default 5439",
            "database": "Database name",
        },
        "drivers": [
            {
                "name": "psycopg2",
                "pypi_package": "psycopg2",
                "connection_string": "redshift+psycopg2://{username}:{password}@{host}:5439/{database}",
                "is_recommended": True,
            },
            {
                "name": "redshift_connector",
                "pypi_package": "redshift_connector",
                "connection_string": "redshift+redshift_connector://{username}:{password}@{host}:5439/{database}",
                "is_recommended": False,
                "notes": "Supports IAM-based credentials for clusters and serverless.",
            },
        ],
        "authentication_methods": [
            {
                "name": "IAM Credentials (Cluster)",
                "description": "Use IAM-based temporary database credentials for Redshift clusters",
                "requirements": "IAM role must have redshift:GetClusterCredentials permission",
                "connection_string": "redshift+redshift_connector://",
                "engine_parameters": {
                    "connect_args": {
                        "iam": True,
                        "database": "<database>",
                        "cluster_identifier": "<cluster_identifier>",
                        "db_user": "<db_user>",
                    }
                },
            },
            {
                "name": "IAM Credentials (Serverless)",
                "description": "Use IAM-based credentials for Redshift Serverless",
                "requirements": "IAM role must have redshift-serverless:GetCredentials and redshift-serverless:GetWorkgroup permissions",
                "connection_string": "redshift+redshift_connector://",
                "engine_parameters": {
                    "connect_args": {
                        "iam": True,
                        "is_serverless": True,
                        "serverless_acct_id": "<aws account number>",
                        "serverless_work_group": "<redshift work group>",
                        "database": "<database>",
                        "user": "IAMR:<superset iam role name>",
                    }
                },
            },
        ],
    },
    "Apache Doris": {
        "description": "Apache Doris is a high-performance real-time analytical database.",
        "logo": "doris.png",
        "homepage_url": "https://doris.apache.org/",
        "pypi_packages": ["pydoris"],
        "connection_string": "doris://{username}:{password}@{host}:{port}/{catalog}.{database}",
        "parameters": {
            "username": "User name",
            "password": "Password",
            "host": "Doris FE Host",
            "port": "Doris FE port",
            "catalog": "Catalog name",
            "database": "Database name",
        },
    },
    "Apache Drill": {
        "description": "Apache Drill is a schema-free SQL query engine for Hadoop and NoSQL.",
        "logo": "apache-drill.png",
        "homepage_url": "https://drill.apache.org/",
        "drivers": [
            {
                "name": "SQLAlchemy (REST)",
                "pypi_package": "sqlalchemy-drill",
                "connection_string": "drill+sadrill://{username}:{password}@{host}:{port}/{storage_plugin}?use_ssl=True",
                "is_recommended": True,
            },
            {
                "name": "JDBC",
                "pypi_package": "sqlalchemy-drill",
                "connection_string": "drill+jdbc://{username}:{password}@{host}:{port}",
                "is_recommended": False,
                "notes": "Requires Drill JDBC Driver installation.",
                "docs_url": "https://drill.apache.org/docs/using-the-jdbc-driver/",
            },
            {
                "name": "ODBC",
                "pypi_package": "sqlalchemy-drill",
                "is_recommended": False,
                "notes": "See Apache Drill documentation for ODBC setup.",
                "docs_url": "https://drill.apache.org/docs/installing-the-driver-on-linux/",
            },
        ],
        "connection_examples": [
            {
                "description": "Local embedded mode",
                "connection_string": "drill+sadrill://localhost:8047/dfs?use_ssl=False",
            },
        ],
    },
    "Apache Druid": {
        "description": "Apache Druid is a high performance real-time analytics database.",
        "logo": "druid.png",
        "homepage_url": "https://druid.apache.org/",
        "pypi_packages": ["pydruid"],
        "connection_string": "druid://{username}:{password}@{host}:{port}/druid/v2/sql",
        "default_port": 9088,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "IP address or URL of the host",
            "port": "Default 9088",
        },
        "ssl_configuration": {
            "custom_certificate": "Add certificate in Root Certificate field. pydruid will automatically use https.",
            "disable_ssl_verification": {
                "engine_params": {
                    "connect_args": {"scheme": "https", "ssl_verify_cert": False}
                }
            },
        },
        "advanced_features": {
            "aggregations": "Define common aggregations in datasource edit view under List Druid Column tab.",
            "post_aggregations": "Create metrics with postagg as Metric Type and provide valid JSON post-aggregation definition.",
        },
        "notes": "A native Druid connector ships with Superset (behind DRUID_IS_ACTIVE flag) but SQLAlchemy connector via pydruid is preferred.",
    },
    "Apache Hive": {
        "description": "Apache Hive is a data warehouse infrastructure built on Hadoop.",
        "logo": "apache-hive.svg",
        "homepage_url": "https://hive.apache.org/",
        "pypi_packages": ["pyhive"],
        "connection_string": "hive://hive@{hostname}:{port}/{database}",
    },
    "Apache Impala": {
        "description": "Apache Impala is an open-source massively parallel processing SQL query engine.",
        "logo": "apache-impala.png",
        "homepage_url": "https://impala.apache.org/",
        "pypi_packages": ["impyla"],
        "connection_string": "impala://{hostname}:{port}/{database}",
    },
    "Apache Kylin": {
        "description": "Apache Kylin is an open-source OLAP engine for big data.",
        "logo": "apache-kylin.png",
        "homepage_url": "https://kylin.apache.org/",
        "pypi_packages": ["kylinpy"],
        "connection_string": "kylin://{username}:{password}@{hostname}:{port}/{project}?{param1}={value1}&{param2}={value2}",
    },
    "Apache Pinot": {
        "description": "Apache Pinot is a real-time distributed OLAP datastore.",
        "logo": "apache-pinot.svg",
        "homepage_url": "https://pinot.apache.org/",
        "pypi_packages": ["pinotdb"],
        "connection_string": "pinot+http://{broker_host}:{broker_port}/query?controller=http://{controller_host}:{controller_port}/",
        "connection_examples": [
            {
                "description": "With authentication",
                "connection_string": "pinot://{username}:{password}@{broker_host}:{broker_port}/query/sql?controller=http://{controller_host}:{controller_port}/verify_ssl=true",
            },
        ],
        "engine_parameters": [
            {
                "name": "Multi-stage Query Engine",
                "description": "Enable for Explore view, joins, window functions",
                "json": {"connect_args": {"use_multistage_engine": "true"}},
                "docs_url": "https://docs.pinot.apache.org/reference/multi-stage-engine",
            },
        ],
    },
    "Apache Solr": {
        "description": "Apache Solr is an open-source enterprise search platform.",
        "homepage_url": "https://solr.apache.org/",
        "pypi_packages": ["sqlalchemy-solr"],
        "connection_string": "solr://{username}:{password}@{host}:{port}/{server_path}/{collection}[/?use_ssl=true|false]",
    },
    "Apache Spark SQL": {
        "description": "Apache Spark SQL is a module for structured data processing.",
        "homepage_url": "https://spark.apache.org/sql/",
        "pypi_packages": ["pyhive"],
        "connection_string": "hive://hive@{hostname}:{port}/{database}",
    },
    "Arc": {
        "description": "Arc is a data platform with multiple connection options.",
        "drivers": [
            {
                "name": "Apache Arrow (Recommended)",
                "pypi_package": "arc-superset-arrow",
                "connection_string": "arc+arrow://{api_key}@{hostname}:{port}/{database}",
                "is_recommended": True,
                "notes": "Recommended for production. Provides 3-5x better performance using Apache Arrow IPC binary format.",
            },
            {
                "name": "JSON",
                "pypi_package": "arc-superset-dialect",
                "connection_string": "arc+json://{api_key}@{hostname}:{port}/{database}",
                "is_recommended": False,
            },
        ],
        "notes": "Arc supports multiple databases (schemas) within a single instance. Each Arc database appears as a schema in SQL Lab.",
    },
    "Ascend.io": {
        "description": "Ascend.io is a data automation platform.",
        "pypi_packages": ["impyla"],
        "connection_string": "ascend://{username}:{password}@{hostname}:{port}/{database}?auth_mechanism=PLAIN;use_ssl=true",
    },
    "ClickHouse": {
        "description": "ClickHouse is an open-source column-oriented OLAP database.",
        "logo": "clickhouse.png",
        "homepage_url": "https://clickhouse.com/",
        "pypi_packages": ["clickhouse-connect"],
        "connection_string": "clickhousedb://{username}:{password}@{hostname}:{port}/{database}",
        "version_requirements": "clickhouse-connect>=0.6.8",
        "connection_examples": [
            {
                "description": "Altinity Cloud",
                "connection_string": "clickhousedb://demo:demo@github.demo.trial.altinity.cloud/default?secure=true",
            },
            {
                "description": "Local (no auth, no SSL)",
                "connection_string": "clickhousedb://localhost/default",
            },
        ],
        "install_instructions": 'echo "clickhouse-connect>=0.6.8" >> ./docker/requirements-local.txt',
    },
    "Cloudflare D1": {
        "description": "Cloudflare D1 is a serverless SQLite database.",
        "pypi_packages": ["superset-engine-d1"],
        "connection_string": "d1://{cloudflare_account_id}:{cloudflare_api_token}@{cloudflare_d1_database_id}",
        "install_instructions": "pip install superset-engine-d1",
    },
    "CockroachDB": {
        "description": "CockroachDB is a distributed SQL database built for cloud applications.",
        "homepage_url": "https://www.cockroachlabs.com/",
        "pypi_packages": ["cockroachdb"],
        "connection_string": "cockroachdb://root@{hostname}:{port}/{database}?sslmode=disable",
        "docs_url": "https://github.com/cockroachdb/sqlalchemy-cockroachdb",
    },
    "Couchbase": {
        "description": "Couchbase is a distributed NoSQL document database with SQL support.",
        "logo": "couchbase.svg",
        "homepage_url": "https://www.couchbase.com/",
        "pypi_packages": ["couchbase-sqlalchemy"],
        "connection_string": "couchbase://{username}:{password}@{hostname}:{port}?truststorepath={certificate_path}?ssl={true|false}",
        "notes": "Supports Couchbase Analytics and Couchbase Columnar services.",
        "docs_url": "https://github.com/couchbase/couchbase-sqlalchemy",
    },
    "CrateDB": {
        "description": "CrateDB is a distributed SQL database for machine data.",
        "homepage_url": "https://cratedb.com/",
        "pypi_packages": ["sqlalchemy-cratedb"],
        "version_requirements": "sqlalchemy-cratedb>=0.40.1,<1",
        "default_port": 4200,
        "connection_examples": [
            {
                "description": "Self-Managed (localhost)",
                "connection_string": "crate://crate@127.0.0.1:4200",
            },
            {
                "description": "CrateDB Cloud",
                "connection_string": "crate://{username}:{password}@{clustername}.cratedb.net:4200/?ssl=true",
            },
        ],
        "install_instructions": 'echo "sqlalchemy-cratedb" >> ./docker/requirements-local.txt',
        "docs_url": "https://cratedb.com/product/cloud",
    },
    "Databend": {
        "description": "Databend is an open-source cloud data warehouse.",
        "logo": "databend.png",
        "homepage_url": "https://www.databend.com/",
        "pypi_packages": ["databend-sqlalchemy"],
        "version_requirements": "databend-sqlalchemy>=0.2.3",
        "connection_string": "databend://{username}:{password}@{host}:{port}/{database_name}",
        "connection_examples": [
            {
                "description": "Local connection",
                "connection_string": "databend://user:password@localhost:8000/default?secure=false",
            },
        ],
    },
    "Databricks": {
        "description": "Databricks is a unified analytics platform built on Apache Spark.",
        "logo": "databricks.png",
        "homepage_url": "https://www.databricks.com/",
        "pypi_packages": ["databricks-sql-connector", "sqlalchemy-databricks"],
        "install_instructions": 'pip install "apache-superset[databricks]"',
        "connection_string": "databricks+connector://token:{access_token}@{server_hostname}:{port}/{database_name}",
        "parameters": {
            "server_hostname": "Found in Configuration -> Advanced Options -> JDBC/ODBC",
            "port": "Found in Configuration -> Advanced Options -> JDBC/ODBC",
            "http_path": "Found in Configuration -> Advanced Options -> JDBC/ODBC",
            "access_token": "From Settings -> User Settings -> Access Tokens",
        },
        "engine_parameters": [
            {
                "name": "HTTP Path (Required)",
                "description": "Must be specified in Engine Parameters",
                "json": {"connect_args": {"http_path": "sql/protocolv1/o/****"}},
            },
        ],
        "drivers": [
            {
                "name": "Native Connector (Recommended)",
                "pypi_package": "databricks-sql-connector",
                "connection_string": "databricks+connector://token:{access_token}@{server_hostname}:{port}/{database_name}",
                "is_recommended": True,
            },
            {
                "name": "databricks-dbapi (Legacy)",
                "pypi_package": "databricks-dbapi[sqlalchemy]",
                "is_recommended": False,
                "notes": "Older connector. Try if having problems with official connector.",
            },
            {
                "name": "Hive Connector",
                "pypi_package": "databricks-dbapi[sqlalchemy]",
                "connection_string": "databricks+pyhive://token:{access_token}@{server_hostname}:{port}/{database_name}",
                "is_recommended": False,
            },
            {
                "name": "ODBC",
                "pypi_package": "databricks-dbapi[sqlalchemy]",
                "connection_string": "databricks+pyodbc://token:{access_token}@{server_hostname}:{port}/{database_name}",
                "is_recommended": False,
                "notes": "Requires ODBC drivers. Use for SQL endpoints.",
                "odbc_driver_paths": {
                    "macOS": "/Library/simba/spark/lib/libsparkodbc_sbu.dylib",
                    "Linux": "/opt/simba/spark/lib/64/libsparkodbc_sb64.so",
                },
                "docs_url": "https://databricks.com/spark/odbc-drivers-download",
            },
        ],
    },
    "Denodo": {
        "description": "Denodo is a data virtualization platform.",
        "logo": "denodo.png",
        "homepage_url": "https://www.denodo.com/",
        "pypi_packages": ["denodo-sqlalchemy"],
        "connection_string": "denodo://{username}:{password}@{hostname}:{port}/{database}",
        "default_port": 9996,
    },
    "Dremio": {
        "description": "Dremio is a data lake engine for self-service analytics.",
        "logo": "dremio.png",
        "homepage_url": "https://www.dremio.com/",
        "pypi_packages": ["sqlalchemy_dremio"],
        "drivers": [
            {
                "name": "Arrow Flight (Recommended)",
                "connection_string": "dremio+flight://{username}:{password}@{host}:32010/dremio",
                "default_port": 32010,
                "is_recommended": True,
                "notes": "Better performance with Arrow Flight.",
            },
            {
                "name": "ODBC",
                "connection_string": "dremio+pyodbc://{username}:{password}@{host}:31010/{database_name}/dremio?SSL=1",
                "default_port": 31010,
                "is_recommended": False,
            },
        ],
        "tutorials": ["https://www.dremio.com/tutorials/dremio-apache-superset/"],
    },
    "DuckDB": {
        "description": "DuckDB is an in-process analytical database.",
        "homepage_url": "https://duckdb.org/",
        "pypi_packages": ["duckdb-engine"],
        "connection_string": "duckdb:///path/to/file.db",
        "notes": "Great for local development. In-process database, no server needed.",
    },
    "Elasticsearch": {
        "description": "Elasticsearch is a distributed search and analytics engine.",
        "homepage_url": "https://www.elastic.co/elasticsearch/",
        "pypi_packages": ["elasticsearch-dbapi"],
        "connection_string": "elasticsearch+http://{username}:{password}@{host}:9200/",
        "default_port": 9200,
        "connection_examples": [
            {
                "description": "HTTPS",
                "connection_string": "elasticsearch+https://{username}:{password}@{host}:9200/",
            },
            {
                "description": "Disable SSL verification",
                "connection_string": "elasticsearch+https://{username}:{password}@{host}:9200/?verify_certs=False",
            },
        ],
        "engine_parameters": [
            {
                "name": "Time Zone",
                "description": "Override default UTC time zone",
                "json": {"connect_args": {"time_zone": "Asia/Shanghai"}},
            },
        ],
        "notes": "Default row limit is 10000. Can be changed via ROW_LIMIT config.",
        "advanced_features": {
            "multi_index_queries": "Use SQL Lab to query multiple indices (e.g., SELECT * FROM \"logstash\")",
            "multi_index_visualization": "Create an alias index for visualizations with multiple indices",
        },
        "warnings": [
            "Before Elasticsearch 7.8, CAST function doesn't support time_zone setting. Use DATETIME_PARSE instead.",
        ],
        "docs_url": "https://github.com/preset-io/elasticsearch-dbapi",
    },
    "Exasol": {
        "description": "Exasol is a high-performance in-memory analytics database.",
        "logo": "exasol.png",
        "homepage_url": "https://www.exasol.com/",
        "pypi_packages": ["sqlalchemy-exasol"],
        "connection_string": "exa+pyodbc://{username}:{password}@{hostname}:{port}/{schema}?CONNECTIONLCALL=en_US.UTF-8&driver=EXAODBC",
        "docs_url": "https://github.com/exasol/sqlalchemy-exasol",
    },
    "Firebird": {
        "description": "Firebird is an open-source relational database.",
        "logo": "firebird.png",
        "homepage_url": "https://firebirdsql.org/",
        "pypi_packages": ["sqlalchemy-firebird"],
        "version_requirements": "sqlalchemy-firebird>=0.7.0,<0.8",
        "connection_string": "firebird+fdb://{username}:{password}@{host}:{port}//{path_to_db_file}",
        "connection_examples": [
            {
                "description": "Local database",
                "connection_string": "firebird+fdb://SYSDBA:masterkey@192.168.86.38:3050//Library/Frameworks/Firebird.framework/Versions/A/Resources/examples/empbuild/employee.fdb",
            },
        ],
    },
    "Firebolt": {
        "description": "Firebolt is a cloud data warehouse for sub-second analytics.",
        "logo": "firebolt.png",
        "homepage_url": "https://www.firebolt.io/",
        "pypi_packages": ["firebolt-sqlalchemy"],
        "connection_examples": [
            {
                "description": "User authentication",
                "connection_string": "firebolt://{username}:{password}@{database}?account_name={name}",
            },
            {
                "description": "User auth with engine",
                "connection_string": "firebolt://{username}:{password}@{database}/{engine_name}?account_name={name}",
            },
            {
                "description": "Service account",
                "connection_string": "firebolt://{client_id}:{client_secret}@{database}?account_name={name}",
            },
            {
                "description": "Service account with engine",
                "connection_string": "firebolt://{client_id}:{client_secret}@{database}/{engine_name}?account_name={name}",
            },
        ],
    },
    "Google BigQuery": {
        "description": "Google BigQuery is a serverless, highly scalable data warehouse.",
        "logo": "google-big-query.svg",
        "homepage_url": "https://cloud.google.com/bigquery/",
        "pypi_packages": ["sqlalchemy-bigquery"],
        "connection_string": "bigquery://{project_id}",
        "install_instructions": 'echo "sqlalchemy-bigquery" >> ./docker/requirements-local.txt',
        "authentication_methods": [
            {
                "name": "Service Account JSON",
                "description": "Upload service account credentials JSON or paste in Secure Extra",
                "secure_extra": {
                    "credentials_info": {
                        "type": "service_account",
                        "project_id": "...",
                        "private_key_id": "...",
                        "private_key": "...",
                        "client_email": "...",
                        "client_id": "...",
                        "auth_uri": "...",
                        "token_uri": "...",
                        "auth_provider_x509_cert_url": "...",
                        "client_x509_cert_url": "...",
                    }
                },
            },
        ],
        "notes": "Create a Service Account via GCP console with access to BigQuery datasets. For CSV/Excel uploads, also install pandas_gbq.",
        "warnings": [
            "Google BigQuery Python SDK is not compatible with gevent. Use a worker type other than gevent when deploying with gunicorn.",
        ],
        "docs_url": "https://github.com/googleapis/python-bigquery-sqlalchemy",
    },
    "Google Sheets": {
        "description": "Query Google Sheets using SQL via the shillelagh library.",
        "logo": "google-sheets.svg",
        "homepage_url": "https://www.google.com/sheets/about/",
        "pypi_packages": ["shillelagh[gsheetsapi]"],
        "connection_string": "gsheets://",
        "notes": "Google Sheets has a limited SQL API.",
        "tutorials": ["https://preset.io/blog/2020-06-01-connect-superset-google-sheets/"],
        "docs_url": "https://github.com/betodealmeida/shillelagh",
    },
    "SAP HANA": {
        "description": "SAP HANA is an in-memory relational database and application platform.",
        "logo": "sap-hana.jpg",
        "homepage_url": "https://www.sap.com/products/technology-platform/hana.html",
        "pypi_packages": ["hdbcli", "sqlalchemy-hana"],
        "install_instructions": 'pip install apache_superset[hana]',
        "connection_string": "hana://{username}:{password}@{host}:{port}",
        "docs_url": "https://github.com/SAP/sqlalchemy-hana",
    },
    "IBM Db2": {
        "description": "IBM Db2 is a family of data management products.",
        "pypi_packages": ["ibm_db_sa"],
        "drivers": [
            {
                "name": "ibm_db_sa (with LIMIT)",
                "connection_string": "db2+ibm_db://{username}:{password}@{hostname}:{port}/{database}",
                "is_recommended": True,
            },
            {
                "name": "ibm_db_sa (without LIMIT syntax)",
                "connection_string": "ibm_db_sa://{username}:{password}@{hostname}:{port}/{database}",
                "is_recommended": False,
                "notes": "Use for older DB2 versions without LIMIT [n] syntax. Recommended for SQL Lab.",
            },
        ],
        "docs_url": "https://github.com/ibmdb/python-ibmdbsa",
    },
    "IBM Netezza": {
        "description": "IBM Netezza Performance Server is a data warehouse appliance.",
        "logo": "netezza.png",
        "homepage_url": "https://www.ibm.com/products/netezza",
        "pypi_packages": ["nzalchemy"],
        "connection_string": "netezza+nzpy://{username}:{password}@{hostname}:{port}/{database}",
    },
    "Kusto": {
        "description": "Azure Data Explorer (Kusto) is a fast, fully managed data analytics service.",
        "pypi_packages": ["sqlalchemy-kusto"],
        "version_requirements": "sqlalchemy-kusto>=2.0.0",
        "connection_examples": [
            {
                "description": "SQL dialect",
                "connection_string": "kustosql+https://{cluster_url}/{database}?azure_ad_client_id={client_id}&azure_ad_client_secret={secret}&azure_ad_tenant_id={tenant_id}&msi=False",
            },
            {
                "description": "KQL dialect",
                "connection_string": "kustokql+https://{cluster_url}/{database}?azure_ad_client_id={client_id}&azure_ad_client_secret={secret}&azure_ad_tenant_id={tenant_id}&msi=False",
            },
        ],
        "notes": "Ensure user has privileges to access all required databases/tables/views.",
    },
    "MariaDB": {
        "description": "MariaDB is a community-developed fork of MySQL.",
        "logo": "mariadb.png",
        "homepage_url": "https://mariadb.org/",
        "pypi_packages": ["mysqlclient"],
        "connection_string": "mysql://{username}:{password}@{host}/{database}",
        "default_port": 3306,
        "notes": "Uses the MySQL driver. Fully compatible with MySQL connector.",
    },
    "Microsoft SQL Server": {
        "description": "Microsoft SQL Server is a relational database management system.",
        "logo": "msql.png",
        "homepage_url": "https://www.microsoft.com/en-us/sql-server",
        "pypi_packages": ["pymssql"],
        "default_port": 1433,
        "drivers": [
            {
                "name": "pymssql",
                "pypi_package": "pymssql",
                "connection_string": "mssql+pymssql://{username}:{password}@{host}:{port}/{database}",
                "is_recommended": True,
            },
            {
                "name": "pyodbc",
                "pypi_package": "pyodbc",
                "connection_string": "mssql+pyodbc:///?odbc_connect=Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3BServer%3Dtcp%3A%3C{host}%3E%2C1433%3BDatabase%3D{database}%3BUid%3D{username}%3BPwd%3D{password}%3BEncrypt%3Dyes%3BConnection+Timeout%3D30",
                "is_recommended": False,
                "notes": "Connection string must be URL-encoded. Special characters like @ need encoding.",
            },
        ],
        "docs_url": "https://docs.sqlalchemy.org/en/20/core/engines.html#escaping-special-characters-such-as-signs-in-passwords",
    },
    "OceanBase": {
        "description": "OceanBase is a distributed relational database.",
        "logo": "oceanbase.svg",
        "homepage_url": "https://www.oceanbase.com/",
        "pypi_packages": ["oceanbase_py"],
        "connection_string": "oceanbase://{username}:{password}@{host}:{port}/{database}",
    },
    "Ocient": {
        "description": "Ocient is a hyperscale data analytics database.",
        "pypi_packages": ["sqlalchemy-ocient"],
        "connection_string": "ocient://{username}:{password}@{host}:{port}/{database}",
        "install_instructions": "pip install sqlalchemy-ocient",
    },
    "Oracle": {
        "description": "Oracle Database is a multi-model database management system.",
        "logo": "oraclelogo.png",
        "homepage_url": "https://www.oracle.com/database/",
        "pypi_packages": ["oracledb"],
        "connection_string": "oracle://{username}:{password}@{hostname}:{port}",
        "notes": "Previously used cx_Oracle, now uses oracledb.",
        "docs_url": "https://cx-oracle.readthedocs.io/en/latest/user_guide/installation.html",
    },
    "Parseable": {
        "description": "Parseable is a distributed log analytics database with SQL-like query interface.",
        "pypi_packages": ["sqlalchemy-parseable"],
        "connection_string": "parseable://{username}:{password}@{hostname}:{port}/{stream_name}",
        "connection_examples": [
            {
                "description": "Example connection",
                "connection_string": "parseable://admin:admin@demo.parseable.com:443/ingress-nginx",
            },
        ],
        "notes": "Stream name in URI represents the Parseable logstream to query. Supports HTTP (80) and HTTPS (443).",
        "docs_url": "https://www.parseable.io",
    },
    "Presto": {
        "description": "Presto is a distributed SQL query engine for big data.",
        "logo": "presto-og.png",
        "homepage_url": "https://prestodb.io/",
        "pypi_packages": ["pyhive"],
        "connection_string": "presto://{username}:{password}@{hostname}:{port}/{database}",
        "connection_examples": [
            {
                "description": "Basic connection",
                "connection_string": "presto://{hostname}:{port}/{database}",
            },
            {
                "description": "With authentication",
                "connection_string": "presto://{username}:{password}@{hostname}:{port}/{database}",
            },
            {
                "description": "Example with values",
                "connection_string": "presto://datascientist:securepassword@presto.example.com:8080/hive",
            },
        ],
        "engine_parameters": [
            {
                "name": "Older Presto Version",
                "description": "Configure for older Presto versions",
                "json": {"version": "0.123"},
            },
            {
                "name": "SSL Configuration",
                "description": "Enable HTTPS with SSL",
                "json": {
                    "connect_args": {
                        "protocol": "https",
                        "requests_kwargs": {"verify": False},
                    }
                },
            },
        ],
    },
    "RisingWave": {
        "description": "RisingWave is a distributed streaming database.",
        "pypi_packages": ["sqlalchemy-risingwave"],
        "connection_string": "risingwave://root@{hostname}:{port}/{database}?sslmode=disable",
        "docs_url": "https://github.com/risingwavelabs/sqlalchemy-risingwave",
    },
    "SingleStore": {
        "description": "SingleStore is a distributed SQL database for real-time analytics.",
        "pypi_packages": ["sqlalchemy-singlestoredb"],
        "connection_string": "singlestoredb://{username}:{password}@{host}:{port}/{database}",
        "docs_url": "https://github.com/singlestore-labs/sqlalchemy-singlestoredb",
    },
    "Snowflake": {
        "description": "Snowflake is a cloud-native data warehouse.",
        "logo": "snowflake.svg",
        "homepage_url": "https://www.snowflake.com/",
        "pypi_packages": ["snowflake-sqlalchemy"],
        "connection_string": "snowflake://{user}:{password}@{account}.{region}/{database}?role={role}&warehouse={warehouse}",
        "install_instructions": 'echo "snowflake-sqlalchemy" >> ./docker/requirements-local.txt',
        "connection_examples": [
            {
                "description": "With role and warehouse",
                "connection_string": "snowflake://{user}:{password}@{account}.{region}/{database}?role={role}&warehouse={warehouse}",
            },
            {
                "description": "With defaults (role/warehouse optional)",
                "connection_string": "snowflake://{user}:{password}@{account}.{region}/{database}",
            },
        ],
        "authentication_methods": [
            {
                "name": "Key Pair Authentication",
                "description": "Use RSA key pair instead of password",
                "requirements": "Key pair must be generated and public key registered in Snowflake",
                "secure_extra_body": {
                    "auth_method": "keypair",
                    "auth_params": {
                        "privatekey_body": "-----BEGIN ENCRYPTED PRIVATE KEY-----\\n...\\n-----END ENCRYPTED PRIVATE KEY-----",
                        "privatekey_pass": "Your Private Key Password",
                    },
                },
                "notes": "Merge multi-line private key to one line with \\n between lines.",
            },
            {
                "name": "Key Pair (File Path)",
                "description": "Key pair with private key stored on server",
                "secure_extra_path": {
                    "auth_method": "keypair",
                    "auth_params": {
                        "privatekey_path": "Your Private Key Path",
                        "privatekey_pass": "Your Private Key Password",
                    },
                },
            },
        ],
        "notes": "Schema is not required in connection string (defined per table/query). Ensure user has privileges for all databases/schemas/tables/views/warehouses.",
        "docs_url": "https://docs.snowflake.com/en/user-guide/key-pair-auth.html",
    },
    "StarRocks": {
        "description": "StarRocks is a next-generation sub-second MPP database.",
        "logo": "starrocks.png",
        "homepage_url": "https://www.starrocks.io/",
        "pypi_packages": ["starrocks"],
        "connection_string": "starrocks://{username}:{password}@{host}:{port}/{catalog}.{database}",
        "parameters": {
            "username": "User name",
            "password": "Database password",
            "host": "StarRocks FE Host",
            "port": "StarRocks FE port",
            "catalog": "Catalog name",
            "database": "Database name",
        },
        "docs_url": "https://docs.starrocks.io/docs/integrations/BI_integrations/Superset/",
    },
    "TDengine": {
        "description": "TDengine is a high-performance time-series database for IoT.",
        "logo": "tdengine.png",
        "homepage_url": "https://tdengine.com/",
        "pypi_packages": ["taospy", "taos-ws-py"],
        "connection_string": "taosws://{user}:{password}@{host}:{port}",
        "default_port": 6041,
        "connection_examples": [
            {
                "description": "Local connection",
                "connection_string": "taosws://root:taosdata@127.0.0.1:6041",
            },
        ],
        "docs_url": "https://www.tdengine.com",
    },
    "Teradata": {
        "description": "Teradata is an enterprise data warehouse platform.",
        "logo": "teradata.png",
        "homepage_url": "https://www.teradata.com/",
        "pypi_packages": ["teradatasqlalchemy"],
        "connection_string": "teradatasql://{user}:{password}@{host}",
        "drivers": [
            {
                "name": "teradatasqlalchemy (Recommended)",
                "pypi_package": "teradatasqlalchemy",
                "connection_string": "teradatasql://{user}:{password}@{host}",
                "is_recommended": True,
                "notes": "No ODBC drivers required.",
            },
            {
                "name": "sqlalchemy-teradata (ODBC)",
                "pypi_package": "sqlalchemy-teradata",
                "is_recommended": False,
                "notes": "Requires ODBC driver installation.",
                "environment_variables": {
                    "ODBCINI": "/.../teradata/client/ODBC_64/odbc.ini",
                    "ODBCINST": "/.../teradata/client/ODBC_64/odbcinst.ini",
                },
                "docs_url": "https://downloads.teradata.com/download/connectivity/odbc-driver/linux",
            },
        ],
    },
    "Trino": {
        "description": "Trino is a distributed SQL query engine for big data analytics.",
        "logo": "trino.png",
        "homepage_url": "https://trino.io/",
        "pypi_packages": ["trino"],
        "connection_string": "trino://{username}:{password}@{hostname}:{port}/{catalog}",
        "version_requirements": "Trino version 352 and higher",
        "connection_examples": [
            {
                "description": "Docker local",
                "connection_string": "trino://trino@host.docker.internal:8080",
            },
        ],
        "authentication_methods": [
            {
                "name": "Basic Authentication",
                "description": "Username/password in connection string or Secure Extra",
                "connection_string": "trino://{username}:{password}@{hostname}:{port}/{catalog}",
                "secure_extra": {
                    "auth_method": "basic",
                    "auth_params": {"username": "<username>", "password": "<password>"},
                },
                "notes": "Secure Extra takes priority if both are provided.",
            },
            {
                "name": "Kerberos Authentication",
                "description": "Kerberos-based authentication",
                "requirements": "Install trino[all] or trino[kerberos]",
                "secure_extra": {
                    "auth_method": "kerberos",
                    "auth_params": {
                        "service_name": "superset",
                        "config": "/path/to/krb5.config",
                    },
                },
            },
            {
                "name": "Certificate Authentication",
                "description": "Client certificate authentication",
                "secure_extra": {
                    "auth_method": "certificate",
                    "auth_params": {
                        "cert": "/path/to/cert.pem",
                        "key": "/path/to/key.pem",
                    },
                },
            },
            {
                "name": "JWT Authentication",
                "description": "JSON Web Token authentication",
                "secure_extra": {
                    "auth_method": "jwt",
                    "auth_params": {"token": "<your-jwt-token>"},
                },
            },
            {
                "name": "Custom Authentication",
                "description": "Custom auth class or factory function",
                "requirements": "Add to ALLOWED_EXTRA_AUTHENTICATIONS in config",
                "config_example": {
                    "ALLOWED_EXTRA_AUTHENTICATIONS": {
                        "trino": {
                            "custom_auth": "AuthClass",
                            "another_auth_method": "auth_method",
                        }
                    }
                },
                "secure_extra": {"auth_method": "custom_auth", "auth_params": {}},
            },
        ],
        "tutorials": ["https://trino.io/episodes/12.html"],
    },
    "Vertica": {
        "description": "Vertica is a column-oriented analytics database.",
        "logo": "vertica.png",
        "homepage_url": "https://www.vertica.com/",
        "pypi_packages": ["sqlalchemy-vertica-python"],
        "connection_string": "vertica+vertica_python://{username}:{password}@{host}/{database}",
        "default_port": 5433,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "localhost, IP address, or hostname (cloud or on-prem)",
            "database": "Database name",
            "port": "Default 5433",
        },
        "notes": "Supports load balancer backup host configuration.",
        "docs_url": "http://www.vertica.com/",
    },
    "YDB": {
        "description": "YDB is a distributed SQL database by Yandex.",
        "logo": "ydb.svg",
        "homepage_url": "https://ydb.tech/",
        "pypi_packages": ["ydb-sqlalchemy"],
        "connection_string": "ydb://{host}:{port}/{database_name}",
        "engine_parameters": [
            {
                "name": "Protocol",
                "description": "Specify connection protocol (default: grpc)",
                "secure_extra": {"protocol": "grpcs"},
            },
        ],
        "authentication_methods": [
            {
                "name": "Static Credentials",
                "description": "Username/password authentication",
                "secure_extra": {
                    "credentials": {"username": "...", "password": "..."}
                },
            },
            {
                "name": "Access Token",
                "description": "Token-based authentication",
                "secure_extra": {"credentials": {"token": "..."}},
            },
            {
                "name": "Service Account",
                "description": "Service account JSON credentials",
                "secure_extra": {
                    "credentials": {
                        "service_account_json": {
                            "id": "...",
                            "service_account_id": "...",
                            "created_at": "...",
                            "key_algorithm": "...",
                            "public_key": "...",
                            "private_key": "...",
                        }
                    }
                },
            },
        ],
        "docs_url": "https://ydb.tech/",
    },
}

LIMIT_METHODS = {
    "FORCE_LIMIT": (
        "modifies the query, replacing an existing LIMIT or adding a new one"
    ),  # E: line too long (89 > 79 characters)
    "WRAP_SQL": "wraps the original query in a SELECT * with a LIMIT",
    "FETCH_MANY": (
        "runs the query unmodified but fetchs only LIMIT rows from the cursor"
    ),  # E: line too long (89 > 79 characters)
}

DATABASE_DETAILS = {
    "limit_method": "Method used to limit the rows in the subquery",
    "joins": "Supports JOINs",
    "subqueries": "Supports subqueries",
    "alias_in_select": "Allows aliases in the SELECT statement",
    "alias_in_orderby": "Allows referencing aliases in the ORDER BY statement",
    "time_groupby_inline": (
        "Allows omitting time filters from inline GROUP BYs"
    ),  # E: line too long (80 > 79 characters)
    "alias_to_source_column": (
        "Able to use source column when an alias overshadows it"
    ),  # E: line too long (87 > 79 characters)
    "order_by_not_in_select": (
        "Allows aggregations in ORDER BY not present in the SELECT"
    ),  # E: line too long (90 > 79 characters)
    "expressions_in_orderby": "Allows expressions in ORDER BY",
    "cte_in_subquery": "Allows CTE as a subquery",
    "limit_clause": "Allows LIMIT clause (instead of TOP)",
    "max_column_name": "Maximum column name",
    "sql_comments": "Allows comments",
    "escaped_colons": "Colons must be escaped",
}
BASIC_FEATURES = {
    "masked_encrypted_extra": "Masks/unmasks encrypted_extra",
    "column_type_mapping": "Has column type mappings",
    "function_names": "Returns a list of function names",
}
NICE_TO_HAVE_FEATURES = {
    "user_impersonation": "Supports user impersonation",
    "file_upload": "Support file upload",
    "get_extra_table_metadata": "Returns extra table metadata",
    "dbapi_exception_mapping": "Maps driver exceptions to Superset exceptions",
    "custom_errors": "Parses error messages and returns Superset errors",
    "dynamic_schema": "Supports changing the schema per-query",
    "catalog": "Supports catalogs",
    "dynamic_catalog": "Supports changing the catalog per-query",
    "ssh_tunneling": "Can be connected thru an SSH tunnel",
    "query_cancelation": "Allows query to be canceled",
    "get_metrics": "Returns additional metrics on dataset creation",
    "where_latest_partition": "Supports querying the latest partition only",
}
ADVANCED_FEATURES = {
    "expand_data": "Expands complex types (arrays, structs) into rows/columns",
    "query_cost_estimation": "Supports query cost estimation",
    "sql_validation": "Supports validating SQL before running query",
}


def has_custom_method(spec: type[BaseEngineSpec], method: str) -> bool:
    """
    Check if a class has a custom implementation of a method.

    Since some classes don't inherit directly from ``BaseEngineSpec`` we need
    to check the attributes of the spec and the base class.
    """
    return bool(
        getattr(spec, method, False)
        and getattr(BaseEngineSpec, method, False)
        and getattr(spec, method).__qualname__
        != getattr(BaseEngineSpec, method).__qualname__
    )


def diagnose(spec: type[BaseEngineSpec]) -> dict[str, Any]:
    """
    Run basic diagnostics on a given DB engine spec.
    """
    # pylint: disable=import-outside-toplevel
    from superset.sql_validators.postgres import PostgreSQLValidator
    from superset.sql_validators.presto_db import PrestoDBSQLValidator

    sql_validators = {
        "presto": PrestoDBSQLValidator,
        "postgresql": PostgreSQLValidator,
    }

    output: dict[str, Any] = {}

    output["time_grains"] = {}
    supported_time_grains = spec.get_time_grain_expressions()
    for time_grain in TimeGrain:
        output["time_grains"][time_grain.name] = time_grain in supported_time_grains

    output.update(
        {
            "module": spec.__module__,
            "limit_method": spec.limit_method.value,
            "limit_clause": getattr(spec, "allow_limit_clause", True),
            "joins": spec.allows_joins,
            "subqueries": spec.allows_subqueries,
            "alias_in_select": spec.allows_alias_in_select,
            "alias_in_orderby": spec.allows_alias_in_orderby,
            "time_groupby_inline": spec.time_groupby_inline,
            "alias_to_source_column": not spec.allows_alias_to_source_column,
            "order_by_not_in_select": spec.allows_hidden_orderby_agg,
            "expressions_in_orderby": spec.allows_hidden_cc_in_orderby,
            "cte_in_subquery": spec.allows_cte_in_subquery,
            "max_column_name": spec.max_column_name_length,
            "sql_comments": spec.allows_sql_comments,
            "escaped_colons": spec.allows_escaped_colons,
            "masked_encrypted_extra": has_custom_method(spec, "mask_encrypted_extra"),
            "column_type_mapping": bool(spec.column_type_mappings),
            "function_names": has_custom_method(spec, "get_function_names"),
            # there are multiple ways of implementing user impersonation
            "user_impersonation": (
                has_custom_method(spec, "update_impersonation_config")
                or has_custom_method(spec, "get_url_for_impersonation")
                or has_custom_method(spec, "impersonate_user")
            ),
            "file_upload": spec.supports_file_upload,
            "get_extra_table_metadata": has_custom_method(
                spec, "get_extra_table_metadata"
            ),
            "dbapi_exception_mapping": has_custom_method(
                spec, "get_dbapi_exception_mapping"
            ),
            "custom_errors": (
                has_custom_method(spec, "extract_errors")
                or has_custom_method(spec, "custom_errors")
            ),
            "dynamic_schema": spec.supports_dynamic_schema,
            "catalog": spec.supports_catalog,
            "dynamic_catalog": spec.supports_dynamic_catalog,
            "ssh_tunneling": not spec.disable_ssh_tunneling,
            "query_cancelation": (
                has_custom_method(spec, "cancel_query") or spec.has_implicit_cancel()
            ),
            "get_metrics": has_custom_method(spec, "get_metrics"),
            "where_latest_partition": has_custom_method(spec, "where_latest_partition"),
            "expand_data": has_custom_method(spec, "expand_data"),
            "query_cost_estimation": has_custom_method(spec, "estimate_query_cost")
            or has_custom_method(spec, "estimate_statement_cost"),
            # SQL validation is implemented in external classes
            "sql_validation": spec.engine in sql_validators,
        },
    )

    # compute score
    score = 0

    # each time grain is 1 point
    score += sum(output["time_grains"][time_grain.name] for time_grain in TimeGrain)

    basic = ["masked_encrypted_extra", "column_type_mapping", "function_names"]
    nice_to_have = [
        "user_impersonation",
        "file_upload",
        "get_extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "catalog",
        "dynamic_catalog",
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "where_latest_partition",
    ]
    advanced = ["expand_data", "query_cost_estimation", "sql_validation"]
    score += sum(10 * int(output[key]) for key in basic)
    score += sum(10 * int(output[key]) for key in nice_to_have)
    score += sum(10 * int(output[key]) for key in advanced)
    output["score"] = score
    output["max_score"] = (
        len(TimeGrain) + 10 * len(basic) + 10 * len(nice_to_have) + 10 * len(advanced)
    )

    return output


def get_name(spec: type[BaseEngineSpec]) -> str:
    """
    Return a name for a given DB engine spec.
    """
    return spec.engine_name or spec.engine


def format_markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    """
    Format headers and rows into a markdown table.
    """
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        lines.append("| " + " | ".join(str(col) for col in row) + " |")
    return "\n".join(lines)


def generate_focused_table(
    info: dict[str, dict[str, Any]],
    feature_keys: list[str],
    column_labels: list[str],
    filter_fn: Any = None,
    value_extractor: Any = None,
    preserve_order: bool = False,
) -> tuple[str, list[str]]:
    """
    Generate a focused markdown table with databases as rows.

    Args:
        info: Dictionary mapping database names to their feature info
        feature_keys: List of feature keys to extract from db_info
        column_labels: List of column header labels
        filter_fn: Optional function to filter databases (receives db_info dict)
        value_extractor: Optional function to extract value (receives db_info, key)

    Returns:
        Tuple of (markdown table string, list of excluded database names)
    """
    # Filter databases if filter function provided
    filtered_info = {}
    excluded_dbs = []

    for db_name, db_info in info.items():
        if filter_fn is None or filter_fn(db_info):
            filtered_info[db_name] = db_info
        else:
            excluded_dbs.append(db_name)

    if not filtered_info:
        return "", excluded_dbs

    # Build headers: Database + feature columns
    headers = ["Database"] + column_labels

    # Build rows
    rows = []
    # Sort by database name unless preserve_order is True
    db_names = (
        list(filtered_info.keys()) if preserve_order else sorted(filtered_info.keys())
    )

    for db_name in db_names:
        db_info = filtered_info[db_name]
        row = [db_name]

        for key in feature_keys:
            if value_extractor:
                value = value_extractor(db_info, key)
            else:
                value = db_info.get(key, "")
            row.append(value)

        rows.append(row)

    return format_markdown_table(headers, rows), excluded_dbs


def calculate_support_level(db_info: dict[str, Any], feature_keys: list[str]) -> str:
    """
    Calculate support level for a group of features.

    Returns: "Supported", "Partial", or "Not supported"
    """
    if not feature_keys:
        return "Not supported"

    # Handle time grain features specially
    if all(k.startswith("time_grains.") for k in feature_keys):
        grain_keys = [k.split(".", 1)[1] for k in feature_keys]
        supported = sum(
            1 for grain in grain_keys if db_info["time_grains"].get(grain, False)
        )
    else:
        supported = sum(1 for k in feature_keys if db_info.get(k, False))

    total = len(feature_keys)
    if supported == 0:
        return "Not supported"
    elif supported == total:
        return "Supported"
    else:
        return "Partial"


def generate_feature_tables() -> str:
    """
    Generate multiple focused markdown tables organized by feature categories.

    Returns a complete markdown document with 7 tables optimized for readability.
    """
    info = {}
    for spec in sorted(load_engine_specs(), key=get_name):
        info[get_name(spec)] = diagnose(spec)

    # remove 3rd party DB engine specs
    info = {k: v for k, v in info.items() if v["module"].startswith("superset")}

    # Sort by score descending for overview table
    sorted_info = dict(sorted(info.items(), key=lambda x: x[1]["score"], reverse=True))

    output = []

    # Table 1: Feature Overview
    output.append("### Feature Overview\n")

    # Define feature groups for summary
    sql_basics = [
        "joins",
        "subqueries",
        "alias_in_select",
        "alias_in_orderby",
        "cte_in_subquery",
    ]
    advanced_sql = [
        "time_groupby_inline",
        "alias_to_source_column",
        "order_by_not_in_select",
        "expressions_in_orderby",
    ]
    common_grains = [
        f"time_grains.{g}"
        for g in ["SECOND", "MINUTE", "HOUR", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]
    ]
    extended_grains = [
        f"time_grains.{g}"
        for g in [
            "FIVE_SECONDS",
            "THIRTY_SECONDS",
            "FIVE_MINUTES",
            "TEN_MINUTES",
            "FIFTEEN_MINUTES",
            "THIRTY_MINUTES",
            "HALF_HOUR",
            "SIX_HOURS",
            "WEEK_STARTING_SUNDAY",
            "WEEK_STARTING_MONDAY",
            "WEEK_ENDING_SATURDAY",
            "WEEK_ENDING_SUNDAY",
            "QUARTER_YEAR",
        ]
    ]
    integrations = [
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "get_extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "where_latest_partition",
    ]
    advanced_features = [
        "user_impersonation",
        "expand_data",
        "query_cost_estimation",
        "sql_validation",
    ]

    headers = [
        "Database",
        "Score",
        "SQL Basics",
        "Advanced SQL",
        "Common Time Grains",
        "Extended Time Grains",
        "Integrations",
        "Advanced Features",
    ]
    rows = []
    for db_name, db_info in sorted_info.items():
        row = [
            db_name,
            db_info["score"],
            calculate_support_level(db_info, sql_basics),
            calculate_support_level(db_info, advanced_sql),
            calculate_support_level(db_info, common_grains),
            calculate_support_level(db_info, extended_grains),
            calculate_support_level(db_info, integrations),
            calculate_support_level(db_info, advanced_features),
        ]
        rows.append(row)
    output.append(format_markdown_table(headers, rows))

    # Table 2: Database Information
    output.append("\n### Database Information\n")

    # Custom value extractor for database info to handle limit_method enum
    def extract_db_info(db_info: dict[str, Any], key: str) -> str:
        if key == "limit_method":
            # Convert enum value to name
            from superset.sql.parse import LimitMethod

            return LimitMethod(db_info[key]).name
        return db_info.get(key, "")

    table, _ = generate_focused_table(
        info,
        feature_keys=["module", "limit_method", "limit_clause", "max_column_name"],
        column_labels=["Module", "Limit Method", "Limit Clause", "Max Column Name"],
        value_extractor=extract_db_info,
    )
    output.append(table)

    # Table 3: SQL Capabilities (combined SQL Capabilities + Advanced SQL)
    output.append("\n### SQL Capabilities\n")
    table, _ = generate_focused_table(
        info,
        feature_keys=[
            "joins",
            "subqueries",
            "alias_in_select",
            "alias_in_orderby",
            "cte_in_subquery",
            "sql_comments",
            "escaped_colons",
            "time_groupby_inline",
            "alias_to_source_column",
            "order_by_not_in_select",
            "expressions_in_orderby",
        ],
        column_labels=[
            "JOINs",
            "Subqueries",
            "Aliases in SELECT",
            "Aliases in ORDER BY",
            "CTEs",
            "Comments",
            "Escaped Colons",
            "Inline Time Groupby",
            "Source Column When Aliased",
            "Aggregations in ORDER BY",
            "Expressions in ORDER BY",
        ],
    )
    output.append(table)

    # Helper to extract time grain values
    def extract_time_grain(db_info: dict[str, Any], grain_name: str) -> str:
        return db_info["time_grains"].get(grain_name, False)

    # Table 4: Time Grains – Common
    output.append("\n### Time Grains – Common\n")
    common_grains = [
        "SECOND",
        "MINUTE",
        "HOUR",
        "DAY",
        "WEEK",
        "MONTH",
        "QUARTER",
        "YEAR",
    ]
    table, _ = generate_focused_table(
        info,
        feature_keys=common_grains,
        column_labels=common_grains,
        value_extractor=extract_time_grain,
    )
    output.append(table)

    # Table 5: Time Grains – Extended
    output.append("\n### Time Grains – Extended\n")
    extended_grains = [
        "FIVE_SECONDS",
        "THIRTY_SECONDS",
        "FIVE_MINUTES",
        "TEN_MINUTES",
        "FIFTEEN_MINUTES",
        "THIRTY_MINUTES",
        "HALF_HOUR",
        "SIX_HOURS",
        "WEEK_STARTING_SUNDAY",
        "WEEK_STARTING_MONDAY",
        "WEEK_ENDING_SATURDAY",
        "WEEK_ENDING_SUNDAY",
        "QUARTER_YEAR",
    ]
    table, _ = generate_focused_table(
        info,
        feature_keys=extended_grains,
        column_labels=extended_grains,
        value_extractor=extract_time_grain,
    )
    output.append(table)

    # Table 6: Core Platform & Metadata Features
    output.append("\n### Core Platform & Metadata Features\n")
    output.append("\nIntegration with platform features and metadata handling.\n")
    table, _ = generate_focused_table(
        info,
        feature_keys=[
            "masked_encrypted_extra",
            "column_type_mapping",
            "function_names",
            "file_upload",
            "dynamic_schema",
            "catalog",
            "dynamic_catalog",
            "ssh_tunneling",
            "where_latest_partition",
            "query_cancelation",
            "get_metrics",
            "get_extra_table_metadata",
            "dbapi_exception_mapping",
            "custom_errors",
        ],
        column_labels=[
            "Masked Encrypted Extra",
            "Column Type Mappings",
            "Function Names",
            "File Upload",
            "Dynamic Schema",
            "Catalog",
            "Dynamic Catalog",
            "SSH Tunneling",
            "Latest Partition",
            "Query Cancellation",
            "Get Metrics",
            "Extra Table Metadata",
            "Exception Mapping",
            "Custom Errors",
        ],
    )
    output.append(table)

    # Table 7: Operational & Advanced Features
    output.append("\n### Operational & Advanced Features\n")
    table, _ = generate_focused_table(
        info,
        feature_keys=[
            "user_impersonation",
            "expand_data",
            "query_cost_estimation",
            "sql_validation",
        ],
        column_labels=[
            "User Impersonation",
            "Expand Data",
            "Cost Estimation",
            "SQL Validation",
        ],
    )
    output.append(table)

    return "\n".join(output)


def generate_table() -> list[list[Any]]:
    """
    Generate a table showing info for all DB engine specs.

    DEPRECATED: This function is kept for backward compatibility.
    Use generate_feature_tables() instead for better readability.
    """
    info = {}
    for spec in sorted(load_engine_specs(), key=get_name):
        info[get_name(spec)] = diagnose(spec)

    # remove 3rd party DB engine specs
    info = {k: v for k, v in info.items() if v["module"].startswith("superset")}

    rows = []  # pylint: disable=redefined-outer-name
    rows.append(["Feature"] + list(info))  # header row
    rows.append(["Module"] + [db_info["module"] for db_info in info.values()])

    # descriptive
    keys = [
        "limit_method",
        "joins",
        "subqueries",
        "alias_in_select",
        "alias_in_orderby",
        "time_groupby_inline",
        "alias_to_source_column",
        "order_by_not_in_select",
        "expressions_in_orderby",
        "cte_in_subquery",
        "limit_clause",
        "max_column_name",
        "sql_comments",
        "escaped_colons",
    ]
    for key in keys:
        rows.append(
            [DATABASE_DETAILS[key]] + [db_info[key] for db_info in info.values()]
        )

    # basic
    for time_grain in TimeGrain:
        rows.append(
            [f"Has time grain {time_grain.name}"]
            + [db_info["time_grains"][time_grain.name] for db_info in info.values()]
        )
    keys = [
        "masked_encrypted_extra",
        "column_type_mapping",
        "function_names",
    ]
    for key in keys:
        rows.append([BASIC_FEATURES[key]] + [db_info[key] for db_info in info.values()])

    # nice to have
    keys = [
        "user_impersonation",
        "file_upload",
        "get_extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "catalog",
        "dynamic_catalog",
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "where_latest_partition",
    ]
    for key in keys:
        rows.append(
            [NICE_TO_HAVE_FEATURES[key]] + [db_info[key] for db_info in info.values()]
        )

    # advanced
    keys = [
        "expand_data",
        "query_cost_estimation",
        "sql_validation",
    ]
    for key in keys:
        rows.append(
            [ADVANCED_FEATURES[key]] + [db_info[key] for db_info in info.values()]
        )

    rows.append(["Score"] + [db_info["score"] for db_info in info.values()])

    return rows


def generate_yaml_docs(output_dir: str | None = None) -> dict[str, dict[str, Any]]:
    """
    Generate YAML documentation files for all database engine specs.

    Args:
        output_dir: Directory to write YAML files. If None, returns dict only.

    Returns:
        Dictionary mapping database names to their full documentation data.
    """
    all_docs: dict[str, dict[str, Any]] = {}

    for spec in sorted(load_engine_specs(), key=get_name):
        # Skip non-superset modules (3rd party)
        if not spec.__module__.startswith("superset"):
            continue

        name = get_name(spec)
        doc_data = diagnose(spec)

        # Add documentation metadata if available
        if name in DATABASE_DOCS:
            doc_data["documentation"] = DATABASE_DOCS[name]
        else:
            # Create minimal documentation entry
            doc_data["documentation"] = {
                "pypi_packages": [],
                "connection_string": getattr(
                    spec, "sqlalchemy_uri_placeholder", ""
                ),
            }

        # Add engine spec metadata
        doc_data["engine"] = spec.engine
        doc_data["engine_name"] = name
        doc_data["engine_aliases"] = list(getattr(spec, "engine_aliases", set()))
        doc_data["default_driver"] = getattr(spec, "default_driver", None)
        doc_data["supports_file_upload"] = spec.supports_file_upload
        doc_data["supports_dynamic_schema"] = spec.supports_dynamic_schema
        doc_data["supports_catalog"] = spec.supports_catalog

        all_docs[name] = doc_data

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

        # Write individual YAML files for each database
        for name, data in all_docs.items():
            # Create a safe filename
            safe_name = name.lower().replace(" ", "-").replace(".", "")
            filepath = os.path.join(output_dir, f"{safe_name}.yaml")
            with open(filepath, "w") as f:
                yaml.dump(
                    {name: data},
                    f,
                    default_flow_style=False,
                    sort_keys=False,
                    allow_unicode=True,
                )

        # Also write a combined index file
        index_filepath = os.path.join(output_dir, "_index.yaml")
        with open(index_filepath, "w") as f:
            yaml.dump(
                all_docs,
                f,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
            )

        print(f"Generated {len(all_docs)} YAML files in {output_dir}")

    return all_docs


if __name__ == "__main__":
    import argparse

    from superset.app import create_app

    parser = argparse.ArgumentParser(description="Generate database documentation")
    parser.add_argument(
        "--format",
        choices=["markdown", "yaml"],
        default="markdown",
        help="Output format (default: markdown)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory for YAML output files",
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.format == "yaml":
            output_dir = args.output_dir or "docs/static/databases"
            docs = generate_yaml_docs(output_dir)
            print(f"\nGenerated documentation for {len(docs)} databases")
        else:
            output = generate_feature_tables()
            print(output)
