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
from os.path import dirname
from unittest.mock import Mock

from superset.extensions import UIManifestProcessor

APP_DIR = f"{dirname(__file__)}/fixtures"


def test_get_manifest_with_prefix():
    app = Mock(
        config={"STATIC_ASSETS_PREFIX": "https://cool.url/here"},
        template_context_processors={None: []},
    )
    manifest_processor = UIManifestProcessor(APP_DIR)
    manifest_processor.init_app(app)
    manifest = manifest_processor.get_manifest()
    assert manifest["js_manifest"]("main") == ["/static/dist/main-js.js"]
    assert manifest["css_manifest"]("main") == ["/static/dist/main-css.css"]
    assert manifest["js_manifest"]("styles") == ["/static/dist/styles-js.js"]
    assert manifest["css_manifest"]("styles") == []
    assert manifest["assets_prefix"] == "https://cool.url/here"


def test_get_manifest_no_prefix():
    app = Mock(
        config={"STATIC_ASSETS_PREFIX": ""}, template_context_processors={None: []}
    )
    manifest_processor = UIManifestProcessor(APP_DIR)
    manifest_processor.init_app(app)
    manifest = manifest_processor.get_manifest()
    assert manifest["js_manifest"]("main") == ["/static/dist/main-js.js"]
    assert manifest["css_manifest"]("main") == ["/static/dist/main-css.css"]
    assert manifest["js_manifest"]("styles") == ["/static/dist/styles-js.js"]
    assert manifest["css_manifest"]("styles") == []
    assert manifest["assets_prefix"] == ""
