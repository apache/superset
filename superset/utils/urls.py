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
import urllib
from typing import Any

from flask import current_app, url_for


def get_url_host(user_friendly: bool = False) -> str:
    if user_friendly:
        return current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"]
    return current_app.config["WEBDRIVER_BASEURL"]


def headless_url(path: str, user_friendly: bool = False) -> str:
    return urllib.parse.urljoin(get_url_host(user_friendly=user_friendly), path)


def get_url_path(view: str, user_friendly: bool = False, **kwargs: Any) -> str:
    with current_app.test_request_context():
        return headless_url(url_for(view, **kwargs), user_friendly=user_friendly)
