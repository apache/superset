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
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec


class AuroraMySQLDataAPI(MySQLEngineSpec):
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


class AuroraPostgresDataAPI(PostgresEngineSpec):
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
