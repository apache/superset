# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging
import re

from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.views import RoleModelView
from flask_babel import lazy_gettext as _


class SupersetRoleModelView(RoleModelView):

    def add_dashboard_role(self, role, dash):
        from superset import db

        if dash not in role.dashboards:
            try:
                role.dashboards.append(dash)
                db.session.merge(role)
                db.session.commit()
            except Exception, e:
                logging.error(e)

    def remove_dashboard_role(self, role, dash):
        from superset import db

        try:
            role.dashboards.remove(dash)
            db.session.merge(role)
            db.session.commit()
        except Exception, e:
            logging.error(e)

    def post_update(self, role):
        from superset.models.core import Dashboard
        from superset import db

        role_dash_perms = []
        for perm_view in role.permissions:
            if perm_view.permission.name == 'dashboard_access':
                m = re.search(r'dash_id\:(\d+)\)$', perm_view.view_menu.name)
                if m:
                    dash_id = m.groups()[0]
                    role_dash_perms.append(int(dash_id))
                    try:
                        dash = db.session.query(Dashboard).filter_by(id=dash_id).first()
                    except Exception, e:
                        logging.error(e)

                    self.add_dashboard_role(role, dash)
                else:
                    logging.error(
                        _("'dashboard_access name '{}' not as expected"
                            .format(perm_view.view_menu.name)))
        role_dashboards = role.dashboards
        for dash in role_dashboards:
            if dash.id not in role_dash_perms:
                self.remove_dashboard_role(role, dash)


class SupersetSecurityManager(SecurityManager):
    rolemodelview = SupersetRoleModelView
