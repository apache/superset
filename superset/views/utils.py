from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict

from flask import g
from flask_appbuilder.security.sqla import models as ab_models

from superset import db


def bootstrap_user_data(given_username=None):
    if given_username:
        username = given_username
    else:
        username = g.user.username

    user = (
        db.session.query(ab_models.User)
        .filter_by(username=username)
        .one()
    )
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

    return {
        'username': user.username,
        'firstName': user.first_name,
        'lastName': user.last_name,
        'userId': user.id,
        'isActive': user.is_active(),
        'createdOn': user.created_on.isoformat(),
        'email': user.email,
        'roles': roles,
        'permissions': permissions,
    }
