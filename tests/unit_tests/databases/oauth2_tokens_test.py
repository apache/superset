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

from datetime import datetime
from typing import Any
from uuid import uuid4

import prison
import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset import security_manager
from superset.commands.database.exceptions import (
    DatabaseNotFoundError,
    OAuth2TokenNotFoundError,
    OAuth2TokensDeleteFailedError,
)
from superset.commands.database.oauth2 import (
    OAuth2DeleteTokensCommand,
)
from superset.daos.database import DatabaseDAO, DatabaseUserOAuth2TokensDAO
from superset.databases.api import DatabaseOAuth2TokensRestApi, DatabaseRestApi
from superset.databases.schemas import DatabaseOAuth2TokensDeleteSchema
from superset.models.core import Database, DatabaseUserOAuth2Tokens

DATABASE_ID = 1
ENDPOINT = f"/api/v1/database/{DATABASE_ID}/oauth2_tokens/"


@pytest.fixture
def token_rows(
    session: Session, mocker: MockerFixture
) -> list[DatabaseUserOAuth2Tokens]:
    """Create credentials on the unmodified metadata schema for two connections."""
    Database.metadata.create_all(session.get_bind())
    mocker.patch.object(DatabaseRestApi.datamodel, "_session", session)
    mocker.patch.object(DatabaseOAuth2TokensRestApi.datamodel, "_session", session)
    user_model = security_manager.user_model
    for user_id in range(1, 5):
        session.execute(
            user_model.__table__.insert().values(
                id=user_id,
                username=f"user{user_id}",
                first_name=f"First{user_id}",
                last_name="Example",
                email=f"user{user_id}@example.com",
                active=True,
            )
        )
    for database_id in (1, 2):
        session.execute(
            Database.__table__.insert().values(
                id=database_id,
                database_name=f"db{database_id}",
                sqlalchemy_uri="sqlite://",
                uuid=uuid4(),
            )
        )
    tokens = [
        DatabaseUserOAuth2Tokens(
            user_id=user_id,
            database_id=1 if user_id < 4 else 2,
            access_token=f"access-secret-{user_id}",
            refresh_token=f"refresh-secret-{user_id}",
            access_token_expiration=datetime(2027, 1, 1),
        )
        for user_id in range(1, 5)
    ]
    session.add_all(tokens)
    session.commit()
    return tokens


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"all": False},
        {"token_ids": []},
        {"token_ids": ["invalid"]},
        {"token_ids": [0]},
        {"token_ids": [-1]},
        {"token_ids": [True]},
        {"token_ids": [1.5]},
        {"token_ids": ["1"]},
        {"all": True, "token_ids": [1]},
        {"all": "true"},
        {"all": None},
        {"token_ids": [1] * 101},
    ],
)
def test_delete_scope_rejects_invalid_payload(payload: Any) -> None:
    """An invalid deletion scope must never become delete-all."""
    with pytest.raises(ValidationError):
        DatabaseOAuth2TokensDeleteSchema().load(payload)


@pytest.mark.parametrize(
    ("method", "suffix", "payload"),
    [
        ("GET", "", None),
        ("POST", "delete/", {"token_ids": [1]}),
        ("POST", "all/", None),
    ],
)
def test_management_routes_require_dedicated_permission(
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
    method: str,
    suffix: str,
    payload: dict[str, Any] | None,
) -> None:
    """Database read/write permission alone does not permit token management."""
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    access = mocker.patch.object(security_manager, "has_access", return_value=False)
    response = client.open(
        ENDPOINT + suffix,
        method=method,
        json=payload,
    )
    assert response.status_code == 403
    access.assert_called_with("can_manage_oauth2_tokens", "Database")


def test_delete_rejects_missing_database(mocker: MockerFixture) -> None:
    """Do not query credentials when the connection is missing or filtered out."""
    lookup = mocker.patch.object(DatabaseDAO, "find_by_id", return_value=None)
    tokens = mocker.patch.object(
        DatabaseUserOAuth2TokensDAO, "find_by_database_and_ids"
    )
    with pytest.raises(DatabaseNotFoundError):
        OAuth2DeleteTokensCommand(DATABASE_ID, [1]).run()
    lookup.assert_called_once_with(DATABASE_ID)
    tokens.assert_not_called()


