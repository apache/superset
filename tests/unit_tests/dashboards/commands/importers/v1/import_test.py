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
from unittest.mock import patch

import pytest
import yaml
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.dashboard.importers.v1.utils import import_dashboard
from superset.commands.exceptions import ImportFailedError
from superset.commands.importers.v1.utils import import_tag
from superset.extensions import feature_flag_manager
from superset.models.dashboard import Dashboard
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.tags.models import TaggedObject
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

    dashboard = import_dashboard(dashboard_config)
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
    dashboard = import_dashboard(config)
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

    with pytest.raises(ImportFailedError) as excinfo:
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
        with pytest.raises(ImportFailedError) as excinfo:
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
        with pytest.raises(ImportFailedError) as excinfo:
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
        result = import_dashboard(dashboard_config, overwrite=True)

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
        result = import_dashboard(dashboard_config)

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
        dashboard = import_dashboard(dashboard_config, overwrite=True)

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
        dashboard = import_dashboard(dashboard_config, overwrite=False)

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
        with pytest.raises(ImportFailedError) as excinfo:
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

    with pytest.raises(ImportFailedError) as excinfo:
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

    result = import_dashboard(dashboard_config, overwrite=True)

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

    dashboard = import_dashboard(
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
