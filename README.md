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

[![Build Status](https://travis-ci.org/apache/incubator-superset.svg?branch=master)](https://travis-ci.org/apache/incubator-superset)
[![PyPI version](https://badge.fury.io/py/apache-superset.svg)](https://badge.fury.io/py/apache-superset)
[![Coverage Status](https://codecov.io/github/apache/incubator-superset/coverage.svg?branch=master)](https://codecov.io/github/apache/incubator-superset)
[![PyPI](https://img.shields.io/pypi/pyversions/apache-superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/apache-superset)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](https://join.slack.com/t/apache-superset/shared_invite/enQtNDMxMDY5NjM4MDU0LWJmOTcxYjlhZTRhYmEyYTMzOWYxOWEwMjcwZDZiNWRiNDY2NDUwNzcwMDFhNzE1ZmMxZTZlZWY0ZTQ2MzMyNTU)
[![Documentation](https://img.shields.io/badge/docs-apache.org-blue.svg)](https://superset.incubator.apache.org)
[![dependencies Status](https://david-dm.org/apache/incubator-superset/status.svg?path=superset/assets)](https://david-dm.org/apache/incubator-superset?path=superset/assets)

<img
  src="https://cloud.githubusercontent.com/assets/130878/20946612/49a8a25c-bbc0-11e6-8314-10bef902af51.png"
  alt="Superset"
  width="500"
/>

**Apache Superset** (incubating) is a modern, enterprise-ready
business intelligence web application

[this project used to be named **Caravel**, and **Panoramix** in the past]


Screenshots & Gifs
------------------

**View Dashboards**

<kbd><img title="View Dashboards" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset/assets/images/screenshots/bank_dash.png"></kbd><br/>

**Slice & dice your data**

<kbd><img title="Slice & dice your data" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset/assets/images/screenshots/explore.png"></kbd><br/>

**Query and visualize your data with SQL Lab**

<kbd><img title="SQL Lab" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset/assets/images/screenshots/sqllab.png"></kbd><br/>

**Visualize geospatial data with deck.gl**

<kbd><img title="Geospatial" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset/assets/images/screenshots/deckgl_dash.png"></kbd><br/>

**Choose from a wide array of visualizations**

<kbd><img title="Visualizations" src="https://raw.githubusercontent.com/apache/incubator-superset/master/superset/assets/images/screenshots/visualizations.png"></kbd><br/>

Apache Superset
---------------
Apache Superset is a data exploration and visualization web application.

Superset provides:
* An intuitive interface to explore and visualize datasets, and
    create interactive dashboards.
* A wide array of beautiful visualizations to showcase your data.
* Easy, code-free, user flows to drill down and slice and dice the data
    underlying exposed dashboards. The dashboards and charts acts as a starting
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


Database Support
----------------

Superset speaks many SQL dialects through SQLAlchemy, a Python
ORM that is compatible with
[most common databases](https://docs.sqlalchemy.org/en/rel_1_2/core/engines.html).

A list of currently supported SQL databases can be found
[here](https://superset.incubator.apache.org/#databases).

Apache Druid (Incubating)!
------

On top of having the ability to query your relational databases,
Superset ships with deep integration with Druid (a real time distributed
column-store). When querying Druid,
Superset can query humongous amounts of data on top of real time dataset.
Note that Superset does not require Druid in any way to function, it's simply
another database backend that it can query.

Here's a description of Druid from the http://druid.io website:

*Druid is an open-source analytics data store designed for
business intelligence (OLAP) queries on event data. Druid provides low
latency (real-time) data ingestion, flexible data exploration,
and fast data aggregation. Existing Druid deployments have scaled to
trillions of events and petabytes of data. Druid is best used to
power analytic dashboards and applications.*


Installation & Configuration
----------------------------

[See in the documentation](https://superset.incubator.apache.org/installation.html)


Resources
-------------
* [Mailing list](https://lists.apache.org/list.html?dev@superset.apache.org)
* [Docker image](https://hub.docker.com/r/amancevice/superset/) (community contributed)
* [Slides from Strata (March 2016)](https://drive.google.com/open?id=0B5PVE0gzO81oOVJkdF9aNkJMSmM)
* [Stackoverflow tag](https://stackoverflow.com/questions/tagged/apache-superset)
* [Join our Slack](https://join.slack.com/t/apache-superset/shared_invite/enQtNDMxMDY5NjM4MDU0LWJmOTcxYjlhZTRhYmEyYTMzOWYxOWEwMjcwZDZiNWRiNDY2NDUwNzcwMDFhNzE1ZmMxZTZlZWY0ZTQ2MzMyNTU)
* [DEPRECATED Google Group](https://groups.google.com/forum/#!forum/airbnb_superset)


Contributing
------------

Interested in contributing? Casual hacking? Check out
[Contributing.MD](https://github.com/airbnb/superset/blob/master/CONTRIBUTING.md)


Who uses Apache Superset (incubating)?
--------------------------------------

Here's a list of organizations who have taken the time to send a PR to let
the world know they are using Superset. Join our growing community!

 1. [6play](https://www.6play.fr)
 1. [AiHello](https://www.aihello.com)
 1. [Airbnb](https://github.com/airbnb)
 1. [Airboxlab](https://foobot.io)
 1. [Aktia Bank plc](https://www.aktia.com)
 1. [American Express](https://www.americanexpress.com)
 1. [Amino](https://amino.com)
 1. [Apollo GraphQL](https://www.apollographql.com/)
 1. [Ascendica Development](http://ascendicadevelopment.com)
 1. [Astronomer](https://www.astronomer.io)
 1. [bilibili](https://www.bilibili.com)
 1. [Brilliant.org](https://brilliant.org/)
 1. [Capital Service S.A.](http://capitalservice.pl)
 1. [Clark.de](http://clark.de/)
 1. [Cloudsmith](https://cloudsmith.io)
 1. [CnOvit](http://www.cnovit.com/)
 1. [Deepomatic](https://deepomatic.com/)
 1. [Dial Once](https://www.dial-once.com/en/)
 1. [Digit Game Studios](https://www.digitgaming.com/)
 1. [Douban](https://www.douban.com/)
 1. [Endress+Hauser](http://www.endress.com/)
 1. [Faasos](http://faasos.com/)
 1. [Fanatics](https://www.fanatics.com)
 1. [FBK - ICT center](http://ict.fbk.eu)
 1. [Fordeal](http://www.fordeal.com)
 1. [GFG - Global Fashion Group](https://global-fashion-group.com)
 1. [GfK Data Lab](http://datalab.gfk.com)
 1. [Grassroot](https://www.grassrootinstitute.org/)
 1. [Hostnfly](https://www.hostnfly.com/)
 1. [HuiShouBao](http://www.huishoubao.com/)
 1. [Intercom](https://www.intercom.com/)
 1. [jampp](https://jampp.com/)
 1. [komoot](https://www.komoot.com/)
 1. [Konfío](http://konfio.mx)
 1. [Kuaishou](https://www.kuaishou.com/)
 1. [Lime](https://www.limebike.com/)
 1. [Living Goods](https://www.livinggoods.org)
 1. [Lyft](https://www.lyft.com/)
 1. [Maieutical Labs](https://maieuticallabs.it)
 1. [Myra Labs](http://www.myralabs.com/)
 1. [Now](https://www.now.vn/)
 1. [Ona](https://ona.io)
 1. [PeopleDoc](https://www.people-doc.com)
 1. [Popoko VM Games Studio](https://popoko.live)
 1. [Pronto Tools](http://www.prontotools.io)
 1. [QPID Health](http://www.qpidhealth.com/    )
 1. [Qunar](https://www.qunar.com/)
 1. [Safaricom](https://www.safaricom.co.ke/)
 1. [Scoot](https://scoot.co/)
 1. [ScopeAI](https://www.getscopeai.com)
 1. [Shopee](https://shopee.sg)
 1. [Shopkick](https://www.shopkick.com)
 1. [Showmax](https://tech.showmax.com)
 1. [source{d}](https://www.sourced.tech)
 1. [Steamroot](https://streamroot.io/)
 1. [Tails.com](https://tails.com)
 1. [Tenable](https://www.tenable.com)
 1. [THE ICONIC](http://theiconic.com.au/)
 1. [TME QQMUSIC/WESING](https://www.tencentmusic.com/)
 1. [Tobii](http://www.tobii.com/)
 1. [Tooploox](https://www.tooploox.com/)
 1. [TrustMedis](https://trustmedis.com)
 1. [Twitter](https://twitter.com/)
 1. [Udemy](https://www.udemy.com/)
 1. [VIPKID](https://www.vipkid.com.cn/)
 1. [WeSure](https://www.wesure.cn/)
 1. [Windsor.ai](https://www.windsor.ai/)
 1. [WP-Semantix](https://wpsemantix.com/)
 1. [Yahoo!](https://yahoo.com/)
 1. [Zaihang](http://www.zaih.com/)
 1. [Zalando](https://www.zalando.com)
 1. [Zalora](https://www.zalora.com)
