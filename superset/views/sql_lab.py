from flask import redirect, g

from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface

from flask_babel import gettext as __

from superset import appbuilder
from superset.models.sql_lab import Query, SavedQuery
from .base import SupersetModelView, BaseSupersetView, DeleteMixin


class QueryView(SupersetModelView):
    datamodel = SQLAInterface(Query)
    list_columns = ['user', 'database', 'status', 'start_time', 'end_time']

appbuilder.add_view(
    QueryView,
    "Queries",
    label=__("Queries"),
    category="Manage",
    category_label=__("Manage"),
    icon="fa-search")


class SavedQueryView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(SavedQuery)
    list_columns = [
        'label', 'user', 'database', 'schema', 'description',
        'modified', 'pop_tab_link']
    show_columns = [
        'id', 'label', 'user', 'database',
        'description', 'sql', 'pop_tab_link']
    search_columns = ('label', 'user', 'database', 'schema', 'changed_on')
    add_columns = ['label', 'database', 'description', 'sql']
    edit_columns = add_columns
    base_order = ('changed_on', 'desc')

    def pre_add(self, obj):
        obj.user = g.user

    def pre_update(self, obj):
        self.pre_add(obj)


class SavedQueryViewApi(SavedQueryView):
    show_columns = ['label', 'db_id', 'schema', 'description', 'sql']
    add_columns = show_columns
    edit_columns = add_columns

appbuilder.add_view_no_menu(SavedQueryViewApi)
appbuilder.add_view_no_menu(SavedQueryView)

appbuilder.add_link(
    __('Saved Queries'),
    href='/sqllab/my_queries/',
    icon="fa-save",
    category='SQL Lab')


class SqlLab(BaseSupersetView):
    """The base views for Superset!"""
    @expose("/my_queries/")
    def my_queries(self):
        """Assigns a list of found users to the given role."""
        return redirect(
            '/savedqueryview/list/?_flt_0_user={}'.format(g.user.id))


appbuilder.add_view_no_menu(SqlLab)
