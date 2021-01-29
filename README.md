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

Superset
=========

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/apache/superset)
[![Build Status](https://github.com/apache/superset/workflows/Python/badge.svg)](https://github.com/apache/superset/actions)
[![PyPI version](https://badge.fury.io/py/apache-superset.svg)](https://badge.fury.io/py/apache-superset)
[![Coverage Status](https://codecov.io/github/apache/superset/coverage.svg?branch=master)](https://codecov.io/github/apache/superset)
[![PyPI](https://img.shields.io/pypi/pyversions/apache-superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/apache-superset)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](https://join.slack.com/t/apache-superset/shared_invite/zt-l5f5e0av-fyYu8tlfdqbMdz_sPLwUqQ)
[![Documentation](https://img.shields.io/badge/docs-apache.org-blue.svg)](https://superset.apache.org)
[![Dependencies Status](https://david-dm.org/apache/superset/status.svg?path=superset-frontend)](https://david-dm.org/apache/superset?path=superset-frontend)

<img
  src="https://github.com/apache/superset/raw/master/superset-frontend/branding/superset-logo-horiz-apache.png"
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
[**Organizations Using Superset**](INTHEWILD.md)


## Screenshots & Gifs

**Gallery**

<kbd><a href="https://superset.apache.org/gallery"><img title="Gallery" src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/screenshots/gallery.jpg"></a></kbd><br/>

**View Dashboards**

<kbd><img title="View Dashboards" src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/screenshots/slack_dash.jpg"></kbd><br/>

**Slice & dice your data**

<kbd><img title="Slice & dice your data" src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/screenshots/explore.jpg"></kbd><br/>

**Query and visualize your data with SQL Lab**

<kbd><img title="SQL Lab" src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/screenshots/sql_lab.jpg"></kbd><br/>

**Visualize geospatial data with deck.gl**

<kbd><img title="Geospatial" src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/screenshots/geospatial_dash.jpg"></kbd><br/>

**Choose from a wide array of visualizations**

<kbd><img title="Visualizations" src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/screenshots/explore_visualizations.jpg"></kbd><br/>


## Why Superset?

Superset provides:

* An intuitive interface for visualizing datasets and
    crafting interactive dashboards
* A wide array of beautiful visualizations to showcase your data
* Code-free visualization builder to extract and present datasets
* A world-class SQL IDE for preparing data for visualization, including a rich metadata browser
* A lightweight semantic layer which empowers data analysts to quickly define custom dimensions and metrics
* Out-of-the-box support for most SQL-speaking databases
* Seamless, in-memory asynchronous caching and queries
* An extensible security model that allows configuration of very intricate rules on
    on who can access which product features and datasets.
* Integration with major
    authentication backends (database, OpenID, LDAP, OAuth, REMOTE_USER, etc)
* The ability to add custom visualization plugins
* An API for programmatic customization
* A cloud-native archiecture designed from the ground up for scale

## Supported Databases

Superset can query data from any SQL-speaking datastore or data engine (e.g. Presto or Athena) that has a Python DB-API driver and a SQLAlchemy dialect.

Here are some of the major database solutions that are supported:

<p align="center">
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/redshift.png" alt="redshift" border="0" width="106" height="41"/>
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/google-biquery.png" alt="google-biquery" border="0" width="114" height="43"/>
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/snowflake.png" alt="snowflake" border="0" width="152" height="46"/>
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/presto.png" alt="presto" border="0" width="152" height="46"/>
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/druid.png" alt="druid" border="0" width="135" height="37" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/postgresql.png" alt="postgresql" border="0" width="132" height="81" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/mysql.png" alt="mysql" border="0" width="119" height="62" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/mssql-server.png" alt="mssql-server" border="0" width="93" height="74" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/db2.png" alt="db2" border="0" width="62" height="62" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/sqlite.png" alt="sqlite" border="0" width="102" height="45" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/sybase.png" alt="sybase" border="0" width="128" height="47" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/mariadb.png" alt="mariadb" border="0" width="83" height="63" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/vertica.png" alt="vertica" border="0" width="128" height="40" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/oracle.png" alt="oracle" border="0" width="121" height="66" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/firebird.png" alt="firebird" border="0" width="86" height="56" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/greenplum.png" alt="greenplum" border="0" width="140" height="45" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/clickhouse.png" alt="clickhouse" border="0" width="133" height="34" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/exasol.png" alt="exasol" border="0" width="106" height="59" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/monet-db.png" alt="monet-db" border="0" width="106" height="46" />
  <img src="https://raw.githubusercontent.com/apache/superset/master/superset-frontend/images/apache-kylin.png" alt="apache-kylin" border="0" width="56" height="64"/>
  <img src="superset-frontend/images/hologres.png" alt="hologres" border="0" width="71" height="64"/>
</p>

**A more comprehensive list of supported databases** along with the configuration instructions can be found
[here](https://superset.apache.org/docs/databases/installing-database-drivers).

Want to add support for your datastore or data engine? Read more [here](https://superset.apache.org/docs/frequently-asked-questions#does-superset-work-with-insert-database-engine-here) about the technical requirements.


## Installation and Configuration

[Extended documentation for Superset](https://superset.apache.org/docs/installation/installing-superset-using-docker-compose)

## Get Involved

* Ask and answer questions on [StackOverflow](https://stackoverflow.com/questions/tagged/apache-superset) using the **apache-superset** tag
* [Join our community's Slack](https://join.slack.com/t/apache-superset/shared_invite/zt-l5f5e0av-fyYu8tlfdqbMdz_sPLwUqQ)
  and please read our [Slack Community Guidelines](CODE_OF_CONDUCT.md#slack-community-guidelines)
* [Join our dev@superset.apache.org Mailing list](https://lists.apache.org/list.html?dev@superset.apache.org)


## Contributor Guide

Interested in contributing? Check out our
[CONTRIBUTING.md](https://github.com/apache/superset/blob/master/CONTRIBUTING.md)
to find resources around contributing along with a detailed guide on
how to set up a development environment.


## Resources

* Superset 1.0
  * [Superset 1.0 Milestone](https://superset.apache.org/docs/version-one)
  * [Superset 1.0 Release Notes](https://github.com/apache/superset/tree/master/RELEASING/release-notes-1-0)
  * [Presentation on Superset 1.0 Public Roadmap](https://docs.google.com/presentation/d/1FGgyI8tLWLUPSQ5eEno78bylLfobj9O2W4yoUoFYHH8/edit#slide=id.g9c182b81b9_1_0)
  * [Public Superset Roadmap](https://github.com/apache-superset/superset-roadmap/projects/1)
* Superset 101 -- Getting Started Guide (From [Preset Blog](https://preset.io/blog/))
  * [Installing Apache Superset Locally](https://preset.io/blog/2020-05-11-getting-started-installing-superset/)
  * [Installing Database Drivers](https://preset.io/blog/2020-05-18-install-db-drivers/)
  * [Connect Superset To Google Sheets](https://preset.io/blog/2020-06-01-connect-superset-google-sheets/)
  * [Create Your First Chart](https://preset.io/blog/2020-06-08-first-chart/)
  * [Create Time Series Charts](https://preset.io/blog/2020-06-26-timeseries-chart/)
* [Documentation for End-Users (by Preset)](https://docs.preset.io/)
* [Docker image](https://hub.docker.com/r/apache/superset)
* [Recordings of Community Events](https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g)
  * [May 2020: Virtual Meetup. Topics: 0.36 Overview, Committers Self-Intro, Roadmap](https://www.youtube.com/watch?v=tXGDmqjmcTs&t=20s)
  * [July 2020: Virtual Meetup. Topics: Visualization Plugins, 0.37 Preview, Demo](https://www.youtube.com/watch?v=f6up5x_iRbI)
  * [November 2020: Virtual Meetup. Topics: Superset 1.0 & the Roadmap](https://www.youtube.com/watch?v=GwtWRUSEjk4)
  * [November 2020: Live Demo. Topic: Superset Semantic Layer](https://www.youtube.com/watch?v=8VL4ZPLFUYI)
  * [December 2020: Live Demo. Topic: Annotations](https://www.youtube.com/watch?v=Yk6bKgphj1Q)
* Custom Visualizations
  * [Building Custom Viz Plugins](https://superset.apache.org/docs/installation/building-custom-viz-plugins)
  * [Managing and Deploying Custom Viz Plugins](https://medium.com/nmc-techblog/apache-superset-manage-custom-viz-plugins-in-production-9fde1a708e55)
* [Superset API](https://superset.apache.org/docs/rest-api)
