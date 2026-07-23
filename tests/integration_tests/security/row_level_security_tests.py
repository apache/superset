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
# isort:skip_file
import re
from typing import Any, Optional
from unittest import mock

import pytest
from flask import g
import rison

from superset import db, security_manager
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.security.guest_token import (
    GuestTokenResourceType,
    GuestUser,
)
from superset.utils import json
from flask_babel import lazy_gettext as _  # noqa: F401
from flask_appbuilder.models.sqla import filters
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,  # noqa: F401
    load_energy_table_data,  # noqa: F401
)
from tests.integration_tests.fixtures.unicode_dashboard import (
    UNICODE_TBL_NAME,  # noqa: F401
    load_unicode_dashboard_with_slice,  # noqa: F401
    load_unicode_data,  # noqa: F401
)
from tests.integration_tests.test_app import app, login

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

QUERY_OBJ: dict[str, Any] = dict(  # noqa: C408
    groupby=[],
    metrics=None,
    filter=[],
    is_timeseries=False,
    columns=["value"],
    granularity=None,
    from_dttm=None,
    to_dttm=None,
    extras={},
)

NAME_AB_ROLE = "NameAB"
NAME_Q_ROLE = "NameQ"
NAMES_A_REGEX = re.compile(r"name like 'A%'")
NAMES_B_REGEX = re.compile(r"name like 'B%'")
NAMES_Q_REGEX = re.compile(r"name like 'Q%'")
BASE_FILTER_REGEX = re.compile(r"gender = 'boy'")

DEFAULT_PASSWORD = "general"  # noqa: S105

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_table(
    name: str, database_id: Optional[int] = None, schema: Optional[str] = None
) -> SqlaTable:
    """Delegate to SupersetTestCase.get_table (static helper)."""
    return SupersetTestCase.get_table(name=name, database_id=database_id, schema=schema)


def _get_user(username: str):
    return SupersetTestCase.get_user(username)


def _get_test_dataset() -> Optional[SqlaTable]:
    return (
        db.session.query(SqlaTable).filter(SqlaTable.table_name == "table1")
    ).one_or_none()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_client(app_context):
    """Provide a logged-in admin test client."""
    with app.test_client() as client:
        login(client, username=ADMIN_USERNAME, password=DEFAULT_PASSWORD)
        yield client


@pytest.fixture
def rls_filters(app_context):
    """Create RLS filter test data with proper session management.

    Wraps all FAB role / user mutations in ``no_autoflush`` to prevent the
    Subject-sync hooks from triggering premature autoflush of unrelated
    pending objects (e.g. RLS M2M associations).
    """
    # Defensive cleanup of any leftover data from a previous failed run
    _cleanup_rls_data()
    with db.session.no_autoflush:
        # Create roles
        role_ab = security_manager.add_role(NAME_AB_ROLE)
        role_q = security_manager.add_role(NAME_Q_ROLE)
        gamma_user = security_manager.find_user(username="gamma")
        gamma_user.roles.append(role_ab)
        gamma_user.roles.append(role_q)
        SupersetTestCase.create_user_with_roles("NoRlsRoleUser", ["Gamma"])

    db.session.commit()

    # Helper: look up the ROLE-type Subject for a given role
    def _role_subject(role_name: str) -> "Subject":
        role = security_manager.find_role(role_name)
        return (
            db.session.query(Subject)
            .filter_by(role_id=role.id, type=SubjectType.ROLE)
            .one()
        )

    with db.session.no_autoflush:
        # Create regular RowLevelSecurityFilter (energy_usage, unicode_test)
        rls_entry1 = RowLevelSecurityFilter()
        rls_entry1.name = "rls_entry1"
        rls_entry1.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["energy_usage", "unicode_test"]))
            .all()
        )
        rls_entry1.filter_type = "Regular"
        rls_entry1.clause = "value > {{ cache_key_wrapper(1) }}"
        rls_entry1.group_key = None
        rls_entry1.subjects.append(_role_subject("Gamma"))
        rls_entry1.subjects.append(_role_subject("Alpha"))
        db.session.add(rls_entry1)

        # Create regular RowLevelSecurityFilter (birth_names name starts with A or B)
        rls_entry2 = RowLevelSecurityFilter()
        rls_entry2.name = "rls_entry2"
        rls_entry2.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["birth_names"]))
            .all()
        )
        rls_entry2.filter_type = "Regular"
        rls_entry2.clause = "name like 'A%' or name like 'B%'"
        rls_entry2.group_key = "name"
        rls_entry2.subjects.append(_role_subject("NameAB"))
        db.session.add(rls_entry2)

        # Create Regular RowLevelSecurityFilter (birth_names name starts with Q)
        rls_entry3 = RowLevelSecurityFilter()
        rls_entry3.name = "rls_entry3"
        rls_entry3.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["birth_names"]))
            .all()
        )
        rls_entry3.filter_type = "Regular"
        rls_entry3.clause = "name like 'Q%'"
        rls_entry3.group_key = "name"
        rls_entry3.subjects.append(_role_subject("NameQ"))
        db.session.add(rls_entry3)

        # Create Base RowLevelSecurityFilter (birth_names boys)
        rls_entry4 = RowLevelSecurityFilter()
        rls_entry4.name = "rls_entry4"
        rls_entry4.tables.extend(
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(["birth_names"]))
            .all()
        )
        rls_entry4.filter_type = "Base"
        rls_entry4.clause = "gender = 'boy'"
        rls_entry4.group_key = "gender"
        rls_entry4.subjects.append(_role_subject("Admin"))
        db.session.add(rls_entry4)

    db.session.commit()

    yield {
        "rls_entry1": rls_entry1,
        "rls_entry2": rls_entry2,
        "rls_entry3": rls_entry3,
        "rls_entry4": rls_entry4,
    }

    # Cleanup
    _cleanup_rls_data()


