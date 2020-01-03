# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""a collection of model-related helper classes and functions"""
import json
import logging
import re
from datetime import datetime
from typing import List, Optional

# isort and pylint disagree, isort should win
# pylint: disable=ungrouped-imports
import humanize
import sqlalchemy as sa
import yaml
from flask import escape, g, Markup
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.models.mixins import AuditMixin
from sqlalchemy import and_, or_, UniqueConstraint
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm.exc import MultipleResultsFound

from superset.utils.core import QueryStatus


def json_to_dict(json_str):
    if json_str:
        val = re.sub(",[ \t\r\n]+}", "}", json_str)
        val = re.sub(
            ",[ \t\r\n]+\]", "]", val  # pylint: disable=anomalous-backslash-in-string
        )
        return json.loads(val)

    return {}


class ImportMixin:
    export_parent: Optional[str] = None
    # The name of the attribute
    # with the SQL Alchemy back reference

    export_children: List[str] = []
    # List of (str) names of attributes
    # with the SQL Alchemy forward references

    export_fields: List[str] = []
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
        unique = [
            {c.name for c in u.columns}
            for u in cls.__table_args__
            if isinstance(u, UniqueConstraint)
        ]
        unique.extend({c.name} for c in cls.__table__.columns if c.unique)
        return unique

    @classmethod
    def export_schema(cls, recursive=True, include_parent_ref=False):
        """Export schema as a dictionary"""
        parent_excludes = {}
        if not include_parent_ref:
            parent_ref = cls.__mapper__.relationships.get(cls.export_parent)
            if parent_ref:
                parent_excludes = {column.name for column in parent_ref.local_columns}

        def formatter(column):
            return (
                "{0} Default ({1})".format(str(column.type), column.default.arg)
                if column.default
                else str(column.type)
            )

        schema = {
            column.name: formatter(column)
            for column in cls.__table__.columns
            if (column.name in cls.export_fields and column.name not in parent_excludes)
        }
        if recursive:
            for column in cls.export_children:
                child_class = cls.__mapper__.relationships[column].argument.class_
                schema[column] = [
                    child_class.export_schema(
                        recursive=recursive, include_parent_ref=include_parent_ref
                    )
                ]
        return schema

    @classmethod
    def import_from_dict(
        cls, session, dict_rep, parent=None, recursive=True, sync=None
    ):  # pylint: disable=too-many-arguments,too-many-locals,too-many-branches
        """Import obj from a dictionary"""
        if sync is None:
            sync = []
        parent_refs = cls._parent_foreign_key_mappings()
        export_fields = set(cls.export_fields) | set(parent_refs.keys())
        new_children = {
            c: dict_rep.get(c) for c in cls.export_children if c in dict_rep
        }
        unique_constrains = cls._unique_constrains()

        filters = []  # Using these filters to check if obj already exists

        # Remove fields that should not get imported
        for k in list(dict_rep):
            if k not in export_fields:
                del dict_rep[k]

        if not parent:
            if cls.export_parent:
                for prnt in parent_refs.keys():
                    if prnt not in dict_rep:
                        raise RuntimeError(
                            "{0}: Missing field {1}".format(cls.__name__, prnt)
                        )
        else:
            # Set foreign keys to parent obj
            for k, v in parent_refs.items():
                dict_rep[k] = getattr(parent, v)

        # Add filter for parent obj
        filters.extend([getattr(cls, k) == dict_rep.get(k) for k in parent_refs.keys()])

        # Add filter for unique constraints
        ucs = [
            and_(
                *[
                    getattr(cls, k) == dict_rep.get(k)
                    for k in cs
                    if dict_rep.get(k) is not None
                ]
            )
            for cs in unique_constrains
        ]
        filters.append(or_(*ucs))

        # Check if object already exists in DB, break if more than one is found
        try:
            obj_query = session.query(cls).filter(and_(*filters))
            obj = obj_query.one_or_none()
        except MultipleResultsFound as e:
            logging.error(
                "Error importing %s \n %s \n %s",
                cls.__name__,
                str(obj_query),
                yaml.safe_dump(dict_rep),
            )
            raise e

        if not obj:
            is_new_obj = True
            # Create new DB object
            obj = cls(**dict_rep)
            logging.info("Importing new %s %s", obj.__tablename__, str(obj))
            if cls.export_parent and parent:
                setattr(obj, cls.export_parent, parent)
            session.add(obj)
        else:
            is_new_obj = False
            logging.info("Updating %s %s", obj.__tablename__, str(obj))
            # Update columns
            for k, v in dict_rep.items():
                setattr(obj, k, v)

        # Recursively create children
        if recursive:
            for child in cls.export_children:
                child_class = cls.__mapper__.relationships[child].argument.class_
                added = []
                for c_obj in new_children.get(child, []):
                    added.append(
                        child_class.import_from_dict(
                            session=session, dict_rep=c_obj, parent=obj, sync=sync
                        )
                    )
                # If children should get synced, delete the ones that did not
                # get updated.
                if child in sync and not is_new_obj:
                    back_refs = (
                        child_class._parent_foreign_key_mappings()  # pylint: disable=protected-access
                    )
                    delete_filters = [
                        getattr(child_class, k) == getattr(obj, back_refs.get(k))
                        for k in back_refs.keys()
                    ]
                    to_delete = set(
                        session.query(child_class).filter(and_(*delete_filters))
                    ).difference(set(added))
                    for o in to_delete:
                        logging.info("Deleting %s %s", child, str(obj))
                        session.delete(o)

        return obj

    def export_to_dict(
        self, recursive=True, include_parent_ref=False, include_defaults=False
    ):
        """Export obj to dictionary"""
        cls = self.__class__
        parent_excludes = {}
        if recursive and not include_parent_ref:
            parent_ref = cls.__mapper__.relationships.get(cls.export_parent)
            if parent_ref:
                parent_excludes = {c.name for c in parent_ref.local_columns}
        dict_rep = {
            c.name: getattr(self, c.name)
            for c in cls.__table__.columns
            if (
                c.name in self.export_fields
                and c.name not in parent_excludes
                and (
                    include_defaults
                    or (
                        getattr(self, c.name) is not None
                        and (not c.default or getattr(self, c.name) != c.default.arg)
                    )
                )
            )
        }
        if recursive:
            for cld in self.export_children:
                # sorting to make lists of children stable
                dict_rep[cld] = sorted(
                    [
                        child.export_to_dict(
                            recursive=recursive,
                            include_parent_ref=include_parent_ref,
                            include_defaults=include_defaults,
                        )
                        for child in getattr(self, cld)
                    ],
                    key=lambda k: sorted(str(k.items())),
                )

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

    def reset_ownership(self):
        """ object will belong to the user the current user """
        # make sure the object doesn't have relations to a user
        # it will be filled by appbuilder on save
        self.created_by = None
        self.changed_by = None
        # flask global context might not exist (in cli or tests for example)
        try:
            if g.user:
                self.owners = [g.user]
        except Exception:  # pylint: disable=broad-except
            self.owners = []

    @property
    def params_dict(self):
        return json_to_dict(self.params)

    @property
    def template_params_dict(self):
        return json_to_dict(self.template_params)