@pytest.mark.parametrize("operation", ["list", "delete", "all"])
def test_management_respects_database_dao_filter(
    session: Session,
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
    operation: str,
) -> None:
    """A real DAO lookup must hide connections outside the caller's grants."""
    mocker.patch.object(
        security_manager, "can_access_all_databases", return_value=False
    )
    mocker.patch.object(security_manager, "user_view_menu_names", return_value=set())
    if operation == "list":
        response = client.get(ENDPOINT)
    elif operation == "all":
        response = client.post(ENDPOINT + "all/")
    else:
        response = client.post(ENDPOINT + "delete/", json={"token_ids": [1]})
    assert response.status_code == 404
    assert session.query(DatabaseUserOAuth2Tokens).count() == 4


def test_fab_listing_search_pagination_and_safe_columns(
    client: Any,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
) -> None:
    """FAB supports owner search and pagination without returning token secrets."""
    response = client.get(
        ENDPOINT, query_string={"q": prison.dumps({"page": 0, "page_size": 2})}
    )
    assert response.status_code == 200
    assert response.json["count"] == 3
    assert [row["user"]["username"] for row in response.json["result"]] == [
        "user1",
        "user2",
    ]
    assert "secret" not in str(response.json)
    assert "access_token" not in response.json["result"][0]
    assert "refresh_token" not in response.json["result"][0]
    response = client.get(
        ENDPOINT, query_string={"q": prison.dumps({"page": 1, "page_size": 2})}
    )
    assert response.json["result"][0]["user"]["username"] == "user3"
    for search in ("USER2", "First2", "First2 Example", "user2@example.com"):
        response = client.get(
            ENDPOINT,
            query_string={
                "q": prison.dumps(
                    {
                        "filters": [
                            {
                                "col": "id",
                                "opr": "oauth2_tokens_user",
                                "value": search,
                            }
                        ],
                    }
                )
            },
        )
        assert response.status_code == 200
        assert response.json["count"] == 1
        assert response.json["result"][0]["user"]["username"] == "user2"
    for argument in ("columns", "select_columns"):
        response = client.get(
            ENDPOINT,
            query_string={
                "q": prison.dumps({argument: ["access_token", "refresh_token"]})
            },
        )
        assert response.status_code == 200
        assert all(
            "access_token" not in row and "refresh_token" not in row
            for row in response.json["result"]
        )


def test_listing_cannot_override_database_scope(
    client: Any,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
) -> None:
    """Client filters cannot replace the database constraint from the route."""
    response = client.get(
        ENDPOINT,
        query_string={
            "q": prison.dumps(
                {"filters": [{"col": "database", "opr": "rel_o_m", "value": 2}]}
            )
        },
    )
    assert response.status_code == 200
    assert response.json["count"] == 0
    assert response.json["result"] == []


def test_fab_listing_caps_page_size(
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
) -> None:
    """Client pagination arguments cannot bypass the bounded FAB page size."""
    query = mocker.spy(DatabaseOAuth2TokensRestApi.datamodel, "query")
    response = client.get(
        ENDPOINT, query_string={"q": prison.dumps({"page_size": 1000})}
    )
    assert response.status_code == 200
    assert query.call_args.kwargs["page_size"] == 100
    assert (
        response.json["result"][0]["access_token_expiration"]
        == datetime(2027, 1, 1).isoformat()
    )


@pytest.mark.parametrize(
    ("ids", "expected"),
    [([1, 4], {1}), ([4], set()), ([1, 1, 2], {1, 2}), ([999], set()), ([], set())],
)
def test_scoped_token_lookup(
    token_rows: list[DatabaseUserOAuth2Tokens], ids: list[int], expected: set[int]
) -> None:
    """Exclude foreign and missing credentials before they reach the command."""
    tokens = DatabaseUserOAuth2TokensDAO.find_by_database_and_ids(1, ids)
    assert {token.id for token in tokens} == expected
    assert all(token.database_id == 1 for token in tokens)


