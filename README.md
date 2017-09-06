Superset
=========

[![Build Status](https://travis-ci.org/apache/incubator-superset.svg?branch=master)](https://travis-ci.org/apache/incubator-superset)
[![PyPI version](https://badge.fury.io/py/superset.svg)](https://badge.fury.io/py/superset)
[![Coverage Status](https://coveralls.io/repos/apache/incubator-superset/badge.svg?branch=master&service=github)](https://coveralls.io/github/apache/incubator-superset?branch=master)
[![PyPI](https://img.shields.io/pypi/pyversions/superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/superset)
[![Requirements Status](https://requires.io/github/apache/incubator-superset/requirements.svg?branch=master)](https://requires.io/github/apache/incubator-superset/requirements/?branch=master)
[![Join the chat at https://gitter.im/apache/incubator-superset](https://badges.gitter.im/apache/incubator-superset.svg)](https://gitter.im/apache/incubator-superset?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
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

![superset-dashboard](https://cloud.githubusercontent.com/assets/130878/20371438/a703a2a0-ac19-11e6-80c4-00a47c2eb644.gif)

<br/>

**View/Edit a Slice**

![superset-explore-slice](https://cloud.githubusercontent.com/assets/130878/20372732/410392f4-ac22-11e6-9c6d-3ef512e81212.gif)

<br/>

**Query and Visualize with SQL Lab**

![superset-sql-lab-visualization](https://cloud.githubusercontent.com/assets/130878/20372911/7c3b3358-ac23-11e6-8f24-923ef1b35715.gif)

<br/>

![superset-dashboard-misc](https://cloud.githubusercontent.com/assets/130878/20234704/0f40778c-a835-11e6-9556-983a62ea061b.png)

![superset-edit-table](https://cloud.githubusercontent.com/assets/130878/20234705/0f415c88-a835-11e6-8b03-f7c35d56dd7d.png)

![superset-query-search](https://cloud.githubusercontent.com/assets/130878/20234706/0f430a10-a835-11e6-8a0d-8b26cc2e6bbd.png)

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
Superset has ships with deep integration with Druid (a real time distributed
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


More screenshots
----------------

![superset-security-menu](https://cloud.githubusercontent.com/assets/130878/20234707/0f565886-a835-11e6-9277-b4f5f4aa2fcc.png)

![superset-slice-bubble](https://cloud.githubusercontent.com/assets/130878/20234708/0f57f3d0-a835-11e6-8268-fcefe8f868c8.png)

![superset-slice-map](https://cloud.githubusercontent.com/assets/130878/20234709/0f5a5a44-a835-11e6-987a-1b6f8ac9922b.png)

![superset-slice-multiline](https://cloud.githubusercontent.com/assets/130878/20234710/0f632d68-a835-11e6-98d1-542dcb618193.png)

![superset-slice-sankey](https://cloud.githubusercontent.com/assets/130878/20234711/0f639136-a835-11e6-8721-fe5e48dab8e7.png)

![superset-slice-view](https://cloud.githubusercontent.com/assets/130878/20234712/0f63c4c6-a835-11e6-8595-6091a6428fa9.png)

![superset-sql-lab-2](https://cloud.githubusercontent.com/assets/130878/20234713/0f67b856-a835-11e6-9d50-7a52168f66fd.png)

![superset-sql-lab](https://cloud.githubusercontent.com/assets/130878/20234714/0f68f45a-a835-11e6-9467-f47ad0af7e79.png)


Resources
-------------
* [Superset Google Group](https://groups.google.com/forum/#!forum/airbnb_superset)
* [Gitter (live chat) Channel](https://gitter.im/airbnb/superset)
* [Docker image](https://hub.docker.com/r/amancevice/superset/) (community contributed)
* [Slides from Strata (March 2016)](https://drive.google.com/open?id=0B5PVE0gzO81oOVJkdF9aNkJMSmM)


Contributing
------------

Interested in contributing? Casual hacking? Check out
[Contributing.MD](https://github.com/airbnb/superset/blob/master/CONTRIBUTING.md)


Who uses Apache Superset (incubating)?
--------------------------------------

Here's a list of organizations who have taken the time to send a PR to let
the world know they are using Superset. Join our growing community!

 - [Airbnb](https://github.com/airbnb)
 - [Amino](https://amino.com)
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
 - [Maieutical Labs](https://cloudschooling.it)
 - [Qunar](https://www.qunar.com/)
 - [Shopkick](https://www.shopkick.com)
 - [Tails.com](https://tails.com)
 - [Tobii](http://www.tobii.com/)
 - [Tooploox](https://www.tooploox.com/)
 - [Udemy](https://www.udemy.com/)
 - [Yahoo!](https://yahoo.com/)
 - [Zalando](https://www.zalando.com)

