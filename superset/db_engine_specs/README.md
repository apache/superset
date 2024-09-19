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

The table below (generated via `python superset/db_engine_specs/lib.py`) summarizes the information about the status of all DB engine specs in Superset (note that this excludes 3rd party DB engine specs):

| Feature | Amazon Athena | Amazon DynamoDB | Amazon Redshift | Apache Drill | Apache Druid | Apache Hive | Apache Impala | Apache Kylin | Apache Pinot | Apache Solr | Apache Spark SQL | Ascend | Aurora MySQL (Data API) | Aurora PostgreSQL (Data API) | Azure Synapse | ClickHouse | ClickHouse Connect (Superset) | CockroachDB | CrateDB | Databricks | Databricks Interactive Cluster | Databricks SQL Endpoint | Dremio | DuckDB | ElasticSearch (OpenDistro SQL) | ElasticSearch (SQL API) | Exasol | Firebird | Firebolt | Google BigQuery | Google Sheets | IBM Db2 | IBM Netezza Performance Server | KustoKQL | KustoSQL | Microsoft SQL Server | MySQL | Ocient | Oracle | PostgreSQL | Presto | RisingWave | Rockset | SAP HANA | SQLite | Shillelagh | Snowflake | StarRocks | Teradata | Trino | Vertica | base |
|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|  ---|
| Module | superset.db_engine_specs.athena | superset.db_engine_specs.dynamodb | superset.db_engine_specs.redshift | superset.db_engine_specs.drill | superset.db_engine_specs.druid | superset.db_engine_specs.hive | superset.db_engine_specs.impala | superset.db_engine_specs.kylin | superset.db_engine_specs.pinot | superset.db_engine_specs.solr | superset.db_engine_specs.spark | superset.db_engine_specs.ascend | superset.db_engine_specs.aurora | superset.db_engine_specs.aurora | superset.db_engine_specs.mssql | superset.db_engine_specs.clickhouse | superset.db_engine_specs.clickhouse | superset.db_engine_specs.cockroachdb | superset.db_engine_specs.crate | superset.db_engine_specs.databricks | superset.db_engine_specs.databricks | superset.db_engine_specs.databricks | superset.db_engine_specs.dremio | superset.db_engine_specs.duckdb | superset.db_engine_specs.elasticsearch | superset.db_engine_specs.elasticsearch | superset.db_engine_specs.exasol | superset.db_engine_specs.firebird | superset.db_engine_specs.firebolt | superset.db_engine_specs.bigquery | superset.db_engine_specs.gsheets | superset.db_engine_specs.db2 | superset.db_engine_specs.netezza | superset.db_engine_specs.kusto | superset.db_engine_specs.kusto | superset.db_engine_specs.mssql | superset.db_engine_specs.mysql | superset.db_engine_specs.ocient | superset.db_engine_specs.oracle | superset.db_engine_specs.postgres | superset.db_engine_specs.presto | superset.db_engine_specs.risingwave | superset.db_engine_specs.rockset | superset.db_engine_specs.hana | superset.db_engine_specs.sqlite | superset.db_engine_specs.shillelagh | superset.db_engine_specs.snowflake | superset.db_engine_specs.starrocks | superset.db_engine_specs.teradata | superset.db_engine_specs.trino | superset.db_engine_specs.vertica | superset.db_engine_specs.presto |
| Method used to limit the rows in the subquery | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | WRAP_SQL | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FETCH_MANY | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | WRAP_SQL | FORCE_LIMIT | WRAP_SQL | WRAP_SQL | WRAP_SQL | FORCE_LIMIT | FORCE_LIMIT | WRAP_SQL | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | WRAP_SQL | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT | WRAP_SQL | FORCE_LIMIT | FORCE_LIMIT | FORCE_LIMIT |
| Supports JOINs | True | True | True | True | False | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Supports subqueries | True | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Allows aliases in the SELECT statement | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Allows referencing aliases in the ORDER BY statement | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Supports secondary time columns | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Allows omitting time filters from inline GROUP BYs | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Able to use source column when an alias overshadows it | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | True | False | False |
| Allows aggregations in ORDER BY not present in the SELECT | True | True | True | True | True | False | True | True | True | True | False | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Allows expressions in ORDER BY | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Allows CTE as a subquery | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Allows LIMIT clause (instead of TOP) | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True |
| Maximum column name | None | None | 127 | None | None | 767 | None | None | None | None | 767 | None | 64 | 63 | 128 | None | None | 63 | None | None | 767 | None | None | None | None | None | 128 | None | None | 128 | None | 30 | None | None | None | 128 | 64 | 30 | 30 | None | None | 63 | None | 30 | None | None | 256 | 64 | 30 | None | None | None |
| Allows comments | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Colons must be escaped | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Has time grain SECOND | True | True | True | True | True | True | False | True | True | False | True | True | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True |
| Has time grain FIVE_SECONDS | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False |
| Has time grain THIRTY_SECONDS | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False |
| Has time grain MINUTE | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Has time grain FIVE_MINUTES | False | False | False | False | True | False | False | False | True | False | False | False | False | False | True | True | True | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | True | True | False | False | False | False | False | False | False | False | True | True | True | False | False | False | False | False |
| Has time grain TEN_MINUTES | False | False | False | False | True | False | False | False | True | False | False | False | False | False | True | True | True | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | True | True | False | False | False | False | False | False | False | False | True | True | True | False | False | False | False | False |
| Has time grain FIFTEEN_MINUTES | False | False | False | True | True | False | False | False | True | False | False | False | False | False | True | True | True | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | True | True | False | False | False | False | False | False | False | False | True | True | True | False | False | False | False | False |
| Has time grain THIRTY_MINUTES | False | False | False | True | True | False | False | False | True | False | False | False | False | False | True | True | True | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | True | False | False | False | False | False | False | False | False | True | True | True | False | False | False | False | False |
| Has time grain HALF_HOUR | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | True | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False |
| Has time grain HOUR | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Has time grain SIX_HOURS | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False |
| Has time grain DAY | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Has time grain WEEK | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | False | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True |
| Has time grain WEEK_STARTING_SUNDAY | True | True | False | False | True | True | False | False | False | False | True | False | False | False | True | False | False | False | False | True | True | True | False | False | False | False | False | False | False | False | True | False | False | False | True | True | False | False | False | False | True | False | False | False | True | True | False | False | False | True | False | True |
| Has time grain WEEK_STARTING_MONDAY | False | True | False | False | False | False | False | False | False | False | False | False | True | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | True | True | True | False | False | False | True | False | False | False | True | True | False | True | False | True | False | True |
| Has time grain WEEK_ENDING_SATURDAY | True | True | False | False | True | True | False | False | False | False | True | False | False | False | False | False | False | False | False | True | True | True | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | True | True | False | False | False | True | False | True |
| Has time grain WEEK_ENDING_SUNDAY | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | True | True | False | False | False | True | False | True |
| Has time grain MONTH | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Has time grain QUARTER | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | False | True | True | True | True | True | False | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Has time grain QUARTER_YEAR | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | True | False | False | False | False | False | False | True | True | False | False | False | False | False | False |
| Has time grain YEAR | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Masks/unmasks encrypted_extra | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Has column type mappings | False | False | False | False | False | True | False | False | False | False | True | False | True | True | True | True | True | True | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | True | False | False | False | True | True | False | False | False | False | False | True | False | True | False | True |
| Returns a list of function names | False | False | False | False | False | True | False | False | False | False | True | False | False | False | False | True | True | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | True | True | False | False | False | True | False | True |
| Supports user impersonation | False | False | False | True | False | True | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | True | False | True | False | False |
| Support file upload | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True |
| Returns extra table metadata | False | False | False | False | False | True | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | True | False | False |
| Maps driver exceptions to Superset exceptions | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Parses error messages and returns Superset errors | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Supports changing the schema per-query | False | False | False | True | False | True | False | False | False | False | True | False | True | True | False | False | False | True | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | True | True | False | False | False | False | True | True | False | True | False | True |
| Supports catalogs | False | False | True | False | False | False | False | False | False | False | False | False | False | True | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | True | False | False | True | False | False | False | False | False | False | True | False | True | False | True | False | False | True | False | False | False | True | False |
| Supports changing the catalog per-query | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Can be connected thru an SSH tunnel | False | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True | True | True | True | True | True | True | True | False | False | True | True | True | True | True | True |
| Allows query to be canceled | False | False | True | False | False | True | True | False | False | False | True | True | True | True | False | False | False | True | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | True | True | False | False | False | False | True | True | False | True | False | False |
| Returns additional metrics on dataset creation | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
| Supports querying the latest partition only | False | False | False | False | False | True | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | True | False | True |
| Expands complex types (arrays, structs) into rows/columns | False | False | False | False | False | True | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False |
| Supports query cost estimation | False | False | False | False | False | True | False | False | False | False | True | False | False | True | False | False | False | True | False | False | True | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | False | True |
| Supports validating SQL before running query | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | False | False |
| Score | 20 | 32 | 48 | 50 | 37 | 120 | 37 | 28 | 32 | 20 | 120 | 38 | 59 | 88 | 44 | 41 | 41 | 78 | 28 | 40 | 120 | 30 | 28 | 28 | 26 | 26 | 28 | 26 | 28 | 63 | 61 | 28 | 38 | 26 | 44 | 44 | 59 | 38 | 28 | 38 | 132 | 78 | 28 | 37 | 41 | 41 | 62 | 59 | 27 | 112 | 38 | 82 |

