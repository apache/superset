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
"""Request and response schemas for full data exports."""

from __future__ import annotations

from marshmallow import fields, Schema


class FullExportQueuedResponseSchema(Schema):
    job_id = fields.String(
        metadata={
            "description": (
                "Correlation id of the queued export. Poll "
                "/api/v1/data_export/status/{job_id}/ for its status and, once "
                "ready, its download link."
            )
        }
    )


class FullExportStatusResponseSchema(Schema):
    status = fields.String(
        metadata={
            "description": (
                '"pending" while queued, "running" once a worker has started '
                'executing, "ready" once the file is available, or "error" if '
                "the export failed."
            )
        }
    )
    download_url = fields.String(
        metadata={
            "description": (
                "Origin-relative path of the download, present when the status "
                'is "ready".'
            )
        }
    )
    row_count = fields.Integer(
        metadata={"description": 'Rows in the exported file, present when "ready".'}
    )
    message = fields.String(
        metadata={"description": 'Why the export failed, present when "error".'}
    )


class ChartFullExportPostSchema(Schema):
    """A full export request for a chart.

    The body is the same query context the chart data endpoint accepts, under
    ``query_context``, so the frontend can reuse the payload it already builds
    for a normal export. Its ``row_limit`` is ignored: a full export removes
    the limit by definition.
    """

    query_context = fields.Dict(
        required=True,
        metadata={
            "description": (
                "A chart data query context, as accepted by "
                "/api/v1/chart/data/ (ChartDataQueryContextSchema)."
            )
        },
    )
