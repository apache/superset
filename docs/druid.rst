Druid
=====

Superset has a native connector to Druid, and a majority of Druid's
features are accessible through Superset.

.. note ::
    Druid now supports SQL and can be accessed through Superset's
    SQLAlchemy connector. The long term vision is to deprecate
    the Druid native REST connector and query Druid exclusively through
    the SQL interface.

Aggregations
------------

Common aggregations, or Druid metrics can be defined and used in Superset.
The first and simpler use case is to use the checkbox matrix expose in your
datasource's edit view (``Sources -> Druid Datasources ->
[your datasource] -> Edit -> [tab] List Druid Column``).
Clicking the ``GroupBy`` and ``Filterable`` checkboxes will make the column
appear in the related dropdowns while in explore view. Checking
``Count Distinct``, ``Min``, ``Max`` or ``Sum`` will result in creating
new metrics that will appear in the ``List Druid Metric`` tab upon saving the
datasource. By editing these metrics, you'll notice that they their ``json``
element correspond to Druid aggregation definition. You can create your own
aggregations manually from the ``List Druid Metric`` tab following Druid
documentation.

.. image:: images/druid_agg.png
   :scale: 50 %

Post-Aggregations
-----------------

Druid supports post aggregation and this works in Superset. All you have to
do is creating a metric, much like you would create an aggregation manually,
but specify ``postagg`` as a ``Metric Type``. You then have to provide a valid
json post-aggregation definition (as specified in the Druid docs) in the
Json field.


Unsupported Features
--------------------

.. note ::
    Unclear at this point, this section of the documentation could use
    some input.
