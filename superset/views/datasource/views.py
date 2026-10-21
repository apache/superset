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
from collections import Counter
from typing import Any, cast

from flask import redirect, request, url_for
from flask_appbuilder import expose, permission_name
from flask_appbuilder.api import rison as parse_rison
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import _
from marshmallow import ValidationError
from sqlalchemy.exc import NoResultFound, NoSuchTableError

from superset import db, event_logger, is_feature_enabled, security_manager
from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
    get_template_render_error_msg,
    TEMPLATE_RENDER_ERRORS,
)
from superset.connectors.sqla.models import SqlaTable
from superset.connectors.sqla.partition_mapping import (
    drop_unmapped_value_transforms,
    stored_expression_error,
    validate_partition_mapping,
    validate_transform,
)
from superset.connectors.sqla.utils import get_physical_table_metadata
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.daos.datasource import Datasource as DatasourceModel, DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.models.core import Database
from superset.models.helpers import (
    parse_template_params,
    template_params_equivalent,
    template_params_for_access_check,
)
from superset.sql.parse import Table
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import DatasourceType
from superset.utils.error_sanitization import redact_sensitive_query_fields
from superset.views.base import api, BaseSupersetView, deprecated, json_error_response
from superset.views.datasource.schemas import (
    ExternalMetadataParams,
    ExternalMetadataSchema,
    get_external_metadata_schema,
    SamplesPayloadSchema,
    SamplesRequestSchema,
)
from superset.views.datasource.utils import get_samples
from superset.views.error_handling import handle_api_exception
from superset.views.utils import sanitize_datasource_data

logger = logging.getLogger(__name__)

# Datasource types whose ``datasource_id`` refers to a dataset row.
_DATASET_TYPES = frozenset({DatasourceType.TABLE.value, DatasourceType.DATASET.value})


def _load_dataset_for_samples(
    view: BaseSupersetView, params: dict[str, Any]
) -> tuple[DatasourceModel | None, FlaskResponse | None]:
    """Pre-fetch and access-check the dataset for an authenticated request.

    Only dataset-backed types are pre-fetched. Non-table types (query,
    saved_query) use a different access model; passing them to
    ``raise_for_access(datasource=...)`` would check the wrong attributes,
    so ``get_samples()`` handles the lookup for those types.

    Returns ``(dataset, None)`` on success and ``(None, error_response)``
    when the caller should return the error response.
    """
    if params["datasource_type"] not in _DATASET_TYPES:
        return None, None
    try:
        dataset = DatasourceDAO.get_datasource(
            datasource_type=params["datasource_type"],
            database_id_or_uuid=params["datasource_id"],
        )
    except (DatasourceNotFound, DatasourceTypeNotSupportedError):
        return None, view.response_404()
    try:
        security_manager.raise_for_access(datasource=dataset)
    except SupersetSecurityException:
        return None, json_error_response(_("Forbidden"), status=403)
    return dataset, None


def _partition_transform_error(
    orm_datasource: Any,
    datasource_dict: dict[str, Any],
) -> str | None:
    """
    The first column whose incoming value transform may not be stored, if any.

    Only datasets carry a partition mapping, and only a transform the request
    actually changes is worth refusing over -- re-sending a value already in
    storage is what a GET-then-PUT client does, and a transform stored before
    this check existed is disarmed at probe time instead.

    Both gates the other writers apply, not just the storability one.
    `stored_expression_error` asks whether the expression may be *run*;
    `validate_transform`'s blocking tier asks whether it may be *stored* --
    Jinja, an executable comment, a non-deterministic function, a placeholder
    the engine will not read. The REST PUT and the importer reach both, and this
    endpoint reached only the first, so `random() + :value` saved here with a
    200 and then failed `UpdateDatasetCommand`'s validation on every later edit,
    including a description-only PUT. The dataset could not be saved again until
    someone edited the transform.
    """
    incoming = [
        column
        for column in datasource_dict.get("columns") or []
        if column.get("partition_value_transform")
    ]
    database = getattr(orm_datasource, "database", None)
    if not incoming or database is None:
        return None

    stored = {
        column.column_name: column.partition_value_transform
        for column in orm_datasource.columns
    }
    for column in incoming:
        transform = column["partition_value_transform"]
        if transform == stored.get(column.get("column_name")):
            continue
        reason = stored_expression_error(
            database,
            orm_datasource.catalog,
            orm_datasource.schema,
            transform,
        )
        if reason is None:
            reason = next(
                (
                    str(issue.message)
                    for issue in validate_transform(transform, database.backend)
                    if issue.blocking
                ),
                None,
            )
        if reason:
            return str(
                _(
                    "The value transform on %(column)s cannot be saved: %(reason)s",
                    column=column.get("column_name"),
                    reason=reason,
                )
            )
    return None


