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
from collections import defaultdict
from urllib import parse

from flask import g, request
from flask_appbuilder.security.sqla import models as ab_models
import simplejson as json

from superset import app, db, viz
from superset.connectors.connector_registry import ConnectorRegistry
from superset.legacy import update_time_range
import superset.models.core as models


FORM_DATA_KEY_BLACKLIST = []
if not app.config.get('ENABLE_JAVASCRIPT_CONTROLS'):
    FORM_DATA_KEY_BLACKLIST = [
        'js_tooltip',
        'js_onclick_href',
        'js_data_mutator',
    ]


def bootstrap_user_data(username=None, include_perms=False):
    if not username:
        username = g.user.username

    user = (
        db.session.query(ab_models.User)
        .filter_by(username=username)
        .one()
    )

    payload = {
        'username': user.username,
        'firstName': user.first_name,
        'lastName': user.last_name,
        'userId': user.id,
        'isActive': user.is_active,
        'createdOn': user.created_on.isoformat(),
        'email': user.email,
    }

    if include_perms:
        roles, permissions = get_permissions(user)
        payload['roles'] = roles
        payload['permissions'] = permissions

    return payload


def get_permissions(user):
    if not user.roles:
        raise AttributeError('User object does not have roles')

    roles = {}
    permissions = defaultdict(set)
    for role in user.roles:
        perms = set()
        for perm in role.permissions:
            if perm.permission and perm.view_menu:
                perms.add(
                    (perm.permission.name, perm.view_menu.name),
                )
                if perm.permission.name in ('datasource_access',
                                            'database_access'):
                    permissions[perm.permission.name].add(perm.view_menu.name)
        roles[role.name] = [
            [perm.permission.name, perm.view_menu.name]
            for perm in role.permissions
            if perm.permission and perm.view_menu
        ]

    return roles, permissions


def get_viz(
        slice_id=None,
        form_data=None,
        datasource_type=None,
        datasource_id=None,
        force=False,
):
    if slice_id:
        slc = (
            db.session.query(models.Slice)
            .filter_by(id=slice_id)
            .one()
        )
        return slc.get_viz()
    else:
        viz_type = form_data.get('viz_type', 'table')
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        viz_obj = viz.viz_types[viz_type](
            datasource,
            form_data=form_data,
            force=force,
        )
        return viz_obj


def get_form_data(slice_id=None, use_slice_data=False):
    form_data = {}
    post_data = request.form.get('form_data')
    request_args_data = request.args.get('form_data')
    # Supporting POST
    if post_data:
        form_data.update(json.loads(post_data))
    # request params can overwrite post body
    if request_args_data:
        form_data.update(json.loads(request_args_data))

    url_id = request.args.get('r')
    if url_id:
        saved_url = db.session.query(models.Url).filter_by(id=url_id).first()
        if saved_url:
            url_str = parse.unquote_plus(
                saved_url.url.split('?')[1][10:], encoding='utf-8', errors=None)
            url_form_data = json.loads(url_str)
            # allow form_date in request override saved url
            url_form_data.update(form_data)
            form_data = url_form_data

    form_data = {
        k: v
        for k, v in form_data.items()
        if k not in FORM_DATA_KEY_BLACKLIST
    }

    # When a slice_id is present, load from DB and override
    # the form_data from the DB with the other form_data provided
    slice_id = form_data.get('slice_id') or slice_id
    slc = None

    # Check if form data only contains slice_id, additional filters and viz type
    valid_keys = ['slice_id', 'extra_filters', 'adhoc_filters', 'viz_type']
    valid_slice_id = all(key in valid_keys for key in form_data)

    # Include the slice_form_data if request from explore or slice calls
    # or if form_data only contains slice_id and additional filters
    if slice_id and (use_slice_data or valid_slice_id):
        slc = db.session.query(models.Slice).filter_by(id=slice_id).one_or_none()
        if slc:
            slice_form_data = slc.form_data.copy()
            slice_form_data.update(form_data)
            form_data = slice_form_data

    update_time_range(form_data)

    return form_data, slc


def get_datasource_info(datasource_id, datasource_type, form_data):
    """Compatibility layer for handling of datasource info

    datasource_id & datasource_type used to be passed in the URL
    directory, now they should come as part of the form_data,
    This function allows supporting both without duplicating code"""
    datasource = form_data.get('datasource', '')
    if '__' in datasource:
        datasource_id, datasource_type = datasource.split('__')
        # The case where the datasource has been deleted
        datasource_id = None if datasource_id == 'None' else datasource_id

    if not datasource_id:
        raise Exception(
            'The datasource associated with this chart no longer exists')
    datasource_id = int(datasource_id)
    return datasource_id, datasource_type
