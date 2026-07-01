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
"""CLI command to sync the subjects table with FAB users, roles, and groups."""

import logging

import click
from flask.cli import with_appcontext

from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
@transaction()
def sync_subjects() -> None:
    """Sync the subjects table with all FAB users, roles, and groups.

    Ensures every user, role, and group has a corresponding Subject row
    with up-to-date labels, secondary labels, and active status.
    Removes orphaned Subject rows that no longer have a matching FAB entity.
    """
    from superset import db
    from superset.extensions import security_manager
    from superset.subjects.models import Subject
    from superset.subjects.sync import (
        sync_group_subject,
        sync_role_subject,
        sync_user_subject,
    )
    from superset.subjects.types import SubjectType

    user_model = security_manager.user_model
    role_model = security_manager.role_model

    # Sync users
    users = db.session.query(user_model).all()
    user_count = 0
    for user in users:
        sync_user_subject(user)
        user_count += 1
    click.echo(f"Synced {user_count} user subjects.")

    # Sync roles
    roles = db.session.query(role_model).all()
    role_count = 0
    for role in roles:
        sync_role_subject(role)
        role_count += 1
    click.echo(f"Synced {role_count} role subjects.")

    # Sync groups (table may not exist)
    group_count = 0
    try:
        from flask_appbuilder.models.sqla.interface import Group

        groups = db.session.query(Group).all()
        for group in groups:
            sync_group_subject(group)
            group_count += 1
        click.echo(f"Synced {group_count} group subjects.")
    except Exception:
        click.echo("Group table not found, skipping group sync.")

    # Remove orphaned subjects
    orphaned_users = (
        db.session.query(Subject)
        .filter(Subject.type == SubjectType.USER)
        .filter(~Subject.user_id.in_(db.session.query(user_model.id)))
        .all()
    )
    orphaned_roles = (
        db.session.query(Subject)
        .filter(Subject.type == SubjectType.ROLE)
        .filter(~Subject.role_id.in_(db.session.query(role_model.id)))
        .all()
    )
    if orphaned := orphaned_users + orphaned_roles:
        for subject in orphaned:
            db.session.delete(subject)
        click.echo(f"Removed {len(orphaned)} orphaned subjects.")

    click.echo("Subject sync complete.")
