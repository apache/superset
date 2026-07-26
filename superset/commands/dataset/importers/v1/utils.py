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
import gzip
import logging
import os
import re
from typing import Any
from urllib import request
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler

import pandas as pd
from flask import current_app as app
from pandas.errors import OutOfBoundsDatetime
from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, String, Text
from sqlalchemy.exc import MultipleResultsFound
from sqlalchemy.types import TypeEngine

from superset import db, security_manager
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetForbiddenDataURI,
    MultiCatalogDisabledValidationError,
)
from superset.commands.exceptions import ImportFailedError
from superset.commands.importers.v1.utils import find_existing_for_import
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.daos.dataset import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.sql.parse import Table
from superset.utils import json
from superset.utils.core import get_user
from superset.utils.network import is_safe_host

logger = logging.getLogger(__name__)


class _ValidatingRedirectHandler(HTTPRedirectHandler):
    """Re-validates the redirect target URL before following any HTTP redirect.

    Prevents bypasses where an initial URL passes validation but a subsequent
    redirect points to a disallowed destination.
    """

    def redirect_request(
        self,
        req: request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> request.Request | None:
        """Validate each redirect target before delegating to the parent handler."""
        # Resolve relative redirects against the originating request URL so that
        # validate_data_uri receives a fully-qualified URL in all cases.
        absolute_url = urljoin(req.full_url, newurl)
        validate_data_uri(absolute_url)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


CHUNKSIZE = 512
VARCHAR = re.compile(r"VARCHAR\((\d+)\)", re.IGNORECASE)

JSON_KEYS = {"params", "template_params", "extra"}


type_map = {
    "BOOLEAN": Boolean(),
    "VARCHAR": String(255),
    "STRING": String(255),
    "TEXT": Text(),
    "BIGINT": BigInteger(),
    "FLOAT": Float(),
    "FLOAT64": Float(),
    "DOUBLE PRECISION": Float(),
    "DATE": Date(),
    "DATETIME": DateTime(),
    "TIMESTAMP WITHOUT TIME ZONE": DateTime(timezone=False),
    "TIMESTAMP WITH TIME ZONE": DateTime(timezone=True),
}


def get_sqla_type(native_type: str) -> TypeEngine:
    if native_type.upper() in type_map:
        return type_map[native_type.upper()]

    if match := VARCHAR.match(native_type):
        size = int(match.group(1))
        return String(size)

    raise Exception(  # pylint: disable=broad-exception-raised
        f"Unknown type: {native_type}"
    )


def get_dtype(df: pd.DataFrame, dataset: SqlaTable) -> dict[str, TypeEngine]:
    return {
        column.column_name: get_sqla_type(column.type)
        for column in dataset.columns
        if column.column_name in df.keys()
    }


def validate_data_uri(data_uri: str) -> None:
    """
    Validate that the data URI is permitted for dataset import.

    Local ``file://`` URIs are allowed only when the path is confined to the
    bundled examples folder.  All other URIs must match a pattern in
    ``DATASET_IMPORT_ALLOWED_DATA_URLS`` *and* resolve to a publicly-routable host.

    :param data_uri: the URI to validate
    :raises DatasetForbiddenDataURI: if the URI is not permitted
    """
    parsed = urlparse(data_uri)
    # ``urlparse`` lower-cases the scheme, so gating on it (rather than a
    # case-sensitive ``startswith("file://")``) also rejects mixed-case
    # variants like ``FiLe://`` that would otherwise skip the local-file
    # sandbox check below.
    if parsed.scheme == "file":
        from urllib.request import url2pathname

        from superset.examples.helpers import get_examples_folder

        # Reject non-local authority components (e.g. file://remotehost/path).
        if parsed.netloc and parsed.netloc.lower() != "localhost":
            raise DatasetForbiddenDataURI()
        # url2pathname handles URL-encoded characters and platform path separators.
        file_path = url2pathname(parsed.path)
        # Resolve symlinks and relative components before comparing.
        real_path = os.path.realpath(file_path)
        examples_folder = os.path.realpath(get_examples_folder())
        if not real_path.startswith(examples_folder + os.sep):
            raise DatasetForbiddenDataURI()
        return

    allowed_urls = app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"]
    for allowed_url in allowed_urls:
        try:
            match = re.match(allowed_url, data_uri)
        except re.error:
            logger.exception(
                "Invalid regular expression on DATASET_IMPORT_ALLOWED_URLS"
            )
            raise
        if match:
            if not app.config["DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS"]:
                hostname = parsed.hostname
                # Fail-closed: reject URIs that have no parseable hostname as
                # well as those that resolve to non-public addresses.
                if not hostname or not is_safe_host(hostname):
                    raise DatasetForbiddenDataURI()
            return
    raise DatasetForbiddenDataURI()


def validate_catalog(config: dict[str, Any]) -> None:
    """
    Reject a non-default catalog when the target database has multi-catalog
    disabled, matching the dataset update validation so an import can't silently
    bind a dataset to an unintended catalog (and route queries to it).
    """
    catalog = config.get("catalog")
    database_id = config.get("database_id")
    if not catalog or database_id is None:
        return

    database = db.session.query(Database).filter_by(id=database_id).first()
    if database is None or not database.db_engine_spec.supports_catalog:
        return

    # Only validate when the connection has a known default catalog to compare
    # against; without one there is no "non-default" catalog to reject.
    default_catalog = database.get_default_catalog()
    if (
        default_catalog is not None
        and not database.allow_multi_catalog
        and catalog != default_catalog
    ):
        raise MultiCatalogDisabledValidationError()


def import_dataset(  # noqa: C901
    config: dict[str, Any],
    overwrite: bool = False,
    force_data: bool = False,
    ignore_permissions: bool = False,
) -> SqlaTable:
    """Import a dataset from a config dict, handling existing matches.

    Permission model for an existing UUID match:

    +--------------+---------------+---------------------+-----------------+
    | Existing row | overwrite arg | Caller has perms?   | Outcome         |
    +==============+===============+=====================+=================+
    | alive        | False         | (n/a)               | return existing |
    +--------------+---------------+---------------------+-----------------+
    | alive        | True          | can_write + editor  | UPDATE in place |
    +--------------+---------------+---------------------+-----------------+
    | alive        | True          | can_write,          | raise           |
    |              |               | not editor/admin    |                 |
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | can_write + editor  | restore + UPDATE|
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | can_write,          | raise           |
    |              |               | not editor/admin    |                 |
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | not can_write       | raise (Case B)  |
    +--------------+---------------+---------------------+-----------------+

    Re-importing a soft-deleted UUID is implicitly a restore-with-update:
    the user is bringing the dataset back by uploading it again. We apply
    the same editorship check as the explicit overwrite path so non-editors
    cannot resurrect via re-import, and we raise rather than silently
    returning a soft-deleted row to callers without write permission
    (which would let them reattach charts/dashboards to a deleted dataset).
    """
    can_write = ignore_permissions or security_manager.can_access(
        "can_write",
        "Dataset",
    )
    # `user` is None for background / example-loader paths (no Flask request
    # user). Combined with ``can_write=True`` (typically from
    # ``ignore_permissions=True``), the editorship checks in the restore /
    # overwrite branches below are intentionally skipped because the caller has
    # already established trust at the command level.
    user = get_user()
    # Tracks whether we entered the soft-deleted mutation path so the
    # downstream `sync` decision (below) can reflect that an
    # implicit-restore re-import is a clean replacement, not a merge.
    is_soft_deleted_match = False

    if existing := find_existing_for_import(SqlaTable, config["uuid"]):
        if existing.deleted_at is not None:
            # RESTORE path — re-importing a soft-deleted UUID is an implicit
            # restore-with-update, a distinct operation from overwriting an
            # alive row, so it is handled in its own branch.
            if not can_write:
                # Case B: don't silently return a soft-deleted row to a caller
                # without write permission — that would let the importer
                # reattach charts/dashboards to a deleted dataset and produce
                # broken charts.
                raise ImportFailedError(
                    f"Dataset {existing.table_name!r} (uuid {config['uuid']}) "
                    "was deleted and re-import requires can_write permission "
                    "to restore it"
                )
            # ``user`` is None on background / example-loader paths; combined
            # with ``can_write`` (typically from ``ignore_permissions=True``)
            # the editorship check is intentionally skipped because the caller
            # already established trust.
            if user and (
                not security_manager.is_editor(existing)
                and not security_manager.is_admin()
            ):
                raise ImportFailedError(
                    f"Dataset {existing.table_name!r} (uuid {config['uuid']}) "
                    "already exists and user doesn't have permissions to "
                    "restore it"
                )
            # Before clearing ``deleted_at``, refuse if another active dataset
            # already references the same physical table. Otherwise the
            # restore would produce two live ``SqlaTable`` rows for one
            # physical table, breaking the logical-uniqueness contract. The
            # shared DAO helper relies on the SoftDeleteMixin listener to
            # consider only active rows, excludes ``existing`` itself via
            # ``id !=``, and normalizes the catalog the same way create/update
            # uniqueness does.
            # Probe the POST-update identity: the uploaded config may rename
            # table_name/schema/catalog, and the collision that matters is
            # against the identity the restored row will end up with — not
            # the stale stored one. Absent keys fall back to the stored
            # values; explicit nulls are respected.
            incoming_identity = Table(
                config.get("table_name") or existing.table_name,
                config.get("schema", existing.schema),
                config.get("catalog", existing.catalog),
            )
            if DatasetDAO.has_active_logical_duplicate(existing, incoming_identity):
                raise ImportFailedError(
                    f"Dataset {existing.table_name!r} (uuid {config['uuid']}) "
                    "cannot be restored via re-import because another active "
                    "dataset already references the same physical table "
                    f"({incoming_identity.table!r}). Rename one of them and "
                    "retry."
                )
            # Restore in place (clear ``deleted_at``) rather than
            # hard-delete-and-replace: a hard delete would cascade through the
            # chart back-reference and the delete-orphan child relationships
            # (table_columns, sql_metrics), which the import would then need to
            # reconstruct.
            #
            # How the restore lands as an UPDATE: clearing
            # ``existing.deleted_at`` marks the in-session row dirty and the
            # explicit flush emits the ``deleted_at = NULL`` UPDATE before
            # ``SqlaTable.import_from_dict`` (below) does its own query-by-uuid
            # lookup. Without the flush we would be relying on autoflush ahead
            # of that internal query — correct under default session config but
            # a hidden contract; the explicit flush makes it robust. The lookup
            # then finds the now-live row (the listener filters ``deleted_at IS
            # NULL``) and ``import_from_dict`` applies the config as field
            # updates on the existing object, preserving the PK. Note:
            # ``config["id"]`` is set defensively, but
            # ``ImportExportMixin.import_from_dict`` strips it because
            # ``SqlaTable.export_fields`` does not contain "id"; what actually
            # binds to the existing row is the uuid uniqueness constraint used
            # inside ``import_from_dict``.
            #
            # Snapshot ``deleted_at`` first so we can roll back the clear if the
            # downstream ``import_from_dict`` hits the legacy
            # ``MultipleResultsFound`` fallback. Without the rollback, an
            # ambiguous import would leave the dataset half-restored
            # (``deleted_at = None`` but upload contents unapplied).
            original_deleted_at = existing.deleted_at
            existing.restore()
            db.session.flush()
            is_soft_deleted_match = True
            config["id"] = existing.id
        else:
            # OVERWRITE path — existing alive row. Without ``overwrite`` or
            # write permission, return it unchanged (the pre-soft-delete
            # overwrite-without-permission behaviour).
            if not overwrite or not can_write:
                return existing
            if user and (
                not security_manager.is_editor(existing)
                and not security_manager.is_admin()
            ):
                raise ImportFailedError(
                    f"Dataset {existing.table_name!r} (uuid {config['uuid']}) "
                    "already exists and user doesn't have permissions to "
                    "overwrite it"
                )
            # Mirror the REST update path's uniqueness contract: the uploaded
            # config may rename this dataset onto the physical identity of a
            # soft-deleted twin. ``import_from_dict``'s lookup cannot see the
            # hidden row (visibility filter), so without this check the
            # update would land cleanly and the live row would silently squat
            # the trash row's identity — permanently 422-blocking its
            # restore. ``validate_update_uniqueness`` bypasses the filter by
            # design, so hidden twins block here exactly as they block
            # ``UpdateDatasetCommand``.
            overwrite_identity = Table(
                config.get("table_name") or existing.table_name,
                config.get("schema", existing.schema),
                config.get("catalog", existing.catalog),
            )
            if not DatasetDAO.validate_update_uniqueness(
                existing.database, overwrite_identity, dataset_id=existing.id
            ):
                raise ImportFailedError(
                    f"Dataset {existing.table_name!r} (uuid {config['uuid']}) "
                    "cannot be overwritten: another dataset (possibly "
                    "soft-deleted) already references the target table "
                    f"({overwrite_identity.table!r}). Restore or rename the "
                    "other dataset, or change this upload's table name."
                )
            config["id"] = existing.id

    elif not can_write:
        raise ImportFailedError(
            "Dataset doesn't exist and user doesn't have permission to create datasets"
        )
    else:
        # Creating a brand-new dataset (no UUID match). A soft-deleted dataset
        # may still claim this physical table; ``import_from_dict`` cannot see it
        # (the visibility filter hides soft-deleted rows), so without this guard
        # the import would create an active twin of a hidden dataset. The REST
        # create path blocks the same collision via ``validate_uniqueness`` —
        # mirror it here and direct the user to restore the existing dataset
        # instead of leaving two rows for one physical table.
        database = (
            db.session.query(Database).filter_by(id=config["database_id"]).first()
        )
        if database is not None and (
            soft_twin := DatasetDAO.find_soft_deleted_logical_duplicate(
                database,
                Table(
                    config["table_name"], config.get("schema"), config.get("catalog")
                ),
            )
        ):
            raise ImportFailedError(
                f"Dataset {config['table_name']!r} cannot be imported because "
                f"a soft-deleted dataset (uuid {soft_twin.uuid}) already "
                "references the same physical table; restore that dataset "
                "instead of importing a duplicate"
            )

    # Trusted imports (e.g. example loading) carry curated configs; only
    # untrusted user imports validate the catalog, like the access checks below.
    if not ignore_permissions:
        validate_catalog(config)

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()
    for key in JSON_KEYS:
        if config.get(key) is not None:
            try:
                config[key] = json.dumps(config[key])
            except TypeError:
                logger.info("Unable to encode `%s` field: %s", key, config[key])
    for key in ("metrics", "columns"):
        for attributes in config.get(key, []):
            if attributes.get("extra") is not None:
                try:
                    attributes["extra"] = json.dumps(attributes["extra"])
                except TypeError:
                    logger.info(
                        "Unable to encode `extra` field: %s", attributes["extra"]
                    )
                    attributes["extra"] = None

    # should we delete columns and metrics not present in the current import?
    # Restore-via-import of a soft-deleted dataset is implicitly a clean
    # replacement (Option C): the user is bringing the dataset back by
    # uploading it again, so children present in the live DB but absent
    # from the upload should be removed, not silently merged. This matches
    # what an explicit overwrite would do.
    sync = ["columns", "metrics"] if (overwrite or is_soft_deleted_match) else []

    # should we also load data into the dataset?
    data_uri = config.get("data")

    # import recursively to include columns and metrics
    try:
        dataset = SqlaTable.import_from_dict(config, recursive=True, sync=sync)
    except MultipleResultsFound as ex:
        # Finding multiple results when importing a dataset only happens because initially  # noqa: E501
        # datasets were imported without schemas (eg, `examples.NULL.users`), and later
        # they were fixed to have the default schema (eg, `examples.public.users`). If a
        # user created `examples.public.users` during that time the second import will
        # fail because the UUID match will try to update `examples.NULL.users` to
        # `examples.public.users`, resulting in a conflict.
        #
        # In the soft-deleted-restore case we cannot silently return
        # the unmodified row: ``existing.deleted_at`` was already
        # cleared above and the operator expects a restore-with-update.
        # Returning the row without applying the upload would produce a
        # half-restored state. Roll back the ``deleted_at`` clear and
        # raise so the operator can resolve the legacy-NULL-schema
        # ambiguity before re-uploading.
        if is_soft_deleted_match:
            # ``is_soft_deleted_match`` is only ever set inside the
            # ``if existing := ...`` walrus block, so ``existing`` is
            # guaranteed non-None here. The assert pins the invariant
            # for mypy.
            assert existing is not None
            existing.deleted_at = original_deleted_at
            db.session.flush()
            raise ImportFailedError(
                f"Dataset {existing.table_name!r} (uuid {config['uuid']}) "
                "matches more than one existing row, so the restore-and-"
                "update cannot pick a target. Resolve the duplicate rows "
                "manually before retrying."
            ) from ex
        # On the non-soft-deleted overwrite path the legacy contract
        # holds: return the existing row unmodified. Bypasses the
        # visibility filter so a soft-deleted duplicate can be located
        # too — without the bypass the listener would hide the row and
        # the ``.one()`` would raise NoResultFound, masking the
        # original MultipleResultsFound.
        dataset = (
            db.session.query(SqlaTable)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {SqlaTable}})
            .filter_by(uuid=config["uuid"])
            .one()
        )

    if dataset.id is None:
        db.session.flush()

    if not ignore_permissions:
        try:
            security_manager.raise_for_access(datasource=dataset)
        except SupersetSecurityException as ex:
            raise DatasetAccessDeniedError() from ex

    try:
        table_exists = dataset.database.has_table(
            Table(dataset.table_name, dataset.schema, dataset.catalog),
        )
    except Exception:  # pylint: disable=broad-except
        # MySQL doesn't play nice with GSheets table names
        logger.warning(
            "Couldn't check if table %s exists, assuming it does", dataset.table_name
        )
        table_exists = True

    if data_uri and (not table_exists or force_data):
        load_data(data_uri, dataset, dataset.database)

    if user:
        from superset.subjects.utils import get_user_subject

        subj = get_user_subject(user.id)
        if subj and subj not in dataset.editors:
            dataset.editors.append(subj)

    return dataset


