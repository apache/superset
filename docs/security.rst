Security
========
Security in Superset is handled by Flask AppBuilder (FAB). FAB is a
"Simple and rapid application development framework, built on top of Flask.".
FAB provides authentication, user management, permissions and roles.
Please read its `Security documentation 
<http://flask-appbuilder.readthedocs.io/en/latest/security.html>`_.

Provided Roles
--------------
Superset ships with a set of roles that are handled by Superset itself.
You can assume that these roles will stay up-to-date as Superset evolves.
Even though it's possible for ``Admin`` users to do so, it is not recommended
that you alter these roles in any way by removing
or adding permissions to them as these roles will be re-synchronized to
their original values as you run your next ``superset init`` command.

Since it's not recommended to alter the roles described here, it's right
to assume that your security strategy should be to compose user access based
on these base roles and roles that you create. For instance you could
create a role ``Financial Analyst`` that would be made of set of permissions
to a set of data sources (tables) and/or databases. Users would then be
granted ``Gamma``, ``Financial Analyst``, and perhaps ``sql_lab``.

Admin
"""""
Admins have all possible rights, including granting or revoking rights from
other users and altering other people's slices and dashboards.

Alpha
"""""
Alpha have access to all data sources, but they cannot grant or revoke access
from other users. They are also limited to altering the objects that they
own. Alpha users can add and alter data sources.

Gamma
"""""
Gamma have limited access. They can only consume data coming from data sources
they have been given access to through another complementary role.
They only have access to view the slices and
dashboards made from data sources that they have access to. Currently Gamma
users are not able to alter or add data sources. We assume that they are
mostly content consumers, though they can create slices and dashboards.

Also note that when Gamma users look at the dashboards and slices list view,
they will only see the objects that they have access to.

sql_lab
"""""""
The ``sql_lab`` role grants access to SQL Lab. Note that while ``Admin``
users have access to all databases by default, both ``Alpha`` and ``Gamma``
users need to be given access on a per database basis.

Public
""""""
It's possible to allow logged out users to access some Superset features.

By setting ``PUBLIC_ROLE_LIKE_GAMMA = True`` in your ``superset_config.py``,
you grant public role the same set of permissions as for the GAMMA role.
This is useful if one wants to enable anonymous users to view
dashboards. Explicit grant on specific datasets is still required, meaning
that you need to edit the ``Public`` role and add the Public data sources
to the role manually.


Managing Gamma per data source access
-------------------------------------
Here's how to provide users access to only specific datasets. First make
sure the users with limited access have [only] the Gamma role assigned to
them. Second, create a new role (``Menu -> Security -> List Roles``) and
click the ``+`` sign.

.. image:: images/create_role.png
   :scale: 50 %

This new window allows you to give this new role a name, attribute it to users
and select the tables in the ``Permissions`` dropdown. To select the data
sources you want to associate with this role, simply click in the dropdown
and use the typeahead to search for your table names.

You can then confirm with your Gamma users that they see the objects
(dashboards and slices) associated with the tables related to their roles.


Customizing
-----------

The permissions exposed by FAB are very granular and allow for a great level
of customization. FAB creates many permissions automagically for each model
that is create (can_add, can_delete, can_show, can_edit, ...) as well as for
each view. On top of that, Superset can expose more granular permissions like
``all_datasource_access``.

We do not recommend altering the 3 base roles as there
are a set of assumptions that Superset build upon. It is possible though for
you to create your own roles, and union them to existing ones.

Permissions
"""""""""""

Roles are composed of a set of permissions, and Superset has many categories
of permissions. Here are the different categories of permissions:

- **Model & action**: models are entities like ``Dashboard``,
  ``Slice``, or ``User``. Each model has a fixed set of permissions, like
  ``can_edit``, ``can_show``, ``can_delete``, ``can_list``, ``can_add``, and
  so on. By adding ``can_delete on Dashboard`` to a role, and granting that
  role to a user, this user will be able to delete dashboards.
- **Views**: views are individual web pages, like the ``explore`` view or the
  ``SQL Lab`` view. When granted to a user, he/she will see that view in
  the its menu items, and be able to load that page.
- **Data source**: For each data source, a permission is created. If the user
  does not have the ``all_datasource_access`` permission granted, the user
  will only be able to see Slices or explore the data sources that are granted
  to them
- **Database**: Granting access to a database allows for the user to access
  all data sources within that database, and will enable the user to query
  that database in SQL Lab, provided that the SQL Lab specific permission
  have been granted to the user


Restricting access to a subset of data sources
""""""""""""""""""""""""""""""""""""""""""""""

The best way to go is probably to give user ``Gamma`` plus one or many other
roles that would add access to specific data sources. We recommend that you
create individual roles for each access profile. Say people in your finance
department might have access to a set of databases and data sources, and
these permissions can be consolidated in a single role. Users with this
profile then need to be attributed ``Gamma`` as a foundation to the models
and views they can access, and that ``Finance`` role that is a collection
of permissions to data objects.

One user can have many roles, so a finance executive could be granted
``Gamma``, ``Finance``, and perhaps another ``Executive`` role that gather
a set of data sources that power dashboards only made available to executives.
When looking at its dashboard list, this user will only see the
list of dashboards it has access to, based on the roles and
permissions that were attributed.


Restricting the access to some metrics
""""""""""""""""""""""""""""""""""""""

Sometimes some metrics are relatively sensitive (e.g. revenue).
We may want to restrict those metrics to only a few roles.
For example, assumed there is a metric ``[cluster1].[datasource1].[revenue]``
and only Admin users are allowed to see it. Here’s how to restrict the access.

1. Edit the datasource (``Menu -> Source -> Druid datasources -> edit the
   record "datasource1"``) and go to the tab ``List Druid Metric``. Check
   the checkbox ``Is Restricted`` in the row of the metric ``revenue``.

2. Edit the role (``Menu -> Security -> List Roles -> edit the record
   “Admin”``), in the permissions field, type-and-search the permission
   ``metric access on [cluster1].[datasource1].[revenue] (id: 1)``, then
   click the Save button on the bottom of the page.

Any users without the permission will see the error message
*Access to the metrics denied: revenue (Status: 500)* in the slices.
It also happens when the user wants to access a post-aggregation metric that
is dependent on revenue.
