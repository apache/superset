from flask import g, redirect
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import appbuilder
from superset.models.sql_lab import Query, SavedQuery
from .base import BaseSupersetView, DeleteMixin, SupersetModelView


class QueryView(SupersetModelView):
    datamodel = SQLAInterface(Query)
    list_columns = ['user', 'database', 'status', 'start_time', 'end_time']
    label_columns = {
        'user': _('User'),
        'database': _('Database'),
        'status': _('Status'),
        'start_time': _('Start Time'),
        'end_time': _('End Time'),
    }


appbuilder.add_view(
    QueryView,
    'Queries',
    label=__('Queries'),
    category='Manage',
    category_label=__('Manage'),
    icon='fa-search')


class SavedQueryView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(SavedQuery)

    list_title = _('List Saved Query')
    show_title = _('Show Saved Query')
    add_title = _('Add Saved Query')
    edit_title = _('Edit Saved Query')

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
    label_columns = {
        'label': _('Label'),
        'user': _('User'),
        'database': _('Database'),
        'description': _('Description'),
        'modified': _('Modified'),
        'end_time': _('End Time'),
        'pop_tab_link': _('Pop Tab Link'),
        'changed_on': _('Changed on'),
    }

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
    icon='fa-save',
    category='SQL Lab')


class SqlLab(BaseSupersetView):
    """The base views for Superset!"""
    @expose('/my_queries/')
    def my_queries(self):
        """Assigns a list of found users to the given role."""
        return redirect(
            '/savedqueryview/list/?_flt_0_user={}'.format(g.user.id))


appbuilder.add_view_no_menu(SqlLab)
