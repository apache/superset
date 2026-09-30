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
from typing import Any, NoReturn
from uuid import UUID

from dateutil.parser import isoparse
from flask_babel import lazy_gettext as _
from marshmallow import (
    fields,
    post_dump,
    pre_load,
    Schema,
    validates_schema,
    ValidationError,
)
from marshmallow.validate import Length, OneOf, Range

from superset import security_manager
from superset.connectors.sqla.partition_mapping_storage import (
    EXTRA_KEY as PARTITION_MAPPING_EXTRA_KEY,
    MAX_COLUMN_NAME_LENGTH,
    MAX_TRANSFORM_LENGTH,
)
from superset.constants import EPOCH_FORMATS
from superset.exceptions import SupersetMarshmallowValidationError
from superset.models.sql_types import parse_currency_string
from superset.utils import json
from superset.utils.schema import DiscardIsManagedExternallyMixin

get_delete_ids_schema = {
    "type": "array",
    "items": {"type": "integer"},
    "example": [1, 2, 3],
}
get_export_ids_schema = {
    "type": "array",
    "items": {"type": "integer"},
    "example": [1, 2, 3],
}
get_related_objects_ids_schema = get_delete_ids_schema
get_drill_info_schema = {
    "type": "object",
    "properties": {
        "dashboard_id": {"type": "integer"},
    },
}