(Note, this table is generated via: `python superset/db_engine_specs/lib.py`.)

## Database information

A DB engine spec has attributes that describe the underlying database engine, so that Superset can know how to build and run queries. For example, some databases don't support subqueries, which are needed for some of the queries produced by Superset for certain charts. When a database doesn't support subqueries the query is run in two-steps, using the results from the first query to build the second query.

These attributes and their default values (set in the base class, `BaseEngineSpec`) are described below:

### `limit_method = LimitMethod.FORCE_LIMIT`

When running user queries in SQL Lab, Superset needs to limit the number of rows returned. The reason for that is cost and performance: there's no point in running a query that produces millions of rows when they can't be loaded into the browser.

For most databases this is done by parsing the user submitted query and applying a limit, if one is not present, or replacing the existing limit if it's larger. This is called the `FORCE_LIMIT` method, and is the most efficient, since the database will produce at most the number of rows that Superset will display.

For some databases this method might not work, and they can use the `WRAP_SQL` method, which wraps the original query in a `SELECT *` and applies a limit via the SQLAlchemy dialect, which should get translated to the correct syntax. This method might be inefficient, since the database optimizer might not be able to push the limit to the inner query.

Finally, as a last resource there is the `FETCH_MANY` method. When a DB engine spec uses this method the query runs unmodified, but Superset fetches only a certain number of rows from the cursor. It's possible that a database using this method can optimize the query execution and compute rows as they are being read by the cursor, but it's unlikely. This makes this method the least efficient of the three.

