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
# pylint: disable=import-outside-toplevel, unused-argument

from typing import Any

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.models.core import Database
from superset.utils.core import override_user
from tests.unit_tests.conftest import with_feature_flags

# A minimal unversioned dataset export carrying an embedded database connection.
DATA_WITH_DATABASE = {"databases": [{"database_name": "sample_db"}]}


def _v0_admin() -> User:
    """
    `AuditMixinNullable` reads `g.user` on insert and these tests have no
    request context, so the persisted fixtures are written under this user.
    """
    return User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )


def test_import_from_dict_requires_database_write(mocker: MockerFixture) -> None:
    """
    A user must hold database write permission to create/update the database
    connections embedded in a legacy dataset export.
    """
    from superset import security_manager
    from superset.commands.dataset.importers import v0
    from superset.commands.exceptions import ImportFailedError

    mocker.patch.object(v0, "get_user", return_value=object())
    can_access = mocker.patch.object(security_manager, "can_access", return_value=False)
    imported = mocker.patch.object(v0.Database, "import_from_dict")

    with pytest.raises(ImportFailedError):
        v0.import_from_dict(DATA_WITH_DATABASE)

    can_access.assert_called_once_with("can_write", "Database")
    imported.assert_not_called()


def test_import_from_dict_allows_database_write(mocker: MockerFixture) -> None:
    """
    A user holding database write permission proceeds to import the databases.
    """
    from superset import security_manager
    from superset.commands.dataset.importers import v0

    mocker.patch.object(v0, "get_user", return_value=object())
    mocker.patch.object(security_manager, "can_access", return_value=True)
    imported = mocker.patch.object(v0.Database, "import_from_dict", return_value=None)

    v0.import_from_dict(DATA_WITH_DATABASE)

    imported.assert_called_once()


def test_import_from_dict_skips_check_without_user(mocker: MockerFixture) -> None:
    """
    The command-line import paths run without a request user; the permission
    check is skipped so those paths keep working.
    """
    from superset import security_manager
    from superset.commands.dataset.importers import v0

    mocker.patch.object(v0, "get_user", return_value=None)
    can_access = mocker.patch.object(security_manager, "can_access")
    imported = mocker.patch.object(v0.Database, "import_from_dict", return_value=None)

    v0.import_from_dict(DATA_WITH_DATABASE)

    can_access.assert_not_called()
    imported.assert_called_once()


def test_validate_parser_error_raises_incorrect_version_error() -> None:
    """
    A YAML file malformed in a way that raises ``yaml.parser.ParserError``
    (an unterminated flow sequence) is reported as an invalid version.
    """
    from superset.commands.dataset.importers import v0
    from superset.commands.importers.exceptions import IncorrectVersionError

    command = v0.ImportDatasetsCommand({"broken.yaml": "[1, 2"})

    with pytest.raises(IncorrectVersionError):
        command.validate()


def test_validate_scanner_error_raises_incorrect_version_error() -> None:
    """
    A YAML file malformed in a way that raises ``yaml.scanner.ScannerError``
    (an unterminated quoted string) is a sibling of ``ParserError`` under
    ``yaml.YAMLError`` and must also be reported as an invalid version rather
    than propagating as a raw, uncaught exception.
    """
    from superset.commands.dataset.importers import v0
    from superset.commands.importers.exceptions import IncorrectVersionError

    command = v0.ImportDatasetsCommand({"broken.yaml": 'key: "unterminated string'})

    with pytest.raises(IncorrectVersionError):
        command.validate()


