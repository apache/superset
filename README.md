Panoramix
=========

Panoramix is a web UI to slice and dice data out of Druid.io

![img](http://i.imgur.com/aOaH0ty.png)

What's Druid?
-------------
From their website at http://druid.io

*Druid is an open-source analytics data store designed for 
business intelligence (OLAP) queries on event data. Druid provides low 
latency (real-time) data ingestion, flexible data exploration, 
and fast data aggregation. Existing Druid deployments have scaled to 
trillions of events and petabytes of data. Druid is best used to 
power analytic dashboards and applications.*

Panoramix
---------
Panoramix's main goal is to make it easy to slice, dice and visualize data
out of Druid. It empowers its user to perform **analytics 
at the speed of thought**.

Panoramix started as a hackathon project at Airbnb in while running a POC
(proof of concept) on using Druid. 

Panoramix provides:
* A way to query intuitively a Druid dataset, allowing for grouping, filtering
    limiting and defining a time granularity
* Many charts and visualization to analyze your data, as well as a flexible
    way to extend the visualization capabilities
* An extensible, high granularity security model allowing intricate rules
    on who can access which features, and integration with major 
    authentication providers (through Flask AppBuiler)
* A simple semantic layer, allowing to control how Druid datasources are 
    displayed in the UI,
    by defining which fields should show up in which dropdown and which
    aggregation and function (metrics) are made available to the user

Installation
------------

Follow these few simple steps to install Panoramix

```
# Clone the github repo 
git clone https://github.com/mistercrunch/panoramix.git

# Get in that fresh new folder
cd panoramix

# You may want to create a python virtualenv
# virtualenv env
# source env/bin/activate
# pip install -r requirements.txt

# If you don't use a virtualenv, you'll have to sudo to install the reqs
sudo pip install -r requirements.txt

# I needed a feature added to pydruid, and it got merged into their 
# master branch but isn't on pypi yet, so you'll need the latest.
git clone https://github.com/metamx/pydruid.git
cd pydruid
python setup.py install

# Same for pandas-highchart, I added features to the lib, so take it
# from my fork until it gets merged...
git clone https://github.com/mistercrunch/pandas-highcharts.git
cd pandas-highcharts
python setup.py install

# Edit config.py, and read through the settings
# Note that alternatively, you can create a ``local_config.py`` and put it
# somewhere in your PYTHONPATH. The variables declared local_config.py
# will override the ones in ``config.py``, and won't create issues when
# you need to ``git pull`` the latest version of panoramix
vim config.py

# Create an admin account, the app will ask for username/password, ...
# This feature is out of Flask App Builder, the framework I used to build
# Panoramix
fabmanager create-admin

# Start the web server
python run.py
```

After installation, you should be able to point your browser to the right
hostname:port [http://localhost:8088](http://localhost:8088), login using
the credential you entered while creating the admin account, and navigate to
`Menu -> Admin -> Refresh Metadata`. This action should bring in all of 
your datasources for Panoramix to be aware of, and they should show up in
`Menu -> Datasources`, from where you can start playing with your data!