Note that when Superset runs a query with a given limit, say 100, it always modifies the query to request one additional row (`LIMIT 101`, in this case). This extra row is dropped before the results are returned to the user, but it allows Superset to inform the users that the query was indeed limited. Otherwise a query with `LIMIT 100` that returns exactly 100 rows would seem like it was limited, when in fact it was not.

### `allows_joins = True`

Not all databases support `JOIN`s. When building complex charts, Superset will try to join the table to itself in order to compute `top_n` groups, for example. If the database doesn't support joins Superset will instead run a prequery, and use the results to build the final query.

### `allows_subqueries = True`

Similarly, not all databases support subqueries. For more complex charts Superset will build subqueries if possible, or run the query in two-steps otherwise.

### `allows_alias_in_select = True`

Does the DB support aliases in the projection of a query, eg:

```sql
SELECT COUNT(*) AS cnt
```

Superset will try to use aliases whenever possible, in order to give friendly names to expressions.

### `allows_alias_in_orderby = True`

Does the DB support referencing alias in the `GROUP BY`, eg:

```sql
SELECT
  UPPER(country_of_origin) AS country
  COUNT(*) AS cnt
FROM
  some_table
GROUP BY
  country
```

Otherwise the query is written as:

```sql
SELECT
  UPPER(country_of_origin) AS country
  COUNT(*) AS cnt
FROM
  some_table
GROUP BY
  UPPER(country_of_origin)
```

### `time_groupby_inline = False`

In theory this attribute should be used to omit time filters from the self-joins. When the attribute is false the time attribute will be present in the subquery used to compute limited series, eg:

```sql
SELECT DATE_TRUNC('day', ts) AS ts,
       team AS team,
       COUNT(*) AS count
FROM public.threads
JOIN
  (SELECT team AS team__,
          COUNT(*) AS mme_inner__
   FROM public.threads
   -- this is added when `time_groupby_inline = False`
   WHERE ts >= TO_TIMESTAMP('2022-07-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
     AND ts < TO_TIMESTAMP('2023-07-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
   --
   GROUP BY team
   ORDER BY mme_inner__ DESC
   LIMIT 5) AS anon_1 ON team = team__
WHERE ts >= TO_TIMESTAMP('2022-07-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
  AND ts < TO_TIMESTAMP('2023-07-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')
GROUP BY DATE_TRUNC('day', ts),
         team
ORDER BY count DESC
LIMIT 10000;
```

