FAQ
===


Can I query/join multiple tables at one time?
---------------------------------------------
Not directly no. A Caravel SQLAlchemy datasource can only be a single table
or a view.

When working with tables, the solution would be to materialize
a table that contains all the fields needed for your analysis, most likely
through some scheduled batch process.

A view is a simple logical layer that abstract an arbitrary SQL queries as
a virtual table. This can allow you to join and union multiple tables, and
to apply some transformation using arbitrary SQL expressions. The limitation
there is your database performance as Caravel effectively will run a query
on top of your query (view). A good practice may be to limit yourself to
joining your main large table to one or many small tables only, and avoid
using ``GROUP BY`` where possible as Caravel will do its own ``GROUP BY`` and
doing the work twice might slow down performance.

Whether you use a table or a view, the important factor is whether your
database is fast enough to serve it in an interactive fashion to provide
a good user experience in Caravel.


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

https://github.com/airbnb/caravel/issues?q=label%3Aexample+is%3Aclosed


Why are my queries timing out?
------------------------------

If you are seeing timeouts (504 Gateway Time-out) when running queries,
it's because the web server is timing out web requests. If you want to
increase the default (50), you can specify the timeout when starting the
web server with the ``-t`` flag, which is expressed in seconds.

``caravel runserver -t 300``


Why is the map not visible in the mapbox visualization?
-------------------------------------------------------

You need to register to mapbox.com, get an API key and configure it as
``MAPBOX_API_KEY`` in ``caravel_config.py``.
