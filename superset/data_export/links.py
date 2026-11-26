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
Status records and download links for full data exports.

Bound to its own ``key_value`` resource and download endpoint, so a full
export's link can never resolve through the dashboard Excel export's endpoint
or the other way round. The link model itself (a Superset endpoint rather
than a signed storage URL, expiring through the store) is documented in
``superset.utils.export_links``.

The download endpoint is intentionally login-free: the requester's access to
the chart or query was checked when they asked for the export, and the
unguessable job id -- emailed only to them -- is the credential. That is the
same model the dashboard Excel export's download endpoint uses.
"""

from __future__ import annotations

from superset.key_value.types import KeyValueResource
from superset.utils.export_links import ExportDownloadLinks

RESOURCE = KeyValueResource.FULL_DATA_EXPORT_DOWNLOAD

DOWNLOAD_PATH = "/api/v1/data_export/download/{job_id}/"

STATUS_PATH = "/api/v1/data_export/status/{job_id}/"

LINKS = ExportDownloadLinks(RESOURCE, DOWNLOAD_PATH)