def _partition_mapping_reference_error(
    orm_datasource: Any,
    datasource_dict: dict[str, Any],
) -> str | None:
    """
    Why this request's partition mapping references cannot be stored, if any.

    Its sibling above covers the transform. `partition_column` and
    `partition_mapped_column` ride in on `update_from_object` too, and nothing
    checked them: a payload naming a column the dataset does not have was
    stored and answered 200, and then *every* later
    ``PUT /api/v1/dataset/<pk>`` failed `_validate_partition_mapping` with a
    column-not-found error -- including a description-only one, which carries no
    columns payload and so cannot reach the branch that forgives a stored-only
    dangle. The dataset was left in a state it could not be saved from until
    someone repaired the reference by hand.

    Only the blocking issues. The implicit self-mapping -- a null override where
    ``main_dttm_col`` happens to equal the partition column -- is Tier 2 by
    design in `validate_partition_mapping`, and refusing it here would recreate
    exactly the unsaveable dataset this function exists to prevent.

    Gated on the feature flag, like `UpdateDatasetCommand`'s own call: with the
    flag off nothing mirrors, and a deployment that never turned the feature on
    should not start failing saves over a reference nothing reads.
    """
    if not is_feature_enabled("PARTITION_FILTER_MAPPING"):
        return None

    partition_column = datasource_dict.get("partition_column")
    if not partition_column:
        return None

    database = getattr(orm_datasource, "database", None)
    if database is None:
        return None

    # The columns the request is about to write, not the ones in storage:
    # `update_from_object` replaces the collection, so a reference has to be
    # checked against what will be there afterwards.
    columns_by_name = {
        column.get("column_name"): column
        for column in datasource_dict.get("columns") or []
        if column.get("column_name")
    }
    for issue in validate_partition_mapping(
        column_names=set(columns_by_name),
        partition_column=partition_column,
        partition_mapped_column=datasource_dict.get("partition_mapped_column"),
        main_dttm_col=datasource_dict.get("main_dttm_col"),
        transform=None,
        engine=database.backend,
        partition_expression=columns_by_name.get(partition_column, {}).get(
            "expression"
        ),
    ):
        if issue.blocking:
            return str(issue.message)
    return None


def _repoints_table(
    datasource: DatasourceModel,
    database_changed: bool,
    requested_sql: str | None,
    requested_table: Table,
) -> bool:
    """
    Would the request point ``datasource`` at a different physical table?

    Moving to another database connection always does, whatever the target
    looks like. Within one connection, a virtual dataset's ``table_name`` is a
    label rather than a pointer, as in
    ``UpdateDatasetCommand._validate_dataset_source``, so dropping the SQL
    binds that label to a real table: a repoint even when the label is
    unchanged.
    """
    # Ahead of the dataset check on purpose: a move to another connection is
    # a repoint whatever the datasource is, and must not go unchecked.
    if database_changed:
        return True
    if not isinstance(datasource, SqlaTable) or requested_sql:
        return False
    if datasource.is_virtual:
        return True
    # Compared field by field because ``Table.__eq__`` compares the ``str``
    # rendering, which drops empty parts and so conflates distinct targets.
    return (requested_table.table, requested_table.schema, requested_table.catalog) != (
        datasource.table_name,
        datasource.schema or None,
        datasource.catalog or None,
    )


