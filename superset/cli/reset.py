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

import sys

import click
from flask.cli import with_appcontext
from werkzeug.security import check_password_hash

from superset.cli.lib import feature_flags

if feature_flags.get("ENABLE_FACTORY_RESET_COMMAND"):

    @click.command()
    @with_appcontext
    @click.option("--username", prompt="Admin Username", help="Admin Username")
    @click.option(
        "--silent",
        is_flag=True,
        prompt=(
            "Are you sure you want to reset Superset? "
            "This action cannot be undone. Continue?"
        ),
        help="Confirmation flag",
    )
    @click.option(
        "--exclude-users",
        default=None,
        help="Comma separated list of users to exclude from reset",
    )
    @click.option(
        "--exclude-roles",
        default=None,
        help="Comma separated list of roles to exclude from reset",
    )
    def factory_reset(
        username: str, silent: bool, exclude_users: str, exclude_roles: str
    ) -> None:
        """Factory Reset Apache Superset"""

        # pylint: disable=import-outside-toplevel
        from superset import security_manager
        from superset.commands.security.reset import ResetSupersetCommand

        # Validate the user
        password = click.prompt("Admin Password", hide_input=True)
        user = security_manager.find_user(username)
        if not user or not check_password_hash(user.password, password):
            click.secho("Invalid credentials", fg="red")
            sys.exit(1)
        if not any(role.name == "Admin" for role in user.roles):
            click.secho("Permission Denied", fg="red")
            sys.exit(1)

        try:
            ResetSupersetCommand(silent, user, exclude_users, exclude_roles).run()
            click.secho("Factory reset complete", fg="green")
        except Exception as ex:  # pylint: disable=broad-except
            click.secho(f"Factory reset failed: {ex}", fg="red")
            sys.exit(1)
