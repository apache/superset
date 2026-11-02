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
from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec


class AuroraMySQLDataAPI(MySQLEngineSpec):
    """Amazon Aurora MySQL via the Data API.

    Note: Documentation is in MySQLEngineSpec's compatible_databases section.
    This spec exists for runtime support of the auroradataapi driver.
    """

    engine = "mysql"
    default_driver = "auroradataapi"
    engine_name = "Aurora MySQL (Data API)"
    sqlalchemy_uri_placeholder = (
        "mysql+auroradataapi://{aws_access_id}:{aws_secret_access_key}@/"
        "{database_name}?"
        "aurora_cluster_arn={aurora_cluster_arn}&"
        "secret_arn={secret_arn}&"
        "region_name={region_name}"
    )

    metadata = {
        "description": (
            "Amazon Aurora MySQL accessed via the AWS Data API, allowing "
            "database queries over HTTP without managing persistent connections."
        ),
        "logo": "aws-aurora.jpg",
        "homepage_url": "https://aws.amazon.com/rds/aurora/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-aurora-data-api"],
        "connection_string": (
            "mysql+auroradataapi://{aws_access_id}:{aws_secret_access_key}@/"
            "{database_name}?aurora_cluster_arn={aurora_cluster_arn}&"
            "secret_arn={secret_arn}&region_name={region_name}"
        ),
        "default_port": 3306,
    }


class AuroraPostgresDataAPI(PostgresEngineSpec):
    """Amazon Aurora PostgreSQL via the Data API.

    Note: Documentation is in PostgresEngineSpec's compatible_databases section.
    This spec exists for runtime support of the auroradataapi driver.
    """

    engine = "postgresql"
    default_driver = "auroradataapi"
    engine_name = "Aurora PostgreSQL (Data API)"
    sqlalchemy_uri_placeholder = (
        "postgresql+auroradataapi://{aws_access_id}:{aws_secret_access_key}@/"
        "{database_name}?"
        "aurora_cluster_arn={aurora_cluster_arn}&"
        "secret_arn={secret_arn}&"
        "region_name={region_name}"
    )

    metadata = {
        "description": (
            "Amazon Aurora PostgreSQL accessed via the AWS Data API, allowing "
            "database queries over HTTP without managing persistent connections."
        ),
        "logo": "aws-aurora.jpg",
        "homepage_url": "https://aws.amazon.com/rds/aurora/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-aurora-data-api"],
        "connection_string": (
            "postgresql+auroradataapi://{aws_access_id}:{aws_secret_access_key}@/"
            "{database_name}?aurora_cluster_arn={aurora_cluster_arn}&"
            "secret_arn={secret_arn}&region_name={region_name}"
        ),
        "default_port": 5432,
    }


class AuroraMySQLEngineSpec(MySQLEngineSpec):
    """
    Aurora MySQL engine spec.

    IAM authentication is handled by the parent MySQLEngineSpec via
    the aws_iam config in encrypted_extra.
    """

    engine = "mysql"
    engine_name = "Aurora MySQL"
    default_driver = "mysqldb"

    metadata = {
        "description": (
            "Amazon Aurora MySQL is a relational database engine that combines "
            "high-end commercial database speed with the simplicity of "
            "open-source MySQL."
        ),
        "logo": "aws-aurora.jpg",
        "homepage_url": "https://aws.amazon.com/rds/aurora/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["mysqlclient"],
        "connection_string": "mysql://{user}:{password}@{host}:{port}/{database}",
        "default_port": 3306,
    }


class AuroraPostgresEngineSpec(PostgresEngineSpec):
    """
    Aurora PostgreSQL engine spec.

    IAM authentication is handled by the parent PostgresEngineSpec via
    the aws_iam config in encrypted_extra.
    """

    engine = "postgresql"
    engine_name = "Aurora PostgreSQL"
    default_driver = "psycopg2"

    metadata = {
        "description": (
            "Amazon Aurora PostgreSQL is a relational database engine that combines "
            "high-end commercial database speed with the simplicity of "
            "open-source PostgreSQL."
        ),
        "logo": "aws-aurora.jpg",
        "homepage_url": "https://aws.amazon.com/rds/aurora/",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["psycopg2"],
        "connection_string": "postgresql://{user}:{password}@{host}:{port}/{database}",
        "default_port": 5432,
    }
