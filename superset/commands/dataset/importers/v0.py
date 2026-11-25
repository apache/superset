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
from typing import Any, Callable, Optional

import yaml
from flask_appbuilder import Model
from sqlalchemy.orm.session import make_transient

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.commands.dataset.importers.v1.utils import (
    _default_omitted_monotonic_declarations,
    drop_unusable_partition_transforms,
)
from superset.commands.exceptions import ImportFailedError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import (
    BaseDatasource,
    SqlaTable,
    SqlMetric,
    TableColumn,
)
from superset.constants import PASSWORD_MASK
from superset.databases.utils import make_url_safe
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import get_user
from superset.utils.decorators import transaction
from superset.utils.dict_import_export import DATABASES_KEY

logger = logging.getLogger(__name__)


def lookup_sqla_table(table: SqlaTable) -> Optional[SqlaTable]:
    return (
        db.session.query(SqlaTable)
        .join(Database)
        .filter(
            SqlaTable.table_name == table.table_name,
            SqlaTable.schema == table.schema,
            Database.id == table.database_id,
        )
        .first()
    )


def lookup_sqla_database(table: SqlaTable) -> Optional[Database]:
    database = (
        db.session.query(Database)
        .filter_by(database_name=table.params_dict["database_name"])
        .one_or_none()
    )
    if database is None:
        raise DatabaseNotFoundError
    return database


def import_dataset(
    i_datasource: BaseDatasource,
    database_id: Optional[int] = None,
    import_time: Optional[int] = None,
) -> int:
    """Imports the datasource from the object to the database.

    Metrics and columns and datasource will be overridden if exists.
    This function can be used to import/export dashboards between multiple
    superset instances. Audit metadata isn't copied over.
    """

    lookup_database: Callable[[BaseDatasource], Optional[Database]]
    lookup_datasource: Callable[[BaseDatasource], Optional[BaseDatasource]]
    if isinstance(i_datasource, SqlaTable):
        lookup_database = lookup_sqla_database
        lookup_datasource = lookup_sqla_table

    else:
        raise DatasetInvalidError

    return import_datasource(
        i_datasource,
        lookup_database,
        lookup_datasource,
        import_time,
        database_id,
    )


def lookup_sqla_metric(metric: SqlMetric) -> SqlMetric:
    return (
        db.session.query(SqlMetric)
        .filter(
            SqlMetric.table_id == metric.table_id,
            SqlMetric.metric_name == metric.metric_name,
        )
        .first()
    )


def import_metric(metric: SqlMetric) -> SqlMetric:
    return import_simple_obj(metric, lookup_sqla_metric)


def lookup_sqla_column(column: TableColumn) -> TableColumn:
    return (
        db.session.query(TableColumn)
        .filter(
            TableColumn.table_id == column.table_id,
            TableColumn.column_name == column.column_name,
        )
        .first()
    )


def import_column(column: TableColumn) -> TableColumn:
    return import_simple_obj(column, lookup_sqla_column)


def import_datasource(
    i_datasource: Model,
    lookup_database: Callable[[Model], Optional[Model]],
    lookup_datasource: Callable[[Model], Optional[Model]],
    import_time: Optional[int] = None,
    database_id: Optional[int] = None,
) -> int:
    """Imports the datasource from the object to the database.

    Metrics and columns and datasource will be overridden if exists.
    This function can be used to import/export datasources between multiple
    superset instances. Audit metadata isn't copies over.
    """
    make_transient(i_datasource)
    logger.info("Started import of the datasource: %s", i_datasource.to_json())

    i_datasource.id = None
    i_datasource.database_id = (
        database_id
        if database_id
        else getattr(lookup_database(i_datasource), "id", None)
    )
    i_datasource.alter_params(import_time=import_time)

    # override the datasource
    datasource = lookup_datasource(i_datasource)

    if datasource:
        datasource.override(i_datasource)
        db.session.flush()
    else:
        datasource = i_datasource.copy()
        db.session.add(datasource)
        db.session.flush()

    for metric in i_datasource.metrics:
        new_m = metric.copy()
        new_m.table_id = datasource.id
        logger.info(
            "Importing metric %s from the datasource: %s",
            new_m.to_json(),
            i_datasource.full_name,
        )
        imported_m = import_metric(new_m)
        if imported_m.metric_name not in [m.metric_name for m in datasource.metrics]:
            datasource.metrics.append(imported_m)

    for column in i_datasource.columns:
        new_c = column.copy()
        new_c.table_id = datasource.id
        logger.info(
            "Importing column %s from the datasource: %s",
            new_c.to_json(),
            i_datasource.full_name,
        )
        imported_c = import_column(new_c)
        if imported_c.column_name not in [c.column_name for c in datasource.columns]:
            datasource.columns.append(imported_c)
    db.session.flush()
    return datasource.id


