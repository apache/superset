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
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
# either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import tempfile
from pathlib import Path
from textwrap import dedent

from superset.db_engine_specs import lint_metadata
from superset.db_engine_specs.lint_metadata import get_all_engine_specs_ast


def test_get_all_engine_specs_ast_annotated_attributes() -> None:
    """
    Ensure engine specs with type-annotated engine, engine_name, and metadata
    are correctly discovered and parsed by get_all_engine_specs_ast.
    """
    specs_dir = Path(lint_metadata.__file__).parent
    code = dedent(
        """
        from typing import Any
        from superset.db_engine_specs.base import BaseEngineSpec

        class TypedBaseEngineSpec(BaseEngineSpec):
            engine: str = "typed_engine"
            engine_name: str = "Typed Engine"
            metadata: dict[str, Any] = {
                "description": "A typed engine spec",
            }
        """
    )

    with tempfile.NamedTemporaryFile(
        mode="w",
        dir=specs_dir,
        prefix="_tmp_typed_",
        suffix=".py",
        encoding="utf-8",
        delete=False,
    ) as tmp_file:
        tmp_path = Path(tmp_file.name)
        tmp_file.write(code)

    try:
        specs = get_all_engine_specs_ast()
        matching = [s for s in specs if s["class_name"] == "TypedBaseEngineSpec"]
        assert len(matching) == 1
        spec = matching[0]
        assert spec["engine_name"] == "Typed Engine"
        assert spec["metadata"] == {"description": "A typed engine spec"}
    finally:
        tmp_path.unlink(missing_ok=True)
