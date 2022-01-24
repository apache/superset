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
import logging
from datetime import datetime, timedelta

import click
from colorama import Fore
from flask.cli import with_appcontext

import superset.utils.database as database_utils
from superset import app, security_manager
from superset.utils.celery import session_scope

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
def load_test_users() -> None:
    """
    Loads admin, alpha, and gamma user for testing purposes

    Syncs permissions for those users/roles
    """
    print(Fore.GREEN + "Loading a set of users for unit tests")
    load_test_users_run()


def load_test_users_run() -> None:
    """
    Loads admin, alpha, and gamma user for testing purposes

    Syncs permissions for those users/roles
    """
    if app.config["TESTING"]:

        sm = security_manager

        examples_db = database_utils.get_example_database()

        examples_pv = sm.add_permission_view_menu("database_access", examples_db.perm)

        sm.sync_role_definitions()
        gamma_sqllab_role = sm.add_role("gamma_sqllab")
        sm.add_permission_role(gamma_sqllab_role, examples_pv)

        gamma_no_csv_role = sm.add_role("gamma_no_csv")
        sm.add_permission_role(gamma_no_csv_role, examples_pv)

        for role in ["Gamma", "sql_lab"]:
            for perm in sm.find_role(role).permissions:
                sm.add_permission_role(gamma_sqllab_role, perm)

                if str(perm) != "can csv on Superset":
                    sm.add_permission_role(gamma_no_csv_role, perm)

        users = (
            ("admin", "Admin"),
            ("gamma", "Gamma"),
            ("gamma2", "Gamma"),
            ("gamma_sqllab", "gamma_sqllab"),
            ("alpha", "Alpha"),
            ("gamma_no_csv", "gamma_no_csv"),
        )
        for username, role in users:
            user = sm.find_user(username)
            if not user:
                sm.add_user(
                    username,
                    username,
                    "user",
                    username + "@fab.org",
                    sm.find_role(role),
                    password="general",
                )
        sm.get_session.commit()


@click.command()
@with_appcontext
def alert() -> None:
    """Run the alert scheduler loop"""
    # this command is just for testing purposes
    # pylint: disable=import-outside-toplevel
    from superset.models.schedules import ScheduleType
    from superset.tasks.schedules import schedule_window

    click.secho("Processing one alert loop", fg="green")
    with session_scope(nullpool=True) as session:
        schedule_window(
            report_type=ScheduleType.alert,
            start_at=datetime.now() - timedelta(1000),
            stop_at=datetime.now(),
            resolution=6000,
            session=session,
        )
