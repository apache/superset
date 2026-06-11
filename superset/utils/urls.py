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
from urllib.parse import urlparse

from flask import current_app as app, has_request_context, url_for


def get_url_host(user_friendly: bool = False) -> str:
    if user_friendly:
        return app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"]
    return app.config["WEBDRIVER_BASEURL"]


def headless_url(path: str, user_friendly: bool = False) -> str:
    return urllib.parse.urljoin(get_url_host(user_friendly=user_friendly), path)


def get_url_path(view: str, user_friendly: bool = False, **kwargs: Any) -> str:
    in_request_context = has_request_context()

    # When already in a request context, Flask's url_for respects SCRIPT_NAME from
    # the WSGI environment, so the prefix is already included. Only add APPLICATION_ROOT
    # prefix when creating a new request context.
    if in_request_context:
        url = url_for(view, **kwargs)
    else:
        with app.test_request_context():
            url = url_for(view, **kwargs)
            app_root = app.config.get("APPLICATION_ROOT", "/")
            if app_root != "/" and not url.startswith(app_root):
                url = app_root.rstrip("/") + url

    return headless_url(url, user_friendly=user_friendly)


def modify_url_query(url: str, **kwargs: Any) -> str:
    """
    Replace or add parameters to a URL.
    """
    parts = list(urllib.parse.urlsplit(url))
    pairs = urllib.parse.parse_qsl(parts[3], keep_blank_values=True)
    replacements = {
        key: [(key, str(item)) for item in value]
        if isinstance(value, list | tuple)
        else [(key, str(value))]
        for key, value in kwargs.items()
    }
    pending_keys = set(replacements)
    updated_pairs: list[tuple[str, str]] = []

    for key, value in pairs:
        if key not in replacements:
            updated_pairs.append((key, value))
        elif key in pending_keys:
            updated_pairs.extend(replacements[key])
            pending_keys.remove(key)

    for key in kwargs:
        if key in pending_keys:
            updated_pairs.extend(replacements[key])

    parts[3] = urllib.parse.urlencode(
        updated_pairs,
        doseq=True,
        quote_via=urllib.parse.quote,
        safe="/",
    )
    return urllib.parse.urlunsplit(parts)


def is_secure_url(url: str) -> bool:
    """
    Validates if a URL is secure (uses HTTPS).

    :param url: The URL to validate.
    :return: True if the URL uses HTTPS (secure), False if it uses HTTP (non-secure).
    """
    parsed_url = urlparse(url)
    return parsed_url.scheme == "https"
