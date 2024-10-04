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
from inspect import isclass
from typing import Any

from superset import db, security_manager
from superset.commands.exceptions import ImportFailedError
from superset.migrations.shared.migrate_viz import processors
from superset.migrations.shared.migrate_viz.base import MigrateViz
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import AnnotationType, get_user


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
    if existing:
        if overwrite and can_write and get_user():
            if not security_manager.can_access_chart(existing):
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