def import_simple_obj(i_obj: Model, lookup_obj: Callable[[Model], Model]) -> Model:
    make_transient(i_obj)
    i_obj.id = None
    i_obj.table = None

    # find if the column was already imported
    existing_column = lookup_obj(i_obj)
    i_obj.table = None
    if existing_column:
        existing_column.override(i_obj)
        db.session.flush()
        return existing_column

    db.session.add(i_obj)
    db.session.flush()
    return i_obj


def import_from_dict(
    data: dict[str, Any], sync: Optional[list[str]] = None
) -> list[SqlaTable]:
    """Imports databases from dictionary, and answers with the datasets it wrote.

    The datasets are reported so the caller can run the partition filter
    mapping's repairs over them: `Database.export_children` carries ``tables``,
    so a database bundle creates datasets here as well as connections.
    """
    if not sync:
        sync = []
    imported: list[SqlaTable] = []
    if isinstance(data, dict):
        databases = data.get(DATABASES_KEY, [])
        # This legacy path creates/updates the embedded database connections.
        # Mirror the versioned (v1) import commands and require database write
        # permission for the objects being created here. Only enforced when there
        # is something to import and a request user is present, so the CLI import
        # paths keep working.
        if (
            databases
            and get_user()
            and not security_manager.can_access("can_write", "Database")
        ):
            raise ImportFailedError(
                "User doesn't have permission to create or update databases"
            )
        logger.info("Importing %d %s", len(databases), DATABASES_KEY)
        for database in databases:
            db_obj = Database.import_from_dict(database, sync=sync)
            # ``import_from_dict`` sets fields via setattr, bypassing
            # ``set_sqlalchemy_uri``.  Call it explicitly so that any plaintext
            # password in the URI is extracted into the encrypted ``password``
            # column and replaced with the password mask in ``sqlalchemy_uri``.
            if db_obj is not None:
                # Only call set_sqlalchemy_uri when the imported URI carries a real
                # password (non-empty and not the password mask).  If the URI has no
                # password segment — common when users keep secrets out of YAML and
                # rely on the encrypted ``password`` column from a prior run —
                # calling set_sqlalchemy_uri would set ``password = None`` and break
                # existing connections.
                parsed = make_url_safe(db_obj.sqlalchemy_uri)
                if parsed.password and parsed.password != PASSWORD_MASK:
                    db_obj.set_sqlalchemy_uri(db_obj.sqlalchemy_uri)
                imported.extend(db_obj.tables or [])
    else:
        logger.info("Supplied object is not a dictionary.")
    return imported


