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
Availability of the object storage the asynchronous dashboard Excel export needs.

This is the single place that answers "can this deployment run an asynchronous
export?", and it is deliberately the only thing that knows *how* that is
configured. The dashboard API branches on it to pick the export path: with
storage the export is queued and delivered by link, without it the workbook is
built inline and returned as the response.

The answer is derived from configuration rather than exposed as a feature flag,
so there is no second knob that can disagree with the storage settings.
"""

from __future__ import annotations

from flask import current_app


def is_export_storage_configured() -> bool:
    """Whether generated exports can be uploaded somewhere and served by link."""
    return bool(current_app.config["EXCEL_EXPORT_S3_BUCKET"])