def test_a_v0_import_repairs_a_dangling_partition_mapping(
    mocker: MockerFixture,
) -> None:
    """
    `SqlaTable.export_fields` carries the mapping's columns, so this path
    imports them -- but it calls `SqlaTable.import_from_dict` directly and goes
    through neither `DatasetDAO.update` nor the v1 importer, so neither repair
    ran. An older bundle imported with ``--sync columns`` that omits the
    partition column deleted it and left `partition_column` naming it, which
    stops the pruning and fails every later edit of that dataset.
    """
    from superset.commands.dataset.importers import v0
    from superset.daos.dataset import DatasetDAO

    dataset = mocker.MagicMock()
    dataset.columns = [mocker.MagicMock(column_name="event_time")]
    mocker.patch.object(v0.SqlaTable, "import_from_dict", return_value=dataset)
    mocker.patch.object(v0.db.session, "flush")
    mocker.patch.object(
        v0.db.session, "query", return_value=mocker.MagicMock()
    ).return_value.filter_by.return_value.one.return_value = mocker.MagicMock(id=1)
    dangling = mocker.patch.object(DatasetDAO, "clear_dangling_partition_mapping")
    unmapped = mocker.patch.object(DatasetDAO, "clear_unmapped_partition_transforms")

    command = v0.ImportDatasetsCommand({}, sync_columns=True)
    command._configs = {  # noqa: SLF001
        "ds.yaml": [{"params": '{"database_name": "sample_db"}'}]
    }
    command.run()

    dangling.assert_called_once_with(dataset, {"event_time"})
    unmapped.assert_called_once_with(dataset)


def test_a_v0_database_bundle_repairs_its_datasets_too(mocker: MockerFixture) -> None:
    """
    `Database.export_children` carries ``tables``, so the database branch
    creates datasets as well as connections -- which is why
    `import_from_dict` reports what it wrote rather than the caller guessing.
    """
    from superset.commands.dataset.importers import v0
    from superset.daos.dataset import DatasetDAO

    dataset = mocker.MagicMock()
    dataset.columns = [mocker.MagicMock(column_name="ds")]
    db_obj = mocker.MagicMock(tables=[dataset])
    db_obj.sqlalchemy_uri = "postgresql://u@h/d"
    mocker.patch.object(v0, "get_user", return_value=None)
    mocker.patch.object(v0.Database, "import_from_dict", return_value=db_obj)
    mocker.patch.object(v0.db.session, "flush")
    dangling = mocker.patch.object(DatasetDAO, "clear_dangling_partition_mapping")
    unmapped = mocker.patch.object(DatasetDAO, "clear_unmapped_partition_transforms")

    command = v0.ImportDatasetsCommand({})
    command._configs = {"db.yaml": DATA_WITH_DATABASE}  # noqa: SLF001
    command.run()

    dangling.assert_called_once_with(dataset, {"ds"})
    unmapped.assert_called_once_with(dataset)


def test_a_v0_import_clears_an_explicit_self_mapping(mocker: MockerFixture) -> None:
    """
    A dangling reference is not the only mapping a later save refuses: an
    explicit self-mapping -- `partition_mapped_column` equal to
    `partition_column` -- is blocking in `UpdateDatasetCommand`. A legacy
    bundle setting both to the same existing column imported cleanly and then
    failed every later edit, including a description-only PUT. The v1 importer
    already clears it; this path did not.
    """
    from superset.commands.dataset.importers import v0
    from superset.daos.dataset import DatasetDAO

    dataset = mocker.MagicMock()
    dataset.columns = [mocker.MagicMock(column_name="event_time")]
    dataset.partition_column = "event_time"
    dataset.partition_mapped_column = "event_time"
    mocker.patch.object(v0.SqlaTable, "import_from_dict", return_value=dataset)
    mocker.patch.object(v0.db.session, "flush")
    mocker.patch.object(
        v0.db.session, "query", return_value=mocker.MagicMock()
    ).return_value.filter_by.return_value.one.return_value = mocker.MagicMock(id=1)
    mocker.patch.object(DatasetDAO, "clear_dangling_partition_mapping")
    mocker.patch.object(DatasetDAO, "clear_unmapped_partition_transforms")

    command = v0.ImportDatasetsCommand({})
    command._configs = {  # noqa: SLF001
        "ds.yaml": [{"params": '{"database_name": "sample_db"}'}]
    }
    command.run()

    # Only the override goes, which leaves the mapping following
    # `main_dttm_col` -- the state a bundle omitting the field would produce.
    assert dataset.partition_mapped_column is None
    assert dataset.partition_column == "event_time"