def _cleanup_rls_data():
    """Remove all RLS test data, tolerating missing/detached objects."""
    db.session.rollback()
    with db.session.no_autoflush:
        for name in ["rls_entry1", "rls_entry2", "rls_entry3", "rls_entry4"]:
            if entry := (
                db.session.query(RowLevelSecurityFilter).filter_by(name=name).first()
            ):
                db.session.delete(entry)
        db.session.flush()
        # Remove test roles from gamma before deleting the roles
        gamma_user = security_manager.find_user(username="gamma")
        if gamma_user:
            gamma_user.roles = [
                r for r in gamma_user.roles if r.name not in [NAME_AB_ROLE, NAME_Q_ROLE]
            ]
        for role_name in [NAME_AB_ROLE, NAME_Q_ROLE]:
            if role := security_manager.find_role(role_name):
                db.session.delete(role)
        if user := _get_user("NoRlsRoleUser"):
            db.session.delete(user)
    db.session.commit()


@pytest.fixture
def create_dataset(app_context):
    """Create a temporary dataset for API tests."""
    # Clean up leftover from a previous failed run
    _cleanup_test_dataset()

    dataset = SqlaTable(database_id=1, schema=None, table_name="table1")
    db.session.add(dataset)
    db.session.flush()
    db.session.commit()

    yield dataset

    _cleanup_test_dataset()


def _cleanup_test_dataset():
    """Remove the test dataset, tolerating missing objects."""
    db.session.rollback()
    dataset = db.session.query(SqlaTable).filter_by(table_name="table1").first()
    if dataset:
        db.session.delete(dataset)
        db.session.commit()


def _subject_for_role(role: Any) -> Subject:
    """Return the ROLE-type subject for a FAB role."""
    from superset.subjects.sync import sync_role_subject

    sync_role_subject(role)
    db.session.flush()
    return (
        db.session.query(Subject)
        .filter_by(role_id=role.id, type=SubjectType.ROLE)
        .one()
    )


