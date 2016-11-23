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


Why are my queries timing out?
------------------------------

If you are seeing timeouts (504 Gateway Time-out) when running queries,
it's because the web server is timing out web requests. If you want to
increase the default (50), you can specify the timeout when starting the
web server with the ``-t`` flag, which is expressed in seconds.

``superset runserver -t 300``


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

But what about if you don't want certain widgets to get filtered on your
dashboard? You can do that by editing your dashboard, and in the form,
edit the ``JSON Metadata`` field, more specifically the
``filter_immune_slices`` key, that receives an array of sliceIds that should
never be affected by any dashboard level filtering.


..code::

    {
        "filter_immune_slices": [324, 65, 92],
        "expanded_slices": {},
        "filter_immune_slice_fields": {
            "177": ["country_name", "__from", "__to"],
            "32": ["__from", "__to"]
        }
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

Why does fabmanager or superset freezed/hung/not responding when started (my home directory is NFS mounted)?
-----------------------------------------------------------------------------------------
superset creates and uses an sqlite database at ``~/.superset/superset.db``. Sqlite is known to `don't work well if used on NFS`__ due to broken file locking implementation on NFS.

__ https://www.sqlite.org/lockingv3.html

One work around is to create a symlink from ~/.superset to a directory located on a non-NFS partition.

Another work around is to change where superset stores the sqlite database by adding ``SQLALCHEMY_DATABASE_URI = 'sqlite:////new/localtion/superset.db'`` in superset_config.py (create the file if needed), then adding the directory where superset_config.py lives to PYTHONPATH environment variable (e.g. ``export PYTHONPATH=/opt/logs/sandbox/airbnb/``).
