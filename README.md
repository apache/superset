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

** Apache Superset ** (incubating) est un outil moderne, prêt à l'emploiapplication web d'aide à la décision

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
Apache Superset est une application Web d'exploration et de visualisation de données.

Superset fournit:
* Une interface intuitive pour explorer et visualiser des jeux de données, et
    créer des tableaux de bord interactifs.
* Un large éventail de belles visualisations pour mettre en valeur vos données.
* Flux d’utilisateurs simples et sans code permettant d’explorer et de découper les données en dés
    tableaux de bord exposés sous-jacents. Les tableaux de bord et les tableaux servent de point de départ
    point pour une analyse plus approfondie.
* Un éditeur / IDE SQL dernier cri exposant un riche navigateur de métadonnées, et
    un workflow simple pour créer des visualisations à partir de tout jeu de résultats.
* Un modèle de sécurité extensible à haute granularité permettant des règles complexes
    sur qui peut accéder à quelles fonctionnalités du produit et à ces jeux de données.
    Intégration avec majeur
    backends d'authentification (base de données, OpenID, LDAP, OAuth, REMOTE_USER, ...)
* Une couche sémantique légère, permettant de contrôler la manière dont les sources de données sont
    exposé à l'utilisateur en définissant des dimensions et des métriques
* Prise en charge immédiate de la plupart des bases de données SQL
* L'intégration profonde avec Druid permet à Superset de rester rapide tout en
    découper et découper de grands ensembles de données en temps réel
* Tableaux de bord à chargement rapide avec mise en cache configurable


Support de base de données
----------------

Superset parle de nombreux dialectes SQL via SQLAlchemy, un langage Python
ORM compatible avec
[bases de données les plus courantes] (http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html).

Superset peut être utilisé pour visualiser des données à partir de la plupart des bases de données:
* MySQL
* Postgres
* Vertica
* Oracle
* Microsoft SQL Server
* SQLite
* Greenplum
* Oiseau de feu
* MariaDB
* Sybase
* IBM DB2
* Exasol
* MonetDB
* Flocon de neige
* Redshift
* Clickhouse
* Apache Kylin
* ** plus! ** cherche la disponibilité d'un dialecte SQLAlchemy pour votre base de données
  pour savoir si cela fonctionnera avec Superset


Druide!
------

En plus d'avoir la possibilité d'interroger vos bases de données relationnelles,
Superset est livré avec une intégration profonde avec Druid (une application distribuée en temps réel)
magasin à colonnes). En interrogeant Druid,
Superset peut interroger des quantités énormes de données sur des ensembles de données en temps réel.
Notez que Superset ne nécessite en aucun cas Druid pour fonctionner, mais simplement
une autre base de données qu'il peut interroger.

Voici une description de Druid du site web http://druid.io:

* Druid est un magasin de données d’analyse open source conçu pour
les informations décisionnelles (OLAP) sur les données d'événement. Druide fournit faible
ingestion de données de latence (temps réel), exploration de données flexible,
et agrégation rapide des données. Les déploiements de druides existants ont été réduits à
des milliards d'événements et de pétaoctets de données. Le druide est le mieux utilisé pour
Tableaux de bord et applications d'analyse de l'alimentation. *


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
* [Join our Slack](https://join.slack.com/t/apache-superset/shared_invite/enQtNDMxMDY5NjM4MDU0LTc2Y2QwYjE4NGYwNzQyZWUwYTExZTdiZDMzMWQwZjc2YmJmM2QyMDkwMGVjZTA4N2I2MzUxZTk2YmE5MWRhZWE)
* [DEPRECATED Google Group](https://groups.google.com/forum/#!forum/airbnb_superset)


Contributing
Intéressé à contribuer? Piratage occasionnel? Check-out
[Contributing.MD] (https://github.com/airbnb/superset/blob/master/CONTRIBUTING.md)


Qui utilise Apache Superset (incubant)?
--------------------------------------

Voici une liste d'organisations qui ont pris le temps d'envoyer un PR à laisser
le monde sait qu'ils utilisent Superset. Rejoignez notre communauté grandissante!
------------

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
 - [CnOvit](http://www.cnovit.com/)
 - [Digit Game Studios](https://www.digitgaming.com/)
 - [Douban](https://www.douban.com/)
 - [Endress+Hauser](http://www.endress.com/)
 - [FBK - ICT center](http://ict.fbk.eu)
 - [Faasos](http://faasos.com/)
 - [GfK Data Lab](http://datalab.gfk.com)
 - [Konfío](http://konfio.mx)
 - [Lime](https://www.limebike.com/)
 - [Lyft](https://www.lyft.com/)
 - [Maieutical Labs](https://maieuticallabs.it)
 - [Myra Labs](http://www.myralabs.com/)
 - [PeopleDoc](https://www.people-doc.com)
 - [Ona](https://ona.io)
 - [Pronto Tools](http://www.prontotools.io)
 - [Qunar](https://www.qunar.com/)
 - [ScopeAI](https://www.getscopeai.com)
 - [Shopee](https://shopee.sg)
 - [Shopkick](https://www.shopkick.com)
 - [Tails.com](https://tails.com)
 - [THEICONIC](http://theiconic.com.au/)
 - [Tobii](http://www.tobii.com/)
 - [Tooploox](https://www.tooploox.com/)
 - [TrustMedis](https://trustmedis.com)
 - [Twitter](https://twitter.com/)
 - [Udemy](https://www.udemy.com/)
 - [VIPKID](https://www.vipkid.com.cn/)
 - [Windsor.ai](https://www.windsor.ai/)
 - [Yahoo!](https://yahoo.com/)
 - [Zaihang](http://www.zaih.com/)
 - [Zalando](https://www.zalando.com)
 - [Fordeal](http://www.fordeal.com)

