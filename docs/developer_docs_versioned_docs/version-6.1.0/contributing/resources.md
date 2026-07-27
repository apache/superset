---
title: Resources
sidebar_position: 8
---

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

# Resources

## High Level Architecture

```mermaid
flowchart TD

  %% Top Level
  LB["<b>Load Balancer(s)</b><br/>(optional)"]
  LB -.-> WebServers

  %% Web Servers
  subgraph WebServers ["<b>Web Server(s)</b>"]
    WS1["<b>Frontend</b><br/>(React, AntD, ECharts, AGGrid)"]
    WS2["<b>Backend</b><br/>(Python, Flask, SQLAlchemy, Pandas, ...)"]
  end

  %% Infra
  subgraph InfraServices ["<b>Infra</b>"]
    DB[("<b>Metadata Database</b><br/>(Postgres / MySQL)")]

    subgraph Caching ["<b>Caching Subservices<br/></b>(Redis, memcache, S3, ...)"]
      direction LR
      DummySpace[" "]:::invisible
      QueryCache["<b>Query Results Cache</b><br/>(Accelerated Dashboards)"]
      CsvCache["<b>CSV Exports Cache</b>"]
      ThumbnailCache["<b>Thumbnails Cache</b>"]
      AlertImageCache["<b>Alert/Report Images Cache</b>"]
	  QueryCache -- " " --> CsvCache
	  linkStyle 1 stroke:transparent;
      ThumbnailCache -- " " --> AlertImageCache
	  linkStyle 2 stroke:transparent;
    end

    Broker(("<b>Message Queue</b><br/>(Redis / RabbitMQ / SQS)"))
  end

  AsyncBackend["<b>Async Workers (Celery)</b><br>required for Alerts & Reports, thumbnails, CSV exports, long-running workloads, ..."]

  %% External DBs
  subgraph ExternalDatabases ["<b>Analytics Databases</b>"]
    direction LR
    BigQuery[(BigQuery)]
    Snowflake[(Snowflake)]
    Redshift[(Redshift)]
    Postgres[(Postgres)]
    Postgres[(... any ...)]
  end

  %% Connections
  LB -.-> WebServers
  WebServers --> DB
  WebServers -.-> Caching
  WebServers -.-> Broker
  WebServers -.-> ExternalDatabases

  Broker -.-> AsyncBackend

  AsyncBackend -.-> ExternalDatabases
  AsyncBackend -.-> Caching



  %% Legend styling
  classDef requiredNode stroke-width:2px,stroke:black;
  class Required requiredNode;
  class Optional optionalNode;

  %% Hide real arrow
  linkStyle 0 stroke:transparent;

  %% Styling
  classDef optionalNode stroke-dasharray: 5 5, opacity:0.9;
  class LB optionalNode;
  class Caching optionalNode;
  class AsyncBackend optionalNode;
  class Broker optionalNode;
  class QueryCache optionalNode;
  class CsvCache optionalNode;
  class ThumbnailCache optionalNode;
  class AlertImageCache optionalNode;
  class Celery optionalNode;

  classDef invisible fill:transparent,stroke:transparent;
```

## Entity-Relationship Diagram

For the full interactive Entity-Relationship Diagram, please visit the [developer documentation](/developer-docs/contributing/resources).

You can also [download the .svg](https://github.com/apache/superset/tree/master/docs/static/img/erd.svg) directly from GitHub.

## Additional Resources

### Official Documentation
- [Apache Superset Documentation](https://superset.apache.org/docs/intro)
- [API Documentation](https://superset.apache.org/docs/api)
- [Configuration Guide](https://superset.apache.org/admin-docs/configuration/configuring-superset)

### Community Resources
- [Apache Superset Blog](https://preset.io/blog/)
- [YouTube Channel](https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g)
- [Twitter/X](https://twitter.com/ApacheSuperset)

### Development Tools
- [GitHub Repository](https://github.com/apache/superset)
- [PyPI Package](https://pypi.org/project/apache-superset/)
- [Docker Hub](https://hub.docker.com/r/apache/superset)
- [npm Packages](https://www.npmjs.com/search?q=%40superset-ui)