class TestRowLevelSecurityUpdateAPI(SupersetTestCase):
    def test_invalid_id_failure(self):
        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [1],
            "subjects": [1],
        }
        rv = self.client.put("/api/v1/rowlevelsecurity/99999999", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 404
        assert data["message"] == "Not found"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_subject_failure(self):
        table = db.session.query(SqlaTable).first()

        rls = RowLevelSecurityFilter(
            name="rls test invalid role",
            clause="1=1",
            filter_type="Regular",
            tables=[table],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "subjects": [999999],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Subjects are invalid']"

        db.session.delete(rls)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_invalid_table_failure(self):
        table = db.session.query(SqlaTable).first()

        rls = RowLevelSecurityFilter(
            name="rls test invalid role",
            clause="1=1",
            filter_type="Regular",
            tables=[table],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls 1",
            "clause": "1=1",
            "filter_type": "Base",
            "tables": [999999],
            "subjects": [1],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
        assert status_code == 422
        assert data["message"] == "[l'Datasource does not exist']"

        db.session.delete(rls)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_put_success(self):
        tables = db.session.query(SqlaTable).limit(2).all()
        roles = db.session.query(security_manager.role_model).limit(2).all()
        role_subjects = [_subject_for_role(role) for role in roles]

        rls = RowLevelSecurityFilter(
            name="rls 1",
            clause="1=1",
            filter_type="Regular",
            tables=[tables[0]],
            subjects=[role_subjects[0]],
        )
        db.session.add(rls)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        payload = {
            "name": "rls put success",
            "clause": "2=2",
            "filter_type": "Base",
            "tables": [tables[1].id],
            "subjects": [role_subjects[1].id],
        }
        rv = self.client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
        status_code, _data = rv.status_code, json.loads(rv.data.decode("utf-8"))  # noqa: F841

        assert status_code == 200

        rls = (
            db.session.query(RowLevelSecurityFilter)
            .filter(RowLevelSecurityFilter.id == rls.id)
            .one_or_none()
        )

        assert rls.name == "rls put success"
        assert rls.clause == "2=2"
        assert rls.filter_type == "Base"
        assert rls.tables[0].id == tables[1].id
        assert rls.subjects[0].role_id == roles[1].id

        db.session.delete(rls)
        db.session.commit()


class TestRowLevelSecurityDeleteAPI(SupersetTestCase):
    def test_invalid_id_failure(self):
        self.login(ADMIN_USERNAME)

        ids_to_delete = rison.dumps([10000, 10001, 100002])
        rv = self.client.delete(f"/api/v1/rowlevelsecurity/?q={ids_to_delete}")
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

        assert status_code == 404
        assert data["message"] == "Not found"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_bulk_delete_success(self):
        tables = db.session.query(SqlaTable).limit(2).all()
        roles = db.session.query(security_manager.role_model).limit(2).all()
        role_subjects = [_subject_for_role(role) for role in roles]

        rls_1 = RowLevelSecurityFilter(
            name="rls 1",
            clause="1=1",
            filter_type="Regular",
            tables=[tables[0]],
            subjects=[role_subjects[0]],
        )
        rls_2 = RowLevelSecurityFilter(
            name="rls 2",
            clause="2=2",
            filter_type="Base",
            tables=[tables[1]],
            subjects=[role_subjects[1]],
        )
        db.session.add_all([rls_1, rls_2])
        db.session.commit()

        self.login(ADMIN_USERNAME)

        ids_to_delete = rison.dumps([rls_1.id, rls_2.id])
        rv = self.client.delete(f"/api/v1/rowlevelsecurity/?q={ids_to_delete}")
        status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

        assert status_code == 200
        assert data["message"] == "Deleted 2 rules"


class TestRowLevelSecurityWithRelatedAPI(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_data")
    @pytest.mark.usefixtures("load_energy_table_data")
    def test_rls_tables_related_api(self):
        self.login(ADMIN_USERNAME)

        params = rison.dumps({"page": 0, "page_size": 100})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]

        db_tables = db.session.query(SqlaTable).all()

        db_table_names = {t.name for t in db_tables}
        received_tables = {table["text"] for table in result}

        assert data["count"] == len(db_tables)
        assert len(result) == len(db_tables)
        assert db_table_names == received_tables

    def test_rls_tables_related_api_with_filter_matching_birth(self):
        self.login(ADMIN_USERNAME)
        # Test with filter that should match 'birth_names'
        params = rison.dumps({"filter": "birth", "page": 0, "page_size": 100})
        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]
        received_tables = {table["text"] for table in result}
        # Should only return tables with 'birth' in the name
        assert all("birth" in table_name.lower() for table_name in received_tables)
        assert len(result) >= 1  # At least birth_names should be returned

    @pytest.mark.usefixtures("load_birth_names_data")
    def test_rls_tables_related_api_returns_all_masked_matches(self):
        """
        Regression for #29707: the RLS dataset selector's async search must
        return *every* dataset whose name matches the typed mask, not a
        truncated subset. The reporter had two "birth" datasets (birth_names
        and birth_france_by_region) and searching "birth" showed an
        incomplete list. This exercises the backend ``related/tables``
        endpoint that feeds that selector to prove whether the search-by-mask
        lookup is the culprit.
        """
        self.login(ADMIN_USERNAME)

        birth_names = self.get_table(name="birth_names")
        # Create a sibling dataset whose name also contains the "birth" mask,
        # mirroring the two-dataset scenario from the issue.
        sibling = SqlaTable(
            table_name="birth_france_by_region",
            database=birth_names.database,
            schema=birth_names.schema,
        )
        db.session.add(sibling)
        db.session.commit()

        try:
            # Datasets in the metadata DB that match the "birth" mask. Keep a
            # sorted list rather than a set so datasets that render the same
            # display name (same table/schema across databases) are not
            # collapsed, which would let the multiplicity disagree with the
            # API's row count below.
            expected = sorted(
                t.name
                for t in db.session.query(SqlaTable)
                .filter(SqlaTable.table_name.ilike("%birth%"))
                .all()
            )
            # Both datasets must be present in the ground truth for the
            # assertion below to be meaningful.
            bare_names = {name.split(".")[-1] for name in expected}
            assert "birth_names" in bare_names
            assert "birth_france_by_region" in bare_names

            params = rison.dumps({"filter": "birth", "page": 0, "page_size": 100})
            rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
            assert rv.status_code == 200
            data = json.loads(rv.data.decode("utf-8"))
            received = sorted(table["text"] for table in data["result"])

            # The masked search must return *all* matching datasets (preserving
            # multiplicity), and the advertised count must not under-report them.
            assert received == expected
            assert data["count"] == len(expected)
        finally:
            db.session.delete(sibling)
            db.session.commit()

    def test_rls_tables_related_api_with_filter_no_matches(self):
        self.login(ADMIN_USERNAME)
        # Test with filter that should match nothing
        params = rison.dumps({"filter": "nonexistent", "page": 0, "page_size": 100})
        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]
        assert len(result) == 0
        assert data["count"] == 0

    def test_rls_subjects_related_api(self):
        self.login(ADMIN_USERNAME)
        params = rison.dumps({"page": 0, "page_size": 100})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/subjects?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]

        assert data["count"] > 0
        assert len(result) > 0

    def test_rls_subjects_related_api_honors_filter_31466(self):
        """
        Regression for #31466: with more than 100 roles the RLS picker could
        not see or select roles beyond the first (default) page of 100 because
        the ``related/roles`` endpoint silently ignored the search ``filter``
        term. The RLS subject/role picker now lives at ``related/subjects``,
        and this test asserts the search term actually narrows the result to
        matching subjects, so any role remains reachable by name regardless of
        how many roles exist.
        """
        self.login(ADMIN_USERNAME)

        # A role label that cannot collide with the built-in roles/subjects
        # (Admin, Public, Alpha, Gamma, sql_lab, ...).
        unique_marker = "zzz_rls_31466"
        role_name = f"{unique_marker}_special_role"
        role = security_manager.add_role(role_name)
        db.session.commit()
        subject = _subject_for_role(role)
        db.session.commit()

        # Ensure ROLE-type subjects are visible in the RLS picker (the scenario
        # from #31466, where roles drive RLS). This is what the original
        # ``related/roles`` endpoint used to serve unconditionally.
        original_types = self.app.config.get("SUBJECTS_RELATED_TYPES_RLS")
        self.app.config["SUBJECTS_RELATED_TYPES_RLS"] = [SubjectType.ROLE]
        try:
            params = rison.dumps({"filter": unique_marker, "page": 0, "page_size": 100})
            rv = self.client.get(
                f"/api/v1/rowlevelsecurity/related/subjects?q={params}"
            )
            assert rv.status_code == 200
            data = json.loads(rv.data.decode("utf-8"))
            received = {r["text"] for r in data["result"]}

            # The role must be findable via the search term ...
            assert role_name in received
            # ... and the filter must narrow the result to matching subjects
            # only. If the search term were ignored (the #31466 bug), other
            # roles that do not contain the marker would leak through and this
            # assertion would fail.
            assert all(unique_marker in text for text in received), (
                "related/subjects ignored the filter term and returned "
                f"non-matching subjects: {sorted(received)}"
            )
        finally:
            self.app.config["SUBJECTS_RELATED_TYPES_RLS"] = original_types
            db.session.delete(subject)
            db.session.delete(role)
            db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch(
        "superset.row_level_security.api.RLSRestApi.base_related_field_filters",
        {"tables": [["table_name", filters.FilterStartsWith, "birth"]]},
    )
    def test_table_related_filter(self):
        self.login(ADMIN_USERNAME)

        params = rison.dumps({"page": 0, "page_size": 10})

        rv = self.client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]
        received_tables = {table["text"].split(".")[-1] for table in result}

        assert data["count"] == 1
        assert len(result) == 1
        assert {"birth_names"} == received_tables

    def test_get_all_related_subjects_with_extra_filters(self):
        """
        API: Test get filter related subjects with extra related query filters
        """
        self.login(ADMIN_USERNAME)

        rv = self.client.get("/api/v1/rowlevelsecurity/related/subjects")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] > 0


