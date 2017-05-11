from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import re

from flask import (
    g, flash, request, redirect, Markup, Response
)

from flask_appbuilder import expose
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface

from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import (
    appbuilder, security, utils, sm, db
)

import superset.models.core as models

from superset.views.base import (
    SupersetModelView, SupersetFilter, DeleteMixin
)

from superset.views.core import (
    check_ownership, generate_download_headers
)

from superset.utils import has_access


class SliceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        perms = self.get_view_menus('datasource_access')
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class SliceModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Slice)
    can_add = False
    label_columns = {
        'datasource_link': 'Datasource',
    }
    list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator', 'modified']
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'owners', 'dashboards',
        'params', 'cache_timeout']
    base_order = ('changed_on', 'desc')
    description_columns = {
        'description': Markup(
            "The content here can be displayed as widget headers in the "
            "dashboard view. Supports "
            "<a href='https://daringfireball.net/projects/markdown/'>"
            "markdown</a>"),
        'params': _(
            "These parameters are generated dynamically when clicking "
            "the save or overwrite button in the explore view. This JSON "
            "object is exposed here for reference and for power users who may "
            "want to alter specific parameters."),
        'cache_timeout': _(
            "Duration (in seconds) of the caching timeout for this slice."
        ),
    }
    base_filters = [['id', SliceFilter, lambda: []]]
    label_columns = {
        'cache_timeout': _("Cache Timeout"),
        'creator': _("Creator"),
        'dashboards': _("Dashboards"),
        'datasource_link': _("Datasource"),
        'description': _("Description"),
        'modified': _("Last Modified"),
        'owners': _("Owners"),
        'params': _("Parameters"),
        'slice_link': _("Slice"),
        'slice_name': _("Name"),
        'table': _("Table"),
        'viz_type': _("Visualization Type"),
    }

    def pre_update(self, obj):
        check_ownership(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        flash(__(
            "To create a new slice, you can open a data source "
            "through the `Sources` menu, or alter an existing slice "
            "from the `Slices` menu"), "info")
        return redirect('/superset/welcome')

appbuilder.add_view(
    SliceModelView,
    "Slices",
    label=__("Slices"),
    icon="fa-bar-chart",
    category="",
    category_icon='',)


class SliceAsync(SliceModelView):  # noqa
    list_columns = [
        'slice_link', 'viz_type',
        'creator', 'modified', 'icons']
    label_columns = {
        'icons': ' ',
        'slice_link': _('Slice'),
    }

appbuilder.add_view_no_menu(SliceAsync)


class SliceAddView(SliceModelView):  # noqa
    list_columns = [
        'id', 'slice_name', 'slice_link', 'viz_type',
        'owners', 'modified', 'changed_on']

appbuilder.add_view_no_menu(SliceAddView)