openapi_spec_methods_override = {
    "get_list": {
        "get": {
            "summary": "Get a list of datasets",
            "description": "Gets a list of datasets, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}


def validate_python_date_format(dt_format: str) -> bool:
    if dt_format in EPOCH_FORMATS:
        return True
    try:
        dt_str = datetime.now().strftime(dt_format)
        isoparse(dt_str)
    except ValueError as ex:
        raise ValidationError([_("Invalid date/timestamp format")]) from ex
    return True


def validate_dataset_extra(value: str | None) -> None:
    """
    Structural check on the ``partition_filter_mapping`` key inside ``extra``.

    That key only, and only structurally. ``extra`` is a free-text JSON box in
    the dataset editor, so the partition mapping has a second door into storage
    that bypasses the typed fields below -- and a value of the wrong type there is
    read as "not configured" and silently ignored, which is the failure mode an
    owner has no way to diagnose. This turns it into an error message.

    Undecodable JSON passes through. ``extra`` has never been validated on this
    endpoint, so a deployment may already hold a value that is not JSON at all;
    rejecting it now would fail an owner's next save over a field they did not
    touch. Nothing else in ``extra`` is checked either -- ``certification``,
    ``warning_markdown``, ``timezone`` and unknown keys are all legitimate.

    Semantics are not checked here: whether the partition column exists, whether
    the transform parses, and whether it calls a non-deterministic function all
    depend on the dataset's columns and its engine, which a schema cannot see.
    `UpdateDatasetCommand._validate_partition_mapping` merges this value with the
    typed fields and answers all three.
    """
    if not value:
        return
    try:
        decoded = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return
    if not isinstance(decoded, dict) or PARTITION_MAPPING_EXTRA_KEY not in decoded:
        return

    blob = decoded[PARTITION_MAPPING_EXTRA_KEY]
    if not isinstance(blob, dict):
        _reject(
            _(
                "%(key)s in extra must be an object.",
                key=PARTITION_MAPPING_EXTRA_KEY,
            )
        )

    for key, limit in (
        ("partition_column", MAX_COLUMN_NAME_LENGTH),
        ("mapped_column", MAX_COLUMN_NAME_LENGTH),
    ):
        _reject_unless_string(blob.get(key), key, limit)

    _validate_column_transforms(blob.get("column_transforms"))


def _validate_column_transforms(transforms: Any) -> None:
    if transforms is None:
        return
    if not isinstance(transforms, dict):
        _reject(_("column_transforms in extra must be an object."))
    for column_name, entry in transforms.items():
        if not isinstance(entry, dict):
            _reject(
                _(
                    "column_transforms.%(name)s in extra must be an object.",
                    name=column_name,
                )
            )
        _reject_unless_string(
            entry.get("value_transform"), "value_transform", MAX_TRANSFORM_LENGTH
        )
        if entry.get("is_monotonic") not in (None, True, False):
            _reject(_("is_monotonic in extra must be a boolean."))


def _reject(message: Any) -> NoReturn:
    """
    Raise with a rendered message.

    Takes an already-translated message rather than a format string, so every
    literal sits under a `_()` call `pybabel extract` can see; handing one in as
    a variable would leave these strings out of the catalogs entirely.

    ``str()`` is not decoration either: marshmallow special-cases ``str`` and
    ``dict`` and falls back to ``list(messages)`` for anything else, which turns
    a ``LazyString`` into a list of single characters.
    """
    raise ValidationError(str(message))


def _reject_unless_string(value: Any, key: str, limit: int) -> None:
    if value is None:
        return
    if not isinstance(value, str):
        _reject(_("%(key)s in extra must be a string.", key=key))
    if len(value) > limit:
        _reject(
            _(
                "%(key)s in extra must be at most %(limit)d characters.",
                key=key,
                limit=limit,
            )
        )


class DatasetColumnsPutSchema(Schema):
    id = fields.Integer(required=False)
    column_name = fields.String(required=True, validate=Length(1, 255))
    type = fields.String(allow_none=True)
    advanced_data_type = fields.String(
        allow_none=True,
        validate=Length(1, 255),
    )
    verbose_name = fields.String(allow_none=True, metadata={Length: (1, 1024)})
    description = fields.String(allow_none=True)
    expression = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    filterable = fields.Boolean()
    groupby = fields.Boolean()
    is_active = fields.Boolean(allow_none=True)
    is_dttm = fields.Boolean(allow_none=True, dump_default=False)
    python_date_format = fields.String(
        allow_none=True, validate=[Length(1, 255), validate_python_date_format]
    )
    datetime_format = fields.String(
        allow_none=True, validate=[Length(1, 100), validate_python_date_format]
    )
    partition_value_transform = fields.String(
        allow_none=True,
        metadata={
            "description": (
                "SQL expression containing a :value placeholder. Filters on "
                "this column are mirrored onto the dataset's partition column "
                "with the value passed through this transform."
            )
        },
    )
    # Deliberately no `load_default`: `DatasetDAO.update_columns` applies the
    # loaded payload field by field onto the stored column, so a default here
    # would let a partial column payload clear a monotonic flag the request
    # never mentioned -- and silently stop mirroring range filters. Absent
    # means "unchanged"; new columns fall back to the model's own default.
    partition_transform_is_monotonic = fields.Boolean(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class DatasetMetricCurrencyPutSchema(Schema):
    symbol = fields.String(validate=Length(1, 128))
    symbolPosition = fields.String(validate=Length(1, 128))  # noqa: N815


class CurrencyField(fields.Nested):
    """
    Nested field that tolerates legacy string payloads for currency.
    """

    def _deserialize(
        self, value: Any, attr: str | None, data: dict[str, Any], **kwargs: Any
    ) -> Any:
        if isinstance(value, str):
            value = parse_currency_string(value)

        return super()._deserialize(value, attr, data, **kwargs)


class DatasetMetricsPutSchema(Schema):
    id = fields.Integer()
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    metric_name = fields.String(required=True, validate=Length(1, 255))
    metric_type = fields.String(allow_none=True, validate=Length(1, 32))
    d3format = fields.String(allow_none=True, validate=Length(1, 128))
    currency = CurrencyField(DatasetMetricCurrencyPutSchema, allow_none=True)
    verbose_name = fields.String(allow_none=True, metadata={Length: (1, 1024)})
    warning_text = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class FolderSchema(Schema):
    uuid = fields.UUID(required=True)
    type = fields.String(
        required=False,
        validate=OneOf(["metric", "column", "folder"]),
    )
    name = fields.String(required=False, validate=Length(1, 250))
    description = fields.String(
        required=False,
        allow_none=True,
        validate=Length(0, 1000),
    )
    # folder can contain metrics, columns, and subfolders:
    children = fields.List(
        fields.Nested(lambda: FolderSchema()),
        required=False,
        allow_none=True,
    )

    @validates_schema
    def validate_folder(self, data: dict[str, Any], **kwargs: Any) -> None:
        if "uuid" in data and len(data) == 1:
            # only UUID is present, this is a metric or column
            return

        # folder; must have children
        if "name" in data and "children" not in data:
            raise ValidationError("If 'name' is present, 'children' must be present.")


class DatasetPostSchema(Schema):
    database = fields.Integer(required=True)
    catalog = fields.String(allow_none=True, validate=Length(0, 250))
    schema = fields.String(allow_none=True, validate=Length(0, 250))
    table_name = fields.String(required=True, allow_none=False, validate=Length(1, 250))
    sql = fields.String(allow_none=True)
    editors = fields.List(fields.Integer())
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)
    normalize_columns = fields.Boolean(load_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)
    currency_code_column = fields.String(allow_none=True, validate=Length(0, 250))
    partition_column = fields.String(allow_none=True, validate=Length(0, 250))
    partition_mapped_column = fields.String(allow_none=True, validate=Length(0, 250))
    template_params = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class DatasetPutSchema(DiscardIsManagedExternallyMixin, Schema):
    table_name = fields.String(allow_none=True, validate=Length(1, 250))
    database_id = fields.Integer()
    sql = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean(allow_none=True)
    fetch_values_predicate = fields.String(allow_none=True, validate=Length(0, 1000))
    catalog = fields.String(allow_none=True, validate=Length(0, 250))
    schema = fields.String(allow_none=True, validate=Length(0, 255))
    description = fields.String(allow_none=True)
    main_dttm_col = fields.String(allow_none=True)
    currency_code_column = fields.String(allow_none=True, validate=Length(0, 250))
    partition_column = fields.String(allow_none=True, validate=Length(0, 250))
    partition_mapped_column = fields.String(allow_none=True, validate=Length(0, 250))
    normalize_columns = fields.Boolean(allow_none=True, dump_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)
    offset = fields.Integer(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    template_params = fields.String(allow_none=True)
    editors = fields.List(fields.Integer())
    columns = fields.List(fields.Nested(DatasetColumnsPutSchema))
    metrics = fields.List(fields.Nested(DatasetMetricsPutSchema))
    folders = fields.List(fields.Nested(FolderSchema), required=False)
    extra = fields.String(allow_none=True, validate=validate_dataset_extra)
    external_url = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)

    def handle_error(
        self,
        error: ValidationError,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> None:
        """
        Return SIP-40 error.
        """
        raise SupersetMarshmallowValidationError(error, data)


class DatasetDuplicateSchema(Schema):
    base_model_id = fields.Integer(required=True)
    table_name = fields.String(required=True, allow_none=False, validate=Length(1, 250))


class DatasetRelatedChart(Schema):
    id = fields.Integer()
    slice_name = fields.String()
    viz_type = fields.String()


class DatasetRelatedDashboard(Schema):
    id = fields.Integer()
    json_metadata = fields.Dict()
    slug = fields.String()
    title = fields.String()


class DatasetRelatedCharts(Schema):
    count = fields.Integer(metadata={"description": "Chart count"})
    restricted_count = fields.Integer(
        metadata={"description": "Charts the current user cannot access"}
    )
    result = fields.List(
        fields.Nested(DatasetRelatedChart),
        metadata={"description": "A list of dashboards"},
    )


class DatasetRelatedDashboards(Schema):
    count = fields.Integer(metadata={"description": "Dashboard count"})
    restricted_count = fields.Integer(
        metadata={"description": "Dashboards the current user cannot access"}
    )
    result = fields.List(
        fields.Nested(DatasetRelatedDashboard),
        metadata={"description": "A list of dashboards"},
    )


class DatasetRelatedObjectsResponse(Schema):
    charts = fields.Nested(DatasetRelatedCharts)
    dashboards = fields.Nested(DatasetRelatedDashboards)


class DatasetPurgeRequestSchema(Schema):
    """Validate a dataset purge confirmation payload."""

    confirmed_impact_token: fields.String = fields.String(
        required=True,
        allow_none=False,
        validate=Length(min=1),
    )


class DatasetPurgeImpactObjectSchema(Schema):
    """Describe one dependent object visible to the caller."""

    uuid: fields.UUID = fields.UUID(required=True)
    name: fields.String = fields.String(required=True)
    archived: fields.Boolean = fields.Boolean(required=True)
    url: fields.String = fields.String(required=True, allow_none=True)


class DatasetPurgeImpactCollectionSchema(Schema):
    """Validate totals and visible results for one dependent object type."""

    count: fields.Integer = fields.Integer(required=True, validate=Range(min=0))
    restricted_count: fields.Integer = fields.Integer(
        required=True, validate=Range(min=0)
    )
    result: fields.List = fields.List(
        fields.Nested(DatasetPurgeImpactObjectSchema), required=True
    )

    @validates_schema
    def validate_totals(self, data: dict[str, Any], **kwargs: Any) -> None:
        """Require visible and restricted records to equal the total."""
        count: int = data["count"]
        restricted_count: int = data["restricted_count"]
        result: list[dict[str, Any]] = data["result"]
        if restricted_count > count or len(result) + restricted_count != count:
            raise ValidationError("Impact totals do not match the result")


class DatasetPurgeImpactSchema(Schema):
    """Describe the authoritative, access-filtered dataset purge impact."""

    impact_token: fields.String = fields.String(required=True)
    charts: fields.Nested = fields.Nested(
        DatasetPurgeImpactCollectionSchema, required=True
    )
    dashboards: fields.Nested = fields.Nested(
        DatasetPurgeImpactCollectionSchema, required=True
    )


class ImportV1ColumnSchema(Schema):
    # pylint: disable=unused-argument
    @pre_load
    def fix_extra(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Fix for extra initially being exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        return data

    column_name = fields.String(required=True)
    extra = fields.Dict(allow_none=True)
    verbose_name = fields.String(allow_none=True)
    is_dttm = fields.Boolean(dump_default=False, allow_none=True)
    is_active = fields.Boolean(dump_default=True, allow_none=True)
    type = fields.String(allow_none=True)
    advanced_data_type = fields.String(allow_none=True)
    groupby = fields.Boolean()
    filterable = fields.Boolean()
    expression = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    python_date_format = fields.String(
        allow_none=True, validate=[Length(1, 255), validate_python_date_format]
    )
    datetime_format = fields.String(
        allow_none=True, validate=[Length(1, 100), validate_python_date_format]
    )
    uuid = fields.UUID(allow_none=True)


class ImportMetricCurrencySchema(Schema):
    symbol = fields.String(validate=Length(1, 128))
    symbolPosition = fields.String(validate=Length(1, 128))  # noqa: N815


class ImportV1MetricSchema(Schema):
    # pylint: disable=unused-argument
    @pre_load
    def fix_fields(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Fix for extra and currency initially being exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        return data

    @pre_load
    def fix_template_params(
        self, data: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """
        Fix for template_params initially being exported as an empty string.
        """
        if (
            isinstance(data.get("template_params"), str)
            and data["template_params"].strip() == ""
        ):
            data["template_params"] = None
        return data

    metric_name = fields.String(required=True)
    verbose_name = fields.String(allow_none=True)
    metric_type = fields.String(allow_none=True)
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    d3format = fields.String(allow_none=True)
    currency = CurrencyField(ImportMetricCurrencySchema, allow_none=True)
    extra = fields.Dict(allow_none=True)
    warning_text = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class ImportV1DatasetSchema(Schema):
    # pylint: disable=unused-argument
    @pre_load
    def fix_extra(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Fix for extra initially being exported as a string.
        And fixed bug when exporting template_params as empty string.
        """
        if isinstance(data.get("extra"), str):
            try:
                extra = data["extra"]
                data["extra"] = json.loads(extra) if extra.strip() else None
            except ValueError:
                data["extra"] = None

        if "template_params" in data and data["template_params"] == "":
            data["template_params"] = None

        return data

    @validates_schema
    def validate_unique_child_uuids(self, data: dict[str, Any], **kwargs: Any) -> None:
        """
        Reject a payload where two metrics (or two columns) share a UUID.

        UUIDs are globally unique in the database, so such a payload cannot be
        imported faithfully: the importer matches children within their parent
        by name *or* UUID, so the second entry would match the first one and
        overwrite it in place, silently collapsing two metrics/columns into one.
        Only a hand-edited bundle can produce this — an export never does.
        """
        for key, singular in (("metrics", "metric"), ("columns", "column")):
            seen: set[UUID] = set()
            duplicates: set[UUID] = set()
            for child in data.get(key) or []:
                child_uuid = child.get("uuid")
                if child_uuid is None:
                    continue
                if child_uuid in seen:
                    duplicates.add(child_uuid)
                seen.add(child_uuid)
            if duplicates:
                raise ValidationError(
                    f"Duplicate UUIDs found in {key}: "
                    f"{', '.join(sorted(str(dup) for dup in duplicates))}. "
                    f"Each {singular} must have a unique `uuid`.",
                    field_name=key,
                )

    table_name = fields.String(required=True)
    main_dttm_col = fields.String(allow_none=True)
    currency_code_column = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    offset = fields.Integer()
    cache_timeout = fields.Integer(allow_none=True)
    schema = fields.String(allow_none=True)
    catalog = fields.String(allow_none=True)
    sql = fields.String(allow_none=True)
    # Source database engine for SQL transpilation (virtual datasets only)
    source_db_engine = fields.String(allow_none=True, load_default=None)
    params = fields.Dict(allow_none=True)
    template_params = fields.Dict(allow_none=True)
    filter_select_enabled = fields.Boolean()
    fetch_values_predicate = fields.String(allow_none=True)
    extra = fields.Dict(allow_none=True)
    uuid = fields.UUID(required=True)
    columns = fields.List(fields.Nested(ImportV1ColumnSchema))
    metrics = fields.List(fields.Nested(ImportV1MetricSchema))
    version = fields.String(required=True)
    database_uuid = fields.UUID(required=True)
    data = fields.URL()
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)
    normalize_columns = fields.Boolean(load_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)
    # No partition mapping fields: it rides inside `extra`, which is already a
    # `fields.Dict` here and already round-trips through export/import, so
    # declaring them would export the same values twice.
    folders = fields.List(fields.Nested(FolderSchema), required=False, allow_none=True)
    # data_file is used by the example loading system to reference Parquet files
    data_file = fields.String(allow_none=True, load_default=None)


class GetOrCreateDatasetSchema(Schema):
    table_name = fields.String(required=True, metadata={"description": "Name of table"})
    database_id = fields.Integer(
        required=True, metadata={"description": "ID of database table belongs to"}
    )
    catalog = fields.String(
        allow_none=True,
        validate=Length(0, 250),
        metadata={"description": "The catalog the table belongs to"},
    )
    schema = fields.String(
        allow_none=True,
        validate=Length(0, 250),
        metadata={"description": "The schema the table belongs to"},
    )
    template_params = fields.String(
        metadata={"description": "Template params for the table"}
    )
    normalize_columns = fields.Boolean(load_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)


class PartitionMappingPreviewSchema(Schema):
    """
    Payload for the dataset editor's partition mapping preview panel.

    Every field is bounded. The endpoint parses `value_transform` with sqlglot
    and then evaluates it against the warehouse, so an unbounded string is
    parser time and warehouse time an owner can spend at will; the bounds keep
    a malformed or oversized payload a 400 rather than work.
    """

    mapped_column = fields.String(
        required=True,
        # Matches the `String(250)` the mapping columns are stored in.
        validate=Length(1, 250),
        metadata={"description": "Column whose filters would be mirrored"},
    )
    value_transform = fields.String(
        required=True,
        allow_none=True,
        # The stored column is `Text`, so this bounds the *request*, not the
        # feature: a transform is one expression around `:value`, and 1024
        # characters is far past anything that reads as one.
        validate=Length(1, 1024),
        metadata={"description": "SQL expression containing a :value placeholder"},
    )
    sample_value = fields.String(
        required=True,
        validate=Length(1, 250),
        metadata={"description": "Value to evaluate the transform at"},
    )


class DatasetCacheWarmUpRequestSchema(Schema):
    db_name = fields.String(
        required=True,
        metadata={"description": "The name of the database where the table is located"},
    )
    table_name = fields.String(
        required=True,
        metadata={"description": "The name of the table to warm up cache for"},
    )
    dashboard_id = fields.Integer(
        metadata={
            "description": "The ID of the dashboard to get filters for when warming cache"  # noqa: E501
        }
    )
    extra_filters = fields.String(
        metadata={"description": "Extra filters to apply when warming up cache"}
    )


class DatasetCacheWarmUpResponseSingleSchema(Schema):
    chart_id = fields.Integer(
        metadata={"description": "The ID of the chart the status belongs to"}
    )
    viz_error = fields.String(
        metadata={"description": "Error that occurred when warming cache for chart"}
    )
    viz_status = fields.String(
        metadata={"description": "Status of the underlying query for the viz"}
    )


class DatasetCacheWarmUpResponseSchema(Schema):
    result = fields.List(
        fields.Nested(DatasetCacheWarmUpResponseSingleSchema),
        metadata={
            "description": "A list of each chart's warmup status and errors if any"
        },
    )


class DatasetColumnDrillInfoSchema(Schema):
    column_name = fields.String(required=True)
    verbose_name = fields.String(required=False)
    # Consumers need every column to resolve display labels, but only dimensions
    # belong in the drill-by picker, so ship the flag and let them narrow.
    groupby = fields.Boolean(required=False)


class DatasetMetricDrillInfoSchema(Schema):
    metric_name = fields.String(required=True)
    verbose_name = fields.String(required=False)


class UserSchema(Schema):
    # Deliberately excludes ``email``: drill_info is reachable by any user
    # with read access to the dataset (and, via the dashboard fallback, by
    # embedded guests), so exposing maintainer emails here would leak user
    # PII across an access boundary. Mirrors the dashboard/RLS user schemas,
    # which expose names only.
    first_name = fields.String()
    last_name = fields.String()


class DrillInfoEditorSchema(Schema):
    # Deliberately excludes ``secondary_label``: for a user-backed Subject,
    # user-subject synchronization (superset.subjects.sync.sync_user_subject)
    # stores that user's email in this field, so including it here would
    # leak the same maintainer PII that ``UserSchema`` above excludes
    # ``email`` to avoid, just through a different field name.
    id = fields.Int()
    label = fields.String()
    img = fields.String()
    type = fields.Integer()


class DatasetDrillInfoSchema(Schema):
    id = fields.Integer()
    columns = fields.List(fields.Nested(DatasetColumnDrillInfoSchema))
    metrics = fields.List(fields.Nested(DatasetMetricDrillInfoSchema))
    table_name = fields.String()
    editors = fields.List(fields.Nested(DrillInfoEditorSchema))
    created_by = fields.Nested(UserSchema)
    created_on_humanized = fields.String()
    changed_by = fields.Nested(UserSchema)
    changed_on_humanized = fields.String()

    # pylint: disable=unused-argument
    @post_dump
    def post_dump(self, serialized: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Clear API response to avoid exposing sensitive information for embedded users.

        Both ``columns`` and ``metrics`` are returned whole. Besides feeding the
        drill-by dimension picker, this response is the source of the verbose map
        that labels the dashboard "View as table" results grid, and a chart can
        select any column or metric -- a raw-records table routinely selects
        non-dimension columns. Narrowing to ``groupby=True`` here left those
        columns, and every metric, showing their raw technical names. Each column
        carries its ``groupby`` flag instead, so the drill-by picker can narrow to
        dimensions client-side, which is the only consumer that needs it.

        Guests get the same lists. They reach this endpoint only through the
        dashboard fallback, which first verifies dashboard access to a dashboard
        built on this dataset, and they already see these labels rendered in that
        dashboard's charts. The branch stays minimal in every other respect.
        """
        if security_manager.is_guest_user():
            return {
                "id": serialized["id"],
                "columns": serialized["columns"],
                "metrics": serialized.get("metrics", []),
            }
        return serialized
