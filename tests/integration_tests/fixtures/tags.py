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

import pytest

from superset import db
from superset.tags.core import register_sqla_event_listeners
from superset.tags.models import Tag
from tests.integration_tests.test_app import app


@pytest.fixture
def with_tagging_system_feature():
    was_enabled = app.config["DEFAULT_FEATURE_FLAGS"]["TAGGING_SYSTEM"]
    app.config["DEFAULT_FEATURE_FLAGS"]["TAGGING_SYSTEM"] = True
    # Idempotent: SQLAlchemy keys listeners by (target, event, fn), so
    # re-registering on top of the app-startup registration is a no-op. Calling
    # it keeps these tests independent of whether startup registration ran (it
    # is skipped when the metadata DB is behind on migrations).
    register_sqla_event_listeners()
    try:
        yield
    finally:
        # Only the flag is restored. The listeners are shared app-level state
        # that startup registered unconditionally, and they check the flag when
        # they fire, so unregistering here would break every later test.
        app.config["DEFAULT_FEATURE_FLAGS"]["TAGGING_SYSTEM"] = was_enabled


@pytest.fixture
def create_custom_tags():
    with app.app_context():
        tags: list[Tag] = []
        for tag_name in {"first_tag", "second_tag", "third_tag"}:
            tag = Tag(
                name=tag_name,
                type="custom",
            )
            db.session.add(tag)
            db.session.commit()
            tags.append(tag)

        yield tags

        for tags in tags:  # noqa: B020
            db.session.delete(tags)
        db.session.commit()


# Helper function to return filter parameters
def get_filter_params(opr, value):
    return {
        "filters": [
            {
                "col": "tags",
                "opr": opr,
                "value": value,
            }
        ]
    }
