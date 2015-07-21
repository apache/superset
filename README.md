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
Panoramix started as a hackathon project at Airbnb while running a POC
(proof of concept) on Druid. The main goal is to provide an easy to 
leverage Druid's speed to power analytics **at the speed of thought**.

Panoramix provides:
* A way to query intuitively a Druid dataset, allowing for grouping, filtering
    limiting and defining a time granularity
* Many charts and visualization to analyze your data, as well as a flexible
    way to extend the visualization capabilities
* An extensible, high granularity security model allowing intricate rules
    on who can access which features, and integration with major 
    authentication providers (through Flask AppBuiler)
* An easy way to control how Druid datasources are displayed in the UI,
    by defining which fields should show up in which drop down and which
    aggregation and function (metrics) are made available to the user
