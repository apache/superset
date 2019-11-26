..  Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

..    http://www.apache.org/licenses/LICENSE-2.0

..  Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.

Importing and Exporting Datasources
===================================

The superset cli allows you to import and export datasources from and to YAML.
Datasources include both databases and druid clusters. The data is expected to be organized in the following hierarchy: ::

    .
    ├──databases
    |  ├──database_1
    |  |  ├──table_1
    |  |  |  ├──columns
    |  |  |  |  ├──column_1
    |  |  |  |  ├──column_2
    |  |  |  |  └──... (more columns)
    |  |  |  └──metrics
    |  |  |     ├──metric_1
    |  |  |     ├──metric_2
    |  |  |     └──... (more metrics)
    |  |  └── ... (more tables)
    |  └── ... (more databases)
    └──druid_clusters
       ├──cluster_1
       |  ├──datasource_1
       |  |  ├──columns
       |  |  |  ├──column_1
       |  |  |  ├──column_2
       |  |  |  └──... (more columns)
       |  |  └──metrics
       |  |     ├──metric_1
       |  |     ├──metric_2
       |  |     └──... (more metrics)
       |  └── ... (more datasources)
       └── ... (more clusters)


Exporting Datasources to YAML
-----------------------------
You can print your current datasources to stdout by running: ::

    superset export_datasources


To save your datasources to a file run: ::

    superset export_datasources -f <filename>


By default, default (null) values will be omitted. Use the ``-d`` flag to include them.
If you want back references to be included (e.g. a column to include the table id
it belongs to) use the ``-b`` flag.

Alternatively, you can export datasources using the UI:

1. Open **Sources** -> **Databases** to export all tables associated to a
   single or multiple databases. (**Tables** for one or more tables,
   **Druid Clusters** for clusters, **Druid Datasources** for datasources)
#. Select the items you would like to export
#. Click **Actions** -> **Export to YAML**
#. If you want to import an item that you exported through the UI, you
   will need to nest it inside its parent element, e.g. a `database`
   needs to be nested under `databases` a `table` needs to be
   nested inside a `database` element.

Exporting the complete supported YAML schema
--------------------------------------------
In order to obtain an exhaustive list of all fields you can import using the YAML import run: ::

    superset export_datasource_schema

Again, you can use the ``-b`` flag to include back references.


Importing Datasources from YAML
-------------------------------
In order to import datasources from a YAML file(s), run: ::

    superset import_datasources -p <path or filename>

If you supply a path all files ending with ``*.yaml`` or ``*.yml`` will be parsed.
You can apply additional flags e.g.: ::

    superset import_datasources -p <path> -r

Will search the supplied path recursively.

The sync flag ``-s`` takes parameters in order to sync the supplied elements with
your file. Be careful this can delete the contents of your meta database. Example:

   superset import_datasources -p <path / filename> -s columns,metrics

This will sync all ``metrics`` and ``columns`` for all datasources found in the
``<path / filename>`` in the Superset meta database. This means columns and metrics
not specified in YAML will be deleted. If you would add ``tables`` to ``columns,metrics``
those would be synchronised as well.


If you don't supply the sync flag (``-s``) importing will only add and update (override) fields.
E.g. you can add a ``verbose_name`` to the column ``ds`` in the table ``random_time_series`` from the example datasets
by saving the following YAML to file and then running the ``import_datasources`` command. ::

    databases:
    - database_name: main
      tables:
      - table_name: random_time_series
        columns:
        - column_name: ds
          verbose_name: datetime