# ---------------------------------------------------------------------------
# Guest token helpers
# ---------------------------------------------------------------------------

RLS_ALICE_REGEX = re.compile(r"name = 'Alice'")
RLS_GENDER_REGEX = re.compile(r"AND \([\s\n]*gender = 'girl'[\s\n]*\)")


def _default_rls_rule():
    return {
        "dataset": _get_table(name="birth_names").id,
        "clause": "name = 'Alice'",
    }


def _guest_user_with_rls(rules: Optional[list[Any]] = None) -> GuestUser:
    if rules is None:
        rules = [_default_rls_rule()]
    return security_manager.get_guest_user_from_token(
        {
            "user": {},
            "resources": [
                {
                    "type": GuestTokenResourceType.DASHBOARD,
                    "id": "06383667-3e02-4e5e-843f-44e9c5896b6c",
                }
            ],
            "rls_rules": rules,
            "iat": 10,
            "exp": 20,
        }
    )


# ===========================================================================
# Tests: Row Level Security (main filter tests)
# ===========================================================================


@pytest.mark.usefixtures("create_dataset", "rls_filters")
def test_model_view_rls_add_success(admin_client):
    test_dataset = _get_test_dataset()
    rv = admin_client.post(
        "/api/v1/rowlevelsecurity/",
        json={
            "name": "rls1",
            "description": "Some description",
            "filter_type": "Regular",
            "tables": [test_dataset.id],
            "subjects": [_subject_for_role(security_manager.find_role("Alpha")).id],
            "group_key": "group_key_1",
            "clause": "client_id=1",
        },
    )
    assert rv.status_code == 201
    rls1 = (
        db.session.query(RowLevelSecurityFilter).filter_by(name="rls1")
    ).one_or_none()
    assert rls1 is not None

    # Revert data changes
    db.session.delete(rls1)
    db.session.commit()


@pytest.mark.usefixtures("create_dataset", "rls_filters")
def test_model_view_rls_add_name_unique(admin_client):
    test_dataset = _get_test_dataset()
    rv = admin_client.post(
        "/api/v1/rowlevelsecurity/",
        json={
            "name": "rls_entry1",
            "description": "Some description",
            "filter_type": "Regular",
            "tables": [test_dataset.id],
            "subjects": [_subject_for_role(security_manager.find_role("Alpha")).id],
            "group_key": "group_key_1",
            "clause": "client_id=1",
        },
    )
    assert rv.status_code == 422


