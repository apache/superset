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

Security
========
Security in Superset is handled by Flask AppBuilder (FAB). FAB is a
"Simple and rapid application development framework, built on top of Flask.".
FAB provides authentication, user management, permissions and roles.
Please read its `Security documentation
<https://flask-appbuilder.readthedocs.io/en/latest/security.html>`_.

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
create a role ``Financial Analyst`` that would be made of a set of permissions
to a set of data sources (tables) and/or databases. Users would then be
granted ``Gamma``, ``Financial Analyst``, and perhaps ``sql_lab``.

Admin
"""""
Admins have all possible rights, including granting or revoking rights from
other users and altering other people's slices and dashboards.

Alpha
"""""
Alpha users have access to all data sources, and all features except SQLLab and
security, so they cannot grant or revoke access from other users.
They are also limited to altering the objects that they
own. Alpha users can add and alter data sources.

Gamma
"""""
Gamma users have limited access. They can only consume data coming from data sources
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

.. image:: _static/images/create_role.png
   :scale: 50 %

This new window allows you to give this new role a name, attribute it to users
and select the tables in the ``Permissions`` dropdown. To select the data
sources you want to associate with this role, simply click on the dropdown
and use the typeahead to search for your table names.

You can then confirm with your Gamma users that they see the objects
(dashboards and slices) associated with the tables related to their roles.


Customizing
-----------

The permissions exposed by FAB are very granular and allow for a great level
of customization. FAB creates many permissions automagically for each model
that is created (can_add, can_delete, can_show, can_edit, ...) as well as for
each view. On top of that, Superset can expose more granular permissions like
``all_datasource_access``.

We do not recommend altering the 3 base roles as there
are a set of assumptions that Superset is built upon. It is possible though for
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
  ``SQL Lab`` view. When granted to a user, he/she will see that view in its menu items, and be able to load that page.
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


Restricting access to a subset of a particular table
""""""""""""""""""""""""""""""""""""""""""""""""""""

Using ``Row level security filters`` (under the ``Security`` menu) you can create 
filters that are assigned to a particular table, as well as a set of roles. 
Say people in your finance department should only have access to rows where 
``department = "finance"``.  You could create a ``Row level security filter`` 
with that clause, and assign it to your ``Finance`` role, as well as the 
applicable table.

The ``clause`` field can contain arbitrary text which is then added to the generated 
SQL statement's ``WHERE`` clause.  So you could even do something like create a 
filter for the last 30 days and apply it to a specific role, with a clause like 
``date_field > DATE_SUB(NOW(), INTERVAL 30 DAY)``.  It can also support multiple 
conditions: ``client_id = 6 AND advertiser="foo"``, etc. 

All relevant ``Row level security filters`` will be ANDed together, so it's 
possible to create a situation where two roles conflict in such a way as to 
limit a table subset to empty.  For example, the filters ``client_id=4`` and 
and ``client_id=5``, applied to a role, will result in users of that role having 
``client_id=4 AND client_id=5`` added to their query, which can never be true.