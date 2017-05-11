from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import re

from flask import (
    g, request, redirect, Response
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

from superset.views.slice import SliceFilter


class DashboardFilter(SupersetFilter):

    """List dashboards for which users have access to at least one slice"""

    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        Slice = models.Slice  # noqa
        Dash = models.Dashboard  # noqa
        # TODO(bogdan): add `schema_access` support here
        datasource_perms = self.get_view_menus('datasource_access')
        slice_ids_qry = (
            db.session
            .query(Slice.id)
            .filter(Slice.perm.in_(datasource_perms))
        )
        query = query.filter(
            Dash.id.in_(
                db.session.query(Dash.id)
                .distinct()
                .join(Dash.slices)
                .filter(Slice.id.in_(slice_ids_qry))
            )
        )
        return query


class DashboardModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Dashboard)
    list_columns = ['dashboard_link', 'creator', 'modified']
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'owners', 'position_json', 'css',
        'json_metadata']
    show_columns = edit_columns + ['table_names']
    add_columns = edit_columns
    base_order = ('changed_on', 'desc')
    description_columns = {
        'position_json': _(
            "This json object describes the positioning of the widgets in "
            "the dashboard. It is dynamically generated when adjusting "
            "the widgets size and positions by using drag & drop in "
            "the dashboard view"),
        'css': _(
            "The css for individual dashboards can be altered here, or "
            "in the dashboard view where changes are immediately "
            "visible"),
        'slug': _("To get a readable URL for your dashboard"),
        'json_metadata': _(
            "This JSON object is generated dynamically when clicking "
            "the save or overwrite button in the dashboard view. It "
            "is exposed here for reference and for power users who may "
            "want to alter specific parameters."),
        'owners': _("Owners is a list of users who can alter the dashboard."),
    }
    base_filters = [['slice', DashboardFilter, lambda: []]]
    add_form_query_rel_fields = {
        'slices': [['slices', SliceFilter, None]],
    }
    edit_form_query_rel_fields = add_form_query_rel_fields
    label_columns = {
        'dashboard_link': _("Dashboard"),
        'dashboard_title': _("Title"),
        'slug': _("Slug"),
        'slices': _("Slices"),
        'owners': _("Owners"),
        'creator': _("Creator"),
        'modified': _("Modified"),
        'position_json': _("Position JSON"),
        'css': _("CSS"),
        'json_metadata': _("JSON Metadata"),
        'table_names': _("Underlying Tables"),
    }

    def pre_add(self, obj):
        obj.slug = obj.slug.strip() or None
        if obj.slug:
            obj.slug = obj.slug.replace(" ", "-")
            obj.slug = re.sub(r'\W+', '', obj.slug)
        if g.user not in obj.owners:
            obj.owners.append(g.user)
        utils.validate_json(obj.json_metadata)
        utils.validate_json(obj.position_json)
        owners = [o for o in obj.owners]
        for slc in obj.slices:
            slc.owners = list(set(owners) | set(slc.owners))

    def pre_update(self, obj):
        check_ownership(obj)
        self.pre_add(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    @action("mulexport", __("Export"), __("Export dashboards?"), "fa-database")
    def mulexport(self, items):
        ids = ''.join('&id={}'.format(d.id) for d in items)
        return redirect(
            '/dashboardmodelview/export_dashboards_form?{}'.format(ids[1:]))

    @expose("/export_dashboards_form")
    def download_dashboards(self):
        if request.args.get('action') == 'go':
            ids = request.args.getlist('id')
            return Response(
                models.Dashboard.export_dashboards(ids),
                headers=generate_download_headers("pickle"),
                mimetype="application/text")
        return self.render_template(
            'superset/export_dashboards.html',
            dashboards_url='/dashboardmodelview/list'
        )


appbuilder.add_view(
    DashboardModelView,
    "Dashboards",
    label=__("Dashboards"),
    icon="fa-dashboard",
    category='',
    category_icon='',)


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = ['dashboard_link', 'creator', 'modified', 'dashboard_title']
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'creator': _('Creator'),
        'modified': _('Modified'),
    }

appbuilder.add_view_no_menu(DashboardModelViewAsync)