@pytest.mark.usefixtures("create_dataset", "rls_filters")
def test_model_view_rls_add_tables_required(admin_client):
    rv = admin_client.post(
        "/api/v1/rowlevelsecurity/",
        json={
            "name": "rls1",
            "description": "Some description",
            "filter_type": "Regular",
            "tables": [],
            "subjects": [_subject_for_role(security_manager.find_role("Alpha")).id],
            "group_key": "group_key_1",
            "clause": "client_id=1",
        },
    )
    assert rv.status_code == 400
    data = json.loads(rv.data.decode("utf-8"))
    assert data["message"] == {"tables": ["Shorter than minimum length 1."]}


@pytest.mark.usefixtures("load_energy_table_with_slice", "rls_filters")
def test_rls_filter_alters_energy_query():
    g.user = _get_user(username="alpha")
    tbl = _get_table(name="energy_usage")
    sql = tbl.get_query_str(QUERY_OBJ)
    assert tbl.get_extra_cache_keys(QUERY_OBJ) == [1]
    assert "value > 1" in sql


@pytest.mark.usefixtures("load_energy_table_with_slice", "rls_filters")
def test_rls_filter_doesnt_alter_energy_query():
    g.user = _get_user(username="admin")
    tbl = _get_table(name="energy_usage")
    sql = tbl.get_query_str(QUERY_OBJ)
    assert tbl.get_extra_cache_keys(QUERY_OBJ) == []
    assert "value > 1" not in sql


@pytest.mark.usefixtures("load_unicode_dashboard_with_slice", "rls_filters")
def test_multiple_table_filter_alters_another_tables_query():
    g.user = _get_user(username="alpha")
    tbl = _get_table(name="unicode_test")
    sql = tbl.get_query_str(QUERY_OBJ)
    assert tbl.get_extra_cache_keys(QUERY_OBJ) == [1]
    assert "value > 1" in sql


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_rls_filter_alters_gamma_birth_names_query():
    g.user = _get_user(username="gamma")
    tbl = _get_table(name="birth_names")
    sql = tbl.get_query_str(QUERY_OBJ)

    # establish that the filters are grouped together correctly with
    # ANDs, ORs and parens in the correct place
    normalized_sql = " ".join(
        sql.replace("%%", "%").replace("`", "").replace('"', "").split()
    )
    column_prefix = r"(?:\w+\.)*"
    name_column = rf"{column_prefix}name"
    gender_column = rf"{column_prefix}gender"
    name_ab_filter = (
        rf"\(*{name_column}\s+like\s+'A%'\s+or\s+"
        rf"{name_column}\s+like\s+'B%'\)*"
    )
    name_q_filter = rf"\(*{name_column}\s+like\s+'Q%'\)*"
    # Filters in the same group can be returned in either order by the metadata DB.
    name_filters = (
        rf"(?:\(*{name_ab_filter}\s+OR\s+{name_q_filter}\)*|"
        rf"\(*{name_q_filter}\s+OR\s+{name_ab_filter}\)*)"
    )
    base_filter = rf"\(*{gender_column}\s*=\s*'boy'\)*"
    expected_filters = {
        rf"WHERE\s+\(*{name_filters}\)*\s+AND\s+{base_filter}",
        rf"WHERE\s+{base_filter}\s+AND\s+\(*{name_filters}\)*",
    }
    assert any(
        re.search(expected_filter, normalized_sql, flags=re.IGNORECASE)
        for expected_filter in expected_filters
    ), normalized_sql


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_rls_filter_alters_no_role_user_birth_names_query():
    g.user = _get_user(username="NoRlsRoleUser")
    tbl = _get_table(name="birth_names")
    sql = tbl.get_query_str(QUERY_OBJ)

    # gamma's filters should not be present query
    assert not NAMES_A_REGEX.search(sql)
    assert not NAMES_B_REGEX.search(sql)
    assert not NAMES_Q_REGEX.search(sql)
    # base query should be present
    assert BASE_FILTER_REGEX.search(sql)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_rls_filter_doesnt_alter_admin_birth_names_query():
    g.user = _get_user(username="admin")
    tbl = _get_table(name="birth_names")
    sql = tbl.get_query_str(QUERY_OBJ)

    # no filters are applied for admin user
    assert not NAMES_A_REGEX.search(sql)
    assert not NAMES_B_REGEX.search(sql)
    assert not NAMES_Q_REGEX.search(sql)
    assert not BASE_FILTER_REGEX.search(sql)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_get_rls_cache_key():
    g.user = _get_user(username="admin")
    tbl = _get_table(name="birth_names")
    clauses = security_manager.get_rls_cache_key(tbl)
    assert clauses == []

    g.user = _get_user(username="gamma")
    clauses = security_manager.get_rls_cache_key(tbl)
    assert clauses == [
        "name like 'A%' or name like 'B%'-name",
        "name like 'Q%'-name",
        "gender = 'boy'-gender",
    ]


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_rls_filter_applies_to_virtual_dataset():
    """
    Test that RLS filters from underlying tables are applied to virtual
    datasets.
    """
    # Get the physical birth_names table which has RLS filters
    physical_table = _get_table(name="birth_names")

    # Create a virtual dataset that queries the birth_names table
    virtual_dataset = SqlaTable(
        table_name="virtual_birth_names",
        database=physical_table.database,
        schema=physical_table.schema,
        sql="SELECT * FROM birth_names",
    )
    db.session.add(virtual_dataset)
    db.session.commit()

    try:
        # Test as gamma user who has RLS filters
        g.user = _get_user(username="gamma")

        # Get the SQL query for the virtual dataset
        sql = virtual_dataset.get_query_str(QUERY_OBJ)

        # Verify that RLS filters from the physical table are applied
        # Gamma user should have the name filters (A%, B%, Q%) and gender filter
        # Note: SQL uses uppercase LIKE and %% escaping
        sql_lower = sql.lower()
        assert "name like 'a%" in sql_lower or "name like 'q%" in sql_lower, (
            f"RLS name filters not found in virtual dataset query: {sql}"
        )
        assert "gender = 'boy'" in sql_lower, (
            f"RLS gender filter not found in virtual dataset query: {sql}"
        )

        # Test as admin user who has no RLS filters
        g.user = _get_user(username="admin")
        sql = virtual_dataset.get_query_str(QUERY_OBJ)

        # Admin should not have RLS filters applied
        assert not NAMES_A_REGEX.search(sql)
        assert not NAMES_B_REGEX.search(sql)
        assert not NAMES_Q_REGEX.search(sql)
        assert not BASE_FILTER_REGEX.search(sql)

    finally:
        # Cleanup
        db.session.delete(virtual_dataset)
        db.session.commit()


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices",
    "load_energy_table_with_slice",
    "rls_filters",
)
def test_rls_filter_applies_to_virtual_dataset_with_join():
    """
    Test that RLS filters are applied when virtual dataset joins
    multiple tables.
    """
    # Get the physical tables
    birth_names_table = _get_table(name="birth_names")
    _get_table(name="energy_usage")  # Load the table for the test

    # Create a virtual dataset with a JOIN query
    virtual_dataset = SqlaTable(
        table_name="virtual_joined",
        database=birth_names_table.database,
        schema=birth_names_table.schema,
        sql="SELECT b.name, e.value FROM birth_names b JOIN energy_usage e ON 1=1",
    )
    db.session.add(virtual_dataset)
    db.session.commit()

    try:
        # Test as gamma user who has RLS filters on both tables
        g.user = _get_user(username="gamma")

        # Get the SQL query for the virtual dataset
        sql = virtual_dataset.get_query_str(QUERY_OBJ)

        # Verify that RLS filters from both physical tables are applied
        # birth_names filters
        sql_lower = sql.lower()
        assert "name like 'a%" in sql_lower or "name like 'q%" in sql_lower, (
            f"birth_names RLS filters not found: {sql}"
        )
        assert "gender = 'boy'" in sql_lower, (
            f"birth_names gender filter not found: {sql}"
        )

        # energy_usage filter
        assert "value > 1" in sql_lower, f"energy_usage RLS filter not found: {sql}"

    finally:
        # Cleanup
        db.session.delete(virtual_dataset)
        db.session.commit()