In practice, the attribute doesn't seem to be working as of 2023-07-27.

### `allows_alias_to_source_column = True`

When this is true the database allows queries where alias can overshadow existing column names. For example, in this query:

```sql
SELECT
  foo + 1 AS foo
FROM
  some_table
ORDER BY
  foo  -- references the alias `foo + 1`, not the column `foo`
```

### `allows_hidden_orderby_agg = True`

If set to true the database allows expressions in the `GROUP BY` that are not present in the projection (`SELECT`), eg:

```sql
SELECT
  country,
  COUNT(*)
FROM
  some_table
GROUP BY
  country
ORDER BY
  SUM(population)  -- not present in the `SELECT`
```

### `allows_hidden_cc_in_orderby = False`

This the opposite of `allows_alias_in_orderby`, for databases that require aliases in the `ORDER BY`. For example, BigQuery doesn't like this query:

```sql
SELECT
  CASE
    WHEN type = 'feature' THEN 'f'
    WHEN type = 'bug' THEN 'b'
    ELSE 'o'
  END AS cc_type
FROM
  some_table
GROUP BY
  cc_type
ORDER BY
  CASE
    WHEN type = 'feature' THEN 'f'
    WHEN type = 'bug' THEN 'b'
    ELSE 'o'
  END
```

Instead, it must be written as:

```sql
SELECT
  CASE
    WHEN type = 'feature' THEN 'f'
    WHEN type = 'bug' THEN 'b'
    ELSE 'o'
  END AS cc_type
FROM
  some_table
GROUP BY
  cc_type
ORDER BY
  cc_type
```

### `allows_cte_in_subquery = True`

When a virtual dataset is used in a chart the original query is converted into a subquery, and is wrapped in an outer query that is generated based on the chart controls. The virtual dataset query might have a CTE, and some databases don't like subqueries with CTEs in them.

When this attribute is false Superset will extract the CTE and move it outside of the subquery when generating SQL for charts. The name of the new CTE will be `cte_alias`, also defined in the DB engine spec.

### `allow_limit_clause = True`

Allows for the `LIMIT` clause. Otherwise, the database probably uses `TOP` to limit rows.

### `max_column_name_length: int | None = None`

Most databases have a well defined limit for the maximum length of a column name (SQLite is probably the one exception). While the can be set (and defaults) to `None,` it's highly recommended to set a value to prevent errors.

### `allows_sql_comments = True`

Are comments supported in the DB? In general SQL in comments are defined by double dashes:

```sql
-- this is a comment
SELECT *  -- we need everything
FROM some_table
```

### `allows_escaped_colons = True`

SQLAlchemy recommends escaping colons to prevent them from being interpreted as bindings to parameters. Because of this, when building queries from virtual datasets Superset will escape all colons with `\:`.

This works for most databases except Athena. The `allows_escaped_colons` attribute specifies if the database supports the escape colon.

## Basic features

These are features that all DB engine specs should support, as the name suggests. They provide a much better user experience for the user.

### Time grains

The most basic feature that DB engine specs need to support is defining time grain expressions. These are dialect-specific SQL expressions that are used to compute metrics on a given time grain when building charts. For example, when computing the metric `COUNT(*)` on a daily basis, Superset will generate the following query:

```sql
SELECT
  <DB engine spec expression for TimeGrain.DAY>,
  COUNT(*)
...
GROUP BY
  <DB engine spec expression for TimeGrain.DAY>
```

For some databases with support for `DATE_TRUNC` or `TIME_FLOOR` this is easy. Here's how Apache Druid computes 15 minute aggregations:

```sql
TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT15M')
```

Where `{col}` is the time column being aggregated — the expression is actually a Jinja2 template. Druid uses the ISO standard for durations, with `PT15M` representing 15 minutes.

On the other and, here's the same for SQLite:

```sql
DATETIME(
  STRFTIME(
    '%Y-%m-%dT%H:%M:00',
    {col}
  ),
  printf(
    '-%d minutes',
    CAST(strftime('%M', {col}) AS INT) % 15
  )
)
```

The SQLite version has to truncate the column down to the minute, and then subtract a number of minutes equals to the modulo 15.

Time grain expressions are defined in the `_time_grain_expressions` class attribute, which maps from a `superset.constants.TimeGrain` to the SQL expression. The dictionary has a special key `None`, that should map to the column directly, for when no time grain is specified.

