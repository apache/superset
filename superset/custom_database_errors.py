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

import re
from typing import Any

from superset.errors import SupersetErrorType

# CUSTOM_DATABASE_ERRORS: Configure custom error messages for database exceptions.
# Transform raw database errors into user-friendly messages with optional documentation
# links using custom_doc_links. Set show_issue_info=False to hide default error codes.
# Example:
# CUSTOM_DATABASE_ERRORS = {
#     "trino": {
#         re.compile(r'message="(?P<message>[^"]*)"'): (
#             __(
#                 'Unexpected error: "%(message)s"'
#             ),
#             SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
#             {
#                 "custom_doc_links": [
#                     {
#                         "url": "https://example.com/docs/1",
#                         "label": "Check documentation"
#                     },
#                 ],
#                 "show_issue_info": False,
#             }
#         )
#     }
# }

CUSTOM_DATABASE_ERRORS: dict[
    str, dict[re.Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]]
] = {}
