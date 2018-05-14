Superset
=========

[![Build Status](https://travis-ci.org/apache/incubator-superset.svg?branch=master)](https://travis-ci.org/apache/incubator-superset)
[![PyPI version](https://badge.fury.io/py/superset.svg)](https://badge.fury.io/py/superset)
[![Coverage Status](https://codecov.io/github/apache/incubator-superset/coverage.svg?branch=master)](https://codecov.io/github/apache/incubator-superset)
[![PyPI](https://img.shields.io/pypi/pyversions/superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/superset)
[![Join the chat at https://gitter.im/airbnb/superset](https://badges.gitter.im/apache/incubator-superset.svg)](https://gitter.im/airbnb/superset?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
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
[most common databases](http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html).

Superset can be used to visualize data out of most databases:
* MySQL
* Postgres
* Vertica
* Oracle
* Microsoft SQL Server
* SQLite
* Greenplum
* Firebird
* MariaDB
* Sybase
* IBM DB2
* Exasol
* MonetDB
* Snowflake
* Redshift
* **more!** look for the availability of a SQLAlchemy dialect for your database
  to find out whether it will work with Superset


Druid!
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
* [Gitter (live chat) Channel](https://gitter.im/airbnb/superset)
* [Docker image](https://hub.docker.com/r/amancevice/superset/) (community contributed)
* [Slides from Strata (March 2016)](https://drive.google.com/open?id=0B5PVE0gzO81oOVJkdF9aNkJMSmM)
* [Stackoverflow tag](https://stackoverflow.com/questions/tagged/apache-superset)
* [DEPRECATED Google Group](https://groups.google.com/forum/#!forum/airbnb_superset)


Contributing
------------

Interested in contributing? Casual hacking? Check out
[Contributing.MD](https://github.com/airbnb/superset/blob/master/CONTRIBUTING.md)


Who uses Apache Superset (incubating)?
--------------------------------------

Here's a list of organizations who have taken the time to send a PR to let
the world know they are using Superset. Join our growing community!

 - [AiHello](https://www.aihello.com)
 - [Airbnb](https://github.com/airbnb)
 - [Airboxlab](https://foobot.io)
 - [Aktia Bank plc](https://www.aktia.com)
 - [Amino](https://amino.com)
 - [Ascendica Development](http://ascendicadevelopment.com)
 - [Astronomer](https://www.astronomer.io)
 - [Brilliant.org](https://brilliant.org/)
 - [Capital Service S.A.](http://capitalservice.pl)
 - [Clark.de](http://clark.de/)
 - [Digit Game Studios](https://www.digitgaming.com/)
 - [Douban](https://www.douban.com/)
 - [Endress+Hauser](http://www.endress.com/)
 - [FBK - ICT center](http://ict.fbk.eu)
 - [Faasos](http://faasos.com/)
 - [GfK Data Lab](http://datalab.gfk.com)
 - [Konfío](http://konfio.mx)
 - [Lyft](https://www.lyft.com/)
 - [Maieutical Labs](https://cloudschooling.it)
 - [PeopleDoc](https://www.people-doc.com)
 - [Ona](https://ona.io)
 - [Pronto Tools](http://www.prontotools.io)
 - [Qunar](https://www.qunar.com/)
 - [ScopeAI](https://www.getscopeai.com)
 - [Shopee](https://shopee.sg)
 - [Shopkick](https://www.shopkick.com)
 - [Tails.com](https://tails.com)
 - [Tobii](http://www.tobii.com/)
 - [Tooploox](https://www.tooploox.com/)
 - [Twitter](https://twitter.com/)
 - [Udemy](https://www.udemy.com/)
 - [VIPKID](https://www.vipkid.com.cn/)
 - [Windsor.ai](https://www.windsor.ai/)
 - [Yahoo!](https://yahoo.com/)
 - [Zaihang](http://www.zaih.com/)
 - [Zalando](https://www.zalando.com)
