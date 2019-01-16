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

from flask import g
from flask_appbuilder.security.sqla import models as ab_models

from superset import db


def bootstrap_user_data(username=None, include_perms=False):
    if username:
        username = username
    else:
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
