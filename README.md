Dashed
=========

[![PyPI version](https://badge.fury.io/py/dashed.svg)](https://badge.fury.io/py/dashed)
[![Coverage Status](https://coveralls.io/repos/airbnb/dashed/badge.svg?branch=master&service=github)](https://coveralls.io/github/airbnb/dashed?branch=master)
[![Code Health](https://landscape.io/github/airbnb/dashed/immune_to_filter/landscape.svg?style=flat)](https://landscape.io/github/airbnb/dashed/master)
[![Requirements Status](https://requires.io/github/airbnb/dashed/requirements.svg?branch=master)](https://requires.io/github/airbnb/dashed/requirements/?branch=master)
[![Join the chat at https://gitter.im/airbnb/dashed](https://badges.gitter.im/airbnb/dashed.svg)](https://gitter.im/airbnb/dashed?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Dashed is a data exploration platform designed to be visual, intuitive
and interactive.

[this project used to be named **Panoramix**]


Video - Introduction to Dashed
---------------------------------
[![Dashed - ](http://img.youtube.com/vi/3Txm_nj_R7M/0.jpg)](http://www.youtube.com/watch?v=3Txm_nj_R7M)

Screenshots
------------
![img](http://i.imgur.com/bi09J9X.png)
![img](http://i.imgur.com/aOaH0ty.png)

Dashed
---------
Dashed's main goal is to make it easy to slice, dice and visualize data.
It empowers its user to perform **analytics at the speed of thought**.

Dashed provides:
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
* Deep integration with Druid allows for Dashed to stay blazing fast while
    slicing and dicing large, realtime datasets


Database Support
----------------

Dashed was originally designed on to of Druid.io, but quickly broadened
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

Dashed is currently only tested using Python 2.7.*. Python 3 support is
on the roadmap, Python 2.6 won't be supported.

Follow these few simple steps to install Dashed.

```
# Install dashed
pip install dashed

# Create an admin user
fabmanager create-admin --app dashed

# Initialize the database
dashed db upgrade

# Create default roles and permissions
dashed init

# Load some data to play with
dashed load_examples

# Start the development web server
dashed runserver -d
```

After installation, you should be able to point your browser to the right
hostname:port [http://localhost:8088](http://localhost:8088), login using
the credential you entered while creating the admin account, and navigate to
`Menu -> Admin -> Refresh Metadata`. This action should bring in all of 
your datasources for Dashed to be aware of, and they should show up in
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

![img](http://i.imgur.com/Rt6gNQ9.png)
![img](http://i.imgur.com/t7VOtqQ.png)
![img](http://i.imgur.com/PaiFQnH.png)
![img](http://i.imgur.com/CdcGHuC.png)

Related Links
-------------
* [Dashed Google Group] (https://groups.google.com/forum/#!forum/airbnb_dashed)
* [Gitter (live chat) Channel](https://gitter.im/airbnb/dashed)


Tip of the Hat
--------------

Dashed would not be possible without these great frameworks / libs

* Flask App Builder - Allowing us to focus on building the app quickly while
getting the foundation for free
* The Flask ecosystem - Simply amazing. So much Plug, easy play.
* NVD3 - One of the best charting library out there
* Much more, check out the requirements.txt file!


Contributing
------------

Interested in contributing? Casual hacking? Check out  [Contributing.MD](https://github.com/airbnb/dashed/blob/master/CONTRIBUTING.md)
