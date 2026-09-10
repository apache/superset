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
from unittest.mock import patch

import pytest
from jinja2.exceptions import TemplateError, TemplateSyntaxError

from superset.commands.explore.permalink.create import CreateExplorePermalinkCommand
from superset.exceptions import SupersetTemplateException

check_chart_access = "superset.commands.explore.permalink.create.check_chart_access"


def test_create_permalink_malformed_jinja_template() -> None:
    # ``check_chart_access`` funnels into ``raise_for_access`` which re-parses the
    # query's unrendered Jinja via ``process_jinja_sql`` and can raise a raw
    # ``TemplateError`` (e.g. an unclosed ``{% if %}``). ``TemplateSyntaxError`` is
    # a subclass of ``TemplateError``. It must surface as a
    # ``SupersetTemplateException`` (422), not propagate as an opaque 500.
    assert issubclass(TemplateSyntaxError, TemplateError)

    command = CreateExplorePermalinkCommand(
        {"formData": {"datasource": "1__table", "slice_id": 1}}
    )

    with patch(
        check_chart_access,
        side_effect=TemplateSyntaxError("unexpected end of template", lineno=1),
    ):
        with pytest.raises(SupersetTemplateException):
            command.run()
