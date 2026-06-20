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
from typing import Optional, TypedDict, Union

from flask_appbuilder.security.sqla.models import Group, Role
from flask_login import AnonymousUserMixin

from superset.utils.backports import StrEnum

logger = logging.getLogger(__name__)

# JWT claim that carries the revocation version a token was minted with.
GUEST_TOKEN_REVOCATION_CLAIM = "rev"  # noqa: S105

# Tokens minted before the revocation feature existed carry no version claim.
# They are treated as version 0, which is only rejected once an admin has
# explicitly bumped the expected version above 0.
DEFAULT_GUEST_TOKEN_REVOCATION_VERSION = 0


def get_current_guest_token_revocation_version() -> int:
    """
    Return the minimum guest-token revocation version accepted at validation time.

    The value is stored in the metadata database via the ``key_value`` store so it
    can be bumped at runtime (e.g. via the ``revoke-guest-tokens`` CLI command)
    without a code deploy. A missing entry means revocation has never been
    triggered, so the default version is returned.
    """
    # pylint: disable=import-outside-toplevel
    from superset.key_value.shared_entries import get_shared_value
    from superset.key_value.types import SharedKey

    try:
        value = get_shared_value(SharedKey.GUEST_TOKEN_REVOCATION_VERSION)
    except Exception:  # pylint: disable=broad-except
        # Never let a metadata-store hiccup hard-fail token validation; fall back
        # to the default version (fail-open to the pre-feature behaviour).
        logger.warning("Could not read guest token revocation version", exc_info=True)
        return DEFAULT_GUEST_TOKEN_REVOCATION_VERSION
    if value is None:
        return DEFAULT_GUEST_TOKEN_REVOCATION_VERSION
    try:
        return int(value)
    except (TypeError, ValueError):
        logger.warning("Invalid guest token revocation version stored: %r", value)
        return DEFAULT_GUEST_TOKEN_REVOCATION_VERSION


def bump_guest_token_revocation_version() -> int:
    """
    Increment and persist the guest-token revocation version, revoking every
    outstanding guest token minted with a lower version.

    :return: the new revocation version
    """
    # pylint: disable=import-outside-toplevel
    from superset.key_value.shared_entries import upsert_shared_value
    from superset.key_value.types import SharedKey

    new_version = get_current_guest_token_revocation_version() + 1
    upsert_shared_value(SharedKey.GUEST_TOKEN_REVOCATION_VERSION, new_version)
    logger.info("Bumped guest token revocation version to %d", new_version)
    return new_version


class GuestTokenUser(TypedDict, total=False):
    username: str
    first_name: str
    last_name: str


class GuestTokenResourceType(StrEnum):
    DASHBOARD = "dashboard"


class GuestTokenResource(TypedDict):
    type: GuestTokenResourceType
    id: Union[str, int]


GuestTokenResources = list[GuestTokenResource]


class GuestTokenRlsRule(TypedDict):
    dataset: Optional[str]
    clause: str


class _GuestTokenRequired(TypedDict):
    """Required JWT claims for a guest token payload."""

    iat: float
    exp: float
    user: GuestTokenUser
    resources: GuestTokenResources
    rls_rules: list[GuestTokenRlsRule]


class GuestToken(_GuestTokenRequired, total=False):
    """JWT claims for an embedded guest token.

    ``datasets`` is an optional allowlist of dataset IDs the guest may access.
    When absent the guest can access all datasets linked to the embedded dashboard,
    preserving existing behaviour.  When present only the listed IDs are permitted.
    """

    datasets: list[int]
    # Revocation version the token was minted with. Absent on tokens minted
    # before the revocation feature was introduced.
    rev: int


class GuestUser(AnonymousUserMixin):
    """
    Used as the "anonymous" user in case of guest authentication (embedded)
    """

    is_guest_user = True
    # FAB 5.0 renamed active to is_active, keeping both for backwards compatibility
    active = is_active = True

    @property
    def is_authenticated(self) -> bool:
        """
        This is set to true because guest users should be considered authenticated,
        at least in most places. The treatment of this flag is kind of inconsistent.
        """
        return True

    @property
    def is_anonymous(self) -> bool:
        """
        This is set to false because lots of code assumes that
        if user.is_anonymous, then role = Public
        But guest users need to have their own role independent of Public.
        """
        return False

    def __init__(self, token: GuestToken, roles: list[Role]):
        user = token["user"]
        self.guest_token = token
        self.username = user.get("username", "guest_user")
        self.first_name = user.get("first_name", "Guest")
        self.last_name = user.get("last_name", "User")
        self.roles = roles
        self.groups: list[Group] = []  # Guest users don't belong to any groups
        self.resources = token["resources"]
        self.rls = token.get("rls_rules", [])
