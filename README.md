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

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/apache/superset?sort=semver)](https://github.com/apache/superset/tree/latest)
[![Build Status](https://github.com/apache/superset/workflows/Python/badge.svg)](https://github.com/apache/superset/actions)
[![PyPI version](https://badge.fury.io/py/apache-superset.svg)](https://badge.fury.io/py/apache-superset)
[![Coverage Status](https://codecov.io/github/apache/superset/coverage.svg?branch=master)](https://codecov.io/github/apache/superset)
[![PyPI](https://img.shields.io/pypi/pyversions/apache-superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/apache-superset)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](https://join.slack.com/t/apache-superset/shared_invite/zt-uxbh5g36-AISUtHbzOXcu0BIj7kgUaw)
[![Documentation](https://img.shields.io/badge/docs-apache.org-blue.svg)](https://superset.apache.org)
[![Dependencies Status](https://david-dm.org/apache/superset/status.svg?path=superset-frontend)](https://david-dm.org/apache/superset?path=superset-frontend)

<img
  src="https://github.com/apache/superset/raw/master/superset-frontend/src/assets/branding/superset-logo-horiz-apache.png"
  alt="Superset"
  width="500"
/>

A modern, enterprise-ready business intelligence web application.

[**Why Superset?**](#why-superset) |
[**Supported Databases**](#supported-databases) |
[**Installation and Configuration**](#installation-and-configuration) |
[**Release Notes**](RELEASING/README.md#release-notes-for-recent-releases) |
[**Get Involved**](#get-involved) |
[**Contributor Guide**](#contributor-guide) |
[**Resources**](#resources) |
[**Organizations Using Superset**](RESOURCES/INTHEWILD.md)

## Screenshots & Gifs

**Gallery**

<kbd><a href="https://superset.apache.org/gallery"><img title="Gallery" src="superset-frontend/images/screenshots/gallery.jpg"/></a></kbd><br/>

**View Dashboards**

<kbd><img title="View Dashboards" src="superset-frontend/images/screenshots/slack_dash.jpg"/></kbd><br/>

**Slice & dice your data**

<kbd><img title="Slice & dice your data" src="superset-frontend/images/screenshots/explore.jpg"/></kbd><br/>

**Query and visualize your data with SQL Lab**

<kbd><img title="SQL Lab" src="superset-frontend/images/screenshots/sql_lab.jpg"/></kbd><br/>

**Visualize geospatial data with deck.gl**

<kbd><img title="Geospatial" src="superset-frontend/images/screenshots/geospatial_dash.jpg"/></kbd><br/>

**Choose from a wide array of visualizations**

<kbd><img title="Visualizations" src="superset-frontend/images/screenshots/explore_visualizations.jpg"/></kbd><br/>

## Why Superset?

Superset provides:

- An intuitive interface for visualizing datasets and
  crafting interactive dashboards
- A wide array of beautiful visualizations to showcase your data
- Code-free visualization builder to extract and present datasets
- A world-class SQL IDE for preparing data for visualization, including a rich metadata browser
- A lightweight semantic layer which empowers data analysts to quickly define custom dimensions and metrics
- Out-of-the-box support for most SQL-speaking databases
- Seamless, in-memory asynchronous caching and queries
- An extensible security model that allows configuration of very intricate rules
  on who can access which product features and datasets.
- Integration with major
  authentication backends (database, OpenID, LDAP, OAuth, REMOTE_USER, etc)
- The ability to add custom visualization plugins
- An API for programmatic customization
- A cloud-native architecture designed from the ground up for scale

## Supported Databases

Superset can query data from any SQL-speaking datastore or data engine (e.g. Presto or Athena) that has a Python DB-API driver and a SQLAlchemy dialect.

Here are some of the major database solutions that are supported:

<p align="center">
  <img src="superset-frontend/images/redshift.png" alt="redshift" border="0" width="106" height="41"/>
  <img src="superset-frontend/images/google-biquery.png" alt="google-biquery" border="0" width="114" height="43"/>
  <img src="superset-frontend/images/snowflake.png" alt="snowflake" border="0" width="152" height="46"/>
  <img src="superset-frontend/images/trino.png" alt="trino" border="0" width="46" height="46"/>
  <img src="superset-frontend/images/presto.png" alt="presto" border="0" width="152" height="46"/>
  <img src="superset-frontend/images/druid.png" alt="druid" border="0" width="135" height="37" />
  <img src="superset-frontend/images/postgresql.png" alt="postgresql" border="0" width="132" height="81" />
  <img src="superset-frontend/images/mysql.png" alt="mysql" border="0" width="119" height="62" />
  <img src="superset-frontend/images/mssql-server.png" alt="mssql-server" border="0" width="93" height="74" />
  <img src="superset-frontend/images/db2.png" alt="db2" border="0" width="62" height="62" />
  <img src="superset-frontend/images/sqlite.png" alt="sqlite" border="0" width="102" height="45" />
  <img src="superset-frontend/images/sybase.png" alt="sybase" border="0" width="128" height="47" />
  <img src="superset-frontend/images/mariadb.png" alt="mariadb" border="0" width="83" height="63" />
  <img src="superset-frontend/images/vertica.png" alt="vertica" border="0" width="128" height="40" />
  <img src="superset-frontend/images/oracle.png" alt="oracle" border="0" width="121" height="66" />
  <img src="superset-frontend/images/firebird.png" alt="firebird" border="0" width="86" height="56" />
  <img src="superset-frontend/images/greenplum.png" alt="greenplum" border="0" width="140" height="45" />
  <img src="superset-frontend/images/clickhouse.png" alt="clickhouse" border="0" width="133" height="34" />
  <img src="superset-frontend/images/exasol.png" alt="exasol" border="0" width="106" height="59" />
  <img src="superset-frontend/images/monet-db.png" alt="monet-db" border="0" width="106" height="46" />
  <img src="superset-frontend/images/apache-kylin.png" alt="apache-kylin" border="0" width="56" height="64"/>
  <img src="superset-frontend/images/hologres.png" alt="hologres" border="0" width="71" height="64"/>
  <img src="superset-frontend/images/netezza.png" alt="netezza" border="0" width="64" height="64"/>
</p>

**A more comprehensive list of supported databases** along with the configuration instructions can be found
[here](https://superset.apache.org/docs/databases/installing-database-drivers).

Want to add support for your datastore or data engine? Read more [here](https://superset.apache.org/docs/frequently-asked-questions#does-superset-work-with-insert-database-engine-here) about the technical requirements.

## Installation and Configuration

[Extended documentation for Superset](https://superset.apache.org/docs/installation/installing-superset-using-docker-compose)

## Get Involved

- Ask and answer questions on [StackOverflow](https://stackoverflow.com/questions/tagged/apache-superset) using the **apache-superset** tag
- [Join our community's Slack](https://join.slack.com/t/apache-superset/shared_invite/zt-uxbh5g36-AISUtHbzOXcu0BIj7kgUaw)
  and please read our [Slack Community Guidelines](https://github.com/apache/superset/blob/master/CODE_OF_CONDUCT.md#slack-community-guidelines)
- [Join our dev@superset.apache.org Mailing list](https://lists.apache.org/list.html?dev@superset.apache.org)

## Contributor Guide

Interested in contributing? Check out our
[CONTRIBUTING.md](https://github.com/apache/superset/blob/master/CONTRIBUTING.md)
to find resources around contributing along with a detailed guide on
how to set up a development environment.

## Resources

- Superset 1.0
  - [Superset 1.0 Milestone](https://superset.apache.org/docs/version-one)
  - [Superset 1.0 Release Notes](https://github.com/apache/superset/tree/master/RELEASING/release-notes-1-0)
- Getting Started with Superset
  - [Superset in 2 Minutes using Docker Compose](https://superset.apache.org/docs/installation/installing-superset-using-docker-compose#installing-superset-locally-using-docker-compose)
  - [Installing Database Drivers](https://superset.apache.org/docs/databases/dockeradddrivers)
  - [Building New Database Connectors](https://preset.io/blog/building-database-connector/)
  - [Create Your First Dashboard](https://superset.apache.org/docs/creating-charts-dashboards/first-dashboard)
- [Documentation for Superset End-Users (by Preset)](https://docs.preset.io/docs/terminology)
- Deploying Superset
  - [Official Docker image](https://hub.docker.com/r/apache/superset)
  - [Helm Chart](https://github.com/apache/superset/tree/master/helm/superset)
- [Recordings of Past Community Events](https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g)
  - [Meetup: Superset 1.0](https://www.youtube.com/watch?v=gEZkFF2kokk)
  - [Live Demo: Interactive Time-series Analysis with Druid and Superset](https://www.youtube.com/watch?v=4eh7OTfMln8)
  - [Live Demo: Visualizing MongoDB and Pinot Data using Trino](https://www.youtube.com/watch?v=Dw_al_26F6o)
- Upcoming Superset Events
  - [Superset + Star Wars: May the 4th Be With You](https://preset.io/events/2021-05-04-superset-star-wars-may-the-4th-be-with-you)
  - [Meetup - Developing and Deploying Custom Visualization Plugins in Superset](https://www.meetup.com/Global-Apache-Superset-Community-Meetup/events/277835486/)
  - [Visualize Your Data Lake Using Athena and Superset](https://preset.io/events/2021-05-18-visualize-your-data-lake-using-athena-and-superset)
- Visualizations
  - [Building Custom Viz Plugins](https://superset.apache.org/docs/installation/building-custom-viz-plugins)
  - [Managing and Deploying Custom Viz Plugins](https://medium.com/nmc-techblog/apache-superset-manage-custom-viz-plugins-in-production-9fde1a708e55)
  - [Why Apache Superset is Betting on Apache ECharts](https://preset.io/blog/2021-4-1-why-echarts/)
- [Superset API](https://superset.apache.org/docs/rest-api)
