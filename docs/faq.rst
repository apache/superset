FAQ
===


Can I query/join multiple tables at one time?
---------------------------------------------
Not directly no. A Superset SQLAlchemy datasource can only be a single table
or a view.

When working with tables, the solution would be to materialize
a table that contains all the fields needed for your analysis, most likely
through some scheduled batch process.

A view is a simple logical layer that abstract an arbitrary SQL queries as
a virtual table. This can allow you to join and union multiple tables, and
to apply some transformation using arbitrary SQL expressions. The limitation
there is your database performance as Superset effectively will run a query
on top of your query (view). A good practice may be to limit yourself to
joining your main large table to one or many small tables only, and avoid
using ``GROUP BY`` where possible as Superset will do its own ``GROUP BY`` and
doing the work twice might slow down performance.

Whether you use a table or a view, the important factor is whether your
database is fast enough to serve it in an interactive fashion to provide
a good user experience in Superset.


How BIG can my data source be?
------------------------------

It can be gigantic! As mentioned above, the main criteria is whether your
database can execute queries and return results in a time frame that is
acceptable to your users. Many distributed databases out there can execute
queries that scan through terabytes in an interactive fashion.


How do I create my own visualization?
-------------------------------------

We are planning on making it easier to add new visualizations to the
framework, in the meantime, we've tagged a few pull requests as
``example`` to give people examples of how to contribute new
visualizations.

https://github.com/airbnb/superset/issues?q=label%3Aexample+is%3Aclosed


Can I upload and visualize csv data?
------------------------------------

Yes, using the ``Upload a CSV`` button under the ``Sources``
menu item. This brings up a form that allows you specify required information. After creating the table from CSV, it can then be loaded like any other on the ``Sources -> Tables``page.


Why are my queries timing out?
------------------------------

There are many reasons may cause long query timing out.


- For running long query from Sql Lab, by default Superset allows it run as long as 6 hours before it being killed by celery. If you want to increase the time for running query, you can specify the timeout in configuration. For example:

  ``SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6``


- Superset is running on gunicorn web server, which may time out web requests. If you want to increase the default (50), you can specify the timeout when starting the web server with the ``-t`` flag, which is expressed in seconds.

  ``superset runserver -t 300``

- If you are seeing timeouts (504 Gateway Time-out) when loading dashboard or explore slice, you are probably behind gateway or proxy server (such as Nginx). If it did not receive a timely response from Superset server (which is processing long queries), these web servers will send 504 status code to clients directly. Superset has a client-side timeout limit to address this issue. If query didn't come back within clint-side timeout (60 seconds by default), Superset will display warning message to avoid gateway timeout message. If you have a longer gateway timeout limit, you can change the timeout settings in ``superset_config.py``:

  ``SUPERSET_WEBSERVER_TIMEOUT = 60``


Why is the map not visible in the mapbox visualization?
-------------------------------------------------------

You need to register to mapbox.com, get an API key and configure it as
``MAPBOX_API_KEY`` in ``superset_config.py``.


How to add dynamic filters to a dashboard?
------------------------------------------

It's easy: use the ``Filter Box`` widget, build a slice, and add it to your
dashboard.

The ``Filter Box`` widget allows you to define a query to populate dropdowns
that can be use for filtering. To build the list of distinct values, we
run a query, and sort the result by the metric you provide, sorting
descending.

The widget also has a checkbox ``Date Filter``, which enables time filtering
capabilities to your dashboard. After checking the box and refreshing, you'll
see a ``from`` and a ``to`` dropdown show up.

By default, the filtering will be applied to all the slices that are built
on top of a datasource that shares the column name that the filter is based
on. It's also a requirement for that column to be checked as "filterable"
in the column tab of the table editor.

But what about if you don't want certain widgets to get filtered on your
dashboard? You can do that by editing your dashboard, and in the form,
edit the ``JSON Metadata`` field, more specifically the
``filter_immune_slices`` key, that receives an array of sliceIds that should
never be affected by any dashboard level filtering.


.. code-block:: json

    {
        "filter_immune_slices": [324, 65, 92],
        "expanded_slices": {},
        "filter_immune_slice_fields": {
            "177": ["country_name", "__from", "__to"],
            "32": ["__from", "__to"]
        },
        "timed_refresh_immune_slices": [324]
    }

In the json blob above, slices 324, 65 and 92 won't be affected by any
dashboard level filtering.

Now note the ``filter_immune_slice_fields`` key. This one allows you to
be more specific and define for a specific slice_id, which filter fields
should be disregarded.

Note the use of the ``__from`` and ``__to`` keywords, those are reserved
for dealing with the time boundary filtering mentioned above.