# ===========================================================================
# Tests: Row Level Security Create API
# ===========================================================================


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_create_api_invalid_subject_failure(admin_client):
    payload = {
        "name": "rls 1",
        "clause": "1=1",
        "filter_type": "Base",
        "tables": [1],
        "subjects": [999999],
    }
    rv = admin_client.post("/api/v1/rowlevelsecurity/", json=payload)
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
    assert status_code == 422
    assert data["message"] == "[l'Subjects are invalid']"


def test_create_api_invalid_table_failure(admin_client):
    payload = {
        "name": "rls 1",
        "clause": "1=1",
        "filter_type": "Base",
        "tables": [999999],
        "subjects": [1],
    }
    rv = admin_client.post("/api/v1/rowlevelsecurity/", json=payload)
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
    assert status_code == 422
    assert data["message"] == "[l'Datasource does not exist']"


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_create_api_post_success(admin_client):
    table = db.session.query(SqlaTable).first()
    subject = _subject_for_role(security_manager.find_role("Admin"))
    payload = {
        "name": "rls 1",
        "clause": "1=1",
        "filter_type": "Base",
        "tables": [table.id],
        "subjects": [subject.id],
    }
    rv = admin_client.post("/api/v1/rowlevelsecurity/", json=payload)
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

    assert status_code == 201

    rls = (
        db.session.query(RowLevelSecurityFilter)
        .filter(RowLevelSecurityFilter.id == data["id"])
        .one_or_none()
    )

    assert rls
    assert rls.name == "rls 1"
    assert rls.clause == "1=1"
    assert rls.filter_type == "Base"
    assert rls.tables[0].id == table.id
    assert rls.subjects[0].id == subject.id

    db.session.delete(rls)
    db.session.commit()


# ===========================================================================
# Tests: Row Level Security Update API
# ===========================================================================


