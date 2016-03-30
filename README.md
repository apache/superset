Caravel
=========
<img src="http://i.imgur.com/H0Kyvyi.jpg" alt="Caravel" style="width: 250px;"/>

[![Build Status](https://travis-ci.org/airbnb/caravel.svg?branch=master)](https://travis-ci.org/airbnb/caravel)
[![PyPI version](https://badge.fury.io/py/caravel.svg)](https://badge.fury.io/py/caravel)
[![Coverage Status](https://coveralls.io/repos/airbnb/caravel/badge.svg?branch=master&service=github)](https://coveralls.io/github/airbnb/caravel?branch=master)
[![Code Health](https://landscape.io/github/airbnb/caravel/master/landscape.svg?style=flat)](https://landscape.io/github/airbnb/caravel/master)
[![Requirements Status](https://requires.io/github/airbnb/caravel/requirements.svg?branch=master)](https://requires.io/github/airbnb/caravel/requirements/?branch=master)
[![Join the chat at https://gitter.im/airbnb/caravel](https://badges.gitter.im/airbnb/caravel.svg)](https://gitter.im/airbnb/caravel?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Caravel is a data exploration platform designed to be visual, intuitive
and interactive.

[this project used to be named **Panoramix**]


Video - Introduction to Caravel
---------------------------------
[![Caravel - ](http://img.youtube.com/vi/3Txm_nj_R7M/0.jpg)](http://www.youtube.com/watch?v=3Txm_nj_R7M)

Screenshots
------------
![img](http://i.imgur.com/JRbTnTx.png)
![img](http://i.imgur.com/4wRtxwb.png)

Caravel
---------
Caravel's main goal is to make it easy to slice, dice and visualize data.
It empowers its user to perform **analytics at the speed of thought**.

Caravel provides:
* A quick way to intuitively visualize datasets
* Create and share interactive dashboards
* A rich set of visualizations to analyze your data, as well as a flexible
    way to extend the capabilities
* An extensible, high granularity security model allowing intricate rules
    on who can access which features, and integration with major
    authentication providers (database, OpenID, LDAP, OAuth & REMOTE_USER
    through Flask AppBuiler)
* A simple semantic layer, allowing to control how data sources are
    displayed in the UI,
    by defining which fields should show up in which dropdown and which
    aggregation and function (metrics) are made available to the user
* Deep integration with Druid allows for Caravel to stay blazing fast while
    slicing and dicing large, realtime datasets


Database Support
----------------

Caravel was originally designed on to of Druid.io, but quickly broadened
its scope to support other databases through the use of SqlAlchemy, a Python
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


Installation
------------

Caravel is currently only tested using Python 2.7.*. Python 3 support is
on the roadmap, Python 2.6 won't be supported.

Follow these few simple steps to install Caravel.

```
# Install caravel
pip install caravel

# Create an admin user
fabmanager create-admin --app caravel

# Initialize the database
caravel db upgrade

# Create default roles and permissions
caravel init

# Load some data to play with
caravel load_examples

# Start the development web server
caravel runserver -d
```

After installation, you should be able to point your browser to the right
hostname:port [http://localhost:8088](http://localhost:8088), login using
the credential you entered while creating the admin account, and navigate to
`Menu -> Admin -> Refresh Metadata`. This action should bring in all of 
your datasources for Caravel to be aware of, and they should show up in
`Menu -> Datasources`, from where you can start playing with your data!

Configuration
=======
[most common databases](http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html).


Installation & Configuration
----------------------------

(See in the documentation)
[http://mistercrunch.github.io/panoramix-docs/installation.html]


What is Druid?
-------------
From their website at http://druid.io

*Druid is an open-source analytics data store designed for
business intelligence (OLAP) queries on event data. Druid provides low
latency (real-time) data ingestion, flexible data exploration,
and fast data aggregation. Existing Druid deployments have scaled to
trillions of events and petabytes of data. Druid is best used to
power analytic dashboards and applications.*


More screenshots
----------------

![img](http://i.imgur.com/MAFZTtU.png)
![img](http://i.imgur.com/xcy1QjN.png)
![img](http://i.imgur.com/RWqA8ly.png)
![img](http://i.imgur.com/D2kZL7q.png)
![img](http://i.imgur.com/0UPTK61.png)
![img](http://i.imgur.com/ahHoCuS.png)


Related Links
-------------
* [Caravel Google Group] (https://groups.google.com/forum/#!forum/airbnb_caravel)
* [Gitter (live chat) Channel](https://gitter.im/airbnb/caravel)


Tip of the Hat
--------------

Caravel would not be possible without these great frameworks / libs

* Flask App Builder - Allowing us to focus on building the app quickly while
getting the foundation for free
* The Flask ecosystem - Simply amazing. So much Plug, easy play.
* NVD3 - One of the best charting library out there
* Much more, check out the requirements.txt file!


Contributing
------------

Interested in contributing? Casual hacking? Check out  [Contributing.MD](https://github.com/airbnb/caravel/blob/master/CONTRIBUTING.md)