But what happens with filtering when dealing with slices coming from
different tables or databases? If the column name is shared, the filter will
be applied, it's as simple as that.


How to limit the timed refresh on a dashboard?
----------------------------------------------
By default, the dashboard timed refresh feature allows you to automatically re-query every slice
on a dashboard according to a set schedule. Sometimes, however, you won't want all of the slices
to be refreshed - especially if some data is slow moving, or run heavy queries. To exclude specific
slices from the timed refresh process, add the ``timed_refresh_immune_slices`` key to the dashboard
``JSON Metadata`` field:

.. code-block:: json

    {
       "filter_immune_slices": [],
        "expanded_slices": {},
        "filter_immune_slice_fields": {},
        "timed_refresh_immune_slices": [324]
    }

In the example above, if a timed refresh is set for the dashboard, then every slice except 324 will
be automatically re-queried on schedule.

Slice refresh will also be staggered over the specified period. You can turn off this staggering
by setting the ``stagger_refresh`` to ``false`` and modify the stagger period by setting
``stagger_time`` to a value in milliseconds in the ``JSON Metadata`` field:

.. code-block:: json

    {
        "stagger_refresh": false,
        "stagger_time": 2500
    }

Here, the entire dashboard will refresh at once if periodic refresh is on. The stagger time of
2.5 seconds is ignored.

Why does fabmanager or superset freezed/hung/not responding when started (my home directory is NFS mounted)?
-----------------------------------------------------------------------------------------
By default, superset creates and uses an sqlite database at ``~/.superset/superset.db``. Sqlite is known to `don't work well if used on NFS`__ due to broken file locking implementation on NFS.

__ https://www.sqlite.org/lockingv3.html

You can override this path using the ``SUPERSET_HOME`` environment variable.

Another work around is to change where superset stores the sqlite database by adding ``SQLALCHEMY_DATABASE_URI = 'sqlite:////new/location/superset.db'`` in superset_config.py (create the file if needed), then adding the directory where superset_config.py lives to PYTHONPATH environment variable (e.g. ``export PYTHONPATH=/opt/logs/sandbox/airbnb/``).

What if the table schema changed?
---------------------------------

Table schemas evolve, and Superset needs to reflect that. It's pretty common
in the life cycle of a dashboard to want to add a new dimension or metric.
To get Superset to discover your new columns, all you have to do is to
go to ``Menu -> Sources -> Tables``, click the ``edit`` icon next to the
table who's schema has changed, and hit ``Save`` from the ``Detail`` tab.
Behind the scene, the new columns will get merged it. Following this,
you may want to
re-edit the table afterwards to configure the ``Column`` tab, check the
appropriate boxes and save again.

How do I go about developing a new visualization type?
------------------------------------------------------
Here's an example as a Github PR with comments that describe what the
different sections of the code do:
https://github.com/airbnb/superset/pull/3013

What database engine can I use as a backend for Superset?
---------------------------------------------------------

To clarify, the *database backend* is an OLTP database used by Superset to store its internal
information like your list of users, slices and dashboard definitions.

Superset is tested using Mysql, Postgresql and Sqlite for its backend. It's recommended you
install Superset on one of these database server for production.

Using a column-store, non-OLTP databases like Vertica, Redshift or Presto as a database backend simply won't work as these databases are not designed for this type of workload. Installation on Oracle, Microsoft SQL Server, or other OLTP databases may work but isn't tested.

Please note that pretty much any databases that have a SqlAlchemy integration should work perfectly fine as a datasource for Superset, just not as the OLTP backend.

How can i configure OAuth authentication and authorization?
-----------------------------------------------------------

You can take a look at this Flask-AppBuilder `configuration example
<https://github.com/dpgaspar/Flask-AppBuilder/blob/master/examples/oauth/config.py>`_.

How can I set a default filter on my dashboard?
-----------------------------------------------

Easy. Simply apply the filter and save the dashboard while the filter
is active.

How do I get Superset to refresh the schema of my table?
--------------------------------------------------------

When adding columns to a table, you can have Superset detect and merge the
new columns in by using the "Refresh Metadata" action in the
``Source -> Tables`` page. Simply check the box next to the tables
you want the schema refreshed, and click ``Actions -> Refresh Metadata``.

Is there a way to force the use specific colors?
------------------------------------------------

It is possible on a per-dashboard basis by providing a mapping of
labels to colors in the ``JSON Metadata`` attribute using the
``label_colors`` key.

.. code-block:: json

    {
        "label_colors": {
            "Girls": "#FF69B4",
            "Boys": "#ADD8E6"
        }
    }