@pytest.mark.parametrize("ids", [[1], [1, 2], [1, 1], [1, 1, 2]])
def test_selected_deletion_uses_base_dao(
    session: Session,
    mocker: MockerFixture,
    token_rows: list[DatabaseUserOAuth2Tokens],
    ids: list[int],
) -> None:
    """Validate selected IDs and delete complete credential rows through BaseDAO."""
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)
    delete = mocker.spy(DatabaseUserOAuth2TokensDAO, "delete")
    assert OAuth2DeleteTokensCommand(DATABASE_ID, ids).run() is None
    delete.assert_called_once()
    assert {token.id for token in delete.call_args.args[0]} == set(ids)
    assert session.query(DatabaseUserOAuth2Tokens).count() == 4 - len(set(ids))
    assert session.query(DatabaseUserOAuth2Tokens).filter_by(database_id=2).count() == 1


@pytest.mark.parametrize("ids", [[999], [1, 999], [4], [1, 4], [], [1, 1, 4]])
def test_selected_deletion_rejects_invalid_ids_atomically(
    session: Session,
    mocker: MockerFixture,
    token_rows: list[DatabaseUserOAuth2Tokens],
    ids: list[int],
) -> None:
    """Missing or foreign IDs prevent every deletion, including mixed duplicates."""
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)
    with pytest.raises(OAuth2TokenNotFoundError):
        OAuth2DeleteTokensCommand(DATABASE_ID, ids).run()
    assert session.query(DatabaseUserOAuth2Tokens).count() == 4


def test_delete_all_is_scoped_without_loading_tokens(
    session: Session,
    mocker: MockerFixture,
    token_rows: list[DatabaseUserOAuth2Tokens],
) -> None:
    """Delete-all uses one bulk operation and does not instantiate token models."""
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)
    lookup = mocker.spy(DatabaseUserOAuth2TokensDAO, "find_by_database_and_ids")
    delete = mocker.spy(DatabaseUserOAuth2TokensDAO, "delete")
    assert OAuth2DeleteTokensCommand(DATABASE_ID, delete_all=True).run() is None
    lookup.assert_not_called()
    delete.assert_not_called()
    assert session.query(DatabaseUserOAuth2Tokens).filter_by(database_id=2).count() == 1
    assert OAuth2DeleteTokensCommand(DATABASE_ID, delete_all=True).run() is None


@pytest.mark.parametrize("ids", [[999], [1, 4], [1, 1, 4]])
def test_delete_api_reports_invalid_selected_ids(
    session: Session,
    client: Any,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
    ids: list[int],
) -> None:
    """Return not-found for stale or foreign IDs without partially deleting rows."""
    response = client.post(ENDPOINT + "delete/", json={"token_ids": ids})
    assert response.status_code == 404
    assert session.query(DatabaseUserOAuth2Tokens).count() == 4


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"all": True},
        {"all": False},
        {"token_ids": []},
        {"all": True, "token_ids": [1]},
    ],
)
def test_delete_api_rejects_unsafe_scope_before_command(
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
    payload: dict[str, Any],
) -> None:
    """An invalid deletion request must never reach the mutation command."""
    command = mocker.patch("superset.databases.api.OAuth2DeleteTokensCommand")
    assert client.post(ENDPOINT + "delete/", json=payload).status_code == 400
    command.assert_not_called()


@pytest.mark.parametrize("payload", [{"token_ids": [1, 2]}, {"token_ids": [1, 1, 2]}])
def test_delete_api_returns_standard_success_message(
    session: Session,
    client: Any,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
    payload: dict[str, Any],
) -> None:
    """Selected deletion returns a success message without a count."""
    response = client.post(ENDPOINT + "delete/", json=payload)
    assert response.status_code == 200
    assert response.json == {"message": "OK"}
    assert session.query(DatabaseUserOAuth2Tokens).count() == 2


def test_delete_all_api_has_an_explicit_route(
    session: Session,
    client: Any,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
) -> None:
    """Only the explicit all route deletes every credential for the database."""
    response = client.post(ENDPOINT + "all/")
    assert response.status_code == 200
    assert response.json == {"message": "OK"}
    assert session.query(DatabaseUserOAuth2Tokens).count() == 1
    assert session.query(DatabaseUserOAuth2Tokens).one().database_id == 2


