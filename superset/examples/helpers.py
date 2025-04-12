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
import os
from typing import Any

from superset import app, db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.utils import json

BASE_URL = "https://github.com/apache-superset/examples-data/blob/master/"

misc_dash_slices: set[str] = set()  # slices assembled in a 'Misc Chart' dashboard


def get_table_connector_registry() -> Any:
    return SqlaTable


def get_examples_folder() -> str:
    return os.path.join(app.config["BASE_DIR"], "examples")


def update_slice_ids(pos: dict[Any, Any]) -> list[Slice]:
    """Update slice ids in position_json and return the slices found."""
    slice_components = [
        component
        for component in pos.values()
        if isinstance(component, dict) and component.get("type") == "CHART"
    ]
    slices = {}
    for name in {component["meta"]["sliceName"] for component in slice_components}:
        slc = db.session.query(Slice).filter_by(slice_name=name).first()
        if slc:
            slices[name] = slc
    for component in slice_components:
        slc = slices.get(component["meta"]["sliceName"])
        if slc:
            component["meta"]["chartId"] = slc.id
            component["meta"]["uuid"] = str(slc.uuid)
    return list(slices.values())


def merge_slice(slc: Slice) -> None:
    o = db.session.query(Slice).filter_by(slice_name=slc.slice_name).first()
    if o:
        db.session.delete(o)
    db.session.add(slc)


def get_slice_json(defaults: dict[Any, Any], **kwargs: Any) -> str:
    defaults_copy = defaults.copy()
    defaults_copy.update(kwargs)
    return json.dumps(defaults_copy, indent=4, sort_keys=True)


def get_example_url(filepath: str) -> str:
    return f"{BASE_URL}{filepath}?raw=true"