Note that it's possible to add new time grains via configuration. For example, if you want to add a "2 seconds" time grain to your installation you can add it to `TIME_GRAIN_ADDONS`, and implement it in `TIME_GRAIN_ADDON_EXPRESSIONS`:

```python
# superset_config.py
TIME_GRAIN_ADDONS = {"PT2S": "2 second"}

TIME_GRAIN_ADDON_EXPRESSIONS = {
    "clickhouse": {
        "PT2S": "toDateTime(intDiv(toUInt32(toDateTime({col})), 2)*2)",
    }
}
```

### Column type mapping

Column type mapping, defined in the `column_type_mappings` class attribute, is just a way of mapping type names from the database to types Superset understand. The default values in `BaseEngineSpec` are sane:

```python
_default_column_type_mappings: tuple[ColumnTypeMapping, ...] = (
    (
        re.compile(r"^string", re.IGNORECASE),
        types.String(),
        GenericDataType.STRING,
    ),
    (
        re.compile(r"^float", re.IGNORECASE),
        types.Float(),
        GenericDataType.NUMERIC,
    ),
    (
        re.compile(r"^date", re.IGNORECASE),
        types.Date(),
        GenericDataType.TEMPORAL,
    ),
    (
        re.compile(r"^bool(ean)?", re.IGNORECASE),
        types.Boolean(),
        GenericDataType.BOOLEAN,
    ),
    ...
)
```

But you might want to implement more specific types in the DB engine spec, or complex types. For example, for MSSQL we have:

```python
from sqlalchemy.dialects.mssql.base import SMALLDATETIME

class MssqlEngineSpec(BaseEngineSpec):
    ...
    column_type_mappings = (
        (
            re.compile(r"^smalldatetime.*", re.IGNORECASE),
            SMALLDATETIME(),
            GenericDataType.TEMPORAL,
        ),
    )
```

### Function names

DB engine specs should implement a class method called `get_function_names` that returns a list of strings, representing all the function names that the database supports. This is used for autocomplete in SQL Lab.

### Masked encrypted extra

Superset does a good job in keeping credentials secure. When you add a database with a password, for example:

```text
postgresql://admin:password123@db.example.org:5432/db
```

The password is sent over the network only when the database is created. When you edit the database later, Superset will return this as the SQLAlchemy URI:

```text
postgresql://admin:XXXXXXXXXX@db.example.org:5432/db
```

The password will be masked in the API response; it's not just masked in the browser UI. This is done in order to avoid sending the password unnecessarily over the network. Also, if a non-admin user has access to the API response, they won't be able to know the database password.

When the database is edited, the Superset backend is smart enough to replace the masked password with the actual password, unless the password has changed. That is, if you change the database in the URI from `db` to `db2` the SQLAlchemy URI will be stored in the backend as:

```text
postgresql://admin:password123@db.example.org:5432/db2
```

The password is not the only piece of information where security is critical. For many databases (like BigQuery), sensitive information is stored in the credentials JSON payload. For example:

```json
{
  "type": "service_account",
  "project_id": "dbt-tutorial-347100",
  "private_key_id": "4bc71f06990c864a590fad8b94be6a5904fc171f",
  "private_key": "<SENSITIVE INFORMATION>",
  "client_email": "dbt-user-278@dbt-tutorial-347100.iam.gserviceaccount.com",
  "client_id": "115666988796889519425",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/dbt-user-278%40dbt-tutorial-347100.iam.gserviceaccount.com"
}
```

Similarly to password, we don't want to send `private_key` to the client when a database is edited; the Superset API should never return its actual contents. Instead, Superset should return a masked value, and users should be able to edit the JSON without having to type in the `private_key` on every edit.

To do this, DB engine specs and implement 2 methods, `mask_encrypted_extra` and `unmask_encrypted_extra`. They have these names because the credentials are stored in an encrypted column called `encrypted_extra`. Here's how these methods look like for BigQuery:

```python
from superset.constants import PASSWORD_MASK


class BigQueryEngineSpec(BaseEngineSpec):

    @classmethod
    def mask_encrypted_extra(cls, encrypted_extra: str | None) -> str | None:
        if encrypted_extra is None:
            return encrypted_extra

        try:
            config = json.loads(encrypted_extra)
        except (json.JSONDecodeError, TypeError):
            return encrypted_extra

        try:
            config["credentials_info"]["private_key"] = PASSWORD_MASK
        except KeyError:
            pass

        return json.dumps(config)

    @classmethod
    def unmask_encrypted_extra(
        cls,
        old: str | None,
        new: str | None
    ) -> str | None:
        if old is None or new is None:
            return new

        try:
            old_config = json.loads(old)
            new_config = json.loads(new)
        except (TypeError, json.JSONDecodeError):
            return new

        if "credentials_info" not in new_config:
            return new

        if "private_key" not in new_config["credentials_info"]:
            return new

        if new_config["credentials_info"]["private_key"] == PASSWORD_MASK:
            new_config["credentials_info"]["private_key"] = old_config[
                "credentials_info"
            ]["private_key"]

        return json.dumps(new_config)
```