def _repoints_sql(
    datasource: DatasourceModel,
    database_changed: bool,
    requested_sql: str | None,
    requested_table: Table,
    raw_template_params: str | None,
) -> bool:
    """
    Would the request change what the SQL on ``datasource`` reads?

    Supplying ``sql`` aims the dataset at whatever that SQL reads, converting
    a physical dataset on the way. Unchanged SQL still lands somewhere new
    when the connection, catalog or schema it resolves unqualified names
    against moves, or when the ``template_params`` that render a templated
    ``FROM`` change -- the same triggers as
    ``UpdateDatasetCommand._validate_sql_access``. An identical params value
    (the editor echoes it back) is never a change, even a legacy non-object
    one; otherwise they are compared as execution reads them.
    """
    if not isinstance(datasource, SqlaTable) or not requested_sql:
        return False
    params_changed = raw_template_params != datasource.template_params and (
        not template_params_equivalent(raw_template_params, datasource.template_params)
    )
    return (
        database_changed
        or requested_sql != datasource.sql
        or (requested_table.schema, requested_table.catalog)
        != (datasource.schema or None, datasource.catalog or None)
        or params_changed
    )


def _requested_target(
    datasource_dict: dict[str, Any],
) -> tuple[str | None, Table, str | None]:
    """The SQL and table a save aims the dataset at.

    ``update_from_object`` applies an omitted key as ``None``, so the request
    body alone describes the target: no stored value feeds into it. The body
    is free-form JSON, so each field is type-checked here, since the access
    checks below parse these values and only a string survives that.

    Raises ``ValueError`` naming the offending field.
    """

    def string(field: str) -> str | None:
        value = datasource_dict.get(field)
        if value is not None and not isinstance(value, str):
            raise ValueError(field)
        return value

    return (
        string("sql"),
        Table(
            # ``Table`` is annotated for a table that exists, but an omitted
            # ``table_name`` lands as ``None`` and has to be compared as one.
            cast(str, string("table_name")),
            string("schema") or None,
            string("catalog") or None,
        ),
        string("template_params"),
    )


def _authorize_repoint(
    datasource: DatasourceModel,
    database_id: int,
    database_changed: bool,
    requested_sql: str | None,
    requested_table: Table,
    raw_template_params: str | None,
) -> FlaskResponse | None:
    """Authorise the target a save aims ``datasource`` at.

    Editorship of the dataset alone is not sufficient to repoint it. Ports
    ``UpdateDatasetCommand``'s table and SQL checks, which are independent:
    one save can do both, and each needs its own ``raise_for_access`` call
    because passing ``sql`` builds an ephemeral query that supersedes
    ``table``.

    Returns an error response when the target cannot be resolved, and ``None``
    once the target is authorised or the save does not repoint at all.
    """
    repoints_table = _repoints_table(
        datasource, database_changed, requested_sql, requested_table
    )
    repoints_sql = _repoints_sql(
        datasource,
        database_changed,
        requested_sql,
        requested_table,
        raw_template_params,
    )
    if not (repoints_table or repoints_sql):
        return None

    target_database = (
        DatasetDAO.get_database_by_id(database_id)
        if database_changed
        else datasource.database
    )
    if target_database is None:
        return json_error_response(_("Database not found."), status=422)
    try:
        if repoints_table:
            security_manager.raise_for_access(
                database=target_database,
                table=requested_table,
                allow_editorship=False,
            )
        if repoints_sql:
            # Only rendered on an actual repoint, so an unreadable value here
            # is a genuine change we cannot authorize -- reject it rather than
            # 500 (a metadata-only echo of a legacy value never reaches this).
            try:
                template_params = parse_template_params(raw_template_params)
            except ValueError:
                return json_error_response(
                    _("Template parameters must be a valid JSON object."),
                    status=422,
                )
            security_manager.raise_for_access(
                database=target_database,
                sql=requested_sql,
                catalog=requested_table.catalog,
                schema=requested_table.schema,
                # Render with the submitted params so a templated FROM is
                # authorized as the table it actually resolves to, minus the
                # names the processor consumes structurally (so the render
                # matches execution).
                template_params=template_params_for_access_check(template_params),
                allow_editorship=False,
            )
    except SupersetSecurityException as ex:
        raise DatasetForbiddenError() from ex
    except TEMPLATE_RENDER_ERRORS as ex:
        # SQL that can't be rendered with the submitted params can't be
        # authorized: refuse it as invalid input rather than a 500.
        return json_error_response(get_template_render_error_msg(ex), status=422)
    return None


