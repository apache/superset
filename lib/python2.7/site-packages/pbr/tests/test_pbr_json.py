# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

import mock

from pbr import pbr_json
from pbr.tests import base


class TestJsonContent(base.BaseTestCase):
    @mock.patch('pbr.git._run_git_functions', return_value=True)
    @mock.patch('pbr.git.get_git_short_sha', return_value="123456")
    @mock.patch('pbr.git.get_is_release', return_value=True)
    def test_content(self, mock_get_is, mock_get_git, mock_run):
        cmd = mock.Mock()
        pbr_json.write_pbr_json(cmd, "basename", "pbr.json")
        cmd.write_file.assert_called_once_with(
            'pbr',
            'pbr.json',
            '{"git_version": "123456", "is_release": true}'
        )
