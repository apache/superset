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

import copy
import logging
from inspect import isclass
from typing import Any

from superset import db, security_manager
from superset.commands.chart.query_context_builder import build_query_context_config
from superset.commands.chart.query_context_generator import (
    get_query_context_generator,
)
from superset.commands.exceptions import ImportFailedError
from superset.migrations.shared.migrate_viz import processors
from superset.migrations.shared.migrate_viz.base import MigrateViz
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import AnnotationType, get_user

logger = logging.getLogger(__name__)


def filter_chart_annotations(chart_config: dict[str, Any]) -> None:
    """
    Mutating the chart's config params to keep only the annotations of
    type FORMULA.
    TODO:
      handle annotation dependencies on either other charts or
      annotation layers objects.
    """
    params = chart_config.get("params", {})
    als = params.get("annotation_layers", [])
    params["annotation_layers"] = [
        al for al in als if al.get("annotationType") == AnnotationType.FORMULA
    ]


def import_chart(
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
) -> Slice:
    can_write = ignore_permissions or security_manager.can_access("can_write", "Chart")
    existing = db.session.query(Slice).filter_by(uuid=config["uuid"]).first()
    user = get_user()
    if existing:
        if overwrite and can_write and user:
            if not security_manager.can_access_chart(existing) or (
                user not in existing.owners and not security_manager.is_admin()
            ):
                raise ImportFailedError(
                    "A chart already exists and user doesn't "
                    "have permissions to overwrite it"
                )
        if not overwrite or not can_write:
            return existing
        config["id"] = existing.id
    elif not can_write:
        raise ImportFailedError(
            "Chart doesn't exist and user doesn't have permission to create charts"
        )

    filter_chart_annotations(config)

    # Synthesize a query_context for imported charts that arrive without one, so
    # the first `GET /api/v1/chart/{pk}/data/` returns data instead of HTTP 400
    # "Chart has no query context saved" (issue #33615, ADR-013). Guarded on an
    # ABSENT context so an existing/remapped one is never overwritten (FR-006).
    #
    # Two-tier derivation:
    #   1. AUTHORITATIVE — run the chart's real frontend `buildQuery` in V8
    #      (QueryContextGenerator) for byte-faithful parity with the UI.
    #   2. FALLBACK — a pure-Python generic derivation
    #      (`build_query_context_config`) when the V8 bundle / py_mini_racer is
    #      unavailable or the viz type is not (yet) covered by the bundle.
    # Either way the datasource is taken from the importer-resolved id/type ONLY,
    # never a value carried in params (ADR-014 authz/RLS). A per-chart derivation
    # error must never abort the bundle (RISK-T03 / FR-004).
    if not config.get("query_context"):
        try:
            params = config.get("params") or {}
            viz_type = config["viz_type"]
            datasource_id = config.get("datasource_id")
            datasource_type = config.get("datasource_type", "table")

            query_context_config = None
            if datasource_id:
                # form_data for the JS builder: the datasource is the
                # importer-resolved id/type only (overwrite any incoming
                # params.datasource — never trust it; ADR-014).
                js_params = {
                    **params,
                    "datasource": f"{datasource_id}__{datasource_type}",
                }
                query_context_config = get_query_context_generator().generate(
                    viz_type, js_params
                )
            if query_context_config is None:
                query_context_config = build_query_context_config(
                    params, viz_type, datasource_id, datasource_type
                )

            if query_context_config is not None:
                config["query_context"] = json.dumps(query_context_config)
                logger.info(
                    "Synthesized query_context for imported chart %s (queryable)",
                    config.get("uuid"),
                )
            else:
                logger.info(
                    "Imported chart %s classified non-derivable; "
                    "query_context left empty",
                    config.get("uuid"),
                )
        except Exception:  # pylint: disable=broad-except
            # Non-derivable on error: leave query_context unset and keep going.
            logger.warning(
                "query_context synthesis failed for imported chart %s; "
                "importing without a query_context",
                config.get("uuid"),
            )

    # TODO (betodealmeida): move this logic to import_from_dict
    config["params"] = json.dumps(config["params"])

    # migrate old viz types to new ones
    config = migrate_chart(config)

    chart = Slice.import_from_dict(config, recursive=False, allow_reparenting=True)
    if chart.id is None:
        db.session.flush()

    if (user := get_user()) and user not in chart.owners:
        chart.owners.append(user)

    return chart


def migrate_chart(config: dict[str, Any]) -> dict[str, Any]:
    """
    Used to migrate old viz types to new ones.
    """
    migrators = {
        class_.source_viz_type: class_
        for class_ in processors.__dict__.values()
        if isclass(class_)
        and issubclass(class_, MigrateViz)
        and hasattr(class_, "source_viz_type")
    }

    output = copy.deepcopy(config)
    if config["viz_type"] not in migrators:
        return output

    migrator = migrators[config["viz_type"]](output["params"])
    # pylint: disable=protected-access
    migrator._pre_action()
    migrator._migrate()
    migrator._post_action()
    params = migrator.data

    params["viz_type"] = migrator.target_viz_type
    output.update(
        {
            "params": json.dumps(params),
            "viz_type": migrator.target_viz_type,
        }
    )

    # also update `query_context`
    try:
        query_context = json.loads(output.get("query_context") or "{}")
    except (json.JSONDecodeError, TypeError):
        query_context = {}
    if "form_data" in query_context:
        query_context["form_data"] = output["params"]
        output["query_context"] = json.dumps(query_context)

    return output
