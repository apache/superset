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
"""Server-side routes for the review workflow's own pages."""

from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


# Both of this extension's screens used to be registered here by hand, so
# their URLs resolved on a cold load. They are now declared in
# `extension.json` under `contributions.pages`: the host registers the rule,
# checks the path against everything the deployment already serves, and
# renders the shell.
