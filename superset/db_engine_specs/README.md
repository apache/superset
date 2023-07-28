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
| Allows ommiting time filters from inline GROUP BYs | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | True | True | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False | False |
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
| Supports user impersonation | False | False | False | True | False | True | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | False | True | False | False | False | False | False | False | False | False | True | False | False |
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

## Database information

A DB engine spec has attributes that describe the underlying database engine, so that Superset can know how to build and run queries. For example, some databases don't support subqueries, which are needed for some of the queries produced by Superset for certain charts. When a database doesn't support subqueries the query is run in two-steps, using the results from the first query to build the second query.

These attributes and their default values (set in the base class, `BaseEngineSpec`) are described below:

### `limit_method = LimitMethod.FORCE_LIMIT`

When running user queries in SQL Lab, Superset needs to limit the number of rows returned. The reason for that is cost and performance: there's no point in running a query that produces millions of rows when they can't be loaded into the browser.

For most databases this is done by parsing the user submitted query and applying a limit, if one is not present, or replacing the existing limit if it's larger. This is called the `FORCE_LIMIT` method, and is the most efficient, since the database will produce at most the number of rows that Superset will display.

For some databases this method might not work, and they can use the `WRAP_SQL` method, which wraps the original query in a `SELECT *` and applies a limit via the SQLAlchemy dialect, which should get translated to the correct syntax. This method might be inneficient, since the database optimizer might not be able to push the limit to the inner query.

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

### `time_secondary_columns = False`

Datasets can have a main datatime column (`main_dttm_col`), but can also have secondary time columns. When this attribute is true, wheneve the secondary columns are filtered, the same filter is applied to the main datetime column.

This might be useful if you have a table partitioned on a daily `ds` column in Hive (which doesn't support indexes), and a secondary column with the timestamp of the events, ie:

|     ds     |        event        | ... |
| ---------- | ------------------- | --- |
| 2023-01-01 | 2023-01-01 23:58:41 | ... |
| 2023-01-02 | 2023-01-02 00:03:17 | ... |
| 2023-01-02 | 2023-01-02 00:14:02 | ... |

With the table above, filtering only on `event` can be very innefective. For example, this query:

```sql
SELECT
  *
FROM
  some_table
WHERE
  event BETWEEN '2023-01-02 00:00:00' AND '2023-01-02 01:00:00'
```

Would scan all the `ds` partitions, even though only one is needed! By setting the attribute to true, if `ds` is set as the main datetime column then the query would be generated as:

```sql
SELECT
  *
FROM
  some_table
WHERE
  event BETWEEN '2023-01-02 00:00:00' AND '2023-01-02 01:00:00' AND
  ds BETWEEN '2023-01-02 00:00:00' AND '2023-01-02 01:00:00'
```

Which reads data from a single partition instead.

### `time_groupby_inline = False`

In theory this attribute should be used to ommit time filters from the self-joins. When the attribute is false the time attribute will be present in the subquery used to compute limited series, eg:

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
