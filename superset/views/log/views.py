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
# pylint: disable=C,R,W
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __

import superset.models.core as models
from superset import app, appbuilder
from superset.views.base import SupersetModelView

from . import LogMixin


class LogModelView(LogMixin, SupersetModelView):
    datamodel = SQLAInterface(models.Log)


if (
    not app.config.get("FAB_ADD_SECURITY_VIEWS") is False
    or app.config.get("SUPERSET_LOG_VIEW") is False
):
    appbuilder.add_view(
        LogModelView,
        "Action Log",
        label=__("Action Log"),
        category="Security",
        category_label=__("Security"),
        icon="fa-list-ol",
    )
