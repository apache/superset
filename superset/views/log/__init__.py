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
from flask_babel import lazy_gettext as _


class LogMixin:  # pylint: disable=too-few-public-methods
    list_title = _("Logs")
    show_title = _("Show Log")
    add_title = _("Add Log")
    edit_title = _("Edit Log")

    list_columns = ["user", "action", "dttm"]
    edit_columns = ["user", "action", "dttm", "json"]
    base_order = ("dttm", "desc")
    label_columns = {
        "user": _("User"),
        "action": _("Action"),
        "dttm": _("dttm"),
        "json": _("JSON"),
    }
