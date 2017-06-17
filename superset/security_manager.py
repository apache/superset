from collections import defaultdict

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security import views as fab_views
from flask_appbuilder.security.sqla import models as ab_models
from flask_appbuilder.security.sqla.manager import SecurityManager

from sqlalchemy import Column, String


class SupersetUser(ab_models.User):
    """Deriving FAB's USER to enrich it"""
    image_url = Column(String(1000))
    slack_username = Column(String(500))

    @property
    def full_name(self):
        return self.first_name + ' ' + self.last_name

    @property
    def data(self):
        """Returns a json-serializable representation of the self"""
        return {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'slack_username': self.slack_username,
            'email': self.email,
            'image_url': self.image_url,
            'username': self.username,
            'is_active': self.is_active(),
            'created_on': self.created_on.isoformat(),
        }

    @property
    def data_extended(self):
        """Superset of data property with roles and perms"""
        d = self.data
        roles = {}
        permissions = defaultdict(set)
        for role in self.roles:
            perms = set()
            for perm in role.permissions:
                perms.add(
                    (perm.permission.name, perm.view_menu.name)
                )
                if perm.permission.name in (
                        'datasource_access', 'database_access'):
                    permissions[perm.permission.name].add(perm.view_menu.name)
            roles[role.name] = [
                [perm.permission.name, perm.view_menu.name]
                for perm in role.permissions
            ]
        d.update({
            'roles': roles,
            'permissions': permissions,
        })
        return d


class SupersetUserModelView(fab_views.UserDBModelView):
    route_base = '/userext'
    datamodel = SQLAInterface(SupersetUser)
    edit_columns = fab_views.UserDBModelView.edit_columns + [
        'image_url', 'slack_username']
    add_columns = fab_views.UserDBModelView.add_columns + [
        'image_url', 'slack_username']
fab_views.UserDBModelView = SupersetUserModelView


class SupersetSecurityManager(SecurityManager):
    user_model = SupersetUser
    userdbmodelview = SupersetUserModelView
