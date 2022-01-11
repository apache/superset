---
title: Security
hide_title: true
sidebar_position: 10
---

### Roles

Security in Superset is handled by Flask AppBuilder (FAB), an application development framework
built on top of Flask. FAB provides authentication, user management, permissions and roles.
Please read its [Security documentation](https://flask-appbuilder.readthedocs.io/en/latest/security.html).

### Provided Roles

Superset ships with a set of roles that are handled by Superset itself. You can assume
that these roles will stay up-to-date as Superset evolves (and as you update Superset versions).

Even though **Admin** users have the ability, we don't recommend altering the
permissions associated with each role (e.g. by removing or adding permissions to them). The permissions
associated with each role will be re-synchronized to their original values when you run
the **superset init** command (often done between Superset versions).

### Admin

Admins have all possible rights, including granting or revoking rights from other
users and altering other people’s slices and dashboards.

### Alpha

Alpha users have access to all data sources, but they cannot grant or revoke access
from other users. They are also limited to altering the objects that they own. Alpha users can add and alter data sources.

### Gamma

Gamma users have limited access. They can only consume data coming from data sources
they have been given access to through another complementary role. They only have access to
view the slices and dashboards made from data sources that they have access to. Currently Gamma
users are not able to alter or add data sources. We assume that they are mostly content consumers, though they can create slices and dashboards.

Also note that when Gamma users look at the dashboards and slices list view, they will
only see the objects that they have access to.

### sql_lab

The **sql_lab** role grants access to SQL Lab. Note that while **Admin** users have access
to all databases by default, both **Alpha** and **Gamma** users need to be given access on a per database basis.

### Public

To allow logged-out users to access some Superset features, you can use the `PUBLIC_ROLE_LIKE` config setting and assign it to another role whose permissions you want passed to this role.

For example, by setting `PUBLIC_ROLE_LIKE = Gamma` in your `superset_config.py` file, you grant
public role the same set of permissions as for the **Gamma** role. This is useful if one
wants to enable anonymous users to view dashboards. Explicit grant on specific datasets is
still required, meaning that you need to edit the **Public** role and add the public data sources to the role manually.

### Managing Data Source Access for Gamma Roles

Here’s how to provide users access to only specific datasets. First make sure the users with
limited access have [only] the Gamma role assigned to them. Second, create a new role (Menu -> Security -> List Roles) and click the + sign.

This new window allows you to give this new role a name, attribute it to users and select the
tables in the **Permissions** dropdown. To select the data sources you want to associate with this role, simply click on the dropdown and use the typeahead to search for your table names.

You can then confirm with users assigned to the **Gamma** role that they see the
objects (dashboards and slices) associated with the tables you just extended them.

### Customizing Permissions

The permissions exposed by FAB are very granular and allow for a great level of
customization. FAB creates many permissions automagically for each model that is
created (can_add, can_delete, can_show, can_edit, …) as well as for each view.
On top of that, Superset can expose more granular permissions like **all_datasource_access**.

**We do not recommend altering the 3 base roles as there are a set of assumptions that
Superset is built upon**. It is possible though for you to create your own roles, and union them to existing ones.

### Permissions

Roles are composed of a set of permissions, and Superset has many categories of
permissions. Here are the different categories of permissions:

- Model & Action: models are entities like Dashboard, Slice, or User. Each model has
  a fixed set of permissions, like **can_edit**, **can_show**, **can_delete**, **can_list**, **can_add**,
  and so on. For example, you can allow a user to delete dashboards by adding **can_delete** on
  Dashboard entity to a role and granting this user that role.
- Views: views are individual web pages, like the Explore view or the SQL Lab view.
  When granted to a user, they will see that view in its menu items, and be able to load that page.
- Data source: For each data source, a permission is created. If the user does not have the
  `all_datasource_access permission` granted, the user will only be able to see Slices or explore the data sources that are granted to them
- Database: Granting access to a database allows for the user to access all
  data sources within that database, and will enable the user to query that
  database in SQL Lab, provided that the SQL Lab specific permission have been granted to the user

### Restricting Access to a Subset of Data Sources

We recommend giving a user the **Gamma** role plus any other roles that would add
access to specific data sources. We recommend that you create individual roles for
each access profile. For example, the users on the Finance team might have access to a set of
databases and data sources; these permissions can be consolidated in a single role.
Users with this profile then need to be assigned the **Gamma** role as a foundation to
the models and views they can access, and that Finance role that is a collection of permissions to data objects.

A user can have multiple roles associated with them. For example, an executive on the Finance
team could be granted **Gamma**, **Finance**, and the **Executive** roles. The **Executive**
role could provide access to a set of data sources and dashboards made available only to executives.
In the **Dashboards** view, a user can only see the ones they have access too
based on the roles and permissions that were attributed.

### Row Level Security

Using Row Level Security filters (under the **Security** menu) you can create filters
that are assigned to a particular table, as well as a set of roles.
If you want members of the Finance team to only have access to
rows where `department = "finance"`, you could:

- Create a Row Level Security filter with that clause (`department = "finance"`)
- Then assign the clause to the **Finance** role and the table it applies to

The **clause** field, which can contain arbitrary text, is then added to the generated
SQL statement’s WHERE clause. So you could even do something like create a filter
for the last 30 days and apply it to a specific role, with a clause
like `date_field > DATE_SUB(NOW(), INTERVAL 30 DAY)`. It can also support
multiple conditions: `client_id = 6` AND `advertiser="foo"`, etc.

All relevant Row level security filters will be combined together (under the hood,
the different SQL clauses are combined using AND statements). This means it's
possible to create a situation where two roles conflict in such a way as to limit a table subset to empty.

For example, the filters `client_id=4` and `client_id=5`, applied to a role,
will result in users of that role having `client_id=4` AND `client_id=5`
added to their query, which can never be true.

### Reporting Security Vulnerabilities

Apache Software Foundation takes a rigorous standpoint in annihilating the security issues in its
software projects. Apache Superset is highly sensitive and forthcoming to issues pertaining to its
features and functionality.

If you have apprehensions regarding Superset security or you discover vulnerability or potential
threat, don’t hesitate to get in touch with the Apache Security Team by dropping a mail at
security@apache.org. In the mail, specify the project name Superset with the description of the
issue or potential threat. You are also urged to recommend the way to reproduce and replicate the
issue. The security team and the Superset community will get back to you after assessing and
analysing the findings.

PLEASE PAY ATTENTION to report the security issue on the security email before disclosing it on
public domain. The ASF Security Team maintains a page with the description of how vulnerabilities
and potential threats are handled, check their web page for more details.