def test_update_api_invalid_id_failure(admin_client):
    payload = {
        "name": "rls 1",
        "clause": "1=1",
        "filter_type": "Base",
        "tables": [1],
        "subjects": [1],
    }
    rv = admin_client.put("/api/v1/rowlevelsecurity/99999999", json=payload)
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
    assert status_code == 404
    assert data["message"] == "Not found"


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_update_api_invalid_subject_failure(admin_client):
    table = db.session.query(SqlaTable).first()

    rls = RowLevelSecurityFilter(
        name="rls test invalid role",
        clause="1=1",
        filter_type="Regular",
        tables=[table],
    )
    db.session.add(rls)
    db.session.commit()

    payload = {
        "subjects": [999999],
    }
    rv = admin_client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
    assert status_code == 422
    assert data["message"] == "[l'Subjects are invalid']"

    db.session.delete(rls)
    db.session.commit()


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_update_api_invalid_table_failure(admin_client):
    table = db.session.query(SqlaTable).first()

    rls = RowLevelSecurityFilter(
        name="rls test invalid role",
        clause="1=1",
        filter_type="Regular",
        tables=[table],
    )
    db.session.add(rls)
    db.session.commit()

    payload = {
        "name": "rls 1",
        "clause": "1=1",
        "filter_type": "Base",
        "tables": [999999],
        "subjects": [1],
    }
    rv = admin_client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))
    assert status_code == 422
    assert data["message"] == "[l'Datasource does not exist']"

    db.session.delete(rls)
    db.session.commit()


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "load_energy_table_with_slice"
)
def test_update_api_put_success(admin_client):
    tables = db.session.query(SqlaTable).limit(2).all()
    roles = db.session.query(security_manager.role_model).limit(2).all()
    role_subjects = [_subject_for_role(role) for role in roles]

    rls = RowLevelSecurityFilter(
        name="rls 1",
        clause="1=1",
        filter_type="Regular",
        tables=[tables[0]],
        subjects=[role_subjects[0]],
    )
    db.session.add(rls)
    db.session.commit()

    payload = {
        "name": "rls put success",
        "clause": "2=2",
        "filter_type": "Base",
        "tables": [tables[1].id],
        "subjects": [role_subjects[1].id],
    }
    rv = admin_client.put(f"/api/v1/rowlevelsecurity/{rls.id}", json=payload)
    status_code, _data = rv.status_code, json.loads(rv.data.decode("utf-8"))  # noqa: F841

    assert status_code == 200

    rls = (
        db.session.query(RowLevelSecurityFilter)
        .filter(RowLevelSecurityFilter.id == rls.id)
        .one_or_none()
    )

    assert rls.name == "rls put success"
    assert rls.clause == "2=2"
    assert rls.filter_type == "Base"
    assert rls.tables[0].id == tables[1].id
    assert rls.subjects[0].role_id == roles[1].id

    db.session.delete(rls)
    db.session.commit()


# ===========================================================================
# Tests: Row Level Security Delete API
# ===========================================================================


def test_delete_api_invalid_id_failure(admin_client):
    ids_to_delete = rison.dumps([10000, 10001, 100002])
    rv = admin_client.delete(f"/api/v1/rowlevelsecurity/?q={ids_to_delete}")
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

    assert status_code == 404
    assert data["message"] == "Not found"


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "load_energy_table_with_slice"
)
def test_delete_api_bulk_delete_success(admin_client):
    tables = db.session.query(SqlaTable).limit(2).all()
    roles = db.session.query(security_manager.role_model).limit(2).all()
    role_subjects = [_subject_for_role(role) for role in roles]

    rls_1 = RowLevelSecurityFilter(
        name="rls 1",
        clause="1=1",
        filter_type="Regular",
        tables=[tables[0]],
        subjects=[role_subjects[0]],
    )
    rls_2 = RowLevelSecurityFilter(
        name="rls 2",
        clause="2=2",
        filter_type="Base",
        tables=[tables[1]],
        subjects=[role_subjects[1]],
    )
    db.session.add_all([rls_1, rls_2])
    db.session.commit()

    ids_to_delete = rison.dumps([rls_1.id, rls_2.id])
    rv = admin_client.delete(f"/api/v1/rowlevelsecurity/?q={ids_to_delete}")
    status_code, data = rv.status_code, json.loads(rv.data.decode("utf-8"))

    assert status_code == 200
    assert data["message"] == "Deleted 2 rules"


# ===========================================================================
# Tests: Row Level Security with Related API
# ===========================================================================


@pytest.mark.usefixtures("load_birth_names_data", "load_energy_table_data")
def test_rls_tables_related_api(admin_client):
    params = rison.dumps({"page": 0, "page_size": 100})

    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
    assert rv.status_code == 200
    data = json.loads(rv.data.decode("utf-8"))
    result = data["result"]

    db_tables = db.session.query(SqlaTable).all()

    db_table_names = {t.name for t in db_tables}
    received_tables = {table["text"] for table in result}

    assert data["count"] == len(db_tables)
    assert len(result) == len(db_tables)
    assert db_table_names == received_tables


def test_rls_tables_related_api_with_filter_matching_birth(admin_client):
    # Test with filter that should match 'birth_names'
    params = rison.dumps({"filter": "birth", "page": 0, "page_size": 100})
    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
    assert rv.status_code == 200
    data = json.loads(rv.data.decode("utf-8"))
    result = data["result"]
    received_tables = {table["text"] for table in result}
    # Should only return tables with 'birth' in the name
    assert all("birth" in table_name.lower() for table_name in received_tables)
    assert len(result) >= 1  # At least birth_names should be returned


