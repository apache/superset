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
"""Route-level tests for the one-time login token endpoints.

These complement ``tests/unit_tests/security/login_token_test.py``, which
exercises mint and consume directly. Driving the HTTP routes additionally covers
the decorator stack -- ``@transaction()`` in particular, which does not nest --
and the session cookie that ``login_user`` writes, neither of which the unit
tests can see.
"""

from contextlib import contextmanager
from typing import Any
from unittest.mock import patch
from uuid import UUID

from flask_appbuilder.security.sqla.manager import user_updating

from superset import db
from superset.daos.key_value import KeyValueDAO
from superset.extensions import csrf
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyValueResource
from superset.utils import json
from tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import GAMMA_USERNAME

ENDPOINT = "/api/v1/security/login-token/"
MINT_SECRET = "integration-test-secret"  # noqa: S105


def _resolver(request: Any, **kwargs: Any) -> dict[str, Any] | None:
    """Stand-in for a deployment resolver: a shared header plus a username.

    A real one would validate an id token or call an internal service; all this
    needs to do is distinguish an authorized caller from an unauthorized one.
    """
    if request.headers.get("X-Test-Mint-Secret") != MINT_SECRET:
        return None
    username = (request.get_json(silent=True) or {}).get("username")
    return {"username": username} if username else None


def _verbatim_resolver(request: Any, **kwargs: Any) -> dict[str, Any] | None:
    """Return the request body as ``userinfo``, unmodified.

    Lets a test drive an arbitrary resolver result through the real route, which
    is the only way to cover shapes a sensible resolver would not produce but a
    misbehaving one will.
    """
    if request.headers.get("X-Test-Mint-Secret") != MINT_SECRET:
        return None
    return request.get_json(silent=True) or None


@contextmanager
def csrf_enabled(app: Any) -> Any:
    """Turn real CSRF protection on for the duration of a test.

    The integration config sets ``WTF_CSRF_ENABLED = False``, so
    ``SupersetAppInitializer.configure_wtf`` never ran ``csrf.init_app`` and
    never applied ``WTF_CSRF_EXEMPT_LIST``. Flipping the config alone does
    nothing: there is no ``before_request`` hook to flip, and the defaults
    ``validate_csrf`` reads (``WTF_CSRF_METHODS``, ``WTF_CSRF_FIELD_NAME`` and
    the rest) are only set by ``init_app``.

    So the real ``init_app`` runs, rather than those defaults being restated
    here -- restating them would mean reimplementing part of what this is meant
    to verify. It registers a ``before_request`` hook and a context processor,
    which Flask refuses once a request has been served, so the setup guard is
    lifted for that call and everything it appended is removed afterwards. This
    keeps the test independent of its position in the suite.
    """
    got_first_request = app._got_first_request  # noqa: SLF001
    before = list(app.before_request_funcs.get(None, []))
    processors = list(app.template_context_processors.get(None, []))
    extension = app.extensions.get("csrf")
    exempt_views = set(csrf._exempt_views)  # noqa: SLF001
    config = {
        key: app.config[key] for key in list(app.config) if key.startswith("WTF_CSRF_")
    }

    try:
        app._got_first_request = False  # noqa: SLF001
        csrf.init_app(app)
        for view in app.config["WTF_CSRF_EXEMPT_LIST"]:
            csrf.exempt(view)
        app._got_first_request = got_first_request  # noqa: SLF001
        app.config["WTF_CSRF_ENABLED"] = True
        yield
    finally:
        app._got_first_request = got_first_request  # noqa: SLF001
        app.before_request_funcs[None] = before
        app.template_context_processors[None] = processors
        csrf._exempt_views = exempt_views  # noqa: SLF001
        for key in [k for k in list(app.config) if k.startswith("WTF_CSRF_")]:
            if key in config:
                app.config[key] = config[key]
            else:
                del app.config[key]
        if extension is None:
            app.extensions.pop("csrf", None)
        else:
            app.extensions["csrf"] = extension


