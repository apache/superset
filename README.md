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

## Slack Community Guidelines

If you decide to join the [Community Slack](https://join.slack.com/t/apache-superset/shared_invite/enQtNDMxMDY5NjM4MDU0LWJmOTcxYjlhZTRhYmEyYTMzOWYxOWEwMjcwZDZiNWRiNDY2NDUwNzcwMDFhNzE1ZmMxZTZlZWY0ZTQ2MzMyNTU), please adhere to the following rules:

**1. Treat everyone in the community with respect.**

- We strive to make this community a warm place for people from all industries, use cases, geographies, and backgrounds. Harassment of any kind is not acceptable and won’t be tolerated. 
- Please follow the guidelines as outlined in the Superset Community [code of conduct here](https://github.com/apache/incubator-superset/blob/master/CODE_OF_CONDUCT.md).

**2. Use the right channel.** 

- Channels are an effective way to organize and focus discussions while also empowering members to opt-in to the types of content they’re interested in. When questions are posted or discussions are started in the wrong channel, it dilutes the trust of the members in the channel and, more practically, makes it harder for your questions to be answered.  

**3. Ask thoughtful questions.**

- We’re all here to help each other out. The best way to get help is by investing effort into your questions. First check and see if your question is answered in [the Superset documentation](https://superset.incubator.apache.org/faq.html) or on [Stack Overflow](https://stackoverflow.com/search?q=apache+superset). You can also check [Github issues](https://github.com/apache/incubator-superset/issues) to see if your question or feature request has been submitted before. Then, use Slack search to see if your question has already been asked and answered in the past. If you still feel the need to ask a question, make sure you include:

- The steps you’ve already taken
- Relevant details presented cleanly (text stacktraces, formatted markdown, or screenshots. Please don’t paste large blocks of code unformatted or post photos of your screen from your phone)
- The specific question you have or the specific type of help you're seeking

**4. Avoid double posting**

- This Slack community is not a customer support channel and all members are here voluntarily. If you aren’t getting a response to a question you have, make sure you look at rules 1, 2, and 3.  It’s also worth remembering that there may not be someone in the community who has the context to help you out.

**5. Communicate openly**

- Unless you have explicit permission from the person, please avoid sending direct messages to individuals. Communicating in public channels ensures that we’re all respecting each other’s attentions and we can scalably moderate our communication to mitigate harassment or discrimination. Do not use direct messages to pitch products and services. If you are receiving unwelcome direct messages, please notify an admin.

**6. Practice good Slack hygiene by using threads for discussions and emojis for light reactions.**

- The medium is the message. Slack can foster a warm, collaborative, and organized community when used effectively. We want to respect people’s attentions (thread notifications > channel notifications > DM notifications) and we want to improve information density (a member should be able to browse and explore many convo threads, not just see one thread discussed in a top level channel).



## Contributor Guide

Interested in contributing? Check out
[Contributing.MD](https://github.com/apache/superset/blob/master/CONTRIBUTING.md) to learn how to contribute and best practices.


## Resources

* Superset 101 -- Getting Started Guide (From [Preset](https://preset.io) [Blog](https://preset.io/blog/))
  * [Installing Apache Superset Locally](https://preset.io/blog/2020-05-11-getting-started-installing-superset/)
  * [Installing Database Drivers](https://preset.io/blog/2020-05-18-install-db-drivers/)
  * [Connect Superset To Google Sheets](https://preset.io/blog/2020-06-01-connect-superset-google-sheets/)
  * [Create Your First Chart](https://preset.io/blog/2020-06-08-first-chart/)
* [Docker image](https://hub.docker.com/r/preset/superset/)
* [Youtube Channel](https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g)
  * [May 15, 2020: Virtual Meetup Recording. Topics: 0.36 Overview, Committers Self-Intro, Roadmap](https://www.youtube.com/watch?v=tXGDmqjmcTs&t=20s)

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
 1. [DouroECI](http://douroeci.com/en/) [@nunohelibeires]
 1. [Dragonpass](https://www.dragonpass.com.cn/) [@zhxjdwh]
 1. [Dremio](https://dremio.com) [@narendrans]
 1. [ELMO Cloud HR & Payroll](https://elmosoftware.com.au/)
 1. [Endress+Hauser](http://www.endress.com/) [@rumbin]
 1. [Faasos](http://faasos.com/) [@shashanksingh]
 1. [Fanatics](https://www.fanatics.com) [@coderfender]
 1. [FBK - ICT center](http://ict.fbk.eu) 
 1. [Fordeal](http://www.fordeal.com) [@Renkai]
 1. [GFG - Global Fashion Group](https://global-fashion-group.com) [@ksaagariconic]
 1. [GfK Data Lab](http://datalab.gfk.com) [@mherr]
 1. [Grassroot](https://www.grassrootinstitute.org/) 
 1. [GrowthSimple](https://growthsimple.ai/)
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
 1. [Nielsen](http://www.nielsen.com/) [@amitNielsen]
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
 1. [Whale](http://whale.im)
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
