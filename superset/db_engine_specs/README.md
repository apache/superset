<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Database engine specifications

Superset uses [SQLAlchemy](https://www.sqlalchemy.org/) as an abstraction layer for running queries and fetching metadata from tables (like column names and types). Unfortunately, while SQLAlchemy offers enough functionality to allow connecting Superset to dozens of databases, there are still implementation details that differ across them. Because of this, Superset has an additional abstraction on top of SQLAlchemy, called a "database engine specification" or, simply, "DB engine spec".

DB engine specs were created initially because there's no SQL standard for computing aggregations at different time grains. For example, to compute a daily metric in Trino or Postgres we could run a query like this:

```sql
SELECT
  date_trunc('day', CAST(time_column) AS TIMESTAMP) AS day,
  COUNT(*) AS metric
FROM
  some_table
GROUP BY
  1
```

For MySQL, instead of using the `date_trunc` function, we would need to write:

```sql
SELECT
  DATE(time_column) AS day,
  COUNT(*) AS metric
FROM
  some_table
GROUP BY
  1
```

Over time, more and more functionality was added to DB engine specs, including validating SQL, estimating the cost of queries before they are run, and understanding the semantics of error messages. These are all described in detail in this document, and in the table below you can see a summary of what features are supported by each database.

Note that DB engine specs are completely optional. Superset can connect to any database supported by SQLAlchemy (or 3rd party dialects) even if there's no DB engine spec associated with it. But DB engine specs greatly improve the experience of working with a database in Superset.

## Features

The tables below (generated via `python superset/db_engine_specs/lib.py`) summarize the status of all DB engine specs in Superset, organized by feature category for easier navigation (note that this excludes 3rd party DB engine specs).

### Quick Navigation

- [Feature Overview](#feature-overview) - High-level summary of support across all databases
- [Database Information](#database-information) - Module paths and core metadata
- [SQL Capabilities](#sql-capabilities) - SQL language features and capabilities
- [Time Grains – Common](#time-grains--common) - Standard time granularity support
- [Time Grains – Extended](#time-grains--extended) - Sub-hour and week variant time grains
- [Core Platform & Metadata Features](#core-platform--metadata-features) - Platform integration and metadata capabilities
- [Operational & Advanced Features](#operational--advanced-features) - Advanced operational capabilities

### Feature Overview

| Database | Score | SQL Basics | Advanced SQL | Common Time Grains | Extended Time Grains | Integrations | Advanced Features |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Presto | 159 | Supported | Partial | Supported | Partial | Partial | Supported |
| Trino | 149 | Supported | Partial | Supported | Partial | Partial | Partial |
| Apache Hive | 140 | Supported | Not supported | Supported | Partial | Partial | Partial |
| Apache Spark SQL | 140 | Supported | Not supported | Supported | Partial | Partial | Partial |
| Databricks Interactive Cluster | 140 | Supported | Not supported | Supported | Partial | Partial | Partial |
| base | 109 | Supported | Partial | Supported | Partial | Partial | Partial |
| Aurora PostgreSQL | 94 | Supported | Partial | Supported | Partial | Partial | Partial |
| Aurora PostgreSQL (Data API) | 94 | Supported | Partial | Supported | Partial | Partial | Partial |
| CockroachDB | 94 | Supported | Partial | Supported | Partial | Partial | Partial |
| Greenplum | 94 | Supported | Partial | Supported | Partial | Partial | Partial |
| RisingWave | 94 | Supported | Partial | Supported | Partial | Partial | Partial |
| Google BigQuery | 93 | Supported | Partial | Supported | Partial | Partial | Partial |
| StarRocks | 89 | Supported | Partial | Supported | Partial | Partial | Partial |
| Snowflake | 82 | Supported | Partial | Supported | Partial | Partial | Partial |
| Databricks | 80 | Supported | Partial | Supported | Partial | Partial | Partial |
| Databricks (legacy) | 80 | Supported | Partial | Supported | Partial | Partial | Partial |
| Apache Doris | 79 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Google Datastore | 73 | Supported | Partial | Supported | Partial | Partial | Not supported |
| ClickHouse | 72 | Supported | Partial | Supported | Partial | Partial | Not supported |
| MotherDuck | 68 | Supported | Partial | Supported | Not supported | Partial | Partial |
| SingleStore | 68 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Google Sheets | 61 | Supported | Partial | Supported | Supported | Partial | Partial |
| Aurora MySQL | 59 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Aurora MySQL (Data API) | 59 | Supported | Partial | Supported | Partial | Partial | Not supported |
| MariaDB | 59 | Supported | Partial | Supported | Partial | Partial | Not supported |
| MySQL | 59 | Supported | Partial | Supported | Partial | Partial | Not supported |
| OceanBase | 59 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Oracle | 58 | Supported | Partial | Supported | Not supported | Partial | Partial |
| Azure Data Explorer | 54 | Supported | Partial | Supported | Partial | Partial | Not supported |
| ClickHouse (sqlalchemy) | 52 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Databend | 51 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Apache Drill | 50 | Supported | Partial | Supported | Partial | Partial | Partial |
| Azure Data Explorer (KQL) | 50 | Supported | Partial | Partial | Partial | Partial | Not supported |
| DuckDB | 48 | Supported | Partial | Supported | Not supported | Partial | Partial |
| Apache Druid | 47 | Partial | Partial | Supported | Partial | Partial | Not supported |
| Elasticsearch | 47 | Partial | Partial | Partial | Not supported | Partial | Not supported |
| Amazon Redshift | 44 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Azure Synapse | 44 | Partial | Partial | Supported | Partial | Partial | Not supported |
| Microsoft SQL Server | 44 | Partial | Partial | Supported | Partial | Partial | Not supported |
| SAP Sybase | 44 | Partial | Partial | Supported | Partial | Partial | Not supported |
| Amazon DynamoDB | 42 | Partial | Partial | Supported | Partial | Partial | Not supported |
| MongoDB | 42 | Supported | Partial | Supported | Partial | Partial | Not supported |
| SQLite | 41 | Supported | Partial | Supported | Supported | Not supported | Not supported |
| Shillelagh | 41 | Supported | Partial | Supported | Supported | Not supported | Not supported |
| Databricks SQL Endpoint | 40 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Ascend | 38 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| IBM Db2 | 38 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| IBM Db2 for i | 38 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Ocient | 38 | Partial | Partial | Partial | Partial | Partial | Not supported |
| Apache Impala | 37 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| OpenSearch (OpenDistro) | 36 | Partial | Partial | Partial | Not supported | Partial | Not supported |
| Hologres | 34 | Supported | Partial | Supported | Partial | Partial | Not supported |
| PostgreSQL | 34 | Supported | Partial | Supported | Partial | Partial | Not supported |
| TimescaleDB | 34 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Vertica | 34 | Supported | Partial | Supported | Partial | Partial | Not supported |
| YugabyteDB | 34 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Apache Pinot | 32 | Partial | Partial | Supported | Partial | Partial | Not supported |
| Cloudflare D1 | 31 | Supported | Partial | Supported | Supported | Not supported | Not supported |
| Superset meta database | 31 | Supported | Partial | Supported | Supported | Not supported | Not supported |
| Amazon Athena | 30 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Apache Kylin | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Apache Phoenix | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Arc | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| CrateDB | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Dremio | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Exasol | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Firebolt | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| IBM Netezza Performance Server | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Parseable | 28 | Supported | Partial | Supported | Not supported | Partial | Not supported |
| Couchbase | 27 | Partial | Partial | Partial | Not supported | Partial | Not supported |
| Denodo | 27 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| SAP HANA | 27 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| Teradata | 27 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| Firebird | 26 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| MonetDB | 26 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| TDengine | 25 | Supported | Partial | Partial | Not supported | Partial | Not supported |
| Apache DataFusion | 24 | Supported | Partial | Supported | Partial | Partial | Not supported |
| YDB | 23 | Supported | Partial | Supported | Partial | Partial | Not supported |
| Apache IoTDB | 20 | Supported | Partial | Not supported | Not supported | Partial | Not supported |
| Apache Solr | 20 | Partial | Partial | Not supported | Not supported | Partial | Not supported |
| ODPS (MaxCompute) | 20 | Supported | Partial | Not supported | Not supported | Partial | Not supported |

### Database Information

| Database | Module | Limit Method | Limit Clause | Max Column Name |
| --- | --- | --- | --- | --- |
| Amazon Athena | superset.db_engine_specs.athena | FORCE_LIMIT | True | None |
| Amazon DynamoDB | superset.db_engine_specs.dynamodb | FORCE_LIMIT | True | None |
| Amazon Redshift | superset.db_engine_specs.redshift | FORCE_LIMIT | True | 127 |
| Apache DataFusion | superset.db_engine_specs.datafusion | FORCE_LIMIT | True | None |
| Apache Doris | superset.db_engine_specs.doris | FORCE_LIMIT | True | 64 |
| Apache Drill | superset.db_engine_specs.drill | FORCE_LIMIT | True | None |
| Apache Druid | superset.db_engine_specs.druid | FORCE_LIMIT | True | None |
| Apache Hive | superset.db_engine_specs.hive | FORCE_LIMIT | True | 767 |
| Apache Impala | superset.db_engine_specs.impala | FORCE_LIMIT | True | None |
| Apache IoTDB | superset.db_engine_specs.iotdb | FORCE_LIMIT | True | None |
| Apache Kylin | superset.db_engine_specs.kylin | FORCE_LIMIT | True | None |
| Apache Phoenix | superset.db_engine_specs.phoenix | FORCE_LIMIT | True | None |
| Apache Pinot | superset.db_engine_specs.pinot | FORCE_LIMIT | True | None |
| Apache Solr | superset.db_engine_specs.solr | FORCE_LIMIT | True | None |
| Apache Spark SQL | superset.db_engine_specs.spark | FORCE_LIMIT | True | 767 |
| Arc | superset.db_engine_specs.arc | FORCE_LIMIT | True | None |
| Ascend | superset.db_engine_specs.ascend | FORCE_LIMIT | True | None |
| Aurora MySQL | superset.db_engine_specs.aurora | FORCE_LIMIT | True | 64 |
| Aurora MySQL (Data API) | superset.db_engine_specs.aurora | FORCE_LIMIT | True | 64 |
| Aurora PostgreSQL | superset.db_engine_specs.aurora | FORCE_LIMIT | True | 63 |
| Aurora PostgreSQL (Data API) | superset.db_engine_specs.aurora | FORCE_LIMIT | True | 63 |
| Azure Data Explorer | superset.db_engine_specs.kusto | WRAP_SQL | True | None |
| Azure Data Explorer (KQL) | superset.db_engine_specs.kusto | FORCE_LIMIT | True | None |
| Azure Synapse | superset.db_engine_specs.mssql | FORCE_LIMIT | True | 128 |
| ClickHouse | superset.db_engine_specs.clickhouse | FORCE_LIMIT | True | None |
| ClickHouse (sqlalchemy) | superset.db_engine_specs.clickhouse | FORCE_LIMIT | True | None |
| Cloudflare D1 | superset.db_engine_specs.d1 | FORCE_LIMIT | True | None |
| CockroachDB | superset.db_engine_specs.cockroachdb | FORCE_LIMIT | True | 63 |
| Couchbase | superset.db_engine_specs.couchbase | FORCE_LIMIT | True | None |
| CrateDB | superset.db_engine_specs.crate | FORCE_LIMIT | True | None |
| Databend | superset.db_engine_specs.databend | FORCE_LIMIT | True | None |
| Databricks | superset.db_engine_specs.databricks | FORCE_LIMIT | True | None |
| Databricks (legacy) | superset.db_engine_specs.databricks | FORCE_LIMIT | True | None |
| Databricks Interactive Cluster | superset.db_engine_specs.databricks | FORCE_LIMIT | True | 767 |
| Databricks SQL Endpoint | superset.db_engine_specs.databricks | FORCE_LIMIT | True | None |
| Denodo | superset.db_engine_specs.denodo | FORCE_LIMIT | True | None |
| Dremio | superset.db_engine_specs.dremio | FORCE_LIMIT | True | None |
| DuckDB | superset.db_engine_specs.duckdb | FORCE_LIMIT | True | None |
| Elasticsearch | superset.db_engine_specs.elasticsearch | FORCE_LIMIT | True | None |
| Exasol | superset.db_engine_specs.exasol | FORCE_LIMIT | True | 128 |
| Firebird | superset.db_engine_specs.firebird | FETCH_MANY | True | None |
| Firebolt | superset.db_engine_specs.firebolt | FORCE_LIMIT | True | None |
| Google BigQuery | superset.db_engine_specs.bigquery | FORCE_LIMIT | True | 128 |
| Google Datastore | superset.db_engine_specs.datastore | FETCH_MANY | True | 128 |
| Google Sheets | superset.db_engine_specs.gsheets | FORCE_LIMIT | True | None |
| Greenplum | superset.db_engine_specs.greenplum | FORCE_LIMIT | True | 63 |
| Hologres | superset.db_engine_specs.hologres | FORCE_LIMIT | True | None |
| IBM Db2 | superset.db_engine_specs.db2 | WRAP_SQL | True | 30 |
| IBM Db2 for i | superset.db_engine_specs.ibmi | WRAP_SQL | True | 128 |
| IBM Netezza Performance Server | superset.db_engine_specs.netezza | FORCE_LIMIT | True | None |
| MariaDB | superset.db_engine_specs.mariadb | FORCE_LIMIT | True | 64 |
| Microsoft SQL Server | superset.db_engine_specs.mssql | FORCE_LIMIT | True | 128 |
| MonetDB | superset.db_engine_specs.monetdb | FORCE_LIMIT | True | None |
| MongoDB | superset.db_engine_specs.mongodb | FORCE_LIMIT | True | None |
| MotherDuck | superset.db_engine_specs.duckdb | FORCE_LIMIT | True | None |
| MySQL | superset.db_engine_specs.mysql | FORCE_LIMIT | True | 64 |
| ODPS (MaxCompute) | superset.db_engine_specs.odps | FORCE_LIMIT | True | None |
| OceanBase | superset.db_engine_specs.oceanbase | FORCE_LIMIT | True | 128 |
| Ocient | superset.db_engine_specs.ocient | FORCE_LIMIT | True | 30 |
| OpenSearch (OpenDistro) | superset.db_engine_specs.elasticsearch | FORCE_LIMIT | True | None |
| Oracle | superset.db_engine_specs.oracle | FORCE_LIMIT | True | 128 |
| Parseable | superset.db_engine_specs.parseable | FORCE_LIMIT | True | None |
| PostgreSQL | superset.db_engine_specs.postgres | FORCE_LIMIT | True | None |
| Presto | superset.db_engine_specs.presto | FORCE_LIMIT | True | None |
| RisingWave | superset.db_engine_specs.risingwave | FORCE_LIMIT | True | 63 |
| SAP HANA | superset.db_engine_specs.hana | WRAP_SQL | True | 30 |
| SAP Sybase | superset.db_engine_specs.sybase | FORCE_LIMIT | True | 128 |
| SQLite | superset.db_engine_specs.sqlite | FORCE_LIMIT | True | None |
| Shillelagh | superset.db_engine_specs.shillelagh | FORCE_LIMIT | True | None |
| SingleStore | superset.db_engine_specs.singlestore | FORCE_LIMIT | True | 256 |
| Snowflake | superset.db_engine_specs.snowflake | FORCE_LIMIT | True | 256 |
| StarRocks | superset.db_engine_specs.starrocks | FORCE_LIMIT | True | 64 |
| Superset meta database | superset.db_engine_specs.superset | FORCE_LIMIT | True | None |
| TDengine | superset.db_engine_specs.tdengine | FORCE_LIMIT | True | 64 |
| Teradata | superset.db_engine_specs.teradata | FORCE_LIMIT | True | 30 |
| TimescaleDB | superset.db_engine_specs.timescaledb | FORCE_LIMIT | True | None |
| Trino | superset.db_engine_specs.trino | FORCE_LIMIT | True | None |
| Vertica | superset.db_engine_specs.vertica | FORCE_LIMIT | True | None |
| YDB | superset.db_engine_specs.ydb | FORCE_LIMIT | True | None |
| YugabyteDB | superset.db_engine_specs.yugabytedb | FORCE_LIMIT | True | None |
| base | superset.db_engine_specs.presto | FORCE_LIMIT | True | None |

### SQL Capabilities

| Database | JOINs | Subqueries | Aliases in SELECT | Aliases in ORDER BY | CTEs | Comments | Escaped Colons | Inline Time Groupby | Source Column When Aliased | Aggregations in ORDER BY | Expressions in ORDER BY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon Athena | True | True | True | True | True | True | False | False | False | True | False |
| Amazon DynamoDB | True | True | True | False | True | True | True | False | False | True | False |
| Amazon Redshift | True | True | True | True | True | True | True | False | False | True | False |
| Apache DataFusion | True | True | True | True | True | True | True | False | False | True | False |
| Apache Doris | True | True | True | True | True | True | True | False | False | True | False |
| Apache Drill | True | True | True | True | True | True | True | False | False | True | False |
| Apache Druid | False | True | True | True | True | True | True | False | False | True | False |
| Apache Hive | True | True | True | True | True | True | True | False | False | False | False |
| Apache Impala | True | True | True | True | True | True | True | False | False | True | False |
| Apache IoTDB | True | True | True | True | True | True | True | False | False | True | False |
| Apache Kylin | True | True | True | True | True | True | True | False | False | True | False |
| Apache Phoenix | True | True | True | True | True | True | True | False | False | True | False |
| Apache Pinot | False | False | False | False | True | True | True | False | False | True | False |
| Apache Solr | False | False | True | True | True | True | True | False | False | True | False |
| Apache Spark SQL | True | True | True | True | True | True | True | False | False | False | False |
| Arc | True | True | True | True | True | True | True | False | False | True | False |
| Ascend | True | True | True | True | True | True | True | False | False | True | False |
| Aurora MySQL | True | True | True | True | True | True | True | False | False | True | False |
| Aurora MySQL (Data API) | True | True | True | True | True | True | True | False | False | True | False |
| Aurora PostgreSQL | True | True | True | True | True | True | True | False | False | True | False |
| Aurora PostgreSQL (Data API) | True | True | True | True | True | True | True | False | False | True | False |
| Azure Data Explorer | True | True | True | True | True | False | True | True | False | True | False |
| Azure Data Explorer (KQL) | True | True | True | True | True | False | True | True | False | True | False |
| Azure Synapse | True | True | True | True | False | True | True | False | False | True | False |
| ClickHouse | True | True | True | True | True | True | True | True | False | True | False |
| ClickHouse (sqlalchemy) | True | True | True | True | True | True | True | True | False | True | False |
| Cloudflare D1 | True | True | True | True | True | True | True | False | False | True | False |
| CockroachDB | True | True | True | True | True | True | True | False | False | True | False |
| Couchbase | False | False | True | True | True | True | True | False | False | True | False |
| CrateDB | True | True | True | True | True | True | True | False | False | True | False |
| Databend | True | True | True | True | True | True | True | True | False | True | False |
| Databricks | True | True | True | True | True | True | True | False | False | True | False |
| Databricks (legacy) | True | True | True | True | True | True | True | False | False | True | False |
| Databricks Interactive Cluster | True | True | True | True | True | True | True | False | False | False | False |
| Databricks SQL Endpoint | True | True | True | True | True | True | True | False | False | True | False |
| Denodo | True | True | True | True | True | True | True | False | False | True | False |
| Dremio | True | True | True | True | True | True | True | False | False | True | False |
| DuckDB | True | True | True | True | True | True | True | False | False | True | False |
| Elasticsearch | False | True | True | True | True | False | True | True | False | True | False |
| Exasol | True | True | True | True | True | True | True | False | False | True | False |
| Firebird | True | True | True | True | True | True | True | False | False | True | False |
| Firebolt | True | True | True | True | True | True | True | False | False | True | False |
| Google BigQuery | True | True | True | True | True | True | True | False | False | True | True |
| Google Datastore | True | True | True | True | True | True | True | False | False | True | True |
| Google Sheets | True | True | True | True | True | True | True | False | False | True | False |
| Greenplum | True | True | True | True | True | True | True | False | False | True | False |
| Hologres | True | True | True | True | True | True | True | False | False | True | False |
| IBM Db2 | True | True | True | True | True | True | True | False | False | True | False |
| IBM Db2 for i | True | True | True | True | True | True | True | False | False | True | False |
| IBM Netezza Performance Server | True | True | True | True | True | True | True | False | False | True | False |
| MariaDB | True | True | True | True | True | True | True | False | False | True | False |
| Microsoft SQL Server | True | True | True | True | False | True | True | False | False | True | False |
| MonetDB | True | True | True | True | True | True | True | False | False | True | False |
| MongoDB | True | True | True | True | True | True | True | False | False | True | False |
| MotherDuck | True | True | True | True | True | True | True | False | False | True | False |
| MySQL | True | True | True | True | True | True | True | False | False | True | False |
| ODPS (MaxCompute) | True | True | True | True | True | True | True | False | False | True | False |
| OceanBase | True | True | True | True | True | True | True | False | False | True | False |
| Ocient | True | True | True | True | False | True | True | False | False | True | False |
| OpenSearch (OpenDistro) | False | True | True | True | True | False | True | True | False | True | False |
| Oracle | True | True | True | True | True | True | True | False | False | True | False |
| Parseable | True | True | True | True | True | True | True | False | False | True | False |
| PostgreSQL | True | True | True | True | True | True | True | False | False | True | False |
| Presto | True | True | True | True | True | True | True | False | True | True | False |
| RisingWave | True | True | True | True | True | True | True | False | False | True | False |
| SAP HANA | True | True | True | True | True | True | True | False | False | True | False |
| SAP Sybase | True | True | True | True | False | True | True | False | False | True | False |
| SQLite | True | True | True | True | True | True | True | False | False | True | False |
| Shillelagh | True | True | True | True | True | True | True | False | False | True | False |
| SingleStore | True | True | True | True | True | True | True | False | False | True | False |
| Snowflake | True | True | True | True | True | True | True | False | False | True | False |
| StarRocks | True | True | True | True | True | True | True | False | False | True | False |
| Superset meta database | True | True | True | True | True | True | True | False | False | True | False |
| TDengine | True | True | True | True | True | True | True | False | False | True | False |
| Teradata | True | True | True | True | True | True | True | False | False | True | False |
| TimescaleDB | True | True | True | True | True | True | True | False | False | True | False |
| Trino | True | True | True | True | True | True | True | False | True | True | False |
| Vertica | True | True | True | True | True | True | True | False | False | True | False |
| YDB | True | True | True | True | True | True | True | False | False | True | False |
| YugabyteDB | True | True | True | True | True | True | True | False | False | True | False |
| base | True | True | True | True | True | True | True | False | False | True | False |

### Time Grains – Common

| Database | SECOND | MINUTE | HOUR | DAY | WEEK | MONTH | QUARTER | YEAR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon Athena | True | True | True | True | True | True | True | True |
| Amazon DynamoDB | True | True | True | True | True | True | True | True |
| Amazon Redshift | True | True | True | True | True | True | True | True |
| Apache DataFusion | True | True | True | True | True | True | True | True |
| Apache Doris | True | True | True | True | True | True | True | True |
| Apache Drill | True | True | True | True | True | True | True | True |
| Apache Druid | True | True | True | True | True | True | True | True |
| Apache Hive | True | True | True | True | True | True | True | True |
| Apache Impala | False | True | True | True | True | True | True | True |
| Apache IoTDB | False | False | False | False | False | False | False | False |
| Apache Kylin | True | True | True | True | True | True | True | True |
| Apache Phoenix | True | True | True | True | True | True | True | True |
| Apache Pinot | True | True | True | True | True | True | True | True |
| Apache Solr | False | False | False | False | False | False | False | False |
| Apache Spark SQL | True | True | True | True | True | True | True | True |
| Arc | True | True | True | True | True | True | True | True |
| Ascend | True | True | True | True | True | True | True | True |
| Aurora MySQL | True | True | True | True | True | True | True | True |
| Aurora MySQL (Data API) | True | True | True | True | True | True | True | True |
| Aurora PostgreSQL | True | True | True | True | True | True | True | True |
| Aurora PostgreSQL (Data API) | True | True | True | True | True | True | True | True |
| Azure Data Explorer | True | True | True | True | True | True | True | True |
| Azure Data Explorer (KQL) | True | True | True | True | True | True | False | True |
| Azure Synapse | True | True | True | True | True | True | True | True |
| ClickHouse | True | True | True | True | True | True | True | True |
| ClickHouse (sqlalchemy) | True | True | True | True | True | True | True | True |
| Cloudflare D1 | True | True | True | True | True | True | True | True |
| CockroachDB | True | True | True | True | True | True | True | True |
| Couchbase | True | True | True | True | False | True | True | True |
| CrateDB | True | True | True | True | True | True | True | True |
| Databend | True | True | True | True | True | True | True | True |
| Databricks | True | True | True | True | True | True | True | True |
| Databricks (legacy) | True | True | True | True | True | True | True | True |
| Databricks Interactive Cluster | True | True | True | True | True | True | True | True |
| Databricks SQL Endpoint | True | True | True | True | True | True | True | True |
| Denodo | False | True | True | True | True | True | True | True |
| Dremio | True | True | True | True | True | True | True | True |
| DuckDB | True | True | True | True | True | True | True | True |
| Elasticsearch | True | True | True | True | True | True | False | True |
| Exasol | True | True | True | True | True | True | True | True |
| Firebird | True | True | True | True | False | True | False | True |
| Firebolt | True | True | True | True | True | True | True | True |
| Google BigQuery | True | True | True | True | True | True | True | True |
| Google Datastore | True | True | True | True | True | True | True | True |
| Google Sheets | True | True | True | True | True | True | True | True |
| Greenplum | True | True | True | True | True | True | True | True |
| Hologres | True | True | True | True | True | True | True | True |
| IBM Db2 | True | True | True | True | True | True | True | True |
| IBM Db2 for i | True | True | True | True | True | True | True | True |
| IBM Netezza Performance Server | True | True | True | True | True | True | True | True |
| MariaDB | True | True | True | True | True | True | True | True |
| Microsoft SQL Server | True | True | True | True | True | True | True | True |
| MonetDB | True | True | True | True | False | True | False | True |
| MongoDB | True | True | True | True | True | True | True | True |
| MotherDuck | True | True | True | True | True | True | True | True |
| MySQL | True | True | True | True | True | True | True | True |
| ODPS (MaxCompute) | False | False | False | False | False | False | False | False |
| OceanBase | True | True | True | True | True | True | True | True |
| Ocient | True | True | True | True | True | True | False | True |
| OpenSearch (OpenDistro) | True | True | True | True | False | True | False | True |
| Oracle | True | True | True | True | True | True | True | True |
| Parseable | True | True | True | True | True | True | True | True |
| PostgreSQL | True | True | True | True | True | True | True | True |
| Presto | True | True | True | True | True | True | True | True |
| RisingWave | True | True | True | True | True | True | True | True |
| SAP HANA | True | True | True | True | False | True | True | True |
| SAP Sybase | True | True | True | True | True | True | True | True |
| SQLite | True | True | True | True | True | True | True | True |
| Shillelagh | True | True | True | True | True | True | True | True |
| SingleStore | True | True | True | True | True | True | True | True |
| Snowflake | True | True | True | True | True | True | True | True |
| StarRocks | True | True | True | True | True | True | True | True |
| Superset meta database | True | True | True | True | True | True | True | True |
| TDengine | True | True | True | True | True | False | False | False |
| Teradata | False | True | True | True | True | True | True | True |
| TimescaleDB | True | True | True | True | True | True | True | True |
| Trino | True | True | True | True | True | True | True | True |
| Vertica | True | True | True | True | True | True | True | True |
| YDB | True | True | True | True | True | True | True | True |
| YugabyteDB | True | True | True | True | True | True | True | True |
| base | True | True | True | True | True | True | True | True |

### Time Grains – Extended

| Database | FIVE_SECONDS | THIRTY_SECONDS | FIVE_MINUTES | TEN_MINUTES | FIFTEEN_MINUTES | THIRTY_MINUTES | HALF_HOUR | SIX_HOURS | WEEK_STARTING_SUNDAY | WEEK_STARTING_MONDAY | WEEK_ENDING_SATURDAY | WEEK_ENDING_SUNDAY | QUARTER_YEAR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon Athena | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Amazon DynamoDB | False | False | False | False | False | False | False | False | True | True | True | True | False |
| Amazon Redshift | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Apache DataFusion | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Apache Doris | False | False | False | False | False | False | False | False | False | True | False | False | False |
| Apache Drill | False | False | False | False | True | True | False | False | False | False | False | False | False |
| Apache Druid | True | True | True | True | True | True | False | True | True | False | True | False | False |
| Apache Hive | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Apache Impala | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Apache IoTDB | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Apache Kylin | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Apache Phoenix | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Apache Pinot | False | False | True | True | True | True | False | False | False | False | False | False | False |
| Apache Solr | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Apache Spark SQL | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Arc | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Ascend | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Aurora MySQL | False | False | False | False | False | False | False | False | False | True | False | False | False |
| Aurora MySQL (Data API) | False | False | False | False | False | False | False | False | False | True | False | False | False |
| Aurora PostgreSQL | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Aurora PostgreSQL (Data API) | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Azure Data Explorer | False | False | True | True | True | False | True | False | True | True | False | False | False |
| Azure Data Explorer (KQL) | False | True | True | False | False | True | False | False | False | False | False | False | False |
| Azure Synapse | False | False | True | True | True | True | False | False | True | True | False | False | False |
| ClickHouse | False | False | True | True | True | True | False | False | False | False | False | False | False |
| ClickHouse (sqlalchemy) | False | False | True | True | True | True | False | False | False | False | False | False | False |
| Cloudflare D1 | True | True | True | True | True | True | True | True | True | True | True | True | True |
| CockroachDB | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Couchbase | False | False | False | False | False | False | False | False | False | False | False | False | False |
| CrateDB | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Databend | False | False | True | True | True | False | False | False | False | False | False | False | False |
| Databricks | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Databricks (legacy) | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Databricks Interactive Cluster | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Databricks SQL Endpoint | False | False | False | False | False | False | False | False | True | False | True | False | False |
| Denodo | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Dremio | False | False | False | False | False | False | False | False | False | False | False | False | False |
| DuckDB | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Elasticsearch | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Exasol | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Firebird | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Firebolt | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Google BigQuery | False | False | True | True | True | True | False | False | False | True | False | False | False |
| Google Datastore | False | False | True | True | True | True | False | False | False | True | False | False | False |
| Google Sheets | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Greenplum | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Hologres | True | True | True | True | True | True | False | False | False | False | False | False | False |
| IBM Db2 | False | False | False | False | False | False | False | False | False | False | False | False | False |
| IBM Db2 for i | False | False | False | False | False | False | False | False | False | False | False | False | False |
| IBM Netezza Performance Server | False | False | False | False | False | False | False | False | False | False | False | False | False |
| MariaDB | False | False | False | False | False | False | False | False | False | True | False | False | False |
| Microsoft SQL Server | False | False | True | True | True | True | False | False | True | True | False | False | False |
| MonetDB | False | False | False | False | False | False | False | False | False | False | False | False | False |
| MongoDB | False | False | False | False | False | False | False | False | True | True | True | True | False |
| MotherDuck | False | False | False | False | False | False | False | False | False | False | False | False | False |
| MySQL | False | False | False | False | False | False | False | False | False | True | False | False | False |
| ODPS (MaxCompute) | False | False | False | False | False | False | False | False | False | False | False | False | False |
| OceanBase | False | False | False | False | False | False | False | False | False | True | False | False | False |
| Ocient | False | False | False | False | False | False | False | False | False | False | False | False | True |
| OpenSearch (OpenDistro) | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Oracle | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Parseable | False | False | False | False | False | False | False | False | False | False | False | False | False |
| PostgreSQL | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Presto | True | True | True | True | True | False | True | True | True | True | True | True | False |
| RisingWave | True | True | True | True | True | True | False | False | False | False | False | False | False |
| SAP HANA | False | False | False | False | False | False | False | False | False | False | False | False | False |
| SAP Sybase | False | False | True | True | True | True | False | False | True | True | False | False | False |
| SQLite | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Shillelagh | True | True | True | True | True | True | True | True | True | True | True | True | True |
| SingleStore | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Snowflake | False | False | True | True | True | True | False | False | False | False | False | False | False |
| StarRocks | False | False | False | False | False | False | False | False | False | True | False | False | False |
| Superset meta database | True | True | True | True | True | True | True | True | True | True | True | True | True |
| TDengine | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Teradata | False | False | False | False | False | False | False | False | False | False | False | False | False |
| TimescaleDB | True | True | True | True | True | True | False | False | False | False | False | False | False |
| Trino | True | True | True | True | True | False | True | True | True | True | True | True | False |
| Vertica | True | True | True | True | True | True | False | False | False | False | False | False | False |
| YDB | False | True | True | True | True | True | False | False | False | False | False | False | False |
| YugabyteDB | True | True | True | True | True | True | False | False | False | False | False | False | False |
| base | True | True | True | True | True | False | True | True | True | True | True | True | False |

### Core Platform & Metadata Features


Integration with platform features and metadata handling.

| Database | Masked Encrypted Extra | Column Type Mappings | Function Names | File Upload | Dynamic Schema | Catalog | Dynamic Catalog | SSH Tunneling | Latest Partition | Query Cancellation | Get Metrics | Extra Table Metadata | Exception Mapping | Custom Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon Athena | False | False | False | True | True | False | False | False | False | False | False | False | False | False |
| Amazon DynamoDB | False | True | False | True | False | False | False | True | False | False | False | False | False | False |
| Amazon Redshift | False | False | False | True | False | False | False | True | False | True | False | False | False | False |
| Apache DataFusion | False | False | False | False | False | False | False | True | False | False | False | False | False | False |
| Apache Doris | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| Apache Drill | False | False | False | True | True | False | False | True | False | False | False | False | False | False |
| Apache Druid | False | False | False | True | False | False | False | True | False | False | False | False | True | False |
| Apache Hive | False | True | True | True | True | True | True | True | True | True | False | True | False | False |
| Apache Impala | False | False | False | True | False | False | False | True | False | True | False | False | False | False |
| Apache IoTDB | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Apache Kylin | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Apache Phoenix | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Apache Pinot | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Apache Solr | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Apache Spark SQL | False | True | True | True | True | True | True | True | True | True | False | True | False | False |
| Arc | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Ascend | False | False | False | True | False | False | False | True | False | True | False | False | False | False |
| Aurora MySQL | False | True | False | True | True | False | False | True | False | True | False | False | False | False |
| Aurora MySQL (Data API) | False | True | False | True | True | False | False | True | False | True | False | False | False | False |
| Aurora PostgreSQL | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| Aurora PostgreSQL (Data API) | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| Azure Data Explorer | False | True | False | True | False | False | False | True | False | False | False | False | True | False |
| Azure Data Explorer (KQL) | False | True | False | True | False | False | False | True | False | False | False | False | True | False |
| Azure Synapse | False | True | False | True | False | False | False | True | False | False | False | False | False | False |
| ClickHouse | False | True | True | False | True | False | False | True | False | True | False | False | True | False |
| ClickHouse (sqlalchemy) | False | True | True | False | False | False | False | True | False | False | False | False | True | False |
| Cloudflare D1 | False | False | True | False | False | False | False | False | False | False | False | False | False | False |
| CockroachDB | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| Couchbase | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| CrateDB | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Databend | False | True | True | False | False | False | False | True | False | False | False | False | True | False |
| Databricks | False | False | False | True | True | True | True | True | False | False | False | False | False | True |
| Databricks (legacy) | False | False | False | True | True | True | True | True | False | False | False | False | False | True |
| Databricks Interactive Cluster | False | True | True | True | True | True | True | True | True | True | False | True | False | False |
| Databricks SQL Endpoint | False | False | False | True | False | False | False | True | False | False | False | False | False | True |
| Denodo | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Dremio | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| DuckDB | False | True | False | True | False | False | False | True | False | False | False | False | False | False |
| Elasticsearch | False | True | False | True | False | False | False | True | False | False | False | False | True | False |
| Exasol | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Firebird | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Firebolt | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Google BigQuery | False | False | False | True | True | True | True | False | True | False | False | True | True | False |
| Google Datastore | False | False | True | True | True | True | True | False | False | False | False | False | True | False |
| Google Sheets | False | False | True | True | False | False | False | False | False | False | False | True | False | False |
| Greenplum | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| Hologres | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| IBM Db2 | False | False | False | True | True | False | False | True | False | False | False | False | False | False |
| IBM Db2 for i | False | False | False | True | True | False | False | True | False | False | False | False | False | False |
| IBM Netezza Performance Server | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| MariaDB | False | True | False | True | True | False | False | True | False | True | False | False | False | False |
| Microsoft SQL Server | False | True | False | True | False | False | False | True | False | False | False | False | False | False |
| MonetDB | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| MongoDB | False | False | False | True | True | False | False | True | False | False | False | False | False | False |
| MotherDuck | False | True | False | True | False | True | True | True | False | False | False | False | False | False |
| MySQL | False | True | False | True | True | False | False | True | False | True | False | False | False | False |
| ODPS (MaxCompute) | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| OceanBase | False | True | False | True | True | False | False | True | False | True | False | False | False | False |
| Ocient | False | False | False | True | False | False | False | True | False | True | False | False | False | False |
| OpenSearch (OpenDistro) | False | True | False | True | False | False | False | True | False | False | False | False | False | False |
| Oracle | False | True | False | True | False | False | False | True | False | True | False | False | False | False |
| Parseable | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| PostgreSQL | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Presto | False | True | True | True | True | True | True | True | True | True | False | True | False | False |
| RisingWave | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| SAP HANA | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| SAP Sybase | False | True | False | True | False | False | False | True | False | False | False | False | False | False |
| SQLite | False | False | True | True | False | False | False | False | False | False | False | False | False | False |
| Shillelagh | False | False | True | True | False | False | False | False | False | False | False | False | False | False |
| SingleStore | False | True | True | True | True | False | False | True | False | True | False | False | False | False |
| Snowflake | False | False | False | True | True | True | True | True | False | True | False | False | False | False |
| StarRocks | False | True | False | True | True | True | True | True | False | True | False | False | False | False |
| Superset meta database | False | False | True | False | False | False | False | False | False | False | False | False | False | False |
| TDengine | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Teradata | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| TimescaleDB | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| Trino | False | True | True | True | True | True | True | True | True | True | False | True | True | False |
| Vertica | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| YDB | False | False | False | False | False | False | False | True | False | False | False | False | False | False |
| YugabyteDB | False | False | False | True | False | False | False | True | False | False | False | False | False | False |
| base | False | True | True | True | True | True | True | True | True | False | False | False | False | False |

### Operational & Advanced Features

| Database | User Impersonation | Expand Data | Cost Estimation | SQL Validation |
| --- | --- | --- | --- | --- |
| Amazon Athena | False | False | False | False |
| Amazon DynamoDB | False | False | False | False |
| Amazon Redshift | False | False | False | False |
| Apache DataFusion | False | False | False | False |
| Apache Doris | False | False | False | False |
| Apache Drill | True | False | False | False |
| Apache Druid | False | False | False | False |
| Apache Hive | True | True | True | False |
| Apache Impala | False | False | False | False |
| Apache IoTDB | False | False | False | False |
| Apache Kylin | False | False | False | False |
| Apache Phoenix | False | False | False | False |
| Apache Pinot | False | False | False | False |
| Apache Solr | False | False | False | False |
| Apache Spark SQL | True | True | True | False |
| Arc | False | False | False | False |
| Ascend | False | False | False | False |
| Aurora MySQL | False | False | False | False |
| Aurora MySQL (Data API) | False | False | False | False |
| Aurora PostgreSQL | False | False | True | False |
| Aurora PostgreSQL (Data API) | False | False | True | False |
| Azure Data Explorer | False | False | False | False |
| Azure Data Explorer (KQL) | False | False | False | False |
| Azure Synapse | False | False | False | False |
| ClickHouse | False | False | False | False |
| ClickHouse (sqlalchemy) | False | False | False | False |
| Cloudflare D1 | False | False | False | False |
| CockroachDB | False | False | True | False |
| Couchbase | False | False | False | False |
| CrateDB | False | False | False | False |
| Databend | False | False | False | False |
| Databricks | True | False | False | False |
| Databricks (legacy) | True | False | False | False |
| Databricks Interactive Cluster | True | True | True | False |
| Databricks SQL Endpoint | False | False | False | False |
| Denodo | False | False | False | False |
| Dremio | False | False | False | False |
| DuckDB | True | False | False | False |
| Elasticsearch | False | False | False | False |
| Exasol | False | False | False | False |
| Firebird | False | False | False | False |
| Firebolt | False | False | False | False |
| Google BigQuery | False | False | True | False |
| Google Datastore | False | False | False | False |
| Google Sheets | True | False | False | False |
| Greenplum | False | False | True | False |
| Hologres | False | False | False | False |
| IBM Db2 | False | False | False | False |
| IBM Db2 for i | False | False | False | False |
| IBM Netezza Performance Server | False | False | False | False |
| MariaDB | False | False | False | False |
| Microsoft SQL Server | False | False | False | False |
| MonetDB | False | False | False | False |
| MongoDB | False | False | False | False |
| MotherDuck | True | False | False | False |
| MySQL | False | False | False | False |
| ODPS (MaxCompute) | False | False | False | False |
| OceanBase | False | False | False | False |
| Ocient | False | False | False | False |
| OpenSearch (OpenDistro) | False | False | False | False |
| Oracle | False | False | True | False |
| Parseable | False | False | False | False |
| PostgreSQL | False | False | False | False |
| Presto | True | True | True | True |
| RisingWave | False | False | True | False |
| SAP HANA | False | False | False | False |
| SAP Sybase | False | False | False | False |
| SQLite | False | False | False | False |
| Shillelagh | False | False | False | False |
| SingleStore | False | False | False | False |
| Snowflake | True | False | False | False |
| StarRocks | True | False | False | False |
| Superset meta database | False | False | False | False |
| TDengine | False | False | False | False |
| Teradata | False | False | False | False |
| TimescaleDB | False | False | False | False |
| Trino | True | False | True | False |
| Vertica | False | False | False | False |
| YDB | False | False | False | False |
| YugabyteDB | False | False | False | False |
| base | False | False | True | False |


## Testing DB engine specs

Superset has a command to test the connection to a given database, as well as checking if the SQLAlchemy dialect implements all necessary methods used by Superset, and checking which features are supported by the DB engine spec (if one exists). To run the tool just call the `test-db` command with the SQLAlchemy URI to be tested:

```bash
superset test-db sqlite://
```

If the connection needs additional arguments they can be passed when the command runs.