This way, when a user edits an existing BigQuery connection, the `private_key` is shown as `XXXXXXXXXX`. Everything else in the JSON is still displayed, and the user can change any of the fields without having to provide the private key.

Note that while this is a basic feature that should be implemented for security reasons, it only makes sense in DB engine specs that use `encrypted_extra` to store connection information.

## Nice to have features

The next set of features are nice to have. They don't apply to all databases, and are not strictly needed for security or usability.

### User impersonation

In general there's no user-level granularity when accessing a database in Superset. A single database connection is shared by all users who have access to that database. There are many use cases when this is not desirable, and some databases implement mechanisms in which they can **impersonate users**, potentially reducing the scope of permissions available to run the query.

For example, the Google Sheets DB engine spec implements this via the `get_url_for_impersonation` class method:

```python
class GSheetsEngineSpec(ShillelaghEngineSpec):

    @classmethod
    def get_url_for_impersonation(
        cls,
        url: URL,
        impersonate_user: bool,
        username: str | None,
        access_token: str | None,
    ) -> URL:
        if impersonate_user and username is not None:
            user = security_manager.find_user(username=username)
            if user and user.email:
                url = url.update_query_dict({"subject": user.email})

        return url
```

The method `get_url_for_impersonation` updates the SQLAlchemy URI before every query. In this particular case, it will fetch the user's email and add it to the `subject` query argument. The driver will then lower the permissions to match that given user. This allows the connection to be configured with a service account that has access to all the spreadsheets, while giving users access to only the spreadsheets they own are have been shared with them (or with their organization — Google will handle the authorization in this case, not Superset).

Alternatively, it's also possible to impersonate users by implementing the `update_impersonation_config`. This is a class method which modifies `connect_args` in place. You can use either method, and ideally they [should be consolidated in a single one](https://github.com/apache/superset/issues/24910).

### OAuth2

