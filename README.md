Superset
=========

[![Build Status](https://travis-ci.org/airbnb/superset.svg?branch=master)](https://travis-ci.org/airbnb/superset)
[![PyPI version](https://badge.fury.io/py/superset.svg)](https://badge.fury.io/py/superset)
[![Coverage Status](https://coveralls.io/repos/airbnb/superset/badge.svg?branch=master&service=github)](https://coveralls.io/github/airbnb/superset?branch=master)
[![JS Test Coverage](https://codeclimate.com/github/airbnb/superset/badges/coverage.svg)](https://codeclimate.com/github/airbnb/superset/coverage)
[![Code Health](https://landscape.io/github/airbnb/superset/master/landscape.svg?style=flat)](https://landscape.io/github/airbnb/superset/master)
[![Code Climate](https://codeclimate.com/github/airbnb/superset/badges/gpa.svg)](https://codeclimate.com/github/airbnb/superset)
[![PyPI](https://img.shields.io/pypi/pyversions/superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/superset)
[![Requirements Status](https://requires.io/github/airbnb/superset/requirements.svg?branch=master)](https://requires.io/github/airbnb/superset/requirements/?branch=master)
[![Join the chat at https://gitter.im/airbnb/superset](https://badges.gitter.im/airbnb/superset.svg)](https://gitter.im/airbnb/superset?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Documentation](https://img.shields.io/badge/docs-airbnb.io-blue.svg)](http://airbnb.io/superset/)
[![dependencies Status](https://david-dm.org/airbnb/superset/status.svg?path=superset/assets)](https://david-dm.org/airbnb/superset?path=superset/assets)

**Superset** is a data exploration platform designed to be visual, intuitive
and interactive.

[this project used to be named **Caravel**, and **Panoramix** in the past]


Screenshots & Gifs
------------------
![img](http://g.recordit.co/xFXSvaGUts.gif)

---
![img](http://g.recordit.co/uZggYOdR5g.gif)

---
![img](http://g.recordit.co/U70FWLpLvh.gif)

---
![img](http://i.imgur.com/x8t30YU.png)

---
![img](http://i.imgur.com/DRCnbq6.png)

Superset
---------
Superset's main goal is to make it easy to slice, dice and visualize data.
It empowers users to perform **analytics at the speed of thought**.

Superset provides:
* A quick way to intuitively visualize datasets by allowing users to create
    and share interactive dashboards
* A rich set of visualizations to analyze your data, as well as a flexible
    way to extend the capabilities
* An extensible, high granularity security model allowing intricate rules
    on who can access which features, and integration with major
    authentication providers (database, OpenID, LDAP, OAuth & REMOTE_USER
    through Flask AppBuiler)
* A simple semantic layer, allowing to control how data sources are
    displayed in the UI, by defining which fields should show up in
    which dropdown and which aggregation and function (metrics) are
    made available to the user
* Deep integration with Druid allows for Superset to stay blazing fast while
    slicing and dicing large, realtime datasets
* Fast loading dashboards with configurable caching


Database Support
----------------

Superset was originally designed on top of Druid.io, but quickly broadened
its scope to support other databases through the use of SQLAlchemy, a Python
ORM that is compatible with
[most common databases](http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html).


What is Druid?
-------------
From their website at http://druid.io

*Druid is an open-source analytics data store designed for
business intelligence (OLAP) queries on event data. Druid provides low
latency (real-time) data ingestion, flexible data exploration,
and fast data aggregation. Existing Druid deployments have scaled to
trillions of events and petabytes of data. Druid is best used to
power analytic dashboards and applications.*


Installation & Configuration
----------------------------

[See in the documentation](http://airbnb.io/superset/installation.html)


More screenshots
----------------

![img](http://i.imgur.com/SAhDJCI.png)

---
![img](http://i.imgur.com/iuLpv1c.png)

---
![img](http://i.imgur.com/V2FWeZx.png)

---
![img](http://i.imgur.com/BeUtCzF.png)

---
![img](http://i.imgur.com/phoY7jI.png)

---
![img](http://i.imgur.com/NvIDgdC.png)

---
![img](http://i.imgur.com/DzwYyns.png)


Resources
-------------
* [Superset Google Group](https://groups.google.com/forum/#!forum/airbnb_superset)
* [Gitter (live chat) Channel](https://gitter.im/airbnb/superset)
* [Docker image 1](https://hub.docker.com/r/kochalex/superset/)
  [Docker image 2](https://hub.docker.com/r/amancevice/superset/) (community contributed)
* [Slides from Strata (March 2016)](https://drive.google.com/open?id=0B5PVE0gzO81oOVJkdF9aNkJMSmM)


Tip of the Hat
--------------

Superset would not be possible without these great frameworks / libs

* Flask App Builder - Allowing us to focus on building the app quickly while
getting the foundation for free
* The Flask ecosystem - Simply amazing. So much Plug, easy play.
* NVD3 - One of the best charting libraries out there
* Much more, check out the `install_requires` section in the [setup.py](https://github.com/airbnb/superset/blob/master/setup.py) file!


Contributing
------------

Interested in contributing? Casual hacking? Check out  [Contributing.MD](https://github.com/airbnb/superset/blob/master/CONTRIBUTING.md)
