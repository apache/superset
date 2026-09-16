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

import click
from flask import current_app
from flask.cli import with_appcontext

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
def revoke_guest_tokens() -> None:
    """
    Revoke all outstanding embedded guest tokens.

    Bumps the guest-token revocation version stored in the metadata database,
    which invalidates every guest token minted with a lower version. New tokens
    minted after this command will carry the bumped version and remain valid.

    Requires ``GUEST_TOKEN_REVOCATION_ENABLED = True``; otherwise the bumped
    version is not enforced at validation time.
    """
    # pylint: disable=import-outside-toplevel
    from superset.security.guest_token import bump_guest_token_revocation_version

    if not current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"]:
        click.secho(
            "Warning: GUEST_TOKEN_REVOCATION_ENABLED is False. The version will "
            "be bumped but is NOT enforced at validation time until you enable "
            "the feature.",
            fg="yellow",
        )

    new_version = bump_guest_token_revocation_version()
    click.secho(
        f"Revoked outstanding guest tokens. Revocation version is now {new_version}.",
        fg="green",
    )