def _user_link(user):  # pylint: disable=no-self-use
    if not user:
        return ""
    url = "/superset/profile/{}/".format(user.username)
    return Markup('<a href="{}">{}</a>'.format(url, escape(user) or ""))


class AuditMixinNullable(AuditMixin):

    """Altering the AuditMixin to use nullable fields

    Allows creating objects programmatically outside of CRUD
    """

    created_on = sa.Column(sa.DateTime, default=datetime.now, nullable=True)
    changed_on = sa.Column(
        sa.DateTime, default=datetime.now, onupdate=datetime.now, nullable=True
    )

    @declared_attr
    def created_by_fk(self):
        return sa.Column(
            sa.Integer,
            sa.ForeignKey("ab_user.id"),
            default=self.get_user_id,
            nullable=True,
        )

    @declared_attr
    def changed_by_fk(self):
        return sa.Column(
            sa.Integer,
            sa.ForeignKey("ab_user.id"),
            default=self.get_user_id,
            onupdate=self.get_user_id,
            nullable=True,
        )

    def changed_by_name(self):
        if self.created_by:
            return escape("{}".format(self.created_by))
        return ""

    @renders("created_by")
    def creator(self):
        return _user_link(self.created_by)

    @property
    def changed_by_(self):
        return _user_link(self.changed_by)

    @renders("changed_on")
    def changed_on_(self):
        return Markup(f'<span class="no-wrap">{self.changed_on}</span>')

    @property
    def changed_on_humanized(self):
        return humanize.naturaltime(datetime.now() - self.changed_on)

    @renders("changed_on")
    def modified(self):
        return Markup(f'<span class="no-wrap">{self.changed_on_humanized}</span>')


class QueryResult:  # pylint: disable=too-few-public-methods

    """Object returned by the query interface"""

    def __init__(  # pylint: disable=too-many-arguments
        self, df, query, duration, status=QueryStatus.SUCCESS, error_message=None
    ):
        self.df = df  # pylint: disable=invalid-name
        self.query = query
        self.duration = duration
        self.status = status
        self.error_message = error_message


class ExtraJSONMixin:
    """Mixin to add an `extra` column (JSON) and utility methods"""

    extra_json = sa.Column(sa.Text, default="{}")

    @property
    def extra(self):
        try:
            return json.loads(self.extra_json)
        except Exception:  # pylint: disable=broad-except
            return {}

    def set_extra_json(self, d):
        self.extra_json = json.dumps(d)

    def set_extra_json_key(self, key, value):
        extra = self.extra
        extra[key] = value
        self.extra_json = json.dumps(extra)
