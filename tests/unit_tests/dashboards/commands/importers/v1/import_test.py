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
# pylint: disable=unused-argument, import-outside-toplevel, unused-import, invalid-name

import copy
from collections.abc import Generator
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest
import yaml
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.dashboard.importers.v1.utils import import_dashboard
from superset.commands.exceptions import ForbiddenError, ImportFailedError
from superset.commands.importers.v1.utils import import_tag
from superset.extensions import feature_flag_manager
from superset.models.dashboard import Dashboard
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.tags.models import TaggedObject
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from superset.utils.core import override_user
from tests.integration_tests.fixtures.importexport import dashboard_config


@pytest.fixture
def session_with_data(session: Session) -> Generator[Session, None, None]:
    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    dashboard = Dashboard(
        id=100,
        dashboard_title="Test dash",
        slug=None,
        slices=[],
        published=True,
        uuid=dashboard_config["uuid"],
    )

    session.add(dashboard)
    session.flush()
    yield session
    session.rollback()


@pytest.fixture
def session_with_schema(session: Session) -> Generator[Session, None, None]:
    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    yield session
    session.rollback()


def test_import_dashboard(mocker: MockerFixture, session_with_schema: Session) -> None:
    """
    Test importing a dashboard.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    dashboard, _ = import_dashboard(dashboard_config)
    assert dashboard.dashboard_title == "Test dash"
    assert dashboard.description is None
    assert dashboard.is_managed_externally is False
    assert dashboard.external_url is None
    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")


def test_import_dashboard_managed_externally(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Test importing a dashboard that is managed externally.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    config = copy.deepcopy(dashboard_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_dashboard"
    dashboard, _ = import_dashboard(config)
    assert dashboard.is_managed_externally is True
    assert dashboard.external_url == "https://example.org/my_dashboard"

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")


def test_import_dashboard_without_permission(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Test importing a dashboard when a user doesn't have permissions to create.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=False
    )

    with pytest.raises(ForbiddenError) as excinfo:
        import_dashboard(dashboard_config)
    assert (
        str(excinfo.value)
        == "Dashboard doesn't exist and user doesn't have permission to create dashboards"  # noqa: E501
    )

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")


def test_import_existing_dashboard_without_access_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a dashboard when a user doesn't have permissions to create.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=False
    )

    dashboard = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        with pytest.raises(ForbiddenError) as excinfo:
            import_dashboard(dashboard_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A dashboard already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")
    mock_can_access_dashboard.assert_called_once_with(dashboard)


def test_import_existing_dashboard_without_editor_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a dashboard when a user isn't an editor and is not an Admin.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=True
    )

    dashboard = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )

    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Gamma")],
    )

    with override_user(user):
        with pytest.raises(ForbiddenError) as excinfo:
            import_dashboard(dashboard_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A dashboard already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")
    mock_can_access_dashboard.assert_called_once_with(dashboard)


def test_import_existing_dashboard_with_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a dashboard that exists when a user has access permission to that dashboard.
    """  # noqa: E501
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=True
    )

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    dashboard = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )

    with override_user(admin):
        import_dashboard(dashboard_config, overwrite=True)

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")
    mock_can_access_dashboard.assert_called_once_with(dashboard)


