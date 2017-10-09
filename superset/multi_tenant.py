from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import Column, Integer, ForeignKey, String, Sequence, Table
from sqlalchemy.orm import relationship, backref
from flask_appbuilder import Model
from flask_appbuilder.security.views import UserDBModelView
from flask_babel import lazy_gettext

class MultiTenantUser(User):
    tenant_id = Column(String(256))

class MultiTenantUserDBModelView(UserDBModelView):
    show_fieldsets = [
        (lazy_gettext('User info'),
         {'fields': ['username', 'active', 'roles', 'login_count', 'tenant_id']}),
        (lazy_gettext('Personal Info'),
         {'fields': ['first_name', 'last_name', 'email'], 'expanded': True}),
        (lazy_gettext('Audit Info'),
         {'fields': ['last_login', 'fail_login_count', 'created_on',
                     'created_by', 'changed_on', 'changed_by'], 'expanded': False}),
    ]

    user_show_fieldsets = [
        (lazy_gettext('User info'),
         {'fields': ['username', 'active', 'roles', 'login_count']}),
        (lazy_gettext('Personal Info'),
         {'fields': ['first_name', 'last_name', 'email'], 'expanded': True}),
    ]

    add_columns = ['first_name', 'last_name', 'username', 'active', 'email', 'roles', 'tenant_id', 'password', 'conf_password']
    list_columns = ['first_name', 'last_name', 'username', 'email', 'active', 'roles']
    edit_columns = ['first_name', 'last_name', 'username', 'active', 'email', 'roles', 'tenant_id']

# This will add multi tenant support in user model
class MultiTenantSecurityManager(SecurityManager):
    user_model = MultiTenantUser
    userdbmodelview = MultiTenantUserDBModelView