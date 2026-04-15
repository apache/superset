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
from flask_appbuilder import ModelView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.subjects.models import Subject


class SubjectModelView(ModelView):
    """Read-only admin view for Subjects."""

    datamodel = SQLAInterface(Subject)
    route_base = "/subject"

    list_title = _("Subjects")
    show_title = _("Subject")

    list_columns = ["id", "name", "label", "type", "active"]
    show_columns = [
        "id",
        "uuid",
        "name",
        "label",
        "type",
        "active",
        "extra_search",
        "user",
        "role",
        "group",
    ]
    search_exclude_columns = ["user", "role", "group"]

    # Read-only: disable create/edit/delete
    can_add = False
    can_edit = False
    can_delete = False