@pytest.mark.parametrize(
    "body", ["{}", '{"token_ids": [1]}', '{"all": true}', "null", "invalid"]
)
def test_delete_all_api_ignores_request_bodies(
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
    body: str,
) -> None:
    """The explicit all route determines deletion scope regardless of the body."""
    command = mocker.patch("superset.databases.api.OAuth2DeleteTokensCommand")
    response = client.post(
        ENDPOINT + "all/", data=body, content_type="application/json"
    )
    assert response.status_code == 200
    command.assert_called_once_with(DATABASE_ID, delete_all=True)
    command.return_value.run.assert_called_once_with()


def test_selected_deletion_rejects_an_absent_body(
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
) -> None:
    """A request without JSON cannot fall through to deletion of all tokens."""
    command = mocker.patch("superset.databases.api.OAuth2DeleteTokensCommand")
    assert client.post(ENDPOINT + "delete/").status_code == 400
    command.assert_not_called()


@pytest.mark.parametrize(
    ("token_ids", "delete_all"),
    [(None, False), ([1], True), ([], True)],
)
def test_delete_command_requires_exactly_one_explicit_mode(
    mocker: MockerFixture,
    token_ids: list[int] | None,
    delete_all: bool,
) -> None:
    """Neither omitted IDs nor conflicting modes can trigger a deletion."""
    lookup = mocker.patch.object(DatabaseDAO, "find_by_id")
    selected = mocker.patch.object(DatabaseUserOAuth2TokensDAO, "delete")
    all_tokens = mocker.patch.object(DatabaseUserOAuth2TokensDAO, "delete_all_tokens")
    with pytest.raises(ValueError, match="Specify token_ids or delete_all=True"):
        OAuth2DeleteTokensCommand(
            DATABASE_ID, token_ids=token_ids, delete_all=delete_all
        ).run()
    lookup.assert_not_called()
    selected.assert_not_called()
    all_tokens.assert_not_called()


@pytest.mark.parametrize("delete_all", [False, True])
@pytest.mark.parametrize("failure_phase", ["mutation", "commit"])
def test_deletion_failures_roll_back_and_raise_domain_error(
    session: Session,
    mocker: MockerFixture,
    token_rows: list[DatabaseUserOAuth2Tokens],
    delete_all: bool,
    failure_phase: str,
) -> None:
    """Translate database failures after rolling back both selected and all deletion."""
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)
    failure = SQLAlchemyError("database-failure-sentinel")
    rollback = mocker.spy(session, "rollback")
    commit = mocker.spy(session, "commit")
    if failure_phase == "commit":
        commit = mocker.patch.object(session, "commit", side_effect=failure)
    else:
        mocker.patch.object(
            DatabaseUserOAuth2TokensDAO,
            "delete_all_tokens" if delete_all else "delete",
            side_effect=failure,
        )
    command = (
        OAuth2DeleteTokensCommand(DATABASE_ID, delete_all=True)
        if delete_all
        else OAuth2DeleteTokensCommand(DATABASE_ID, token_ids=[1, 2])
    )
    with pytest.raises(OAuth2TokensDeleteFailedError) as raised:
        command.run()
    assert raised.value.__cause__ is failure
    rollback.assert_called_once()
    if failure_phase == "commit":
        commit.assert_called_once()
    else:
        commit.assert_not_called()
    assert session.query(DatabaseUserOAuth2Tokens).count() == 4


@pytest.mark.parametrize("delete_all", [False, True])
def test_deletion_routes_report_domain_failure_consistently(
    session: Session,
    client: Any,
    mocker: MockerFixture,
    full_api_access: None,
    token_rows: list[DatabaseUserOAuth2Tokens],
    delete_all: bool,
) -> None:
    """Both routes return a deletion error without exposing the database exception."""
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "delete_all_tokens" if delete_all else "delete",
        side_effect=SQLAlchemyError("database-failure-sentinel"),
    )
    response = (
        client.post(ENDPOINT + "all/")
        if delete_all
        else client.post(ENDPOINT + "delete/", json={"token_ids": [1, 2]})
    )
    assert response.status_code == 422
    assert response.json == {"message": "OAuth2 tokens could not be deleted."}
    assert "database-failure-sentinel" not in response.get_data(as_text=True)
    assert session.query(DatabaseUserOAuth2Tokens).count() == 4
