# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
"""a collection of model-related helper classes and functions"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
import json
import logging
import re

from flask import escape, Markup
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.models.mixins import AuditMixin
import humanize
import sqlalchemy as sa
from sqlalchemy import and_, or_, UniqueConstraint
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm.exc import MultipleResultsFound
import yaml

from superset import security_manager
from superset.utils import QueryStatus


def json_to_dict(json_str):
    if json_str:
        val = re.sub(',[ \t\r\n]+}', '}', json_str)
        val = re.sub(',[ \t\r\n]+\]', ']', val)
        return json.loads(val)
    else:
        return {}


class ImportMixin(object):
    export_parent = None
    # The name of the attribute
    # with the SQL Alchemy back reference

    export_children = []
    # List of (str) names of attributes
    # with the SQL Alchemy forward references

    export_fields = []
    # The names of the attributes
    # that are available for import and export

    @classmethod
    def _parent_foreign_key_mappings(cls):
        """Get a mapping of foreign name to the local name of foreign keys"""
        parent_rel = cls.__mapper__.relationships.get(cls.export_parent)
        if parent_rel:
            return {l.name: r.name for (l, r) in parent_rel.local_remote_pairs}
        return {}

    @classmethod
    def _unique_constrains(cls):
        """Get all (single column and multi column) unique constraints"""
        unique = [{c.name for c in u.columns} for u in cls.__table_args__
                  if isinstance(u, UniqueConstraint)]
        unique.extend({c.name} for c in cls.__table__.columns if c.unique)
        return unique

    @classmethod
    def export_schema(cls, recursive=True, include_parent_ref=False):
        """Export schema as a dictionary"""
        parent_excludes = {}
        if not include_parent_ref:
            parent_ref = cls.__mapper__.relationships.get(cls.export_parent)
            if parent_ref:
                parent_excludes = {c.name for c in parent_ref.local_columns}

        def formatter(c):
            return ('{0} Default ({1})'.format(
                str(c.type), c.default.arg) if c.default else str(c.type))

        schema = {c.name: formatter(c) for c in cls.__table__.columns
                  if (c.name in cls.export_fields and
                  c.name not in parent_excludes)}
        if recursive:
            for c in cls.export_children:
                child_class = cls.__mapper__.relationships[c].argument.class_
                schema[c] = [child_class.export_schema(recursive=recursive,
                             include_parent_ref=include_parent_ref)]
        return schema

    @classmethod
    def import_from_dict(cls, session, dict_rep, parent=None,
                         recursive=True, sync=[]):
        """Import obj from a dictionary"""
        parent_refs = cls._parent_foreign_key_mappings()
        export_fields = set(cls.export_fields) | set(parent_refs.keys())
        new_children = {c: dict_rep.get(c) for c in cls.export_children
                        if c in dict_rep}
        unique_constrains = cls._unique_constrains()

        filters = []  # Using these filters to check if obj already exists

        # Remove fields that should not get imported
        for k in list(dict_rep):
            if k not in export_fields:
                del dict_rep[k]

        if not parent:
            if cls.export_parent:
                for p in parent_refs.keys():
                    if p not in dict_rep:
                        raise RuntimeError(
                            '{0}: Missing field {1}'.format(cls.__name__, p))
        else:
            # Set foreign keys to parent obj
            for k, v in parent_refs.items():
                dict_rep[k] = getattr(parent, v)

        # Add filter for parent obj
        filters.extend([getattr(cls, k) == dict_rep.get(k)
                        for k in parent_refs.keys()])

        # Add filter for unique constraints
        ucs = [and_(*[getattr(cls, k) == dict_rep.get(k)
               for k in cs if dict_rep.get(k) is not None])
               for cs in unique_constrains]
        filters.append(or_(*ucs))

        # Check if object already exists in DB, break if more than one is found
        try:
            obj_query = session.query(cls).filter(and_(*filters))
            obj = obj_query.one_or_none()
        except MultipleResultsFound as e:
            logging.error('Error importing %s \n %s \n %s', cls.__name__,
                          str(obj_query),
                          yaml.safe_dump(dict_rep))
            raise e

        if not obj:
            is_new_obj = True
            # Create new DB object
            obj = cls(**dict_rep)
            logging.info('Importing new %s %s', obj.__tablename__, str(obj))
            if cls.export_parent and parent:
                setattr(obj, cls.export_parent, parent)
            session.add(obj)
        else:
            is_new_obj = False
            logging.info('Updating %s %s', obj.__tablename__, str(obj))
            # Update columns
            for k, v in dict_rep.items():
                setattr(obj, k, v)

        # Recursively create children
        if recursive:
            for c in cls.export_children:
                child_class = cls.__mapper__.relationships[c].argument.class_
                added = []
                for c_obj in new_children.get(c, []):
                    added.append(child_class.import_from_dict(session=session,
                                                              dict_rep=c_obj,
                                                              parent=obj,
                                                              sync=sync))
                # If children should get synced, delete the ones that did not
                # get updated.
                if c in sync and not is_new_obj:
                    back_refs = child_class._parent_foreign_key_mappings()
                    delete_filters = [getattr(child_class, k) ==
                                      getattr(obj, back_refs.get(k))
                                      for k in back_refs.keys()]
                    to_delete = set(session.query(child_class).filter(
                        and_(*delete_filters))).difference(set(added))
                    for o in to_delete:
                        logging.info('Deleting %s %s', c, str(obj))
                        session.delete(o)

        return obj

    def export_to_dict(self, recursive=True, include_parent_ref=False,
                       include_defaults=False):
        """Export obj to dictionary"""
        cls = self.__class__
        parent_excludes = {}
        if recursive and not include_parent_ref:
            parent_ref = cls.__mapper__.relationships.get(cls.export_parent)
            if parent_ref:
                parent_excludes = {c.name for c in parent_ref.local_columns}
        dict_rep = {c.name: getattr(self, c.name)
                    for c in cls.__table__.columns
                    if (c.name in self.export_fields and
                        c.name not in parent_excludes and
                        (include_defaults or (
                            getattr(self, c.name) is not None and
                            (not c.default or
                                getattr(self, c.name) != c.default.arg))))
                    }
        if recursive:
            for c in self.export_children:
                # sorting to make lists of children stable
                dict_rep[c] = sorted(
                    [
                        child.export_to_dict(
                            recursive=recursive,
                            include_parent_ref=include_parent_ref,
                            include_defaults=include_defaults,
                        ) for child in getattr(self, c)
                    ],
                    key=lambda k: sorted(k.items()))

        return dict_rep

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
        return json_to_dict(self.params)

    @property
    def template_params_dict(self):
        return json_to_dict(self.template_params)


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

    def changed_by_name(self):
        if self.created_by:
            return escape('{}'.format(self.created_by))
        return ''

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
            .values(name=permission_name),
        )
    if not view_menu:
        view_menu_table = sm.viewmenu_model.__table__
        connection.execute(
            view_menu_table.insert()
            .values(name=view_menu_name),
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
                view_menu_id=view_menu.id,
            ),
        )


def set_perm(mapper, connection, target):  # noqa

    if target.perm != target.get_perm():
        link_table = target.__table__
        connection.execute(
            link_table.update()
            .where(link_table.c.id == target.id)
            .values(perm=target.get_perm()),
        )

    # add to view menu if not already exists
    merge_perm(security_manager, 'datasource_access', target.get_perm(), connection)
