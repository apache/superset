from datetime import datetime
import humanize
import json
import re
import sqlalchemy as sa

from sqlalchemy.ext.declarative import declared_attr

from flask import escape, Markup
from flask_appbuilder.models.mixins import AuditMixin
from flask_appbuilder.models.decorators import renders
from superset.utils import QueryStatus
from superset import sm


class ImportMixin(object):
    def override(self, obj):
        """Overrides the plain fields of the dashboard."""
        for field in obj.__class__.export_fields:
            setattr(self, field, getattr(obj, field))

    def copy(self):
        """Creates a copy of the dashboard without relationships."""
        new_obj = self.__class__()
        new_obj.override(self)
        return new_obj

    def alter_params(self, **kwargs):
        d = self.params_dict
        d.update(kwargs)
        self.params = json.dumps(d)

    @property
    def params_dict(self):
        if self.params:
            params = re.sub(",[ \t\r\n]+}", "}", self.params)
            params = re.sub(",[ \t\r\n]+\]", "]", params)
            return json.loads(params)
        else:
            return {}


class AuditMixinNullable(AuditMixin):

    """Altering the AuditMixin to use nullable fields

    Allows creating objects programmatically outside of CRUD
    """

    created_on = sa.Column(sa.DateTime, default=datetime.now, nullable=True)
    changed_on = sa.Column(
        sa.DateTime, default=datetime.now,
        onupdate=datetime.now, nullable=True)

    @declared_attr
    def created_by_fk(self):  # noqa
        return sa.Column(
            sa.Integer, sa.ForeignKey('ab_user.id'),
            default=self.get_user_id, nullable=True)

    @declared_attr
    def changed_by_fk(self):  # noqa
        return sa.Column(
            sa.Integer, sa.ForeignKey('ab_user.id'),
            default=self.get_user_id, onupdate=self.get_user_id, nullable=True)

    def _user_link(self, user):
        if not user:
            return ''
        url = '/superset/profile/{}/'.format(user.username)
        return Markup('<a href="{}">{}</a>'.format(url, escape(user) or ''))

    @renders('created_by')
    def creator(self):  # noqa
        return self._user_link(self.created_by)

    @property
    def changed_by_(self):
        return self._user_link(self.changed_by)

    @renders('changed_on')
    def changed_on_(self):
        return Markup(
            '<span class="no-wrap">{}</span>'.format(self.changed_on))

    @renders('changed_on')
    def modified(self):
        s = humanize.naturaltime(datetime.now() - self.changed_on)
        return Markup('<span class="no-wrap">{}</span>'.format(s))

    @property
    def icons(self):
        return """
        <a
                href="{self.datasource_edit_url}"
                data-toggle="tooltip"
                title="{self.datasource}">
            <i class="fa fa-database"></i>
        </a>
        """.format(**locals())


class QueryResult(object):

    """Object returned by the query interface"""

    def __init__(  # noqa
            self,
            df,
            query,
            duration,
            status=QueryStatus.SUCCESS,
            error_message=None):
        self.df = df
        self.query = query
        self.duration = duration
        self.status = status
        self.error_message = error_message


def merge_perm(sm, permission_name, view_menu_name, connection):

    permission = sm.find_permission(permission_name)
    view_menu = sm.find_view_menu(view_menu_name)
    pv = None

    if not permission:
        permission_table = sm.permission_model.__table__
        connection.execute(
            permission_table.insert()
            .values(name=permission_name)
        )
    if not view_menu:
        view_menu_table = sm.viewmenu_model.__table__
        connection.execute(
            view_menu_table.insert()
            .values(name=view_menu_name)
        )

    permission = sm.find_permission(permission_name)
    view_menu = sm.find_view_menu(view_menu_name)

    if permission and view_menu:
        pv = sm.get_session.query(sm.permissionview_model).filter_by(
            permission=permission, view_menu=view_menu).first()
    if not pv and permission and view_menu:
        permission_view_table = sm.permissionview_model.__table__
        connection.execute(
            permission_view_table.insert()
            .values(
                permission_id=permission.id,
                view_menu_id=view_menu.id
                )
        )


def set_perm(mapper, connection, target):  # noqa

    if target.perm != target.get_perm():
        link_table = target.__table__
        connection.execute(
            link_table.update()
            .where(link_table.c.id == target.id)
            .values(perm=target.get_perm())
        )

    # add to view menu if not already exists
    merge_perm(sm, 'datasource_access', target.get_perm(), connection)
