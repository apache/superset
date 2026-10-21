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

from superset.commands.explore.permalink.get import GetExplorePermalinkCommand
from superset.exceptions import SupersetTemplateException
from superset.utils.core import DatasourceType

check_chart_access = "superset.commands.explore.permalink.get.check_chart_access"
decode_permalink_id = "superset.commands.explore.permalink.get.decode_permalink_id"
get_value = "superset.daos.key_value.KeyValueDAO.get_value"


def test_get_permalink_malformed_jinja_template() -> None:
    # ``check_chart_access`` funnels into ``raise_for_access`` which re-parses the
    # query's unrendered Jinja via ``process_jinja_sql`` and can raise a raw
    # ``TemplateError`` (e.g. an unclosed ``{% if %}``). ``TemplateSyntaxError`` is
    # a subclass of ``TemplateError``. It must surface as a
    # ``SupersetTemplateException`` (422), not propagate as an opaque 500.
    assert issubclass(TemplateSyntaxError, TemplateError)

    command = GetExplorePermalinkCommand("thisisallmocked")

    with (
        patch(decode_permalink_id, return_value="123456"),
        patch(
            get_value,
            return_value={
                "chartId": 1,
                "datasourceId": 1,
                "datasourceType": DatasourceType.TABLE.value,
            },
        ),
        patch(
            check_chart_access,
            side_effect=TemplateSyntaxError("unexpected end of template", lineno=1),
        ),
    ):
        with pytest.raises(SupersetTemplateException):
            command.run()
