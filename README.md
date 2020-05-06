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
[![dependencies Status](https://david-dm.org/apache/incubator-superset/status.svg?path=superset-frontend)](https://david-dm.org/apache/incubator-superset?path=superset-frontend)

<img
  src="https://cloud.githubusercontent.com/assets/130878/20946612/49a8a25c-bbc0-11e6-8314-10bef902af51.png"
  alt="Superset"
  width="500"
/>

A modern, enterprise-ready business intelligence web application.

[**Why Superset**](#why-superset) | 
[**Database Support**](#database-support) |
[**Installation and Configuration**](#installation-and-configuration) |
[**Get Help**](#get-help) |
[**Contributor Guide**](#contributor-guide) |
[**Resources**](#resources) |
[**Superset Users**](#superset-users) |
[**License**](#license) |


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


## Database Support

Superset speaks many SQL dialects through SQLAlchemy - a Python
SQL toolkit that is compatible with most databases. A list of
supported databases can be found
[here](https://superset.incubator.apache.org/#databases).


## Installation and Configuration

[See in the documentation](https://superset.incubator.apache.org/installation.html)


## Get Help

* [Stackoverflow tag](https://stackoverflow.com/questions/tagged/apache-superset)
* [Join Community Slack](https://join.slack.com/t/apache-superset/shared_invite/enQtNDMxMDY5NjM4MDU0LWJmOTcxYjlhZTRhYmEyYTMzOWYxOWEwMjcwZDZiNWRiNDY2NDUwNzcwMDFhNzE1ZmMxZTZlZWY0ZTQ2MzMyNTU)
* [Mailing list](https://lists.apache.org/list.html?dev@superset.apache.org)


## Contributor Guide

Interested in contributing? Check out
[Contributing.MD](https://github.com/apache/superset/blob/master/CONTRIBUTING.md) to learn how to contribute and best practices.


## Resources

* [Blog](https://preset.io/blog/)
* [Docker image](https://hub.docker.com/r/preset/superset/)

## Superset Users

Here's a list of organizations that have taken the time to send a PR to let
the world know they are using Superset. If you are a user and want to be recognized,
all you have to do is file a simple PR [like this one](https://github.com/apache/incubator-superset/pull/7576). 
Join our growing community!

 1. [6play](https://www.6play.fr) [@CoryChaplin]
 1. [AiHello](https://www.aihello.com) [@ganeshkrishnan1]
 1. [Airbnb](https://github.com/airbnb) 
 1. [Airboxlab](https://foobot.io) [@antoine-galataud]
 1. [Aktia Bank plc](https://www.aktia.com) [@villebro]
 1. [American Express](https://www.americanexpress.com) [@TheLastSultan]
 1. [Amino](https://amino.com) [@shkr]
 1. [Apollo GraphQL](https://www.apollographql.com/) [@evans]
 1. [Ascendica Development](http://ascendicadevelopment.com) [@davidhassan]
 1. [Astronomer](https://www.astronomer.io) [@ryw]
 1. [bilibili](https://www.bilibili.com) [@Moinheart]
 1. [Brilliant.org](https://brilliant.org/) 
 1. [Capital Service S.A.](http://capitalservice.pl) [@pkonarzewski]
 1. [Clark.de](http://clark.de/) 
 1. [Cloudsmith](https://cloudsmith.io) [@alancarson]
 1. [CnOvit](http://www.cnovit.com/) [@xieshaohu]
 1. [Deepomatic](https://deepomatic.com/) [@Zanoellia]
 1. [Dial Once](https://www.dial-once.com/en/) 
 1. [Digit Game Studios](https://www.digitgaming.com/)
 1. [Douban](https://www.douban.com/) [@luchuan]
 1. [Dragonpass](https://www.dragonpass.com.cn/) [@zhxjdwh]
 1. [Dremio](https://dremio.com) [@narendrans]
 1. [Endress+Hauser](http://www.endress.com/) [@rumbin]
 1. [Faasos](http://faasos.com/) [@shashanksingh]
 1. [Fanatics](https://www.fanatics.com) [@coderfender]
 1. [FBK - ICT center](http://ict.fbk.eu) 
 1. [Fordeal](http://www.fordeal.com) [@Renkai]
 1. [GFG - Global Fashion Group](https://global-fashion-group.com) [@ksaagariconic]
 1. [GfK Data Lab](http://datalab.gfk.com) [@mherr]
 1. [Grassroot](https://www.grassrootinstitute.org/) 
 1. [Hostnfly](https://www.hostnfly.com/) [@alexisrosuel]
 1. [HuiShouBao](http://www.huishoubao.com/) [@Yukinoshita-Yukino]
 1. [Intercom](https://www.intercom.com/) [@kate-gallo]
 1. [jampp](https://jampp.com/) 
 1. [komoot](https://www.komoot.com/) [@christophlingg]
 1. [Konfío](http://konfio.mx) [@uis-rodriguez]
 1. [Kuaishou](https://www.kuaishou.com/) [@zhaoyu89730105]
 1. [Let's Roam](https://www.letsroam.com/) 
 1. [Lime](https://www.limebike.com/) [@cxmcc]
 1. [Living Goods](https://www.livinggoods.org) [@chelule]
 1. [Lyft](https://www.lyft.com/) 
 1. [Maieutical Labs](https://maieuticallabs.it) [@xrmx]
 1. [Myra Labs](http://www.myralabs.com/) [@viksit]
 1. [Now](https://www.now.vn/) [@davidkohcw]
 1. [Ona](https://ona.io) [@pld]
 1. [Peak AI](https://www.peak.ai/) [@azhar22k]
 1. [PeopleDoc](https://www.people-doc.com) [@rodo]
 1. [Popoko VM Games Studio](https://popoko.live) 
 1. [Preset, Inc.](https://preset.io) 
 1. [Pronto Tools](http://www.prontotools.io) [@zkan]
 1. [PubNub](https://pubnub.com) [@jzucker2]
 1. [QPID Health](http://www.qpidhealth.com/) 
 1. [Qunar](https://www.qunar.com/) [@flametest]
 1. [Rakuten Viki](https://www.viki.com) 
 1. [Reward Gateway](https://www.rewardgateway.com) 
 1. [Safaricom](https://www.safaricom.co.ke/) [@mmutiso]
 1. [Scoot](https://scoot.co/) [@haaspt]
 1. [ScopeAI](https://www.getscopeai.com) [@iloveluce]
 1. [Shopee](https://shopee.sg) [@xiaohanyu]
 1. [Shopkick](https://www.shopkick.com) [@LAlbertalli]
 1. [Showmax](https://tech.showmax.com) [@bobek]
 1. [source{d}](https://www.sourced.tech) [@marnovo]
 1. [Steamroot](https://streamroot.io/) 
 1. [Tails.com](https://tails.com) [@alanmcruickshank]
 1. [Tenable](https://www.tenable.com) [@dflionis]
 1. [THE ICONIC](http://theiconic.com.au/) [@ksaagariconic]
 1. [timbr.ai](https://timbr.ai/) [@semantiDan]
 1. [TME QQMUSIC/WESING](https://www.tencentmusic.com/) 
 1. [Tobii](http://www.tobii.com/) [@dwa]
 1. [Tooploox](https://www.tooploox.com/) [@jakubczaplicki]
 1. [TrustMedis](https://trustmedis.com) [@famasya]
 1. [Twitter](https://twitter.com/) 
 1. [Udemy](https://www.udemy.com/) [@sungjuly]
 1. [VIPKID](https://www.vipkid.com.cn/) [@illpanda]
 1. [WeSure](https://www.wesure.cn/) 
 1. [Windsor.ai](https://www.windsor.ai/) [@octaviancorlade]
 1. [Yahoo!](https://yahoo.com/) 
 1. [Zaihang](http://www.zaih.com/)
 1. [Zalando](https://www.zalando.com) [@dmigo]
 1. [Zalora](https://www.zalora.com) [@ksaagariconic]

## License

```
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
```