Support for authenticating to a database using personal OAuth2 access tokens was introduced in [SIP-85](https://github.com/apache/superset/issues/20300). The Google Sheets DB engine spec is the reference implementation.

Note that this API is still experimental and evolving quickly, subject to breaking changes. Currently, to add support for OAuth2 to a DB engine spec, the following attributes are needed:

```python
class BaseEngineSpec:

    supports_oauth2 = True
    oauth2_exception = OAuth2RedirectError

    oauth2_scope = " ".join([
        "https://example.org/scope1",
        "https://example.org/scope2",
    ])
    oauth2_authorization_request_uri = "https://example.org/authorize"
    oauth2_token_request_uri = "https://example.org/token"
```

The `oauth2_exception` is an exception that is raised by `cursor.execute` when OAuth2 is needed. This will start the OAuth2 dance when `BaseEngineSpec.execute` is called, by returning the custom error `OAUTH2_REDIRECT` to the frontend. If the database driver doesn't have a specific exception, it might be necessary to overload the `execute` method in the DB engine spec, so that the `BaseEngineSpec.start_oauth2_dance` method gets called whenever OAuth2 is needed.

The DB engine should implement logic in either `get_url_for_impersonation` or `update_impersonation_config` to update the connection with the personal access token. See the Google Sheets DB engine spec for a reference implementation.

Currently OAuth2 needs to be configured at the DB engine spec level, ie, with one client for each DB engien spec. The configuration lives in `superset_config.py`:

```python
# superset_config.py
DATABASE_OAUTH2_CLIENTS = {
    "Google Sheets": {
        "id": "XXX.apps.googleusercontent.com",
        "secret": "GOCSPX-YYY",
        "scope": " ".join(
            [
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/spreadsheets",
                "https://spreadsheets.google.com/feeds",
            ],
        ),
        "authorization_request_uri": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_request_uri": "https://oauth2.googleapis.com/token",
    },
}
DATABASE_OAUTH2_JWT_ALGORITHM = "HS256"
DATABASE_OAUTH2_REDIRECT_URI = "http://localhost:8088/api/v1/database/oauth2/"
DATABASE_OAUTH2_TIMEOUT = timedelta(seconds=30)
```

When configuring a client only the ID and secret are required; the DB engine spec should have default values for the scope and endpoints. The `DATABASE_OAUTH2_REDIRECT_URI` attribute is optional, and defaults to `/api/v1/databases/oauth2/` in Superset.

In the future we plan to support adding custom clients via the Superset UI, and being able to manually assign clients to specific databases.

### File upload

When a DB engine spec supports file upload it declares so via the `supports_file_upload` class attribute. The base class implementation is very generic and should work for any database that has support for `CREATE TABLE`. It leverages Pandas and the [`df_to_sql`](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.to_sql.html) method.

For some databases the `df_to_sql` classmethod needs to be implemented. For example, for BigQuery the DB engine spec implements a custom method that uses the [`to_gbq`](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.to_gbq.html) method.

### Extra table metadata

DB engine specs can return additional metadata associated with a table. This is done via the `get_extra_table_metadata` class method. Trino uses this to return information about the latest partition, for example, and Bigquery returns clustering information. This information is then surfaced in the SQL Lab UI, when browsing tables in the metadata explorer (on the left panel).

### DB API exception mapping

Different DB API 2.0 drivers implement different exceptions, even if they have the same name. The `get_dbapi_exception_mapping` class method returns a dictionary mapping these custom exceptions to Superset exceptions, so that Superset can return more specific errors when an exception is raised by the underlying driver.

For example, for ClickHouse we have:

```python
from urllib3.exceptions import NewConnectionError

from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError


class ClickHouseEngineSpec(ClickHouseBaseEngineSpec):

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        return {NewConnectionError: SupersetDBAPIDatabaseError}
```

This way, if the ClickHouse driver raises a `NewConnectionError` it would get wrapped in a `SupersetDBAPIDatabaseError`.

### Custom errors

Queries can fail in many different ways. For example, in SQLite:

```sql
sqlite> CREATE TABLE a (b INT);
sqlite> SELECT c FROM a;
Error: no such column: c
sqlite>
```

When a query fails, Superset will return the message, "Error: no such column: c", to the user as a generic error.

Since ideally we want to return specific and actionable error messages, DB engine specs can implement methods that map error messages to more specific errors. For example, the SQLite DB engine specs defines:

```python
COLUMN_DOES_NOT_EXIST_REGEX = re.compile("no such column: (?P<column_name>.+)")


class SqliteEngineSpec(BaseEngineSpec):

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] =
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }
```

This way, when a user selects a column that doesn't exist Superset can return a more informative error.

### Dynamic schema

In SQL Lab it's possible to select a database, and then a schema in that database. Ideally, when running a query in SQL Lab, any unqualified table names (eg, `table`, instead of `schema.table`) should be in the selected schema. For example, if the user selects `dev` as the schema and then runs the following query:

```sql
SELECT * FROM my_table
```

The table `my_table` should live in the `dev` schema. In order to do that, it's necessary to modify the SQLAlchemy URI before running the query. Since different databases have different ways of doing that, this functionality is implemented via the `adjust_engine_params` class method. The method receives the SQLAlchemy URI and `connect_args`, as well as the schema in which the query should run. It then returns a potentially modified URI and `connect_args` to ensure that the query runs in the specified schema.

When a DB engine specs implements `adjust_engine_params` it should have the class attribute `supports_dynamic_schema` set to true. This is critical for security, since **it allows Superset to know to which schema any unqualified table names belong to**. For example, in the query above, if the database supports dynamic schema, Superset would check to see if the user running the query has access to `dev.my_table`. On the other hand, if the database doesn't support dynamic schema, Superset would use the default database schema instead of `dev`.

Implementing this method is also important for usability. When the method is not implemented selecting the schema in SQL Lab has no effect on the schema in which the query runs, resulting in a confusing results when using unqualified table names.

### Catalog

In general, databases support a hierarchy of one-to-many concepts:

1. Database
2. Catalog
3. Namespace
4. Table
5. Column

These concepts have different names depending on the database. For example, Postgres uses the following terminology:

1. Cluster (database)
2. Database (catalog)
3. Schema (namespace)
4. Table
5. Column

BigQuery, on the other hand:

1. BigQuery (database)
2. Project (catalog)
3. Schema (namespace)
4. Table
5. Column

Hive and Trino:

1. Database
2. Catalog
3. Schema
4. Table
5. Column

If the database supports catalogs, then the DB engine spec should have the `supports_catalog` class attribute set to true. It should also implement the `get_default_catalog` method, so that the proper permissions can be created when datasets are added.

### Dynamic catalog

Superset support for multiple catalogs. Since, in general, a given SQLAlchemy URI connects only to a single catalog, it requires DB engine specs to implement the `adjust_engine_params` method to rewrite the URL to connect to a different catalog, similar to how dynamic schemas work. Additionally, DB engine specs should also implement the `get_catalog_names` method, so that users can browse the available catalogs.

### SSH tunneling

Superset can connect to databases via an SSH tunnel. For databases where this doesn't make sense (eg, SQLite or BigQuery) the DB engine spec should have `disable_ssh_tunneling` set to true.

### Query cancelation

Superset will try to cancel running queries if the users wants so, but it's up to the DB engine spec to handle this.

Some databases have an implicit query cancelation. When a cursor stops being polled it will cancel the query. For databases that behave like this, the class method `has_implicit_cancel` (which should really be a class attribute) should return true.

For other databases, DB engine specs can implement query cancelation via the `prepare_cancel_query` and `cancel_query` methods. Implementation of query cancelation is usually heavily dependent on the database, but the DB engine specs that support it can serve as an example.

### Get metrics on dataset creation

When a physical dataset is first created, the `get_metrics` class method is called on the table. The base implementation returns the `COUNT(*)` metric, but DB engine specs can override `get_metrics` to return other metrics. This method is useful for semantic layers that contain their own metrics definitions; when Superset connect to them it can automatically create those metrics when a dataset is added.

This feature is still experimental, and ideally there would be a mechanism for calling it periodically or when a dataset is explored, in order to sync new metric definitions to the dataset.

### `WHERE` on latest partition

In some databases, running `SELECT *` can be a **very expensive** operation, since the query might scan all partitions for a given table. Because of that, some DB engine specs implement the `where_latest_partition` method, which returns a modified SQLAlchemy query with an additional predicate that filters on the latest partition.

## Advanced features

### Expand complex types

Some databases will visually expand complex types (arrays and structures) when displaying results from queries. For example, the BigQuery UI is able to expand objects into columns and array into rows, so that this:

|   array   |      struct      |
| --------- | ---------------- |
| [1, 2, 3] | {a: one, b: two} |

Is shown as:

| array |      struct      | struct.a | struct.b |
| ----- | ---------------- | -------- | -------- |
| 1     | {a: one, b: two} | one      | two      |
| 2     |                  |          |          |
| 3     |                  |          |          |

A similar behavior has been implemented in Superset for Presto, and can be enabled via the `PRESTO_EXPAND_DATA` feature flag. To implement this feature a DB engine spec should implement the `expand_data` method, which takes the columns and rows and returns modified columns and rows.

Note that despite being implemented only for Presto, this behavior has nothing that is Presto specific, and in theory could be implemented in a generic way for all database without requiring custom DB engine spec implementations (that is, the Presto `expand_data` method could be moved to the base class, after being cleaned up, and we could then enable the feature per DB in the configuration).

### Query cost estimation

Some databases allow uses to estimate the cost of running a query before running it. This is done via the `estimate_query_cost` method in DB engine specs, which receives the SQL and returns a list of "costs". The definition of what "cost" is varies from database to database (in the few that support this functionality), and it can be formatted via the `query_cost_formatter`.

The `query_cost_formatter` can be overridden with an arbitrary function via the config `QUERY_COST_FORMATTERS_BY_ENGINE`. This allows custom deployments of Superset to format the results in different ways. For example, at some point in Lyft the cost for running Presto queries would also show the carbon footprint (in trees).

### SQL validation

A few databases support validating the syntax of the SQL as the user is typing it, indicating in SQL Lab any errors. This is usually done using an `EXPLAIN` query and, because it gets called every few seconds as the user types, it's important that the database returns the result quickly.

This is currently implement for Presto and Postgres, via custom classes in `superset/sql_validators` that should be enabled in the configuration. Implementing this as custom classes, instead of a `validate_sql` method in the DB engine spec offers no advantages, and ideally in the future we should move the logic to DB engine specs.

## Testing DB engine specs

Superset has a command to test the connection to a given database, as well as checking if the SQLAlchemy dialect implements all necessary methods used by Superset, and checking which features are supported by the DB engine spec (if one exists). To run the tool just call the `test-db` command with the SQLAlchemy URI to be tested:

```bash
superset test-db sqlite://
```

If the connection needs additional arguments they can be passed when the command runs.
