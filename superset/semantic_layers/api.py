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
from __future__ import annotations

import logging
from typing import Any

from flask import make_response, request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.api.schemas import get_list_schema
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError
from pydantic import ValidationError as PydanticValidationError

from superset import db, event_logger, is_feature_enabled
from superset.commands.semantic_layer.create import (
    CreateSemanticLayerCommand,
    CreateSemanticViewCommand,
)
from superset.commands.semantic_layer.delete import (
    DeleteSemanticLayerCommand,
    DeleteSemanticViewCommand,
)
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerDeleteFailedError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewCreateFailedError,
    SemanticViewDeleteFailedError,
    SemanticViewForbiddenError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)
from superset.commands.semantic_layer.update import (
    UpdateSemanticLayerCommand,
    UpdateSemanticViewCommand,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.models.core import Database
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from superset.semantic_layers.schemas import (
    SemanticLayerPostSchema,
    SemanticLayerPutSchema,
    SemanticViewPostSchema,
    SemanticViewPutSchema,
)
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.views.base_api import (
    BaseSupersetApi,
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


def _serialize_layer(layer: SemanticLayer) -> dict[str, Any]:
    config = layer.configuration
    if isinstance(config, str):
        config = json.loads(config)
    return {
        "uuid": str(layer.uuid),
        "name": layer.name,
        "description": layer.description,
        "type": layer.type,
        "cache_timeout": layer.cache_timeout,
        "configuration": config or {},
        "changed_on_delta_humanized": layer.changed_on_delta_humanized(),
    }


def _infer_discriminators(
    schema: dict[str, Any],
    data: dict[str, Any],
) -> dict[str, Any]:
    """
    Infer discriminator values for union fields when the frontend omits them.

    Walks the schema's properties looking for discriminated unions (fields with a
    ``discriminator.mapping``). For each one, tries to match the submitted data
    against one of the variants by checking which variant's required fields are
    present, then injects the discriminator value.
    """
    defs = schema.get("$defs", {})
    for prop_name, prop_schema in schema.get("properties", {}).items():
        value = data.get(prop_name)
        if not isinstance(value, dict):
            continue

        # Find discriminated union via discriminator mapping
        mapping = (
            prop_schema.get("discriminator", {}).get("mapping")
            if "discriminator" in prop_schema
            else None
        )
        if not mapping:
            continue

        discriminator_field = prop_schema["discriminator"].get("propertyName")
        if not discriminator_field or discriminator_field in value:
            continue

        # Try each variant: match by required fields present in the data
        for disc_value, ref in mapping.items():
            ref_name = ref.rsplit("/", 1)[-1] if "/" in ref else ref
            variant_def = defs.get(ref_name, {})
            required = set(variant_def.get("required", []))
            # Exclude the discriminator itself from the check
            required.discard(discriminator_field)
            if required and required.issubset(value.keys()):
                data = {
                    **data,
                    prop_name: {**value, discriminator_field: disc_value},
                }
                break

    return data


def _parse_partial_config(
    cls: Any,
    config: dict[str, Any],
) -> Any:
    """
    Parse a partial configuration, handling discriminator inference and
    falling back to lenient validation when strict parsing fails.
    """
    config_class = cls.configuration_class

    # Infer discriminator values the frontend may have omitted
    schema = config_class.model_json_schema()
    config = _infer_discriminators(schema, config)

    try:
        return config_class.model_validate(config)
    except (PydanticValidationError, ValueError):
        pass

    try:
        return config_class.model_validate(config, context={"partial": True})
    except (PydanticValidationError, ValueError):
        return None


class SemanticViewRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SemanticView)

    resource_name = "semantic_view"
    allow_browser_login = True
    class_permission_name = "SemanticView"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {"put", "post", "delete"}

    edit_model_schema = SemanticViewPutSchema()

    @expose("/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Bulk create semantic views.
        ---
        post:
          summary: Create semantic views
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    views:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          semantic_layer_uuid:
                            type: string
                          configuration:
                            type: object
                          description:
                            type: string
                          cache_timeout:
                            type: integer
          responses:
            201:
              description: Semantic views created
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
        """
        body = request.json or {}
        views_data = body.get("views", [])
        if not views_data:
            return self.response_400(message="No views provided")

        schema = SemanticViewPostSchema()
        created = []
        errors = []
        for view_data in views_data:
            try:
                item = schema.load(view_data)
            except ValidationError as error:
                errors.append({"name": view_data.get("name"), "error": error.messages})
                continue
            try:
                new_model = CreateSemanticViewCommand(item).run()
                created.append({"uuid": str(new_model.uuid), "name": new_model.name})
            except SemanticLayerNotFoundError:
                errors.append(
                    {"name": view_data.get("name"), "error": "Semantic layer not found"}
                )
            except SemanticViewCreateFailedError as ex:
                logger.error(
                    "Error creating semantic view: %s",
                    str(ex),
                    exc_info=True,
                )
                errors.append({"name": view_data.get("name"), "error": str(ex)})

        result: dict[str, Any] = {"created": created}
        if errors:
            result["errors"] = errors
        status = 201 if created else 422
        return self.response(status, result=result)

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a semantic view.
        ---
        put:
          summary: Update a semantic view
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Semantic view schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Semantic view changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdateSemanticViewCommand(pk, item).run()
            response = self.response(200, id=changed_model.id, result=item)
        except SemanticViewNotFoundError:
            response = self.response_404()
        except SemanticViewForbiddenError:
            response = self.response_403()
        except SemanticViewInvalidError as ex:
            response = self.response_422(message=ex.normalized_messages())
        except SemanticViewUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))
        return response

    @expose("/<pk>", methods=("DELETE",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a semantic view.
        ---
        delete:
          summary: Delete a semantic view
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Semantic view deleted
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            DeleteSemanticViewCommand(pk).run()
            return self.response(200, message="OK")
        except SemanticViewNotFoundError:
            return self.response_404()
        except SemanticViewDeleteFailedError as ex:
            logger.error(
                "Error deleting semantic view: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))


class SemanticLayerRestApi(BaseSupersetApi):
    resource_name = "semantic_layer"
    allow_browser_login = True
    class_permission_name = "SemanticLayer"
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "types": "read",
        "configuration_schema": "read",
        "runtime_schema": "read",
    }
    openapi_spec_tag = "Semantic Layers"
    add_model_schema = SemanticLayerPostSchema()
    edit_model_schema = SemanticLayerPutSchema()

    @expose("/types", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def types(self) -> FlaskResponse:
        """List available semantic layer types.
        ---
        get:
          summary: List available semantic layer types
          responses:
            200:
              description: A list of semantic layer types
            401:
              $ref: '#/components/responses/401'
        """
        result = [
            {"id": key, "name": cls.name, "description": cls.description}  # type: ignore[attr-defined]
            for key, cls in registry.items()
        ]
        return self.response(200, result=result)

    @expose("/schema/configuration", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    def configuration_schema(self) -> FlaskResponse:
        """Get configuration schema for a semantic layer type.
        ---
        post:
          summary: Get configuration schema for a semantic layer type
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    type:
                      type: string
                    configuration:
                      type: object
          responses:
            200:
              description: Configuration JSON Schema
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
        """
        body = request.json or {}
        sl_type = body.get("type")

        cls = registry.get(sl_type)  # type: ignore[arg-type]
        if not cls:
            return self.response_400(message=f"Unknown type: {sl_type}")

        parsed_config = None
        if config := body.get("configuration"):
            parsed_config = _parse_partial_config(cls, config)

        try:
            schema = cls.get_configuration_schema(parsed_config)
        except Exception:  # pylint: disable=broad-except
            # Connection or query failures during schema enrichment should not
            # prevent the form from rendering — return the base schema instead.
            schema = cls.get_configuration_schema(None)

        resp = make_response(json.dumps({"result": schema}, sort_keys=False), 200)
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        return resp

    @expose("/<uuid>/schema/runtime", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def runtime_schema(self, uuid: str) -> FlaskResponse:
        """Get runtime schema for a stored semantic layer.
        ---
        post:
          summary: Get runtime schema for a semantic layer
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    runtime_data:
                      type: object
          responses:
            200:
              description: Runtime JSON Schema
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        layer = SemanticLayerDAO.find_by_uuid(uuid)
        if not layer:
            return self.response_404()

        body = request.get_json(silent=True) or {}
        runtime_data = body.get("runtime_data")

        cls = registry.get(layer.type)
        if not cls:
            return self.response_400(message=f"Unknown type: {layer.type}")

        try:
            schema = cls.get_runtime_schema(
                layer.implementation.configuration,  # type: ignore[attr-defined]
                runtime_data,
            )
        except Exception as ex:  # pylint: disable=broad-except
            return self.response_400(message=str(ex))

        return self.response(200, result=schema)

    @expose("/<uuid>/views", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def views(self, uuid: str) -> FlaskResponse:
        """List available views from a semantic layer.
        ---
        post:
          summary: List available views from a semantic layer
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
          requestBody:
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    runtime_data:
                      type: object
          responses:
            200:
              description: Available views
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        layer = SemanticLayerDAO.find_by_uuid(uuid)
        if not layer:
            return self.response_404()

        body = request.get_json(silent=True) or {}
        runtime_data = body.get("runtime_data", {})

        try:
            views = layer.implementation.get_semantic_views(runtime_data)
        except Exception as ex:  # pylint: disable=broad-except
            return self.response_400(message=str(ex))

        # Check which views already exist with the same runtime config
        existing = SemanticViewDAO.find_by_semantic_layer(str(layer.uuid))
        existing_keys: set[tuple[str, str]] = set()
        for v in existing:
            config = v.configuration
            if isinstance(config, str):
                config = json.loads(config)
            existing_keys.add((v.name, json.dumps(config or {}, sort_keys=True)))
        runtime_key = json.dumps(runtime_data or {}, sort_keys=True)

        result = [
            {
                "name": v.name,
                "already_added": (v.name, runtime_key) in existing_keys,
            }
            for v in sorted(views, key=lambda v: v.name)
        ]
        return self.response(200, result=result)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    def post(self) -> FlaskResponse:
        """Create a semantic layer.
        ---
        post:
          summary: Create a semantic layer
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    name:
                      type: string
                    description:
                      type: string
                    type:
                      type: string
                    configuration:
                      type: object
                    cache_timeout:
                      type: integer
          responses:
            201:
              description: Semantic layer created
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = CreateSemanticLayerCommand(item).run()
            return self.response(201, result={"uuid": str(new_model.uuid)})
        except SemanticLayerInvalidError as ex:
            return self.response_422(message=str(ex))
        except SemanticLayerCreateFailedError as ex:
            logger.error(
                "Error creating semantic layer: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<uuid>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    def put(self, uuid: str) -> FlaskResponse:
        """Update a semantic layer.
        ---
        put:
          summary: Update a semantic layer
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    name:
                      type: string
                    description:
                      type: string
                    configuration:
                      type: object
                    cache_timeout:
                      type: integer
          responses:
            200:
              description: Semantic layer updated
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            changed_model = UpdateSemanticLayerCommand(uuid, item).run()
            return self.response(200, result={"uuid": str(changed_model.uuid)})
        except SemanticLayerNotFoundError:
            return self.response_404()
        except SemanticLayerInvalidError as ex:
            return self.response_422(message=str(ex))
        except SemanticLayerUpdateFailedError as ex:
            logger.error(
                "Error updating semantic layer: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<uuid>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, uuid: str) -> FlaskResponse:
        """Delete a semantic layer.
        ---
        delete:
          summary: Delete a semantic layer
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
          responses:
            200:
              description: Semantic layer deleted
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            DeleteSemanticLayerCommand(uuid).run()
            return self.response(200, message="OK")
        except SemanticLayerNotFoundError:
            return self.response_404()
        except SemanticLayerDeleteFailedError as ex:
            logger.error(
                "Error deleting semantic layer: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/connections/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_list_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.connections",
        log_to_statsd=False,
    )
    def connections(self, **kwargs: Any) -> FlaskResponse:
        """List databases and semantic layers combined.
        ---
        get:
          summary: List databases and semantic layers combined
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: Combined list of databases and semantic layers
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        args = kwargs.get("rison", {})
        page = args.get("page", 0)
        page_size = args.get("page_size", 25)
        order_column = args.get("order_column", "changed_on")
        order_direction = args.get("order_direction", "desc")
        filters = args.get("filters", [])

        source_type, name_filter = self._parse_connection_filters(filters)

        if not is_feature_enabled("SEMANTIC_LAYERS"):
            source_type = "database"

        all_items = self._fetch_connection_items(source_type, name_filter)

        sort_key = self._get_connection_sort_key(order_column)
        all_items.sort(key=sort_key, reverse=order_direction == "desc")  # type: ignore
        total_count = len(all_items)

        start = page * page_size
        page_items = all_items[start : start + page_size]

        result = [
            self._serialize_database(obj)
            if item_type == "database"
            else self._serialize_semantic_layer(obj)
            for item_type, obj in page_items
        ]

        return self.response(200, count=total_count, result=result)

    @staticmethod
    def _parse_connection_filters(
        filters: list[dict[str, Any]],
    ) -> tuple[str, str | None]:
        """Parse filters into source_type and name_filter."""
        source_type = "all"
        name_filter = None
        for f in filters:
            if f.get("col") == "source_type":
                source_type = f.get("value", "all")
            elif f.get("col") == "database_name" and f.get("opr") == "ct":
                name_filter = f.get("value")
        return source_type, name_filter

    @staticmethod
    def _fetch_connection_items(
        source_type: str,
        name_filter: str | None,
    ) -> list[tuple[str, Any]]:
        """Fetch database and semantic layer items based on filters."""
        db_items: list[tuple[str, Database]] = []
        if source_type in ("all", "database"):
            db_q = db.session.query(Database)
            if name_filter:
                db_q = db_q.filter(Database.database_name.ilike(f"%{name_filter}%"))
            db_items = [("database", obj) for obj in db_q.all()]

        sl_items: list[tuple[str, SemanticLayer]] = []
        if source_type in ("all", "semantic_layer"):
            sl_q = db.session.query(SemanticLayer)
            if name_filter:
                sl_q = sl_q.filter(SemanticLayer.name.ilike(f"%{name_filter}%"))
            sl_items = [("semantic_layer", obj) for obj in sl_q.all()]

        return db_items + sl_items  # type: ignore

    @staticmethod
    def _get_connection_sort_key(order_column: str) -> Any:
        """Return a sort key function for connection items."""

        def _sort_key_changed_on(
            item: tuple[str, Database | SemanticLayer],
        ) -> float:
            changed_on = item[1].changed_on
            return changed_on.timestamp() if changed_on else 0.0

        def _sort_key_name(
            item: tuple[str, Database | SemanticLayer],
        ) -> str:
            obj = item[1]
            raw = (
                obj.database_name  # type: ignore[union-attr]
                if item[0] == "database"
                else obj.name
            )
            return raw.lower()

        sort_key_map = {
            "changed_on_delta_humanized": _sort_key_changed_on,
            "database_name": _sort_key_name,
        }
        return sort_key_map.get(order_column, _sort_key_changed_on)

    @staticmethod
    def _serialize_database(obj: Database) -> dict[str, Any]:
        changed_by = obj.changed_by
        return {
            "source_type": "database",
            "id": obj.id,
            "uuid": str(obj.uuid),
            "database_name": obj.database_name,
            "backend": obj.backend,
            "allow_run_async": obj.allow_run_async,
            "allow_dml": obj.allow_dml,
            "allow_file_upload": obj.allow_file_upload,
            "expose_in_sqllab": obj.expose_in_sqllab,
            "changed_on_delta_humanized": obj.changed_on_delta_humanized(),
            "changed_by": {
                "first_name": changed_by.first_name,
                "last_name": changed_by.last_name,
            }
            if changed_by
            else None,
        }

    @staticmethod
    def _serialize_semantic_layer(obj: SemanticLayer) -> dict[str, Any]:
        changed_by = obj.changed_by
        sl_type = obj.type
        cls = registry.get(sl_type)
        type_name = cls.name if cls else sl_type  # type: ignore[attr-defined]
        return {
            "source_type": "semantic_layer",
            "uuid": str(obj.uuid),
            "database_name": obj.name,
            "backend": type_name,
            "sl_type": sl_type,
            "description": obj.description,
            "allow_run_async": None,
            "allow_dml": None,
            "allow_file_upload": None,
            "expose_in_sqllab": None,
            "changed_on_delta_humanized": obj.changed_on_delta_humanized(),
            "changed_by": {
                "first_name": changed_by.first_name,
                "last_name": changed_by.last_name,
            }
            if changed_by
            else None,
        }

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_list(self) -> FlaskResponse:
        """List all semantic layers.
        ---
        get:
          summary: List all semantic layers
          responses:
            200:
              description: A list of semantic layers
            401:
              $ref: '#/components/responses/401'
        """
        layers = SemanticLayerDAO.find_all()
        result = [_serialize_layer(layer) for layer in layers]
        return self.response(200, result=result)

    @expose("/<uuid>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get(self, uuid: str) -> FlaskResponse:
        """Get a single semantic layer.
        ---
        get:
          summary: Get a semantic layer by UUID
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
          responses:
            200:
              description: A semantic layer
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        layer = SemanticLayerDAO.find_by_uuid(uuid)
        if not layer:
            return self.response_404()
        return self.response(200, result=_serialize_layer(layer))
