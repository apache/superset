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
from click.testing import CliRunner
from pytest_mock import MockerFixture

from superset.cli.update import update_api_docs


def test_update_api_docs_fails_when_no_api_is_documented(
    mocker: MockerFixture, app_context: None
) -> None:
    """A registration regression must not report success.

    Exiting zero here leaves the committed spec in place, so a caller diffing
    the result reads staleness as "up to date".
    """
    mocker.patch("superset.cli.update.current_app.appbuilder.baseviews", [])
    write = mocker.patch("superset.cli.update.open")

    result = CliRunner().invoke(update_api_docs, [])

    assert result.exit_code != 0
    assert "No v1 API found to document" in result.output
    write.assert_not_called()
