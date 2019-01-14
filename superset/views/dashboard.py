# pylint: disable=C,R,W
from flask import g, redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access

from superset import appbuilder, db
from superset.models import core as models
from .base import BaseSupersetView


class Dashboard(BaseSupersetView):
    """The base views for Superset!"""

    @has_access
    @expose('/new/')
    def new(self):
        """Creates a new, blank dashboard and redirects to it in edit mode"""
        new_dashboard = models.Dashboard(
            dashboard_title='[ untitled dashboard ]',
            owners=[g.user],
        )
        db.session.add(new_dashboard)
        db.session.commit()
        return redirect(f'/superset/dashboard/{new_dashboard.id}/?edit=true')


appbuilder.add_view_no_menu(Dashboard)
