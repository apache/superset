from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import (
    appbuilder, security, utils, sm, db
)

from superset.views.base import (
    SupersetModelView, DeleteMixin
)

import superset.models.core as models


class DatabaseView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Database)
    list_columns = [
        'database_name', 'backend', 'allow_run_sync', 'allow_run_async',
        'allow_dml', 'creator', 'modified']
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra',
        'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
        'allow_ctas', 'allow_dml', 'force_ctas_schema']
    search_exclude_columns = ('password',)
    edit_columns = add_columns
    show_columns = [
        'tables',
        'cache_timeout',
        'extra',
        'database_name',
        'sqlalchemy_uri',
        'perm',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on',
    ]
    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': utils.markdown(
            "Refer to the "
            "[SqlAlchemy docs]"
            "(http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html#"
            "database-urls) "
            "for more information on how to structure your URI.", True),
        'expose_in_sqllab': _("Expose this DB in SQL Lab"),
        'allow_run_sync': _(
            "Allow users to run synchronous queries, this is the default "
            "and should work well for queries that can be executed "
            "within a web request scope (<~1 minute)"),
        'allow_run_async': _(
            "Allow users to run queries, against an async backend. "
            "This assumes that you have a Celery worker setup as well "
            "as a results backend."),
        'allow_ctas': _("Allow CREATE TABLE AS option in SQL Lab"),
        'allow_dml': _(
            "Allow users to run non-SELECT statements "
            "(UPDATE, DELETE, CREATE, ...) "
            "in SQL Lab"),
        'force_ctas_schema': _(
            "When allowing CREATE TABLE AS option in SQL Lab, "
            "this option forces the table to be created in this schema"),
        'extra': utils.markdown(
            "JSON string containing extra configuration elements. "
            "The ``engine_params`` object gets unpacked into the "
            "[sqlalchemy.create_engine]"
            "(http://docs.sqlalchemy.org/en/latest/core/engines.html#"
            "sqlalchemy.create_engine) call, while the ``metadata_params`` "
            "gets unpacked into the [sqlalchemy.MetaData]"
            "(http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html"
            "#sqlalchemy.schema.MetaData) call. ", True),
    }
    label_columns = {
        'expose_in_sqllab': _("Expose in SQL Lab"),
        'allow_ctas': _("Allow CREATE TABLE AS"),
        'allow_dml': _("Allow DML"),
        'force_ctas_schema': _("CTAS Schema"),
        'database_name': _("Database"),
        'creator': _("Creator"),
        'changed_on_': _("Last Changed"),
        'sqlalchemy_uri': _("SQLAlchemy URI"),
        'cache_timeout': _("Cache Timeout"),
        'extra': _("Extra"),
    }

    def pre_add(self, db):
        db.set_sqlalchemy_uri(db.sqlalchemy_uri)
        security.merge_perm(sm, 'database_access', db.perm)
        for schema in db.all_schema_names():
            security.merge_perm(
                sm, 'schema_access', utils.get_schema_perm(db, schema))

    def pre_update(self, db):
        self.pre_add(db)


appbuilder.add_link(
    'Import Dashboards',
    label=__("Import Dashboards"),
    href='/superset/import_dashboards',
    icon="fa-cloud-upload",
    category='Manage',
    category_label=__("Manage"),
    category_icon='fa-wrench',)


appbuilder.add_view(
    DatabaseView,
    "Databases",
    label=__("Databases"),
    icon="fa-database",
    category="Sources",
    category_label=__("Sources"),
    category_icon='fa-database',)


class DatabaseAsync(DatabaseView):
    list_columns = [
        'id', 'database_name',
        'expose_in_sqllab', 'allow_ctas', 'force_ctas_schema',
        'allow_run_async', 'allow_run_sync', 'allow_dml',
    ]

appbuilder.add_view_no_menu(DatabaseAsync)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ['id', 'all_table_names', 'all_schema_names']

appbuilder.add_view_no_menu(DatabaseTablesAsync)

appbuilder.add_separator("Sources")
