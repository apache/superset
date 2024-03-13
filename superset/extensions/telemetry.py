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

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import TypedDict


class TelemetryItem(TypedDict):
    name: str
    start: float
    end: float | None
    children: list[TelemetryItem]


class TelemetryHandler:  # pylint: disable=too-few-public-methods
    """
    Handler for telemetry events.

    To use this, decorate an endpoint with `@show_telemetry`:

        @expose("/")
        @show_telemetry
        def some_endpoint() -> str:
            with g.telemetry("Computation"):
                output = {"answer": some_computation()}

            return jsonify(output)

        def some_computation() -> int:
            with g.telemetry("Crunching numbers"):
                return magic()

    The response payload will then look like this:

        {
            # original response
            "answer": 42,

            # added telemetry
            "telemetry": [
                {
                    "name": "Computation",
                    "start": 1710360466.328792,
                    "end": 1710360472.7976031,
                    "children": [
                        {
                            "name": "Crunching numbers",
                            "start": 1710360468.401769,
                            "end": 1710360470.532115,
                            "children": [],
                        },
                    ],
                },
            },
        }

    """

    def __init__(self) -> None:
        self.events: list[TelemetryItem] = []
        self.root = self.events

    @contextmanager
    def __call__(self, name: str) -> Iterator[None]:
        event: TelemetryItem = {
            "name": name,
            "start": time.time(),
            "end": None,
            "children": [],
        }
        self.root.append(event)
        previous = self.root
        self.root = event["children"]
        try:
            yield
        finally:
            event["end"] = time.time()
            self.root = previous
