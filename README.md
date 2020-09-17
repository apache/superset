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
![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/apache/incubator-superset)
[![Build Status](https://travis-ci.org/apache/incubator-superset.svg?branch=master)](https://travis-ci.org/apache/incubator-superset)
[![PyPI version](https://badge.fury.io/py/apache-superset.svg)](https://badge.fury.io/py/apache-superset)
[![Coverage Status](https://codecov.io/github/apache/incubator-superset/coverage.svg?branch=master)](https://codecov.io/github/apache/incubator-superset)
[![PyPI](https://img.shields.io/pypi/pyversions/apache-superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/apache-superset)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](https://join.slack.com/t/apache-superset/shared_invite/zt-g8lpruog-HeqpgYrwdfrD5OYhlU7hPQ)
[![Documentation](https://img.shields.io/badge/docs-apache.org-blue.svg)](https://superset.apache.org)
[![Dependencies Status](https://david-dm.org/apache/incubator-superset/status.svg?path=superset-frontend)](https://david-dm.org/apache/incubator-superset?path=superset-frontend)

<img
  src="https://cloud.githubusercontent.com/assets/130878/20946612/49a8a25c-bbc0-11e6-8314-10bef902af51.png"
  alt="Superset"
  width="500"
/>

A modern, enterprise-ready business intelligence web application.

[**Why Superset**](#why-superset) |
[**Supported Databases**](#supported-databases) |
[**Installation and Configuration**](#installation-and-configuration) |
[**Get Help**](#get-help) |
[**Contributor Guide**](#contributor-guide) |
[**Resources**](#resources) |
[**Superset Users**](INTHEWILD.md)


## Screenshots & Gifs

**View Dashboards**

<kbd><img title="View Dashboards" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset-frontend/images/screenshots/bank_dash.png"></kbd><br/>

**Slice & dice your data**

<kbd><img title="Slice & dice your data" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset-frontend/images/screenshots/explore.png"></kbd><br/>

**Query and visualize your data with SQL Lab**

<kbd><img title="SQL Lab" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset-frontend/images/screenshots/sqllab.png"></kbd><br/>

**Visualize geospatial data with deck.gl**

<kbd><img title="Geospatial" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset-frontend/images/screenshots/deckgl_dash.png"></kbd><br/>

**Choose from a wide array of visualizations**

<kbd><img title="Visualizations" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset-frontend/images/screenshots/visualizations.png"></kbd><br/>

## Why Superset

Superset provides:
* An intuitive interface to explore and visualize datasets, and
    create interactive dashboards.
* A wide array of beautiful visualizations to showcase your data.
* Easy, code-free, user flows to drill down and slice and dice the data
    underlying exposed dashboards. The dashboards and charts act as a starting
    point for deeper analysis.
* A state of the art SQL editor/IDE exposing a rich metadata browser, and
    an easy workflow to create visualizations out of any result set.
* An extensible, high granularity security model allowing intricate rules
    on who can access which product features and datasets.
    Integration with major
    authentication backends (database, OpenID, LDAP, OAuth, REMOTE_USER, ...)
* A lightweight semantic layer, allowing to control how data sources are
    exposed to the user by defining dimensions and metrics
* Out of the box support for most SQL-speaking databases
* Deep integration with Druid allows for Superset to stay blazing fast while
    slicing and dicing large, realtime datasets
* Fast loading dashboards with configurable caching


## Supported Databases

Superset speaks many SQL dialects through SQLAlchemy - a Python
SQL toolkit that is compatible with most databases. Here are some of the major database solutions that are supported:

<p align="center">
  <img src="superset-frontend/images/redshift.png" alt="redshift" border="0" width="106" height="41"/>
  <img src="superset-frontend/images/google-biquery.png" alt="google-biquery" border="0" width="114" height="43"/>
  <img src="superset-frontend/images/snowflake.png" alt="snowflake" border="0" width="152" height="46"/>
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
</p>

A complete list of supported databases can be found
[here](https://superset.incubator.apache.org/docs/databases/installing-database-drivers).


## Installation and Configuration

[See in the documentation](https://superset.incubator.apache.org/docs/installation/installing-superset-using-docker-compose)


## Get Involved

* Ask and answer questions on [StackOverflow](https://stackoverflow.com/questions/tagged/apache-superset)
* [Join our community's Slack](https://join.slack.com/t/apache-superset/shared_invite/zt-g8lpruog-HeqpgYrwdfrD5OYhlU7hPQ)
  and please read our [Slack Community Guidelines](CODE_OF_CONDUCT.md#slack-community-guidelines)
* [Join our dev@superset.apache.org Mailing list](https://lists.apache.org/list.html?dev@superset.apache.org)


## Contributor Guide

Interested in contributing? Check out our
[CONTRIBUTING.md](https://github.com/apache/superset/blob/master/CONTRIBUTING.md)
to find resources around contributing along with a detailed guide on
how to set up a development environment.


## Resources

* Superset 101 -- Getting Started Guide (From [Preset](https://preset.io) [Blog](https://preset.io/blog/))
  * [Installing Apache Superset Locally](https://preset.io/blog/2020-05-11-getting-started-installing-superset/)
  * [Installing Database Drivers](https://preset.io/blog/2020-05-18-install-db-drivers/)
  * [Connect Superset To Google Sheets](https://preset.io/blog/2020-06-01-connect-superset-google-sheets/)
  * [Create Your First Chart](https://preset.io/blog/2020-06-08-first-chart/)
  * [Create Time Series Charts](https://preset.io/blog/2020-06-26-timeseries-chart/)
* [Docker image](https://hub.docker.com/r/preset/superset/)
* [Youtube Channel](https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g)
  * [May 15, 2020: Virtual Meetup Recording. Topics: 0.36 Overview, Committers Self-Intro, Roadmap](https://www.youtube.com/watch?v=tXGDmqjmcTs&t=20s)
  * [July 16, 2020: Virtual Meetup Recording. Topics: Visualization Plugins, 0.37 Preview, Demo](https://www.youtube.com/watch?v=f6up5x_iRbI)
* [So, You Want to Build a Superset Viz Plugin...](https://preset.io/blog/2020-07-02-hello-world/)