def _convert_temporal_columns(df: pd.DataFrame, dtype: dict[str, Any]) -> None:
    """Convert Date/DateTime columns in-place, coercing only out-of-bounds values."""
    for column_name, sqla_type in dtype.items():
        if isinstance(sqla_type, (Date, DateTime)):
            try:
                df[column_name] = pd.to_datetime(df[column_name])
            except OutOfBoundsDatetime:
                # Row-level fallback: coerce only OOB values; re-raise for malformed
                # strings. Whole-column errors="coerce" would silently swallow
                # malformed values that happen to share a column with an OOB date.
                original = df[column_name].copy()
                result = []
                for val in original:
                    if pd.isna(val):
                        result.append(pd.NaT)
                        continue
                    try:
                        result.append(pd.to_datetime(val))
                    except OutOfBoundsDatetime:
                        result.append(pd.NaT)
                    # Other exceptions (e.g. malformed strings) propagate
                converted = pd.Series(result, index=original.index)
                n_coerced = int(converted.isna().sum() - original.isna().sum())
                if n_coerced > 0:
                    logger.warning(
                        "Coerced %d out-of-bounds datetime value(s) "
                        "in column '%s' to NaT",
                        n_coerced,
                        column_name,
                    )
                df[column_name] = converted


def load_data(data_uri: str, dataset: SqlaTable, database: Database) -> None:
    """
    Load data from a data URI into a dataset.

    :raises DatasetUnAllowedDataURI: If a dataset is trying
    to load data from a URI that is not allowed.
    """
    from superset.examples.helpers import normalize_example_data_url

    # Convert example URLs to align with configuration
    data_uri = normalize_example_data_url(data_uri)

    validate_data_uri(data_uri)
    logger.info("Downloading data from %s", data_uri)
    opener = request.build_opener(_ValidatingRedirectHandler)
    data = opener.open(data_uri)  # pylint: disable=consider-using-with  # noqa: S310
    if data_uri.endswith(".gz"):
        data = gzip.open(data)
    df = pd.read_csv(data, encoding="utf-8")
    dtype = get_dtype(df, dataset)

    _convert_temporal_columns(df, dtype)

    # reuse session when loading data if possible, to make import atomic
    if database.sqlalchemy_uri == app.config.get("SQLALCHEMY_DATABASE_URI"):
        logger.info("Loading data inside the import transaction")
        connection = db.session.connection()
        df.to_sql(
            dataset.table_name,
            con=connection,
            schema=dataset.schema,
            if_exists="replace",
            chunksize=CHUNKSIZE,
            dtype=dtype,
            index=False,
            method="multi",
        )
    else:
        logger.warning("Loading data outside the import transaction")
        with database.get_sqla_engine(
            catalog=dataset.catalog,
            schema=dataset.schema,
        ) as engine:
            df.to_sql(
                dataset.table_name,
                con=engine,
                schema=dataset.schema,
                if_exists="replace",
                chunksize=CHUNKSIZE,
                dtype=dtype,
                index=False,
                method="multi",
            )