def test_rls_tables_related_api_with_filter_no_matches(admin_client):
    # Test with filter that should match nothing
    params = rison.dumps({"filter": "nonexistent", "page": 0, "page_size": 100})
    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
    assert rv.status_code == 200
    data = json.loads(rv.data.decode("utf-8"))
    result = data["result"]
    assert len(result) == 0
    assert data["count"] == 0


@mock.patch.dict(
    "flask.current_app.config",
    {
        "SUBJECTS_RELATED_TYPES": [SubjectType.USER, SubjectType.GROUP],
        "SUBJECTS_RELATED_TYPES_RLS": None,
    },
)
def test_rls_subjects_related_api(admin_client):
    params = rison.dumps({"page": 0, "page_size": 100})

    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/subjects?q={params}")
    assert rv.status_code == 200
    data = json.loads(rv.data.decode("utf-8"))
    result = data["result"]

    assert data["count"] > 0
    assert len(result) > 0
    assert {subject["extra"]["type"] for subject in result} <= {
        SubjectType.USER,
        SubjectType.GROUP,
    }


@mock.patch.dict(
    "flask.current_app.config",
    {
        "SUBJECTS_RELATED_TYPES": [SubjectType.USER],
        "SUBJECTS_RELATED_TYPES_RLS": [SubjectType.ROLE],
    },
)
def test_rls_subjects_related_api_entity_override_roles(admin_client):
    params = rison.dumps({"page": 0, "page_size": 100})

    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/subjects?q={params}")
    assert rv.status_code == 200
    data = json.loads(rv.data.decode("utf-8"))
    result = data["result"]

    assert data["count"] > 0
    assert len(result) > 0
    assert {subject["extra"]["type"] for subject in result} == {SubjectType.ROLE}


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "load_energy_table_with_slice"
)
@mock.patch(
    "superset.row_level_security.api.RLSRestApi.base_related_field_filters",
    {"tables": [["table_name", filters.FilterStartsWith, "birth"]]},
)
def test_table_related_filter(admin_client):
    params = rison.dumps({"page": 0, "page_size": 10})

    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/tables?q={params}")
    assert rv.status_code == 200
    data = json.loads(rv.data.decode("utf-8"))
    result = data["result"]
    received_tables = {table["text"].split(".")[-1] for table in result}

    assert data["count"] == 1
    assert len(result) == 1
    assert {"birth_names"} == received_tables


def test_get_all_related_subjects_with_extra_filters(admin_client):
    """
    API: Test get filter related subjects with extra related query filters
    """
    params = rison.dumps({"page": 0, "page_size": 100})
    rv = admin_client.get(f"/api/v1/rowlevelsecurity/related/subjects?q={params}")
    assert rv.status_code == 200
    response = json.loads(rv.data.decode("utf-8"))
    assert response["count"] > 0


# ===========================================================================
# Tests: Guest Token Row Level Security
# ===========================================================================


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_guest_rls_filter_alters_query():
    g.user = _guest_user_with_rls()
    tbl = _get_table(name="birth_names")
    sql = tbl.get_query_str(QUERY_OBJ)

    assert re.search(RLS_ALICE_REGEX, sql)


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_guest_rls_filter_does_not_alter_unrelated_query():
    g.user = _guest_user_with_rls(
        rules=[
            {
                "dataset": _get_table(name="birth_names").id + 1,
                "clause": "name = 'Alice'",
            }
        ]
    )
    tbl = _get_table(name="birth_names")
    sql = tbl.get_query_str(QUERY_OBJ)

    assert not re.search(RLS_ALICE_REGEX, sql)


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_guest_multiple_rls_filters_are_unionized():
    g.user = _guest_user_with_rls(
        rules=[
            _default_rls_rule(),
            {
                "dataset": _get_table(name="birth_names").id,
                "clause": "gender = 'girl'",
            },
        ]
    )
    tbl = _get_table(name="birth_names")
    sql = tbl.get_query_str(QUERY_OBJ)

    assert re.search(RLS_ALICE_REGEX, sql)
    assert re.search(RLS_GENDER_REGEX, sql)


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "load_energy_table_with_slice"
)
def test_guest_rls_filter_for_all_datasets():
    births = _get_table(name="birth_names")
    energy = _get_table(name="energy_usage")
    guest = _guest_user_with_rls(rules=[{"clause": "name = 'Alice'"}])
    guest.resources.append({type: "dashboard", id: energy.id})
    g.user = guest
    births_sql = births.get_query_str(QUERY_OBJ)
    energy_sql = energy.get_query_str(QUERY_OBJ)

    assert re.search(RLS_ALICE_REGEX, births_sql)
    assert re.search(RLS_ALICE_REGEX, energy_sql)


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_guest_dataset_id_can_be_string():
    dataset = _get_table(name="birth_names")
    str_id = str(dataset.id)
    g.user = _guest_user_with_rls(
        rules=[{"dataset": str_id, "clause": "name = 'Alice'"}]
    )
    sql = dataset.get_query_str(QUERY_OBJ)

    assert re.search(RLS_ALICE_REGEX, sql)