@pytest.mark.parametrize(
    "config",
    [
        # A UI export: a bare list of datasets.
        [
            {
                "params": '{"database_name": "sample_db"}',
                "columns": [
                    {"column_name": "n", "partition_value_transform": "abs(:value)"}
                ],
            }
        ],
        # A CLI export: datasets nested under their database.
        {
            "databases": [
                {
                    "database_name": "sample_db",
                    "tables": [
                        {
                            "table_name": "t",
                            "columns": [
                                {
                                    "column_name": "n",
                                    "partition_value_transform": "abs(:value)",
                                }
                            ],
                        }
                    ],
                }
            ]
        },
    ],
    ids=["ui-export", "cli-export"],
)
def test_a_v0_import_defaults_an_omitted_monotonic_declaration(
    config: list[dict[str, Any]] | dict[str, Any],
) -> None:
    """
    An overwrite keeps whatever the bundle omits, including a `True` left
    behind by the transform this bundle replaces. `abs(:value)` inheriting it
    enables range mirrors that exclude rows the filter keeps: `n >= -1` becomes
    `p >= 1` and misses `n = 0, p = 0`.

    Both bundle shapes, because a v0 config nests datasets differently
    depending on where it came from.
    """
    from superset.commands.dataset.importers import v0

    v0.ImportDatasetsCommand._default_omitted_monotonic_declarations(  # noqa: SLF001
        config
    )

    columns = (
        config[0]["columns"]
        if isinstance(config, list)
        else config["databases"][0]["tables"][0]["columns"]
    )
    assert isinstance(columns, list)
    assert columns[0]["partition_transform_is_monotonic"] is False


def test_a_v0_import_leaves_a_transformless_column_alone() -> None:
    """
    Only columns that supply a transform are touched, so a re-import that says
    nothing about a column stays idempotent -- and an explicit declaration the
    bundle does carry is not overwritten.
    """
    from superset.commands.dataset.importers import v0

    columns: list[dict[str, Any]] = [
        {"column_name": "plain"},
        {
            "column_name": "declared",
            "partition_value_transform": "unix_timestamp(:value)",
            "partition_transform_is_monotonic": True,
        },
    ]
    config = [{"columns": columns}]

    v0.ImportDatasetsCommand._default_omitted_monotonic_declarations(  # noqa: SLF001
        config
    )

    assert "partition_transform_is_monotonic" not in columns[0]
    assert columns[1]["partition_transform_is_monotonic"] is True


