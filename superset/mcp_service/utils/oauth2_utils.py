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

"""
Utilities for handling OAuth2 errors in MCP tools.
"""


def build_oauth2_redirect_message(ex: Exception) -> str:
    """
    Build a user-facing message for OAuth2RedirectError.

    If the exception contains an authorization URL, include it so
    the MCP client can present it to the user for authentication.
    """
    oauth_url = ""
    if hasattr(ex, "error") and hasattr(ex.error, "extra") and ex.error.extra:
        oauth_url = ex.error.extra.get("url", "")

    if oauth_url:
        return (
            "This database uses OAuth for authentication. "
            "Please open the following URL in your browser to "
            "authorize access, then retry this request:\n\n"
            f"{oauth_url}"
        )
    return (
        "This database uses OAuth for authentication. "
        "Please authenticate via the Superset UI first, "
        "then retry this request."
    )


OAUTH2_CONFIG_ERROR_MESSAGE = (
    "OAuth authentication failed due to a configuration "
    "or provider error. "
    "Please contact your Superset administrator."
)
