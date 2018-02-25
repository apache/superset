# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict

from superset import sm


def cleanup_permissions():
    # 1. Clean up duplicates.
    pvms = sm.get_session.query(sm.permissionview_model).all()
    print('# of permission view menues is: {}'.format(len(pvms)))
    pvms_dict = defaultdict(list)
    for pvm in pvms:
        pvms_dict[(pvm.permission, pvm.view_menu)].append(pvm)
    duplicates = [v for v in pvms_dict.values() if len(v) > 1]
    len(duplicates)

    for pvm_list in duplicates:
        first_prm = pvm_list[0]
        roles = set(first_prm.role)
        for pvm in pvm_list[1:]:
            roles = roles.union(pvm.role)
            sm.get_session.delete(pvm)
        first_prm.roles = list(roles)
    sm.get_session.commit()

    pvms = sm.get_session.query(sm.permissionview_model).all()
    print('STage 1: # of permission view menues is: {}'.format(len(pvms)))

    # 2. Clean up None permissions or view menues
    pvms = sm.get_session.query(sm.permissionview_model).all()
    for pvm in pvms:
        if not (pvm.view_menu and pvm.permission):
            sm.get_session.delete(pvm)
    sm.get_session.commit()

    pvms = sm.get_session.query(sm.permissionview_model).all()
    print('Stage 2: # of permission view menues is: {}'.format(len(pvms)))

    # 3. Delete empty permission view menues from roles
    roles = sm.get_session.query(sm.role_model).all()
    for role in roles:
        role.permissions = [p for p in role.permissions if p]
    sm.get_session.commit()

    # 4. Delete empty roles from permission view menues
    pvms = sm.get_session.query(sm.permissionview_model).all()
    for pvm in pvms:
        pvm.role = [r for r in pvm.role if r]
    sm.get_session.commit()


cleanup_permissions()
