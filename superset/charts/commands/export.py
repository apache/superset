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
# isort:skip_file

import json
import logging
from typing import Iterator, Tuple

import yaml
from werkzeug.utils import secure_filename

from superset.charts.commands.exceptions import ChartNotFoundError
from superset.charts.dao import ChartDAO
from superset.datasets.commands.export import ExportDatasetsCommand
from superset.commands.export import ExportModelsCommand
from superset.models.slice import Slice
from superset.utils.dict_import_export import EXPORT_VERSION

logger = logging.getLogger(__name__)


# keys present in the standard export that are not needed
REMOVE_KEYS = ["datasource_type", "datasource_name"]


class ExportChartsCommand(ExportModelsCommand):

    dao = ChartDAO
    not_found = ChartNotFoundError

    @staticmethod
    def _export(model: Slice) -> Iterator[Tuple[str, str]]:
        chart_slug = secure_filename(model.slice_name)
        file_name = f"charts/{chart_slug}_{model.id}.yaml"

        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        for key in REMOVE_KEYS:
            del payload[key]
        if payload.get("params"):
            try:
                payload["params"] = json.loads(payload["params"])
            except json.decoder.JSONDecodeError:
                logger.info("Unable to decode `params` field: %s", payload["params"])

        payload["version"] = EXPORT_VERSION
        if model.table:
            payload["dataset_uuid"] = str(model.table.uuid)

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        if model.table:
            yield from ExportDatasetsCommand([model.table.id]).run()
