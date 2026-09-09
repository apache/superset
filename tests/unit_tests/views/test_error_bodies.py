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
"""sc-120052: error-response bodies must carry their message.

``json_error_response`` used to set ``payload["error"]`` only for exact
``str`` arguments; a flask-babel ``lazy_gettext`` proxy (LazyString) failed
that isinstance check and the body silently degraded to ``{}`` while the
status still said "denied". Five live call sites in ``superset/views``
shipped empty 403/404 bodies that way. Pins: the helper now coerces
string-like proxies, and a binding-aware source scan keeps lazy ``_()``
out of error bodies at the call sites (the eager alias stays preferred —
the coercion is the safety net, not the convention).
"""

import pathlib
import re
from typing import cast

from flask import Response
from flask_babel import lazy_gettext

from superset.utils import json


def test_json_error_response_carries_lazy_string_message(app_context) -> None:
    """A LazyString body must not degrade to {} (the sc-120052 bug)."""
    from superset.views.error_handling import json_error_response

    resp = cast(
        Response,
        json_error_response(lazy_gettext("permalink state not found"), status=404),
    )

    body = json.loads(resp.get_data(as_text=True))
    assert body.get("error") == "permalink state not found"
    assert resp.status_code == 404


def test_json_error_response_still_carries_plain_str(app_context) -> None:
    from superset.views.error_handling import json_error_response

    resp = cast(Response, json_error_response("nope", status=403))

    assert json.loads(resp.get_data(as_text=True)).get("error") == "nope"


def test_no_lazy_gettext_reaches_json_error_response() -> None:
    """Binding-aware source tripwire for the call-site convention.

    In any module that binds ``_`` to ``lazy_gettext``, an error body built
    as ``json_error_response(_(...))`` is the sc-120052 bug shape. The
    helper now coerces (see the tests above), so this scan guards the
    convention rather than correctness — if it fires, switch the site to
    the eager ``__()`` alias.
    """
    pattern = re.compile(r"json_error_response\(\s*_\(", re.S)
    offenders: list[str] = []
    for path in pathlib.Path("superset").rglob("*.py"):
        source = path.read_text(errors="ignore")
        if "json_error_response" not in source:
            continue
        if not re.search(r"lazy_gettext as _\b", source):
            continue
        for match in pattern.finditer(source):
            line = source.count("\n", 0, match.start()) + 1
            offenders.append(f"{path}:{line}")
    assert not offenders, f"lazy _() passed to json_error_response at: {offenders}"