def test_import_existing_dashboard_does_not_add_importer_as_editor(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Importing an existing dashboard must NOT add the importer as an editor.
    Regression test for GitHub issue #36244.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )
    subject = Subject(label="Alice Doe", type=SubjectType.USER, user_id=admin.id)
    get_user_subject = mocker.patch(
        "superset.subjects.utils.get_user_subject",
        return_value=subject,
    )

    with override_user(admin):
        result, _ = import_dashboard(dashboard_config, overwrite=True)

    get_user_subject.assert_not_called()
    assert subject not in result.editors


def test_import_new_dashboard_adds_importer_as_editor(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Importing a new dashboard (UUID not in DB) should add the importer as editor.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    user = User(
        first_name="Bob",
        last_name="Smith",
        email="bsmith@example.org",
        username="bob",
        roles=[Role(name="Gamma")],
    )
    subject = Subject(label="Bob Smith", type=SubjectType.USER, user_id=user.id)
    get_user_subject = mocker.patch(
        "superset.subjects.utils.get_user_subject",
        return_value=subject,
    )

    with override_user(user):
        result, _ = import_dashboard(dashboard_config)

    get_user_subject.assert_called_once_with(user.id)
    assert subject in result.editors


def test_import_soft_deleted_dashboard_overwrite_restores_in_place(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Overwrite-importing a soft-deleted dashboard must restore the row in
    place rather than hard-delete-and-replace. A hard delete would
    cascade through dashboard_slices junctions; in-place restore
    preserves them.

    Asserts not just that the PK survives, but that the
    ``dashboard_slices`` junction rows do too — that's the whole point
    of restore-in-place vs delete-and-replace, so a regression that
    re-introduces the hard-delete shape must trip this test.
    """
    from superset.connectors.sqla.models import Database, SqlaTable
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)

    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    original_id = existing.id

    # Attach a chart via the dashboard_slices M2M before soft-delete so
    # we can assert the junction row survives the restore-in-place.
    dataset = SqlaTable(
        table_name="junction_test_table",
        database=Database(database_name="junction_test_db", sqlalchemy_uri="sqlite://"),
    )
    session_with_data.add(dataset)
    session_with_data.flush()
    chart = Slice(
        slice_name="junction_test_chart",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    session_with_data.add(chart)
    session_with_data.flush()
    existing.slices.append(chart)
    session_with_data.flush()
    chart_id = chart.id

    junction_before = (
        session_with_data.query(dashboard_slices)
        .filter(
            dashboard_slices.c.dashboard_id == original_id,
            dashboard_slices.c.slice_id == chart_id,
        )
        .count()
    )
    assert junction_before == 1, "junction row precondition not established"

    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    session_with_data.flush()

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        dashboard, _ = import_dashboard(dashboard_config, overwrite=True)

    assert dashboard.id == original_id
    assert dashboard.deleted_at is None

    # The junction row survived the restore — if a future regression
    # switched back to delete-and-replace, this row would have been
    # cascaded away.
    junction_after = (
        session_with_data.query(dashboard_slices)
        .filter(
            dashboard_slices.c.dashboard_id == original_id,
            dashboard_slices.c.slice_id == chart_id,
        )
        .count()
    )
    assert junction_after == 1, (
        "dashboard_slices junction was lost across restore-via-import; "
        "Option C requires in-place restore, not delete-and-replace"
    )


def test_import_soft_deleted_dashboard_non_overwrite_restores_for_editor(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Non-overwrite re-import of a soft-deleted UUID is implicitly a
    restore-and-update: the user is bringing the dashboard back by
    uploading it again. The same editorship rule as the overwrite path
    applies, so an editor (or admin) succeeds without setting
    overwrite=True.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)

    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    original_id = existing.id
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    session_with_data.flush()

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        dashboard, _ = import_dashboard(dashboard_config, overwrite=False)

    assert dashboard.id == original_id
    assert dashboard.deleted_at is None


def test_import_soft_deleted_dashboard_non_overwrite_raises_for_non_editor(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Non-overwrite re-import that would resurrect a soft-deleted dashboard
    must respect editorship: a non-editor without admin role cannot
    restore-via-import. Mirrors the explicit /restore endpoint's check.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)

    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    session_with_data.flush()

    non_editor = User(
        first_name="Bob",
        last_name="Roe",
        email="bob@example.org",
        username="bob",
        roles=[Role(name="Gamma")],
    )

    with override_user(non_editor):
        with pytest.raises(ForbiddenError) as excinfo:
            import_dashboard(dashboard_config, overwrite=False)
    assert "permissions to restore" in str(excinfo.value)


def test_import_soft_deleted_dashboard_raises_when_caller_lacks_can_write(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Case B: re-import of a soft-deleted UUID by a caller without
    can_write must raise, not silently return the soft-deleted row.

    The dashboard endpoint already gates on can_write Dashboard, so the
    primary way to hit this is a programmatic caller that bypassed the
    endpoint or a service-account with no permissions. Either way the
    correct response is a raise -- silently returning the soft-deleted
    dashboard would let callers reattach to it and surface a hidden row.
    """
    mocker.patch.object(security_manager, "can_access", return_value=False)

    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    session_with_data.flush()

    with pytest.raises(ForbiddenError) as excinfo:
        import_dashboard(dashboard_config, overwrite=False)
    assert "can_write" in str(excinfo.value)


def test_import_existing_active_dashboard_overwrite_without_can_write_returns_existing(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    An *active* (not soft-deleted) dashboard re-imported with overwrite=True by
    a caller without can_write must fall through to returning the existing row,
    not raise the restore error. Case B is keyed on ``is_soft_deleted``, so the
    fused ``needs_mutation`` condition must not pull active rows into the
    restore-without-permission branch (pre-soft-delete overwrite behaviour).
    """
    mocker.patch.object(security_manager, "can_access", return_value=False)

    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    assert existing.deleted_at is None

    result, _ = import_dashboard(dashboard_config, overwrite=True)

    assert result.id == existing.id
    assert result.deleted_at is None


def test_import_soft_deleted_dashboard_ignore_permissions_restores_in_place(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    The example loader path: ignore_permissions=True with no logged-in
    user. The needs_mutation gate must still trigger the overwrite path
    so config["id"] is preserved on the fallthrough, otherwise the
    example loader's re-import collides on the UUID unique index.
    """
    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    original_id = existing.id
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    session_with_data.flush()

    dashboard, _ = import_dashboard(
        dashboard_config, overwrite=True, ignore_permissions=True
    )

    assert dashboard.id == original_id
    assert dashboard.deleted_at is None


def test_import_tag_logic_for_dashboards(session_with_schema: Session):
    contents = {
        "tags.yaml": yaml.dump(
            {"tags": [{"tag_name": "tag_1", "description": "Description for tag_1"}]}
        )
    }

    object_id = 1
    object_type = "dashboards"

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        new_tag_ids = import_tag(
            ["tag_1"], contents, object_id, object_type, session_with_schema
        )
        assert len(new_tag_ids) > 0
        assert (
            session_with_schema.query(TaggedObject)
            .filter_by(object_id=object_id, object_type=object_type)
            .count()
            > 0
        )

    session_with_schema.query(TaggedObject).filter_by(
        object_id=object_id, object_type=object_type
    ).delete()
    session_with_schema.commit()

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=False):
        new_tag_ids_disabled = import_tag(
            ["tag_1"], contents, object_id, object_type, session_with_schema
        )
        assert len(new_tag_ids_disabled) == 0
        associated_tags = (
            session_with_schema.query(TaggedObject)
            .filter_by(object_id=object_id, object_type=object_type)
            .all()
        )
        assert len(associated_tags) == 0


def test_dashboard_unique_constraints_includes_slug() -> None:
    """``slug`` must remain an import identity key even though its column-level
    ``unique=True`` was dropped for soft-delete (DB keeps a partial active-only
    index). Otherwise a same-slug/different-UUID import inserts and collides on
    the partial index instead of updating the existing dashboard."""
    constraints = Dashboard._unique_constraints()
    assert {"slug"} in constraints


def test_dashboard_import_matches_existing_active_by_slug(
    session_with_schema: Session,
) -> None:
    """A re-import whose UUID differs but whose slug matches an existing active
    dashboard updates that row (matched by slug) rather than inserting a new one
    and colliding on the active-slug partial index at flush."""
    from superset import db

    existing = Dashboard(
        dashboard_title="Original",
        slug="shared-slug",
        uuid="11111111-1111-1111-1111-111111111111",
    )
    db.session.add(existing)
    db.session.flush()
    original_id = existing.id

    obj = Dashboard.import_from_dict(
        {
            "uuid": "22222222-2222-2222-2222-222222222222",
            "slug": "shared-slug",
            "dashboard_title": "Updated via import",
        },
        recursive=False,
    )
    db.session.flush()

    assert obj.id == original_id  # matched & updated the existing row by slug
    assert obj.dashboard_title == "Updated via import"
    assert db.session.query(Dashboard).filter_by(slug="shared-slug").count() == 1


def test_import_soft_deleted_dashboard_slug_collision_raises(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """Restore-via-import fails readably when the slug was claimed.

    The common re-import carries the pre-deletion slug. If another active
    dashboard claimed it during the soft-deleted window, the importer must
    surface the same active-slug-twin conflict the explicit restore raises
    (naming the slug), not let the flush hit the partial unique index as an
    opaque IntegrityError-wrapped import failure.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)

    existing = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )
    assert existing is not None
    existing.slug = "contested-slug"
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Another active dashboard claimed the slug during the deleted window.
    claimant = Dashboard(
        id=101,
        dashboard_title="Claimant",
        slug="contested-slug",
        slices=[],
        published=True,
        uuid="11111111-1111-1111-1111-111111111111",
    )
    session_with_data.add(claimant)
    session_with_data.flush()

    config = copy.deepcopy(dashboard_config)
    config["slug"] = "contested-slug"

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        with pytest.raises(ImportFailedError) as excinfo:
            import_dashboard(config, overwrite=True)

    assert "contested-slug" in str(excinfo.value)
    # The conflict was caught by the pre-check, before any flush could
    # surface a DB-level error.
    assert "another active dashboard" in str(excinfo.value)
    # Check-before-mutate: the twin check must run BEFORE ``restore()`` —
    # mutating first would let the validation query's autoflush emit the
    # restoring UPDATE into the partial unique index (IntegrityError on
    # Postgres / MySQL 8.0.13+) and leave the row half-restored in the
    # session. A failed import must leave the row still soft-deleted.
    assert existing.deleted_at is not None


def test_import_slug_collision_requires_overwrite_permission(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    A config carrying a fresh UUID but a slug that already belongs to an
    active dashboard is matched by slug in ``import_from_dict``. That path must
    go through the same overwrite permission gate as a UUID match, so a caller
    who is neither an editor of the existing dashboard nor an admin cannot
    update it by reusing its slug.
    """
    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    existing = Dashboard(
        id=300,
        dashboard_title="Existing dash",
        slug="shared-slug",
        slices=[],
        published=True,
        uuid="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    )
    session.add(existing)
    session.flush()

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=True
    )

    config = copy.deepcopy(dashboard_config)
    config["uuid"] = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    config["slug"] = "shared-slug"

    user = User(
        first_name="Gina",
        last_name="Amma",
        email="gamma@example.org",
        username="gamma",
        roles=[Role(name="Gamma")],
    )

    with override_user(user):
        with pytest.raises(ForbiddenError) as excinfo:
            import_dashboard(config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A dashboard already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    mock_can_access_dashboard.assert_called_once_with(existing)
    session.rollback()


DEMO_GLOBAL = {
    "schema_version": 1,
    "max_span": {"quantity": 12, "time_grain": "P1W"},
    "max_look_back": {"quantity": 12, "time_grain": "P1M"},
    "max_look_forward": {"quantity": 3, "time_grain": "P1M"},
}
DASHBOARD_FILE = "dashboards/imported_dashboard.yaml"


def span(quantity: int, time_grain: str = "P1W") -> dict[str, Any]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": quantity, "time_grain": time_grain},
        "max_look_back": None,
        "max_look_forward": None,
    }


@pytest.fixture
def time_range_limits_enabled(mocker: MockerFixture) -> None:
    from flask import current_app

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: True},
    )
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": DEMO_GLOBAL})
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")


def bundle(limits: Any, dataset_limits: Any = None) -> dict[str, str]:
    from tests.integration_tests.fixtures.importexport import (
        chart_config,
        database_config,
        dataset_config,
        metadata_files,
    )

    dashboard = copy.deepcopy(dashboard_config)
    dashboard.pop("id", None)
    dashboard["metadata"]["time_range_limits"] = limits
    dataset = copy.deepcopy(dataset_config)
    if dataset_limits is not None:
        dataset["extra"] = {"time_range_limits": dataset_limits}
    return {
        "metadata.yaml": yaml.safe_dump(metadata_files["dashboard"]),
        "databases/imported_database.yaml": yaml.safe_dump(database_config),
        "datasets/imported_dataset.yaml": yaml.safe_dump(dataset),
        "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        DASHBOARD_FILE: yaml.safe_dump(dashboard),
    }


def count_assets() -> tuple[int, int, int]:
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    return (
        db.session.query(Dashboard).count(),
        db.session.query(Slice).count(),
        db.session.query(SqlaTable).count(),
    )


def test_import_v1_dashboard_rejects_a_looser_override(
    session_with_schema: Session, time_range_limits_enabled: None
) -> None:
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError

    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDashboardsCommand(bundle(span(13))).run()

    assert excinfo.value.normalized_messages()[DASHBOARD_FILE] == {
        "metadata": {
            "time_range_limits.max_span.quantity": [
                "Dashboard maximum span must be 12 weeks or less."
            ]
        }
    }
    assert count_assets() == (0, 0, 0)


def test_import_v1_dashboard_rejects_a_looser_dataset_extra(
    session_with_schema: Session, time_range_limits_enabled: None
) -> None:
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError

    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDashboardsCommand(bundle(span(9), dataset_limits=span(13))).run()

    assert excinfo.value.normalized_messages()["datasets/imported_dataset.yaml"] == {
        "extra": {
            "time_range_limits.max_span.quantity": [
                "Dataset maximum span must be 12 weeks or less."
            ]
        }
    }
    assert count_assets() == (0, 0, 0)


def test_import_v1_dashboard_dataset_extra_under_a_bad_global(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset.commands.dashboard.importers.dispatcher import (
        ImportDashboardsCommand,
    )
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": {}})

    with pytest.raises(TimeRangeLimitsUnavailableError):
        ImportDashboardsCommand(bundle(None, dataset_limits=span(9))).run()
    assert count_assets() == (0, 0, 0)


def test_import_v1_dashboard_overwrite_clamps_an_unchanged_stale_override(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    stale = span(20)
    db.session.add(
        Dashboard(
            dashboard_title="Stale",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps({"time_range_limits": stale}),
        )
    )
    db.session.flush()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    contents = bundle(stale, dataset_limits=span(4))
    config = yaml.safe_load(contents[DASHBOARD_FILE])
    config["metadata"]["native_filter_configuration"] = [
        {
            "id": "NATIVE_FILTER-time",
            "filterType": "filter_time",
            "defaultDataMask": {"filterState": {"value": "Last 20 weeks"}},
        }
    ]
    contents[DASHBOARD_FILE] = yaml.safe_dump(config)
    ImportDashboardsCommand(contents, overwrite=True, adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Test dash"
    metadata = json.loads(dashboard.json_metadata)
    assert metadata["time_range_limits"] == span(12)
    mask = metadata["native_filter_configuration"][0]["defaultDataMask"]
    expected = 'DATEADD(DATETIME("today"), -4, week) : today'
    assert mask["filterState"]["value"] == expected
    assert mask["extraFormData"]["time_range"] == expected

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
        ImportDashboardsCommand(bundle(span(21)), overwrite=True).run()
    assert [
        (item["old_label"], item["new_label"]) for item in excinfo.value.payload()
    ] == [("21 weeks", "12 weeks")]
    db.session.refresh(dashboard)
    assert json.loads(dashboard.json_metadata)["time_range_limits"] == span(12)


def stale_dashboard_bundle(deleted_at: datetime | None = None) -> dict[str, str]:
    """An existing dashboard, archived when ``deleted_at`` is given, whose stored
    20-week span a 12-week global made stale, and a bundle that overwrites it
    with a "No filter" default."""
    from superset import db

    db.session.add(
        Dashboard(
            dashboard_title="Stale",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps({"time_range_limits": span(20)}),
            deleted_at=deleted_at,
        )
    )
    db.session.commit()
    contents = bundle(span(20), dataset_limits=span(4))
    config = yaml.safe_load(contents[DASHBOARD_FILE])
    config["metadata"]["native_filter_configuration"] = [
        {
            "id": "NATIVE_FILTER-time",
            "name": "Date",
            "filterType": "filter_time",
            "defaultDataMask": {"filterState": {"value": "No filter"}},
        }
    ]
    contents[DASHBOARD_FILE] = yaml.safe_dump(config)
    return contents


STALE_IDENTITY = {
    "dashboard": "Test dash",
    "dashboard_key": dashboard_config["uuid"],
    "file": DASHBOARD_FILE,
}
STALE_ADJUSTMENTS: list[dict[str, Any]] = [
    {
        **STALE_IDENTITY,
        "kind": "time_range_limit",
        "name": "Test dash",
        "filter_id": None,
        "field": "max_span",
        "old": {"quantity": 20, "time_grain": "P1W"},
        "new": {"quantity": 12, "time_grain": "P1W"},
        "old_label": "20 weeks",
        "new_label": "12 weeks",
    },
    {
        **STALE_IDENTITY,
        "kind": "filter_default",
        "name": "Date",
        "filter_id": "NATIVE_FILTER-time",
        "field": "default",
        "old": None,
        "new": 'DATEADD(DATETIME("today"), -4, week) : today',
        "old_label": "No filter",
        "new_label": "Last 4 weeks",
    },
]


def test_import_v1_dashboard_asks_before_adjusting_time_ranges(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.slice import Slice
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    contents = stale_dashboard_bundle()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
        ImportDashboardsCommand(contents, overwrite=True).run()

    assert excinfo.value.status == 422
    assert excinfo.value.normalized_messages() == {
        DASHBOARD_FILE: {"time_range_adjustments": STALE_ADJUSTMENTS},
        "time_range_adjustments_fingerprint": excinfo.value.fingerprint,
    }
    assert excinfo.value.message == (
        "The dashboard time ranges don't fit the time range limits. To apply these "
        "changes, send the request again with adjust_time_ranges set to true: "
        'Dashboard "Test dash": maximum span 20 weeks → 12 weeks; '
        'Dashboard "Test dash": time range filter "Date" default "No filter" → '
        '"Last 4 weeks"'
    )
    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Stale"
    assert dashboard.params_dict == {"time_range_limits": span(20)}
    assert db.session.query(Slice).count() == 0

    ImportDashboardsCommand(contents, overwrite=True, adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Test dash"
    metadata = dashboard.params_dict
    assert metadata["time_range_limits"] == {
        **span(20),
        "max_span": STALE_ADJUSTMENTS[0]["new"],
    }
    mask = metadata["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == STALE_ADJUSTMENTS[1]["new"]
    assert mask["extraFormData"]["time_range"] == STALE_ADJUSTMENTS[1]["new"]


@pytest.mark.parametrize("overwrite", [True, False])
def test_import_v1_over_an_archived_dashboard_asks_like_a_live_one(
    session_with_schema: Session,
    time_range_limits_enabled: None,
    mocker: MockerFixture,
    overwrite: bool,
) -> None:
    """Re-importing over an archived dashboard restores it in place, so it lists
    and asks for the same changes as over a live one, keeps it archived on
    refusal, and restores it with exactly those changes on consent."""
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    contents = stale_dashboard_bundle(deleted_at=datetime(2026, 1, 1))
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        ImportDashboardsCommand(contents, overwrite=overwrite).run()

    assert preview.value.payload() == STALE_ADJUSTMENTS
    archived = (
        db.session.query(Dashboard)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
        .filter_by(uuid=dashboard_config["uuid"])
        .one()
    )
    assert archived.deleted_at is not None
    assert archived.params_dict == {"time_range_limits": span(20)}

    ImportDashboardsCommand(
        contents,
        overwrite=overwrite,
        adjust_time_ranges=True,
        time_range_adjustments_fingerprint=preview.value.fingerprint,
    ).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.deleted_at is None
    assert dashboard.dashboard_title == "Test dash"
    metadata = dashboard.params_dict
    assert metadata["time_range_limits"]["max_span"] == STALE_ADJUSTMENTS[0]["new"]
    mask = metadata["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == STALE_ADJUSTMENTS[1]["new"]


def import_with_consent(contents: dict[str, str]) -> list[dict[str, Any]]:
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        ImportDashboardsCommand(contents, overwrite=True).run()
    ImportDashboardsCommand(
        contents,
        overwrite=True,
        adjust_time_ranges=True,
        time_range_adjustments_fingerprint=preview.value.fingerprint,
    ).run()
    return preview.value.payload()


@pytest.mark.parametrize("archive", [False, True], ids=["live", "archived"])
def test_import_v1_reimporting_the_same_file_after_a_fit_asks_again(
    session_with_schema: Session,
    time_range_limits_enabled: None,
    mocker: MockerFixture,
    archive: bool,
) -> None:
    """The first import stores the fitted limit, so the same file differs from the
    stored value on the next import. It asks again instead of refusing, over a live
    or archived dashboard."""
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    contents = stale_dashboard_bundle()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    import_with_consent(contents)
    dashboard = db.session.query(Dashboard).one()
    assert (
        dashboard.params_dict["time_range_limits"]["max_span"] == span(12)["max_span"]
    )
    if archive:
        dashboard.deleted_at = datetime(2026, 1, 1)
        db.session.commit()

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        ImportDashboardsCommand(contents, overwrite=True).run()

    assert preview.value.payload()[0] == STALE_ADJUSTMENTS[0]
    stored = (
        db.session.query(Dashboard)
        .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
        .filter_by(uuid=dashboard_config["uuid"])
        .one()
    )
    assert (stored.deleted_at is not None) is archive

    ImportDashboardsCommand(
        contents,
        overwrite=True,
        adjust_time_ranges=True,
        time_range_adjustments_fingerprint=preview.value.fingerprint,
    ).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.deleted_at is None
    assert (
        dashboard.params_dict["time_range_limits"]["max_span"] == span(12)["max_span"]
    )


def test_import_v1_looser_file_over_a_dashboard_without_limits_asks(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db

    db.session.add(
        Dashboard(
            dashboard_title="No limits",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps({}),
        )
    )
    db.session.commit()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    adjustments = import_with_consent(bundle(span(20)))

    assert adjustments == [STALE_ADJUSTMENTS[0]]
    dashboard = db.session.query(Dashboard).one()
    assert dashboard.params_dict["time_range_limits"] == span(12)


def test_import_v1_dashboard_asks_again_when_the_changes_differ_from_the_preview(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    contents = stale_dashboard_bundle()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        ImportDashboardsCommand(contents, overwrite=True).run()

    tighter = {**DEMO_GLOBAL, "max_span": {"quantity": 10, "time_grain": "P1W"}}
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": tighter})
    with pytest.raises(TimeRangeAdjustmentsRequiredError) as again:
        ImportDashboardsCommand(
            contents,
            overwrite=True,
            adjust_time_ranges=True,
            time_range_adjustments_fingerprint=preview.value.fingerprint,
        ).run()

    assert again.value.fingerprint != preview.value.fingerprint
    assert [item["new_label"] for item in again.value.payload()] == [
        "10 weeks",
        "Last 4 weeks",
    ]
    assert db.session.query(Dashboard).one().dashboard_title == "Stale"

    ImportDashboardsCommand(
        contents,
        overwrite=True,
        adjust_time_ranges=True,
        time_range_adjustments_fingerprint=again.value.fingerprint,
    ).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Test dash"
    assert dashboard.params_dict["time_range_limits"]["max_span"] == {
        "quantity": 10,
        "time_grain": "P1W",
    }


def test_import_v1_dashboard_agrees_to_a_migrated_filter_box_on_retry(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    """A legacy Time Range filter box gets a new native filter id on every
    attempt; the fingerprint still matches the reviewed changes."""
    from sqlalchemy.exc import SQLAlchemyError

    from superset import db
    from superset.commands.dashboard import importers
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    v1_importer = importers.v1
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    db.session.add(
        Dashboard(
            dashboard_title="Stale",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps({"time_range_limits": span(20)}),
        )
    )
    db.session.commit()
    contents = bundle(span(20))
    chart = yaml.safe_load(contents["charts/imported_chart.yaml"])
    chart["viz_type"] = "filter_box"
    chart["params"] = {"date_filter": True, "time_range": "No filter"}
    contents["charts/imported_chart.yaml"] = yaml.safe_dump(chart)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    previews = []
    for _ in range(2):
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
            ImportDashboardsCommand(contents, overwrite=True).run()
        previews.append(preview.value)
    filter_ids = [
        item["filter_id"]
        for error in previews
        for item in error.payload()
        if item["kind"] == "filter_default"
    ]
    assert len(filter_ids) == 2
    assert filter_ids[0] != filter_ids[1]
    assert previews[0].fingerprint == previews[1].fingerprint

    # Committing a filter-box import over an existing dashboard fails on this
    # test database whatever the limits (a duplicate dashboard_slices version
    # row when the migrated filter-box chart is deleted), so this checks that
    # the retry gets past the consent check rather than that it commits.
    consent = mocker.spy(v1_importer, "check_consent")
    with pytest.raises(SQLAlchemyError):
        ImportDashboardsCommand(
            contents,
            overwrite=True,
            adjust_time_ranges=True,
            time_range_adjustments_fingerprint=previews[0].fingerprint,
        ).run()

    assert consent.call_count == 1
    assert consent.spy_exception is None
    [agreed] = [
        item for item in consent.call_args.args[0] if item.kind == "filter_default"
    ]
    assert agreed.new == 'DATEADD(DATETIME("today"), -12, week) : today'


def test_import_v1_dashboard_asks_for_overwrite_before_adjusting(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    contents = stale_dashboard_bundle()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    for adjust in (False, True):
        with pytest.raises(CommandInvalidError) as excinfo:
            ImportDashboardsCommand(contents, adjust_time_ranges=adjust).run()
        assert not isinstance(excinfo.value, TimeRangeAdjustmentsRequiredError)
        assert excinfo.value.normalized_messages() == {
            DASHBOARD_FILE: "Dashboard already exists and `overwrite=true` was not "
            "passed"
        }
    with pytest.raises(TimeRangeAdjustmentsRequiredError):
        ImportDashboardsCommand(contents, overwrite=True).run()
    assert db.session.query(Dashboard).one().dashboard_title == "Stale"

    ImportDashboardsCommand(contents, overwrite=True, adjust_time_ranges=True).run()
    assert db.session.query(Dashboard).one().dashboard_title == "Test dash"


def test_import_v1_dashboard_that_fits_imports_without_asking(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    db.session.add(
        Dashboard(
            dashboard_title="Fits",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps({"time_range_limits": span(9)}),
        )
    )
    db.session.commit()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    ImportDashboardsCommand(bundle(span(9)), overwrite=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Test dash"
    assert dashboard.params_dict["time_range_limits"] == span(9)


def test_import_v1_dashboard_flag_off_imports_stale_ranges_unchanged(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    contents = stale_dashboard_bundle()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: False},
    )

    ImportDashboardsCommand(contents, overwrite=True).run()

    metadata = db.session.query(Dashboard).one().params_dict
    assert metadata["time_range_limits"] == span(20)
    mask = metadata["native_filter_configuration"][0]["defaultDataMask"]
    assert mask == {"filterState": {"value": "No filter"}}


def test_import_v1_dashboard_refuses_a_clamp_to_zero_look_back_and_forward(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError

    zero_days = {"quantity": 0, "time_grain": "P1D"}
    global_limits = {**span(12), "max_look_back": zero_days}
    stale = {
        **span(12),
        "max_look_back": {"quantity": 5, "time_grain": "P1D"},
        "max_look_forward": zero_days,
    }
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_limits})
    dashboard = Dashboard(
        dashboard_title="Stale",
        uuid=dashboard_config["uuid"],
        json_metadata=json.dumps({"time_range_limits": stale}),
    )
    db.session.add(dashboard)
    db.session.commit()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDashboardsCommand(bundle(stale), overwrite=True).run()

    assert excinfo.value.status == 422
    errors = {
        "metadata": {
            "time_range_limits.max_look_forward.quantity": [
                "Look-back and look-forward can't both be 0: no time range would fit."
            ]
        }
    }
    assert excinfo.value.message == (
        f"Error importing dashboard: {DASHBOARD_FILE}: {errors}"
    )
    assert excinfo.value.normalized_messages() == {DASHBOARD_FILE: errors}
    assert dashboard.params_dict["time_range_limits"] == stale


def test_import_v1_dashboard_rolls_back_when_the_time_default_cannot_be_fitted(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError

    stale = span(20)
    zero_hours = {"quantity": 0, "time_grain": "PT1H"}
    dataset_limits = {**span(12), "max_look_forward": zero_hours}
    contents = bundle(stale, dataset_limits=dataset_limits)
    config = yaml.safe_load(contents[DASHBOARD_FILE])
    config["metadata"]["native_filter_configuration"] = [
        {"id": "NATIVE_FILTER-time", "filterType": "filter_time"}
    ]
    contents[DASHBOARD_FILE] = yaml.safe_dump(config)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": stale})
    ImportDashboardsCommand(contents).run()
    mocker.patch.dict(
        current_app.config,
        {"TIME_RANGE_LIMITS_GLOBAL": {**span(12), "max_look_back": zero_hours}},
    )

    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDashboardsCommand(contents, overwrite=True).run()

    assert excinfo.value.status == 422
    field = (
        "json_metadata.native_filter_configuration.NATIVE_FILTER-time.defaultDataMask"
    )
    errors = excinfo.value.normalized_messages()[DASHBOARD_FILE]
    assert set(errors) == {field}
    assert "No time range fits" in errors[field][0]
    assert excinfo.value.message == (
        f"Error importing dashboard: {DASHBOARD_FILE}: {errors}"
    )
    dashboard = db.session.query(Dashboard).one()
    assert dashboard.params_dict["time_range_limits"] == stale


def test_import_v1_dashboard_restoring_a_soft_deleted_row_clamps_its_stale_override(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from datetime import datetime

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    stale = span(20)
    db.session.add(
        Dashboard(
            dashboard_title="Stale",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps({"time_range_limits": stale}),
            deleted_at=datetime(2026, 1, 1),
        )
    )
    db.session.commit()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    with pytest.raises(TimeRangeAdjustmentsRequiredError):
        ImportDashboardsCommand(bundle(span(21)), overwrite=True).run()
    assert db.session.query(Dashboard).count() == 0

    ImportDashboardsCommand(bundle(stale), adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.deleted_at is None
    assert json.loads(dashboard.json_metadata)["time_range_limits"] == span(12)


def test_import_v1_dashboard_clamps_limits_when_metadata_is_omitted(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    db.session.add(
        Dashboard(
            dashboard_title="Stale",
            uuid=dashboard_config["uuid"],
            json_metadata=json.dumps(
                {"time_range_limits": span(20), "refresh_frequency": 60}
            ),
        )
    )
    db.session.flush()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    contents = bundle(None)
    config = yaml.safe_load(contents[DASHBOARD_FILE])
    del config["metadata"]
    contents[DASHBOARD_FILE] = yaml.safe_dump(config)

    ImportDashboardsCommand(contents, overwrite=True, adjust_time_ranges=True).run()

    metadata = db.session.query(Dashboard).one().params_dict
    assert metadata["time_range_limits"] == span(12)
    assert metadata["refresh_frequency"] == 60


def test_import_v1_dashboard_with_a_fresh_uuid_clamps_the_slug_holders_stale_override(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from uuid import uuid4

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.time_range_limits.adjustments import (
        TimeRangeAdjustmentsRequiredError,
    )

    stale = span(20)
    db.session.add(
        Dashboard(
            dashboard_title="Stale",
            slug="same-slug",
            json_metadata=json.dumps({"time_range_limits": stale}),
        )
    )
    db.session.commit()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)

    def fresh(limits: Any) -> dict[str, str]:
        contents = bundle(limits)
        config = yaml.safe_load(contents[DASHBOARD_FILE])
        config["uuid"] = str(uuid4())
        config["slug"] = "same-slug"
        contents[DASHBOARD_FILE] = yaml.safe_dump(config)
        return contents

    with pytest.raises(TimeRangeAdjustmentsRequiredError):
        ImportDashboardsCommand(fresh(span(21)), overwrite=True).run()

    ImportDashboardsCommand(fresh(stale), overwrite=True, adjust_time_ranges=True).run()

    dashboard = db.session.query(Dashboard).one()
    assert dashboard.dashboard_title == "Test dash"
    assert json.loads(dashboard.json_metadata)["time_range_limits"] == span(12)


def test_import_v1_dashboard_round_trips_without_a_global(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset import db
    from superset.commands.dashboard.export import ExportDashboardsCommand
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    limits = span(9)
    dashboard = Dashboard(
        dashboard_title="Exported",
        json_metadata=json.dumps({"time_range_limits": limits}),
    )
    db.session.add(dashboard)
    db.session.flush()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    admin = User(username="admin", roles=[Role(name="Admin")])
    with override_user(admin):
        contents = {
            name: content()
            for name, content in ExportDashboardsCommand([dashboard.id]).run()
        }
    db.session.delete(dashboard)
    db.session.flush()
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})

    ImportDashboardsCommand(contents).run()

    imported = db.session.query(Dashboard).one()
    assert json.loads(imported.json_metadata)["time_range_limits"] == limits


def yaml_nodes(tree: Any) -> Generator[Any, None, None]:
    yield tree
    if isinstance(tree, dict):
        tree = list(tree.values())
    if isinstance(tree, list):
        for child in tree:
            yield from yaml_nodes(child)


def test_export_carries_the_dashboard_limit_not_the_global(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset import db
    from superset.commands.dashboard.export import ExportDashboardsCommand

    assert current_app.config["TIME_RANGE_LIMITS_GLOBAL"] == DEMO_GLOBAL
    limits = span(9)
    dashboard = Dashboard(
        dashboard_title="Exported",
        json_metadata=json.dumps({"time_range_limits": limits}),
    )
    db.session.add(dashboard)
    db.session.flush()
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    admin = User(username="admin", roles=[Role(name="Admin")])
    with override_user(admin):
        contents = {
            name: content()
            for name, content in ExportDashboardsCommand([dashboard.id]).run()
        }

    (dashboard_file,) = [name for name in contents if name.startswith("dashboards/")]
    metadata = yaml.safe_load(contents[dashboard_file])["metadata"]
    assert metadata["time_range_limits"] == limits
    global_rules = [rule for rule in DEMO_GLOBAL.values() if isinstance(rule, dict)]
    for name, text in contents.items():
        nodes = list(yaml_nodes(yaml.safe_load(text)))
        assert DEMO_GLOBAL not in nodes, name
        for rule in global_rules:
            assert rule not in nodes, (name, rule)
        assert "TIME_RANGE_LIMITS_GLOBAL" not in text, name


def test_import_v1_dashboard_bad_global_is_unavailable(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": {}})
    with pytest.raises(TimeRangeLimitsUnavailableError):
        ImportDashboardsCommand(bundle(span(1))).run()
    assert count_assets() == (0, 0, 0)


def test_import_v1_dashboard_flag_off_accepts_a_looser_override(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: False},
    )

    ImportDashboardsCommand(bundle(span(13))).run()

    dashboard = db.session.query(Dashboard).one()
    assert json.loads(dashboard.json_metadata)["time_range_limits"] == span(13)


def test_import_writes_audit_row(
    session_with_schema: Session, time_range_limits_enabled: None, mocker: MockerFixture
) -> None:
    from flask import current_app

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.core import Log
    from superset.time_range_limits.audit import (
        AUDIT_ACTION,
        register_audit_listener,
        remove_audit_listener,
    )

    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    user = User(first_name="a", last_name="b", username="u", email="u@x", active=True)
    db.session.add(user)
    db.session.commit()
    register_audit_listener(db.session)
    try:
        with (
            current_app.test_request_context("/api/v1/dashboard/import/"),
            override_user(user),
        ):
            ImportDashboardsCommand(bundle(span(9))).run()
            ImportDashboardsCommand(bundle(span(8)), overwrite=True).run()
            ImportDashboardsCommand(bundle(span(8)), overwrite=True).run()
    finally:
        remove_audit_listener(db.session)

    dashboard_id = db.session.query(Dashboard).one().id
    rows = db.session.query(Log).filter(Log.action == AUDIT_ACTION).order_by(Log.id)
    assert [(row.user_id, row.dashboard_id, json.loads(row.json)) for row in rows] == [
        (
            user.id,
            dashboard_id,
            {
                "level": "dashboard",
                "dashboard_id": dashboard_id,
                "old": old,
                "new": new,
                "path": "/api/v1/dashboard/import/",
            },
        )
        for old, new in [(None, span(9)), (span(9), span(8))]
    ]