class TestLoginTokenApi(SupersetTestCase):
    def _mint(self, username: str = GAMMA_USERNAME) -> str:
        """Mint a token through the route and return it."""
        response = self.client.post(
            ENDPOINT,
            data=json.dumps({"username": username}),
            content_type="application/json",
            headers={"X-Test-Mint-Secret": MINT_SECRET},
        )
        assert response.status_code == 200, response.data
        token = json.loads(response.data)["access_token"]
        assert token
        return token

    @staticmethod
    def _stored_tokens() -> int:
        return (
            db.session.query(KeyValueEntry)
            .filter(KeyValueEntry.resource == KeyValueResource.LOGIN_TOKEN.value)
            .count()
        )

    @staticmethod
    def _is_stored(token: str) -> bool:
        """Whether this specific token still has a row.

        Scoped to one key rather than counting the table: the metadata database
        is shared across the suite, so an absolute count couples these
        assertions to whatever other tests happen to have left behind.
        """
        return (
            KeyValueDAO.get_entry(KeyValueResource.LOGIN_TOKEN, UUID(token)) is not None
        )

    # ---------------------------------------------------------------- closed off

    def test_endpoints_are_404_without_the_feature_flag(self):
        """Closed by default: neither verb exists until the flag is on."""
        assert self.client.post(ENDPOINT).status_code == 404
        assert self.client.get(f"{ENDPOINT}?token=x").status_code == 404

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": None})
    def test_endpoints_are_404_without_a_resolver(self):
        """The flag alone is not enough -- a resolver must also be configured."""
        assert self.client.post(ENDPOINT).status_code == 404
        assert self.client.get(f"{ENDPOINT}?token=x").status_code == 404

    # --------------------------------------------------------------------- mint

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_mint_rejects_a_caller_the_resolver_declines(self):
        """No shared header, no token -- and nothing written to the store."""
        before = self._stored_tokens()
        response = self.client.post(
            ENDPOINT,
            data=json.dumps({"username": GAMMA_USERNAME}),
            content_type="application/json",
        )
        assert response.status_code == 401
        assert self._stored_tokens() == before

    # ------------------------------------------------------------------ consume

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_consume_establishes_a_session_and_redirects(self):
        """The happy path: 302 to `next`, and the frame is authenticated."""
        token = self._mint()
        response = self.client.get(f"{ENDPOINT}?token={token}&next=/dashboard/list/")

        assert response.status_code == 302
        assert response.headers["Location"] == "/dashboard/list/"

        # The session belongs to the resolved user, not to whoever called mint.
        me = self.client.get("/api/v1/me/")
        assert me.status_code == 200
        assert json.loads(me.data)["result"]["username"] == GAMMA_USERNAME

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_consume_is_single_use(self):
        """A spent token is refused on the second request."""
        token = self._mint()
        assert self.client.get(f"{ENDPOINT}?token={token}").status_code == 302
        assert self.client.get(f"{ENDPOINT}?token={token}").status_code == 401

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_consume_burn_survives_a_provisioning_rollback(self):
        """Burn durability when provisioning *declines*.

        Flask-AppBuilder's ``add_user`` / ``update_user`` catch their own
        failures, call ``rollback()`` on the shared session and return ``False``
        without raising -- and ``update_user_auth_stat`` discards that return
        value. Before ``consume`` committed the delete itself, that rollback
        discarded the pending DELETE, and a token already handed to a browser
        became redeemable a second time.

        This covers the 401 branch. The harder case -- a rollback on a login that
        nonetheless *succeeds* -- is
        :meth:`test_consume_burn_survives_a_failing_user_updating_hook`.
        """
        token = self._mint()

        def rollback_and_decline(_userinfo: Any) -> None:
            db.session.rollback()
            return None

        with patch.object(
            self.app.appbuilder.sm,
            "auth_user_oauth",
            side_effect=rollback_and_decline,
        ):
            first = self.client.get(f"{ENDPOINT}?token={token}")

        # Provisioning declined, so no session -- but the token is still spent.
        assert first.status_code == 401

        second = self.client.get(f"{ENDPOINT}?token={token}")
        assert second.status_code == 401, (
            "the token was redeemable after a provisioning rollback -- the burn "
            "was not committed independently of provisioning"
        )
        assert not self._is_stored(token)

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_consume_burn_survives_a_failing_user_updating_hook(self):
        """Burn durability on a login that *succeeds* despite a rollback.

        This is the worst case, and it uses the real Flask-AppBuilder code path
        rather than a patched security manager. In FAB 5.2.2,
        ``SecurityManager.update_user`` emits ``user_updating`` as a pre-commit
        signal *inside* its ``try``, and ``_emit_pre_signal`` re-raises whatever a
        handler throws. The handler's exception therefore lands in
        ``update_user``'s own ``except``, which calls ``rollback()`` on the shared
        session and returns ``False``.

        Nothing upstream notices: ``update_user_auth_stat`` discards that return
        value, and ``auth_user_oauth`` returns the user regardless. So the request
        completes as a **successful login** -- a 302 and a valid session cookie --
        while the rollback has silently undone whatever the endpoint had pending.

        If the burn were not committed inside ``consume``, the token would be back
        in the key-value store and redeemable for the rest of its TTL, even though
        the user is now logged in. ``FAB_SECURITY_SIGNALS_ENABLED`` defaults to
        ``True`` and Superset does not override it, so this is reachable in a
        default deployment, not a contrived one.
        """
        token = self._mint()

        def failing_hook(_sender: Any, **_kwargs: Any) -> None:
            raise RuntimeError("user_updating handler failed")

        # ``connected_to`` holds a strong reference for the duration; a plain
        # ``connect`` of a local function can be garbage collected before the
        # signal fires, which would silently make this test vacuous.
        with user_updating.connected_to(failing_hook):
            first = self.client.get(f"{ENDPOINT}?token={token}")

        # The login SUCCEEDED -- that is precisely what makes this dangerous.
        assert first.status_code == 302, (
            f"expected a successful login despite the failing hook, got "
            f"{first.status_code}"
        )

        second = self.client.get(f"{ENDPOINT}?token={token}")
        assert second.status_code == 401, (
            "the token was redeemable after a successful login whose "
            "user_updating hook rolled the session back -- the burn must be "
            "committed before provisioning runs"
        )
        assert not self._is_stored(token)

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_consume_rejects_unknown_and_malformed_tokens(self):
        """Missing, malformed and well-formed-but-unknown are the same 401."""
        for token in ("", "not-a-uuid", "6d2b9921-2274-43b8-94d6-e5e1f05372c4"):
            with self.subTest(token=token):
                response = self.client.get(f"{ENDPOINT}?token={token}")
                assert response.status_code == 401

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _verbatim_resolver})
    def test_empty_identity_keys_do_not_mint_a_doomed_token(self):
        """A token that mints must be redeemable, end to end.

        ``auth_user_oauth`` selects the identifier on key *presence*: ``if
        "username" in userinfo`` wins even when the value is empty, and the empty
        username is then rejected outright. So a resolver returning
        ``{"username": "", "email": ...}`` used to mint a perfectly good token
        that could only ever 401 on redemption, instead of falling back to the
        email. Surrounding whitespace failed the same way, via ``find_user``.

        Both now normalize before minting, so each of these redeems. Note FAB
        uses whichever value it selected as the ``find_user`` lookup key, which
        is why the email slot here holds a username rather than an address.
        """
        for userinfo in (
            {"username": "", "email": GAMMA_USERNAME},
            {"username": f"  {GAMMA_USERNAME}  "},
            {"username": "", "first_name": "", "email": GAMMA_USERNAME},
        ):
            with self.subTest(userinfo=userinfo):
                response = self.client.post(
                    ENDPOINT,
                    data=json.dumps(userinfo),
                    content_type="application/json",
                    headers={"X-Test-Mint-Secret": MINT_SECRET},
                )
                assert response.status_code == 200, response.data
                token = json.loads(response.data)["access_token"]

                redeemed = self.client.get(f"{ENDPOINT}?token={token}")
                assert redeemed.status_code == 302, (
                    f"minted a token for {userinfo} that could not be redeemed "
                    f"({redeemed.status_code}) -- empty or padded identity keys "
                    "must be normalized before minting"
                )

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _verbatim_resolver})
    def test_mint_rejects_an_identity_with_no_usable_identifier(self):
        """If nothing survives normalization there is no identity to mint for."""
        for userinfo in (
            {"username": "", "email": ""},
            {"username": "   "},
            {"first_name": "Jane", "last_name": "Doe"},
        ):
            with self.subTest(userinfo=userinfo):
                response = self.client.post(
                    ENDPOINT,
                    data=json.dumps(userinfo),
                    content_type="application/json",
                    headers={"X-Test-Mint-Secret": MINT_SECRET},
                )
                assert response.status_code == 401, response.data

    # --------------------------------------------------------------------- csrf

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_mint_is_csrf_exempt_with_protection_actually_on(self):
        """The mint POST must work with no session and no CSRF token.

        It is a server-to-server call from a backend that holds neither, so the
        entry in ``WTF_CSRF_EXEMPT_LIST`` is load-bearing: without it the flow
        cannot be used at all. Nothing else covers it, because the integration
        config disables CSRF outright -- so removing or misspelling that entry
        would leave the suite green and break production.
        """
        with csrf_enabled(self.app):
            # Control first. If CSRF were not genuinely active, every assertion
            # below would pass for the wrong reason, so prove a non-exempt POST
            # on the same blueprint is rejected before trusting the rest.
            control = self.client.post(
                "/api/v1/security/guest_token/",
                data=json.dumps({}),
                content_type="application/json",
            )
            assert control.status_code == 400, (
                "CSRF protection is not actually active, so this test proves "
                f"nothing (guest_token returned {control.status_code})"
            )

            # The exempt endpoint: no session, no CSRF token, still mints.
            response = self.client.post(
                ENDPOINT,
                data=json.dumps({"username": GAMMA_USERNAME}),
                content_type="application/json",
                headers={"X-Test-Mint-Secret": MINT_SECRET},
            )
            assert response.status_code == 200, response.data
            token = json.loads(response.data)["access_token"]

            # A rejected caller must fail on the credential, not on CSRF.
            rejected = self.client.post(
                ENDPOINT,
                data=json.dumps({"username": GAMMA_USERNAME}),
                content_type="application/json",
            )
            assert rejected.status_code == 401, rejected.data

        # The minted token is a real one, redeemable after the fact.
        assert self.client.get(f"{ENDPOINT}?token={token}").status_code == 302

    # --------------------------------------------------------------------- next

    @with_feature_flags(LOGIN_TOKEN=True)
    @with_config({"LOGIN_TOKEN_IDENTITY_RESOLVER": _resolver})
    def test_consume_falls_back_to_root_for_a_non_relative_next(self):
        """`next` is site-relative only; anything else lands on `/`.

        Absolute URLs are rejected even for the deployment's own origin. That is
        deliberate: comparing against ``WEBDRIVER_BASEURL`` would have made a
        legitimate same-origin URL depend on report-worker configuration.
        """
        for requested_next in (
            "https://superset.example.com/dashboard/1/",
            "//evil.example.com/",
            "/\\evil.example.com/",
            "javascript:alert(1)",
            # Encoded CR/LF. These must reject rather than normalize: a
            # surviving newline reaches `redirect()`, which Werkzeug refuses
            # with a ValueError, and @safe turns that into a 500 -- after the
            # token has been burned and the session cookie set, so the parent
            # application cannot retry.
            "%2Fdashboard%2F1%2F%0D%0AX-Injected:+yes",
            "%2F%0Adashboard%2F",
            "%2F%09dashboard",
        ):
            with self.subTest(next=requested_next):
                token = self._mint()
                response = self.client.get(
                    f"{ENDPOINT}?token={token}&next={requested_next}"
                )

                # Exactly `/`, not merely "ends with a slash": the rejected
                # input `https://superset.example.com/dashboard/1/` itself ends
                # with one, so a looser assertion would pass even if the route
                # stopped rejecting absolute URLs and redirected there verbatim.
                assert response.status_code == 302
                assert response.headers["Location"] == "/", (
                    f"`next={requested_next}` was not rejected; redirected to "
                    f"{response.headers['Location']}"
                )