def test_a_v0_import_normalizes_before_it_writes(mocker: MockerFixture) -> None:
    """
    The wiring, not the helper: the tests above call
    `_default_omitted_monotonic_declarations` directly, so deleting its call
    from `run()` would leave them green while the default never reached
    storage. Asserted on the payload `import_from_dict` actually receives.
    """
    from superset.commands.dataset.importers import v0
    from superset.daos.dataset import DatasetDAO

    dataset = mocker.MagicMock()
    dataset.columns = []
    dataset.partition_column = None
    dataset.partition_mapped_column = None
    imported = mocker.patch.object(
        v0.SqlaTable, "import_from_dict", return_value=dataset
    )
    mocker.patch.object(v0.db.session, "flush")
    mocker.patch.object(
        v0.db.session, "query", return_value=mocker.MagicMock()
    ).return_value.filter_by.return_value.one.return_value = mocker.MagicMock(id=1)
    mocker.patch.object(DatasetDAO, "clear_dangling_partition_mapping")
    mocker.patch.object(DatasetDAO, "clear_unmapped_partition_transforms")

    command = v0.ImportDatasetsCommand({})
    command._configs = {  # noqa: SLF001
        "ds.yaml": [
            {
                "params": '{"database_name": "sample_db"}',
                "columns": [
                    {"column_name": "n", "partition_value_transform": "abs(:value)"}
                ],
            }
        ]
    }
    command.run()

    written = imported.call_args.args[0]
    assert written["columns"][0]["partition_transform_is_monotonic"] is False


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
@pytest.mark.parametrize("shape", ["ui-export", "cli-export"])
def test_a_v0_import_drops_a_transform_the_save_path_would_reject(
    mocker: MockerFixture,
    session: Session,
    shape: str,
) -> None:
    """
    v0 ran neither of the v1 importer's pre-import repairs, and this is the
    sanitizing one. A legacy bundle naming ``partition_mapped_column: n`` and a
    transform of ``rand() + 0 * :value`` on ``n`` imported happily and stored
    the expression -- and then *every* later save failed validation: a
    description-only ``PUT /api/v1/dataset/<id>`` returns 422 on the stored
    transform, and the mapping never mirrors anything.

    Both bundle shapes, because a v0 config nests datasets differently
    depending on where it came from and the wiring is per-branch: deleting the
    `_prepare_partition_mapping` call from either branch of `run()` fails this
    on that shape alone.
    """
    from superset.commands.dataset.importers import v0

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    database = Database(database_name="pfm_v0_db", sqlalchemy_uri="hive://localhost/d")
    db.session.add(database)
    db.session.flush()

    columns: list[dict[str, Any]] = [
        {
            "column_name": "n",
            "partition_value_transform": "rand() + 0 * :value",
            "partition_transform_is_monotonic": True,
        }
    ]
    dataset: dict[str, Any] = {
        "table_name": "pfm_v0",
        "columns": columns,
        "partition_column": "p",
        "partition_mapped_column": "n",
    }

    config: Any
    if shape == "ui-export":
        dataset["params"] = '{"database_name": "pfm_v0_db"}'
        config = [dataset]
    else:
        config = {"databases": [{"database_name": "pfm_v0_db", "tables": [dataset]}]}

    # The write itself is not what this pins; the config the writer is handed is.
    mocker.patch.object(v0, "get_user", return_value=None)
    mocker.patch.object(v0.SqlaTable, "import_from_dict", return_value=None)
    mocker.patch.object(v0.Database, "import_from_dict", return_value=None)

    command = v0.ImportDatasetsCommand({})
    command._configs = {"ds.yaml": config}  # noqa: SLF001
    command.run()

    assert columns[0]["partition_value_transform"] is None
    assert columns[0]["partition_transform_is_monotonic"] is False


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_a_v0_overwrite_disarms_the_old_mapping_before_the_new_one_lands(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    The other pre-import repair. `clear_unmapped_partition_transforms` reads
    the mapping as it stands, so the post-import call can only enforce the
    one-transform invariant against the *new* references -- it resolves the new
    mapping, finds the parked column already effective, and keeps a transform
    nothing in the bundle authored.

    Here the stored dataset maps ``a -> p`` and holds a parked ``:value + 100``
    on ``b``. A v0 overwrite that sets ``partition_mapped_column: b`` and omits
    the columns makes ``b`` effective, so without the pre-import call a chart
    filter of ``b = 5`` mirrors to ``p = 105`` and drops the row
    ``(a=1, b=5, p=1)``.
    """
    from superset.commands.dataset.importers import v0

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    database = Database(database_name="pfm_v0_db2", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    stored = SqlaTable(
        table_name="pfm_v0_overwrite",
        database=database,
        schema="main",
        main_dttm_col="a",
        columns=[
            TableColumn(column_name="a", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="b", type="BIGINT"),
            TableColumn(column_name="p", type="BIGINT"),
        ],
    )
    stored.partition_column = "p"
    stored.partition_mapped_column = "a"
    stored.columns[0].partition_value_transform = "unix_timestamp(:value)"
    # Parked: no row renders it, nobody chose it, and the only thing that would
    # make it effective is this overwrite re-pointing the mapped column at `b`.
    stored.columns[1].partition_value_transform = ":value + 100"
    with override_user(_v0_admin()):
        db.session.add(stored)
        db.session.flush()

    mocker.patch.object(v0, "get_user", return_value=None)
    mocker.patch.object(v0.SqlaTable, "import_from_dict", return_value=None)

    command = v0.ImportDatasetsCommand({})
    command._configs = {  # noqa: SLF001
        "ds.yaml": [
            {
                "table_name": "pfm_v0_overwrite",
                "schema": "main",
                "params": '{"database_name": "pfm_v0_db2"}',
                "partition_mapped_column": "b",
            }
        ]
    }
    command.run()

    transforms = {c.column_name: c.partition_value_transform for c in stored.columns}
    assert transforms["b"] is None, "the parked transform survived the overwrite"
    # `a` was the mapped column when the call ran, so its own transform is the
    # one the invariant keeps. The post-import pass clears it once `b` becomes
    # effective; what matters here is that `b` was disarmed first.
    assert transforms["p"] is None