class ImportDatasetsCommand(BaseCommand):
    """
    Import datasources in YAML format.

    This is the original unversioned format used to export and import datasources
    in Superset.
    """

    # pylint: disable=unused-argument
    def __init__(
        self,
        contents: dict[str, str],
        *args: Any,
        **kwargs: Any,
    ):
        self.contents = contents
        self._configs: dict[str, Any] = {}

        self.sync = []
        if kwargs.get("sync_columns"):
            self.sync.append("columns")
        if kwargs.get("sync_metrics"):
            self.sync.append("metrics")

    @transaction()
    def run(self) -> None:
        self.validate()

        imported: list[SqlaTable] = []
        for file_name, config in self._configs.items():
            logger.info("Importing dataset from file %s", file_name)
            self._default_omitted_monotonic_declarations(config)
            if isinstance(config, dict):
                for database_config in config.get(DATABASES_KEY) or []:
                    # The connection is imported by name, so it may or may not
                    # exist yet; `one_or_none` rather than `one`, and a bundle
                    # creating its own connection simply has nothing stored to
                    # disarm or validate against.
                    database = (
                        db.session.query(Database)
                        .filter_by(database_name=database_config.get("database_name"))
                        .one_or_none()
                    )
                    for dataset in database_config.get("tables") or []:
                        self._prepare_partition_mapping(dataset, database)
                imported.extend(import_from_dict(config, sync=self.sync))
            else:  # list
                for dataset in config:
                    # UI exports don't have the database metadata, so we assume
                    # the DB exists and has the same name
                    params = json.loads(dataset["params"])
                    database = (
                        db.session.query(Database)
                        .filter_by(database_name=params["database_name"])
                        .one()
                    )
                    dataset["database_id"] = database.id
                    self._prepare_partition_mapping(dataset, database)
                    table = SqlaTable.import_from_dict(dataset, sync=self.sync)
                    if table is not None:
                        imported.append(table)

        self._repair_partition_mappings(imported)

    @classmethod
    def _default_omitted_monotonic_declarations(cls, config: Any) -> None:
        """
        Materialize `partition_transform_is_monotonic` wherever a transform is
        set, anywhere in a v0 config.

        The v1 importer does this on its own raw config, and for the same
        reason: an overwrite keeps whatever the bundle omits, including a
        ``True`` left behind by the transform this bundle is replacing. A
        non-monotonic transform declared monotonic enables range mirrors that
        exclude rows the filter keeps -- ``abs(:value)`` inheriting a stored
        ``True`` turns ``n >= -1`` into ``p >= 1`` and misses ``n = 0``.

        Walked rather than addressed directly because a v0 bundle comes in two
        shapes: a CLI export nests datasets under ``databases[].tables[]``,
        while a UI export is a bare list of datasets. Only columns that supply
        a transform are touched, so a re-import that says nothing about a
        column stays idempotent.
        """
        if isinstance(config, list):
            for entry in config:
                cls._default_omitted_monotonic_declarations(entry)
            return
        if not isinstance(config, dict):
            return
        _default_omitted_monotonic_declarations(config.get("columns") or [])
        for key in (DATABASES_KEY, "tables"):
            for child in config.get(key) or []:
                cls._default_omitted_monotonic_declarations(child)

    @staticmethod
    def _prepare_partition_mapping(
        dataset: dict[str, Any], database: Optional[Database]
    ) -> None:
        """
        Run the two repairs that have to happen *before* the bundle is applied.

        `_repair_partition_mappings` below runs after `import_from_dict`, which
        is too late for either of these.

        Sanitizing the bundle. The v1 importer drops a transform the save path
        would refuse (`drop_unusable_partition_transforms`) on its way in, and
        v0 did not -- so a legacy bundle naming ``partition_mapped_column: n``
        and a transform of ``random() + :value`` on ``n`` imported happily and
        then failed *every* later save: a description-only
        ``PUT /api/v1/dataset/<id>`` returns 422 on the stored expression, and
        the mapping never mirrors anything. Applied to the config rather than
        the model because that is where the transform still is.

        Disarming the old mapping. `DatasetDAO.clear_unmapped_partition_transforms`
        reads the mapping as it stands, so the post-import call can only enforce
        the one-transform invariant against the *new* references. An overwrite
        that re-points the mapping makes a previously unmapped column the
        effective one, and a transform parked there -- which nothing in the
        bundle authored -- is found already mapped by the later call and kept.
        A dataset mapping ``a -> p`` with a parked ``:value + 100`` on ``b``,
        overwritten by a bundle setting ``partition_mapped_column: b`` and
        omitting the columns, would mirror ``b = 5`` as ``p = 105`` and drop the
        row ``(a=1, b=5, p=1)``. The same pre-change call `DatasetDAO.update`
        and the v1 importer both make, and for the same reason.

        ``database`` is ``None`` only for a CLI bundle importing a connection
        that does not exist yet, which by definition has no stored dataset to
        disarm and no dialect to validate a transform against -- the same case
        `drop_unusable_partition_transforms` already declines to act on.
        """
        if database is None:
            return

        # Deferred import: `daos.dataset` pulls in `views.base`, which
        # circularly imports back into the commands package at app init.
        from superset.daos.dataset import DatasetDAO  # noqa: PLC0415

        drop_unusable_partition_transforms(dataset, database)

        if not (table_name := dataset.get("table_name")):
            return
        existing = (
            db.session.query(SqlaTable)
            .filter(
                SqlaTable.table_name == table_name,
                SqlaTable.schema == dataset.get("schema"),
                SqlaTable.catalog == dataset["catalog"]
                if dataset.get("catalog") is not None
                else True,
                SqlaTable.database_id == database.id,
            )
            .one_or_none()
        )
        if existing is not None:
            DatasetDAO.clear_unmapped_partition_transforms(existing)

    @staticmethod
    def _repair_partition_mappings(datasets: list[SqlaTable]) -> None:
        """
        Keep the partition filter mapping honest across a v0 import.

        The mapping's columns ride in `SqlaTable.export_fields`, so this path
        carries them -- but it calls `SqlaTable.import_from_dict` directly and
        goes through neither `DatasetDAO.update` nor the v1 importer, so
        neither of the mapping's repairs ran. An older bundle imported with
        ``--sync columns`` that omits the partition column deletes it and keeps
        `partition_column` naming it: pruning silently stops, and every later
        edit of that dataset fails the partition-column-not-found validation,
        including a description-only PUT, which carries no columns payload and
        so cannot reach the branch that forgives a stored-only dangle.

        The same pair, in the same order, as `RefreshDatasetCommand` and the
        v1 importer. Run after the import rather than around it because
        ``import_from_dict`` is what discovers which datasets are involved.
        """
        if not datasets:
            return
        # Deferred import: `daos.dataset` pulls in `views.base`, which
        # circularly imports back into the commands package at app init.
        from superset.daos.dataset import DatasetDAO  # noqa: PLC0415

        db.session.flush()
        for dataset in datasets:
            DatasetDAO.clear_dangling_partition_mapping(
                dataset, {column.column_name for column in dataset.columns}
            )
            # The other reference a bundle can leave unsaveable, cleared the way
            # the v1 importer clears it: an *explicit* self-mapping is blocking
            # in `UpdateDatasetCommand`, so a bundle setting both references to
            # the same existing column imported happily and then failed every
            # later edit, including a description-only PUT. Dropping only the
            # override leaves the mapping following `main_dttm_col`, which is
            # the state a bundle omitting the field would have produced.
            if (
                dataset.partition_mapped_column
                and dataset.partition_mapped_column == dataset.partition_column
            ):
                logger.warning(
                    "Clearing the partition mapped column on dataset %s during "
                    "import: it names the partition column itself, which no "
                    "later save would accept",
                    dataset.table_name,
                )
                dataset.partition_mapped_column = None
            DatasetDAO.clear_unmapped_partition_transforms(dataset)

    def validate(self) -> None:
        # ensure all files are YAML
        for file_name, content in self.contents.items():
            try:
                config = yaml.safe_load(content)
            except yaml.YAMLError as ex:
                logger.exception("Invalid YAML file")
                raise IncorrectVersionError(
                    f"{file_name} is not a valid YAML file"
                ) from ex

            # CLI export
            if isinstance(config, dict):
                # TODO (betodealmeida): validate with Marshmallow
                if DATABASES_KEY not in config:
                    raise IncorrectVersionError(f"{file_name} has no valid keys")

            # UI export
            elif isinstance(config, list):
                # TODO (betodealmeida): validate with Marshmallow
                pass

            else:
                raise IncorrectVersionError(f"{file_name} is not a valid file")

            self._configs[file_name] = config
