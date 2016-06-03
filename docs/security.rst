Security
========
Security in Caravel is handled by Flask AppBuilder (FAB). FAB is a
"Simple and rapid application development framework, built on top of Flask.".
FAB provides authentication, user management, permissions and roles.


Provided Roles
--------------
Caravel ships with 3 roles that are handled by Caravel itself. You can
assume that these 3 roles will stay up-to-date as Caravel evolves.

Admin
"""""
Admins have all rights, including granting or revoking rights from other
users and altering other people's slices and dashboards.

Alpha
"""""
Alpha have access to all data sources, but they cannot grant or revoke access
from other users. They are also limited to altering the objects that they
own. Alpha users can add and alter data sources.

Gamma
"""""
Gamma have limited access. They can only consume data coming from data sources
they have been giving access to through another complementary role.
They only have access to view the slices and
dashboards made from data sources that they have access to. Currently Gamma
users are not able to alter or add data sources. We assume that they are
mostly content consumers, though they can create slices and dashboards.

Also note that when Gamma users look at the dashboards and slices list view,
they will only see the objects that they have access to.


Managing Gamma per data source access
-------------------------------------
Here's how to provide users access to only specific datasets. First make
sure the users with limited access have [only] the Gamma role assigned to
them. Second, create a new role (``Menu -> Security -> List Roles``) and
click the ``+`` sign.

.. image:: _static/img/create_role.png
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
each view. On top of that, Caravel can expose more granular permissions like
``all_datasource_access``.

We do not recommend altering the 3 base roles as there
are a set of assumptions that Caravel build upon. It is possible though for
you to create your own roles, and union them to existing ones.

The best way to go is probably to give user ``Gamma`` plus another role
that would add specific permissions needed by this type of users. 
