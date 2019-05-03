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
# pylint: disable=C,R,W
from typing import Callable

from flask import g, redirect
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from flask_sqlalchemy import BaseQuery

from superset import appbuilder, security_manager
from superset.models.sql_lab import Query, SavedQuery
from .base import BaseSupersetView, DeleteMixin, SupersetFilter, SupersetModelView


class QueryFilter(SupersetFilter):
    def apply(
            self,
            query: BaseQuery,
            func: Callable) -> BaseQuery:
        """
        Filter queries to only those owned by current user if
        can_only_access_owned_queries permission is set.

        :returns: query
        """
        if security_manager.can_only_access_owned_queries():
            query = (
                query
                .filter(Query.user_id == g.user.get_user_id())
            )
        return query


class QueryView(SupersetModelView):
    datamodel = SQLAInterface(Query)

    list_title = _('List Query')
    show_title = _('Show Query')
    add_title = _('Add Query')
    edit_title = _('Edit Query')

    list_columns = ['username', 'database_name', 'status', 'start_time', 'end_time']
    base_filters = [['id', QueryFilter, lambda: []]]
    label_columns = {
        'user': _('User'),
        'username': _('User'),
        'database_name': _('Database'),
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
    list_columns = [
        'id', 'label', 'sqlalchemy_uri', 'user_email', 'schema', 'description',
        'sql', 'extra_json']
    show_columns = [
        'label', 'db_id', 'schema', 'description', 'sql', 'extra_json']
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
    @has_access
    def my_queries(self):
        """Assigns a list of found users to the given role."""
        return redirect(
            '/savedqueryview/list/?_flt_0_user={}'.format(g.user.id))


appbuilder.add_view_no_menu(SqlLab)