class Datasource(BaseSupersetView):
    """Datasource-related views"""

    @expose("/save/", methods=("POST",))
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.save",
        log_to_statsd=False,
    )
    @has_access_api
    @api
    @handle_api_exception
    @deprecated(new_target="/api/v1/dataset/<int:pk>")
    def save(self) -> FlaskResponse:
        data = request.form.get("data")
        if not isinstance(data, str):
            return json_error_response(_("Request missing data field."), status=500)

        datasource_dict = json.loads(data)
        normalize_columns = datasource_dict.get("normalize_columns", False)
        always_filter_main_dttm = datasource_dict.get("always_filter_main_dttm", False)
        datasource_dict["normalize_columns"] = normalize_columns
        datasource_dict["always_filter_main_dttm"] = always_filter_main_dttm
        datasource_id = datasource_dict.get("id")
        datasource_type = datasource_dict.get("type")
        database_id = datasource_dict["database"].get("id")
        orm_datasource = DatasourceDAO.get_datasource(
            DatasourceType(datasource_type), datasource_id
        )

        try:
            security_manager.raise_for_editorship(orm_datasource)
        except SupersetSecurityException as ex:
            raise DatasetForbiddenError() from ex

        database_changed = database_id != orm_datasource.database_id
        try:
            requested_sql, requested_table, raw_template_params = _requested_target(
                datasource_dict
            )
        except ValueError as ex:
            return json_error_response(
                _("The `%(field)s` field must be a string.", field=str(ex)),
                status=422,
            )

        if error := _authorize_repoint(
            orm_datasource,
            database_id,
            database_changed,
            requested_sql,
            requested_table,
            raw_template_params,
        ):
            return error

        if database_changed:
            orm_datasource.database_id = database_id

        duplicates = [
            name
            for name, count in Counter(
                [col["column_name"] for col in datasource_dict["columns"]]
            ).items()
            if count > 1
        ]
        if duplicates:
            return json_error_response(
                _(
                    "Duplicate column name(s): %(columns)s",
                    columns=",".join(duplicates),
                ),
                status=409,
            )
        # The mapping's one-transform invariant, against the columns this
        # request is about to write. `update_from_object` sets every field in
        # `update_from_object_fields` straight onto the column, so nothing
        # between here and storage would notice a transform parked on a column
        # the mapping does not mirror -- invisible in the editor, since no row
        # but the mapped one renders a transform, and live the moment the mapped
        # column resolves back to it. `DatasetDAO.update` runs a model-level
        # pass for this; this endpoint bypasses that along with the rest of
        # `UpdateDatasetCommand`.
        #
        # Corrected rather than refused, unlike the gates below. Those are about
        # a value that may not be stored anywhere; this is about a value in the
        # wrong place, and the payload a GET-then-POST client sends back carries
        # whatever a previous writer left there -- so a 422 would punish the
        # client that is merely echoing the state it was given.
        #
        # Which is also why it runs *first*. A parked transform that is not a
        # storable expression would otherwise fail the gate below and 422 every
        # save, leaving the dataset uneditable over a value nobody asked to
        # keep; dropped here, there is nothing left for that gate to refuse.
        # What it still guards is the transform this request actually stores,
        # the one on the mapped column.
        #
        # Read from the payload alone, with no fallback to the model: every
        # field here rides in on `update_from_object`, which writes
        # `obj.get(attr)` for each one, so what this request says *is* what the
        # mapping will be.
        if cleared := drop_unmapped_value_transforms(
            datasource_dict.get("columns"),
            partition_column=datasource_dict.get("partition_column"),
            partition_mapped_column=datasource_dict.get("partition_mapped_column"),
            main_dttm_col=datasource_dict.get("main_dttm_col"),
            # With the flag off, an unchanged echo of stored configuration
            # survives: this endpoint's own client does GET-then-POST. With it
            # on nothing is exempt, since no model-level pass runs here to clear
            # a transform the mapping no longer mirrors -- the REST path has
            # one, so exempting an echo here left the old mapped column holding
            # its transform, and clearing the override through this same
            # endpoint later re-armed it.
            stored_by_name=None
            if is_feature_enabled("PARTITION_FILTER_MAPPING")
            else {
                column.column_name: (
                    column.partition_value_transform,
                    bool(column.partition_transform_is_monotonic),
                )
                for column in getattr(orm_datasource, "columns", None) or []
            },
        ):
            logger.info(
                "Dataset %s: dropped an incoming partition value transform "
                "from %s, which the mapping does not mirror",
                datasource_id,
                ", ".join(cleared),
            )
        # `partition_value_transform` rides in on `update_from_object`, which
        # writes every field in `update_from_object_fields` straight onto the
        # column. That bypasses `UpdateDatasetCommand`, and with it the gate
        # the REST PUT and the mapping preview both apply -- so without this
        # the deprecated endpoint is a way to store arbitrary SQL that the
        # partition probe later runs. Refused rather than dropped, unlike the
        # importer: this is one interactive edit whose author is present to
        # correct it, not a bundle where failing the whole dataset over one
        # expression is the worse trade.
        if error := _partition_transform_error(orm_datasource, datasource_dict):
            return json_error_response(error, status=422)
        # And the mapping's own column references, for the same reason: they
        # ride in on `update_from_object` with no validation, and a dangling one
        # fails every later PUT rather than this request.
        if error := _partition_mapping_reference_error(orm_datasource, datasource_dict):
            return json_error_response(error, status=422)

        orm_datasource.update_from_object(datasource_dict)
        data = orm_datasource.data
        db.session.commit()  # pylint: disable=consider-using-transaction

        return self.json_response(sanitize_datasource_data(data))

    @expose("/get/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    @deprecated(new_target="/api/v1/dataset/<int:pk>")
    def get(self, datasource_type: str, datasource_id: int) -> FlaskResponse:
        datasource = DatasourceDAO.get_datasource(
            DatasourceType(datasource_type), datasource_id
        )
        security_manager.raise_for_access(datasource=datasource)
        return self.json_response(sanitize_datasource_data(datasource.data))

    @expose("/external_metadata/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    def external_metadata(
        self, datasource_type: str, datasource_id: int
    ) -> FlaskResponse:
        """Gets column info from the source system"""
        datasource = DatasourceDAO.get_datasource(
            DatasourceType(datasource_type),
            datasource_id,
        )
        security_manager.raise_for_access(datasource=datasource)
        try:
            external_metadata = datasource.external_metadata()
        except SupersetException as ex:
            return json_error_response(str(ex), status=400)
        return self.json_response(external_metadata)

    @expose("/external_metadata_by_name/")
    @has_access_api
    @api
    @handle_api_exception
    @parse_rison(get_external_metadata_schema)
    def external_metadata_by_name(self, **kwargs: Any) -> FlaskResponse:
        """Gets table metadata from the source system and SQLAlchemy inspector"""
        try:
            params: ExternalMetadataParams = ExternalMetadataSchema().load(
                kwargs.get("rison")
            )
        except ValidationError as err:
            return json_error_response(str(err), status=400)

        datasource = SqlaTable.get_datasource_by_name(
            database_name=params["database_name"],
            catalog=params.get("catalog_name"),
            schema=params["schema_name"],
            datasource_name=params["table_name"],
        )
        try:
            if datasource is not None:
                # Get columns from Superset metadata
                security_manager.raise_for_access(datasource=datasource)
                external_metadata = datasource.external_metadata()
            else:
                # Use the SQLAlchemy inspector to get columns
                database = (
                    db.session.query(Database)
                    .filter_by(database_name=params["database_name"])
                    .one()
                )
                table = Table(
                    params["table_name"],
                    params["schema_name"],
                    params.get("catalog_name"),
                )
                security_manager.raise_for_access(
                    database=database,
                    table=table,
                )
                external_metadata = get_physical_table_metadata(
                    database=database,
                    table=table,
                    normalize_columns=params.get("normalize_columns") or False,
                )
        except (NoResultFound, NoSuchTableError) as ex:
            raise DatasetNotFoundError() from ex
        return self.json_response(external_metadata)

    @expose("/samples", methods=("POST",))
    @has_access_api
    @api
    @handle_api_exception
    def samples(self) -> FlaskResponse:
        try:
            params = SamplesRequestSchema().load(request.args)
            payload = SamplesPayloadSchema().load(request.json)
        except ValidationError as err:
            return json_error_response(err.messages, status=400)

        dashboard_id = None
        if security_manager.is_guest_user():
            if not params["dashboard_id"]:
                return json_error_response(_("Forbidden"), status=403)
            # Guest drill access is only defined for dataset-backed charts.
            # Refuse other datasource types before the DatasetDAO lookup:
            # ``datasource_id`` values for those types live in unrelated id
            # spaces, so the lookup below would validate whichever unrelated
            # SqlaTable happens to share the integer id.
            if params["datasource_type"] not in _DATASET_TYPES:
                return self.response_404()
            dashboard_id = params["dashboard_id"]
            dataset = DatasetDAO.find_by_id(
                params["datasource_id"], skip_base_filter=True
            )
            dashboard = DashboardDAO.find_by_id(dashboard_id, skip_base_filter=True)
            if not (dashboard and dataset):
                return self.response_404()
            if not security_manager.can_drill_dataset_via_dashboard_access(
                dataset,
                dashboard,
            ):
                return json_error_response(_("Forbidden"), status=403)
        else:
            dataset, error_response = _load_dataset_for_samples(self, params)
            if error_response is not None:
                return error_response

        # Refuse datasource types that don't model raw rows only after the
        # authorization checks above, keeping authorization-before-capability
        # ordering: guests get 403/404 from the guest branch, while
        # authenticated users hit this purely type-level gate (a 400 that is a
        # function of the requested ``datasource_type`` alone -- no per-object
        # lookup happens for non-table types, by design).
        ds_class = DatasourceDAO.sources.get(
            DatasourceType(params["datasource_type"]),
        )
        if ds_class is not None and not ds_class.supports_samples:
            return json_error_response(
                _("Samples are not available for this datasource type."),
                status=400,
            )

        rv = get_samples(
            datasource_type=params["datasource_type"],
            datasource_id=params["datasource_id"],
            force=params["force"],
            page=params["page"],
            per_page=params["per_page"],
            payload=payload,
            datasource=dataset,
            dashboard_id=dashboard_id,
        )
        # Drill to detail is available to embedded guests (see the guest branch
        # above), and the samples payload carries the generated SQL under
        # ``query``. Apply the same guest redaction as ``/api/v1/chart/data``
        # (CVE-2025-55673, gated on "can view query on Dashboard" since #43151)
        # so the SQL is not disclosed to a guest whose role lacks that
        # permission.
        redact_sensitive_query_fields([rv])
        return self.json_response({"result": rv})


class DatasetEditor(BaseSupersetView):
    route_base = "/dataset"
    class_permission_name = "Dataset"

    @expose("/add/")
    @has_access
    @permission_name("read")
    def root(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("/<pk>", methods=("GET",))
    @has_access
    @permission_name("read")
    # pylint: disable=unused-argument
    def show(self, pk: int) -> FlaskResponse:
        dev = request.args.get("testing")
        if dev is not None:
            return super().render_app_template()
        # url_for keeps the redirect inside the application root under
        # subdirectory deployments (a bare "/" would escape the prefix).
        return redirect(url_for("Superset.welcome"))
