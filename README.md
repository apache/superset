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

# Superset

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/license/apache-2-0)
[![Latest Release on Github](https://img.shields.io/github/v/release/apache/superset?sort=semver)](https://github.com/apache/superset/releases/latest)
[![Build Status](https://github.com/apache/superset/actions/workflows/superset-python-unittest.yml/badge.svg)](https://github.com/apache/superset/actions)
[![PyPI version](https://badge.fury.io/py/apache_superset.svg)](https://badge.fury.io/py/apache_superset)
[![PyPI](https://img.shields.io/pypi/pyversions/apache_superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/apache_superset)
[![GitHub Stars](https://img.shields.io/github/stars/apache/superset?style=social)](https://github.com/apache/superset/stargazers)
[![Contributors](https://img.shields.io/github/contributors/apache/superset)](https://github.com/apache/superset/graphs/contributors)
[![Last Commit](https://img.shields.io/github/last-commit/apache/superset)](https://github.com/apache/superset/commits/master)
[![Open Issues](https://img.shields.io/github/issues/apache/superset)](https://github.com/apache/superset/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/apache/superset)](https://github.com/apache/superset/pulls)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://bit.ly/join-superset-slack)
[![Documentation](https://img.shields.io/badge/docs-apache.org-blue.svg)](https://superset.apache.org)

<picture width="500">
  <source
    width="600"
    media="(prefers-color-scheme: dark)"
    src="https://superset.apache.org/img/superset-logo-horiz-dark.svg"
    alt="Superset logo (dark)"
  />
  <img
    width="600"
    src="https://superset.apache.org/img/superset-logo-horiz-apache.svg"
    alt="Superset logo (light)"
  />
</picture>

A modern, enterprise-ready business intelligence web application.

### Documentation

- **[User Guide](https://superset.apache.org/user-docs/)** — For analysts and business users. Explore data, build charts, create dashboards, and connect databases.
- **[Administrator Guide](https://superset.apache.org/admin-docs/)** — Install, configure, and operate Superset. Covers security, scaling, and database drivers.
- **[Developer Guide](https://superset.apache.org/developer-docs/)** — Contribute to Superset or build on its REST API and extension framework.

[**Why Superset?**](#why-superset) |
[**Supported Databases**](#supported-databases) |
[**Release Notes**](https://github.com/apache/superset/blob/master/RELEASING/README.md#release-notes-for-recent-releases) |
[**Get Involved**](#get-involved) |
[**Resources**](#resources) |
[**Organizations Using Superset**](https://superset.apache.org/inTheWild)

## Why Superset?

Superset is a modern data exploration and data visualization platform. Superset can replace or augment proprietary business intelligence tools for many teams. Superset integrates well with a variety of data sources.

Superset provides:

- A **no-code interface** for building charts quickly
- A powerful, web-based **SQL Editor** for advanced querying
- A **lightweight semantic layer** for quickly defining custom dimensions and metrics
- Out of the box support for **nearly any SQL** database or data engine
- A wide array of **beautiful visualizations** to showcase your data, ranging from simple bar charts to geospatial visualizations
- Lightweight, configurable **caching layer** to help ease database load
- Highly extensible **security roles and authentication** options
- An **API** for programmatic customization
- A **cloud-native architecture** designed from the ground up for scale

## Screenshots & Gifs

**Video Overview**

<!-- File hosted here https://github.com/apache/superset-site/raw/lfs/superset-video-4k.mp4 -->

[superset-video-1080p.webm](https://github.com/user-attachments/assets/b37388f7-a971-409c-96a7-90c4e31322e6)

<br/>

**Large Gallery of Visualizations**

<kbd><img title="Gallery" src="https://superset.apache.org/img/screenshots/gallery.jpg"/></kbd><br/>

**Craft Beautiful, Dynamic Dashboards**

<kbd><img title="View Dashboards" src="https://superset.apache.org/img/screenshots/dashboard.jpg"/></kbd><br/>

**No-Code Chart Builder**

<kbd><img title="Slice & dice your data" src="https://superset.apache.org/img/screenshots/explore.jpg"/></kbd><br/>

**Powerful SQL Editor**

<kbd><img title="SQL Lab" src="https://superset.apache.org/img/screenshots/sql_lab.jpg"/></kbd><br/>

## Supported Databases

Superset can query data from any SQL-speaking datastore or data engine (Presto, Trino, Athena, [and more](https://superset.apache.org/docs/databases)) that has a Python DB-API driver and a SQLAlchemy dialect.

Here are some of the major database solutions that are supported:

<!-- SUPPORTED_DATABASES_START -->
<p align="center">
  <a href="https://superset.apache.org/docs/databases/supported/amazon-athena" title="Amazon Athena"><img src="docs/static/img/databases/amazon-athena.jpg" alt="Amazon Athena" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/amazon-dynamodb" title="Amazon DynamoDB"><img src="docs/static/img/databases/aws.png" alt="Amazon DynamoDB" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/amazon-redshift" title="Amazon Redshift"><img src="docs/static/img/databases/redshift.png" alt="Amazon Redshift" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-doris" title="Apache Doris"><img src="docs/static/img/databases/doris.png" alt="Apache Doris" width="103" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-drill" title="Apache Drill"><img src="docs/static/img/databases/apache-drill.png" alt="Apache Drill" width="81" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-druid" title="Apache Druid"><img src="docs/static/img/databases/druid.png" alt="Apache Druid" width="117" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-hive" title="Apache Hive"><img src="docs/static/img/databases/apache-hive.svg" alt="Apache Hive" width="44" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-impala" title="Apache Impala"><img src="docs/static/img/databases/apache-impala.png" alt="Apache Impala" width="21" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-kylin" title="Apache Kylin"><img src="docs/static/img/databases/apache-kylin.png" alt="Apache Kylin" width="44" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-pinot" title="Apache Pinot"><img src="docs/static/img/databases/apache-pinot.svg" alt="Apache Pinot" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-solr" title="Apache Solr"><img src="docs/static/img/databases/apache-solr.png" alt="Apache Solr" width="79" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-spark-sql" title="Apache Spark SQL"><img src="docs/static/img/databases/apache-spark.png" alt="Apache Spark SQL" width="75" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ascend" title="Ascend"><img src="docs/static/img/databases/ascend.webp" alt="Ascend" width="117" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/aurora-mysql-data-api" title="Aurora MySQL (Data API)"><img src="docs/static/img/databases/mysql.png" alt="Aurora MySQL (Data API)" width="77" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/aurora-postgresql-data-api" title="Aurora PostgreSQL (Data API)"><img src="docs/static/img/databases/postgresql.svg" alt="Aurora PostgreSQL (Data API)" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/azure-data-explorer" title="Azure Data Explorer"><img src="docs/static/img/databases/kusto.png" alt="Azure Data Explorer" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/azure-synapse" title="Azure Synapse"><img src="docs/static/img/databases/azure.svg" alt="Azure Synapse" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/clickhouse" title="ClickHouse"><img src="docs/static/img/databases/clickhouse.png" alt="ClickHouse" width="150" height="37" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/cloudflare-d1" title="Cloudflare D1"><img src="docs/static/img/databases/cloudflare.png" alt="Cloudflare D1" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/cockroachdb" title="CockroachDB"><img src="docs/static/img/databases/cockroachdb.png" alt="CockroachDB" width="150" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/couchbase" title="Couchbase"><img src="docs/static/img/databases/couchbase.svg" alt="Couchbase" width="150" height="35" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/cratedb" title="CrateDB"><img src="docs/static/img/databases/cratedb.svg" alt="CrateDB" width="180" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/databend" title="Databend"><img src="docs/static/img/databases/databend.png" alt="Databend" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/databricks" title="Databricks"><img src="docs/static/img/databases/databricks.png" alt="Databricks" width="152" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/denodo" title="Denodo"><img src="docs/static/img/databases/denodo.png" alt="Denodo" width="138" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/dremio" title="Dremio"><img src="docs/static/img/databases/dremio.png" alt="Dremio" width="126" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/duckdb" title="DuckDB"><img src="docs/static/img/databases/duckdb.png" alt="DuckDB" width="52" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/elasticsearch" title="Elasticsearch"><img src="docs/static/img/databases/elasticsearch.png" alt="Elasticsearch" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/exasol" title="Exasol"><img src="docs/static/img/databases/exasol.png" alt="Exasol" width="72" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/firebird" title="Firebird"><img src="docs/static/img/databases/firebird.png" alt="Firebird" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/firebolt" title="Firebolt"><img src="docs/static/img/databases/firebolt.png" alt="Firebolt" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/google-bigquery" title="Google BigQuery"><img src="docs/static/img/databases/google-big-query.svg" alt="Google BigQuery" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/google-sheets" title="Google Sheets"><img src="docs/static/img/databases/google-sheets.svg" alt="Google Sheets" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/greenplum" title="Greenplum"><img src="docs/static/img/databases/greenplum.png" alt="Greenplum" width="124" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/hologres" title="Hologres"><img src="docs/static/img/databases/hologres.png" alt="Hologres" width="44" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ibm-db2" title="IBM Db2"><img src="docs/static/img/databases/ibm-db2.svg" alt="IBM Db2" width="91" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ibm-netezza-performance-server" title="IBM Netezza Performance Server"><img src="docs/static/img/databases/netezza.png" alt="IBM Netezza Performance Server" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/mariadb" title="MariaDB"><img src="docs/static/img/databases/mariadb.png" alt="MariaDB" width="150" height="37" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/microsoft-sql-server" title="Microsoft SQL Server"><img src="docs/static/img/databases/msql.png" alt="Microsoft SQL Server" width="50" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/monetdb" title="MonetDB"><img src="docs/static/img/databases/monet-db.png" alt="MonetDB" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/mongodb" title="MongoDB"><img src="docs/static/img/databases/mongodb.png" alt="MongoDB" width="150" height="38" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/motherduck" title="MotherDuck"><img src="docs/static/img/databases/motherduck.png" alt="MotherDuck" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/oceanbase" title="OceanBase"><img src="docs/static/img/databases/oceanbase.svg" alt="OceanBase" width="175" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/oracle" title="Oracle"><img src="docs/static/img/databases/oraclelogo.png" alt="Oracle" width="111" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/presto" title="Presto"><img src="docs/static/img/databases/presto-og.png" alt="Presto" width="127" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/risingwave" title="RisingWave"><img src="docs/static/img/databases/risingwave.svg" alt="RisingWave" width="147" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/sap-hana" title="SAP HANA"><img src="docs/static/img/databases/sap-hana.png" alt="SAP HANA" width="137" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/sap-sybase" title="SAP Sybase"><img src="docs/static/img/databases/sybase.png" alt="SAP Sybase" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/shillelagh" title="Shillelagh"><img src="docs/static/img/databases/shillelagh.png" alt="Shillelagh" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/singlestore" title="SingleStore"><img src="docs/static/img/databases/singlestore.png" alt="SingleStore" width="150" height="31" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/snowflake" title="Snowflake"><img src="docs/static/img/databases/snowflake.svg" alt="Snowflake" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/sqlite" title="SQLite"><img src="docs/static/img/databases/sqlite.png" alt="SQLite" width="84" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/starrocks" title="StarRocks"><img src="docs/static/img/databases/starrocks.png" alt="StarRocks" width="149" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/superset-meta-database" title="Superset meta database"><img src="docs/static/img/databases/superset.svg" alt="Superset meta database" width="150" height="39" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/tdengine" title="TDengine"><img src="docs/static/img/databases/tdengine.png" alt="TDengine" width="140" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/teradata" title="Teradata"><img src="docs/static/img/databases/teradata.png" alt="Teradata" width="124" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/timescaledb" title="TimescaleDB"><img src="docs/static/img/databases/timescale.png" alt="TimescaleDB" width="150" height="36" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/trino" title="Trino"><img src="docs/static/img/databases/trino.png" alt="Trino" width="89" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/vertica" title="Vertica"><img src="docs/static/img/databases/vertica.png" alt="Vertica" width="128" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ydb" title="YDB"><img src="docs/static/img/databases/ydb.svg" alt="YDB" width="110" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/yugabytedb" title="YugabyteDB"><img src="docs/static/img/databases/yugabyte.png" alt="YugabyteDB" width="150" height="26" /></a>
</p>
<!-- SUPPORTED_DATABASES_END -->

**A more comprehensive list of supported databases** along with the configuration instructions can be found [here](https://superset.apache.org/docs/databases).

Want to add support for your datastore or data engine? Read more [here](https://superset.apache.org/docs/frequently-asked-questions#does-superset-work-with-insert-database-engine-here) about the technical requirements.

## Installation and Configuration

Try out Superset's [quickstart](https://superset.apache.org/docs/quickstart/) guide or learn about [the options for production deployments](https://superset.apache.org/docs/installation/architecture/).

## Get Involved

- Ask and answer questions on [StackOverflow](https://stackoverflow.com/questions/tagged/apache-superset) using the **apache-superset** tag
- [Join our community's Slack](http://bit.ly/join-superset-slack)
  and please read our [Slack Community Guidelines](https://github.com/apache/superset/blob/master/CODE_OF_CONDUCT.md#slack-community-guidelines)
- [Join our dev@superset.apache.org Mailing list](https://lists.apache.org/list.html?dev@superset.apache.org). To join, simply send an email to [dev-subscribe@superset.apache.org](mailto:dev-subscribe@superset.apache.org)
- If you want to help troubleshoot GitHub Issues involving the numerous database drivers that Superset supports, please consider adding your name and the databases you have access to on the [Superset Database Familiarity Rolodex](https://docs.google.com/spreadsheets/d/1U1qxiLvOX0kBTUGME1AHHi6Ywel6ECF8xk_Qy-V9R8c/edit#gid=0)
- Join Superset's Town Hall and [Operational Model](https://preset.io/blog/the-superset-operational-model-wants-you/) recurring meetings. Meeting info is available on the [Superset Community Calendar](https://superset.apache.org/community)

## Contributor Guide

Interested in contributing? Check out our
[Developer Guide](https://superset.apache.org/developer-docs/)
to find resources around contributing along with a detailed guide on
how to set up a development environment.

## Resources

- [Superset "In the Wild"](https://superset.apache.org/inTheWild) - see who's using Superset, and [add your organization](https://github.com/apache/superset/edit/master/RESOURCES/INTHEWILD.yaml) to the list!
- [Feature Flags](https://superset.apache.org/docs/configuration/feature-flags) - the status of Superset's Feature Flags.
- [Standard Roles](https://github.com/apache/superset/blob/master/RESOURCES/STANDARD_ROLES.md) - How RBAC permissions map to roles.
- [Superset Wiki](https://github.com/apache/superset/wiki) - Tons of additional community resources: best practices, community content and other information.
- [Superset SIPs](https://github.com/orgs/apache/projects/170) - The status of Superset's SIPs (Superset Improvement Proposals) for both consensus and implementation status.

Understanding the Superset Points of View

- [The Case for Dataset-Centric Visualization](https://preset.io/blog/dataset-centric-visualization/)
- [Understanding the Superset Semantic Layer](https://preset.io/blog/understanding-superset-semantic-layer/)

- Getting Started with Superset
  - [Superset in 2 Minutes using Docker Compose](https://superset.apache.org/docs/installation/docker-compose#installing-superset-locally-using-docker-compose)
  - [Installing Database Drivers](https://superset.apache.org/docs/configuration/databases#installing-database-drivers)
  - [Building New Database Connectors](https://preset.io/blog/building-database-connector/)
  - [Create Your First Dashboard](https://superset.apache.org/docs/using-superset/creating-your-first-dashboard/)
  - [Comprehensive Tutorial for Contributing Code to Apache Superset
    ](https://preset.io/blog/tutorial-contributing-code-to-apache-superset/)
- [Resources to master Superset by Preset](https://preset.io/resources/)

- Deploying Superset

  - [Official Docker image](https://hub.docker.com/r/apache/superset)
  - [Helm Chart](https://github.com/apache/superset/tree/master/helm/superset)

- Recordings of Past [Superset Community Events](https://preset.io/events)

  - [Mixed Time Series Charts](https://preset.io/events/mixed-time-series-visualization-in-superset-workshop/)
  - [How the Bing Team Customized Superset for the Internal Self-Serve Data & Analytics Platform](https://preset.io/events/how-the-bing-team-heavily-customized-superset-for-their-internal-data/)
  - [Live Demo: Visualizing MongoDB and Pinot Data using Trino](https://preset.io/events/2021-04-13-visualizing-mongodb-and-pinot-data-using-trino/)
  - [Introduction to the Superset API](https://preset.io/events/introduction-to-the-superset-api/)
  - [Building a Database Connector for Superset](https://preset.io/events/2021-02-16-building-a-database-connector-for-superset/)

- Visualizations

  - [Creating Viz Plugins](https://superset.apache.org/docs/contributing/creating-viz-plugins/)
  - [Managing and Deploying Custom Viz Plugins](https://medium.com/nmc-techblog/apache-superset-manage-custom-viz-plugins-in-production-9fde1a708e55)
  - [Why Apache Superset is Betting on Apache ECharts](https://preset.io/blog/2021-4-1-why-echarts/)

- [Superset API](https://superset.apache.org/docs/rest-api)

## Repo Activity

<a href="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats?repo_id=39464018" target="_blank" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=39464018&image_size=auto&color_scheme=dark" width="655" height="auto" />
    <img alt="Performance Stats of apache/superset - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=39464018&image_size=auto&color_scheme=light" width="655" height="auto" />
  </picture>
</a>

<!-- Made with [OSS Insight](https://ossinsight.io/) -->

<!-- telemetry/analytics pixel: -->
<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=bc1c90cd-bc04-4e11-8c7b-289fb2839492" />
