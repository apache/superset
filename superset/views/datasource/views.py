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
from typing import Any

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
)
from superset.connectors.sqla.models import SqlaTable
from superset.connectors.sqla.partition_mapping import (
    drop_unmapped_value_transforms,
    stored_expression_error,
    validate_partition_mapping,
)
from superset.connectors.sqla.utils import get_physical_table_metadata
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.daos.datasource import Datasource as DatasourceModel, DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.models.core import Database
from superset.sql.parse import Table
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import DatasourceType
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
        if reason := stored_expression_error(
            database,
            orm_datasource.catalog,
            orm_datasource.schema,
            transform,
        ):
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
    column_names = {
        column.get("column_name")
        for column in datasource_dict.get("columns") or []
        if column.get("column_name")
    }
    for issue in validate_partition_mapping(
        column_names=column_names,
        partition_column=partition_column,
        partition_mapped_column=datasource_dict.get("partition_mapped_column"),
        main_dttm_col=datasource_dict.get("main_dttm_col"),
        transform=None,
        engine=database.backend,
    ):
        if issue.blocking:
            return str(issue.message)
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

        if database_id != orm_datasource.database_id:
            new_database = DatasetDAO.get_database_by_id(database_id)
            if new_database is None:
                return json_error_response(_("Database not found."), status=422)
            try:
                security_manager.raise_for_access(
                    database=new_database,
                    # Check access against the table/schema/catalog the
                    # request is repointing to, not the dataset's current
                    # values -- update_from_object (below) applies whatever
                    # table_name/schema/catalog the request supplies.
                    table=Table(
                        datasource_dict.get("table_name", orm_datasource.table_name),
                        datasource_dict.get("schema", orm_datasource.schema),
                        datasource_dict.get("catalog", orm_datasource.catalog),
                    ),
                )
            except SupersetSecurityException as ex:
                raise DatasetForbiddenError() from ex
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
