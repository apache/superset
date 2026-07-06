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
from typing import Any

from watchdog.events import FileDeletedEvent, FileMovedEvent

from superset.extensions.local_extensions_watcher import _get_file_handler_class


def make_handler() -> Any:
    handler_class = _get_file_handler_class()
    handler = handler_class()
    # Avoid spinning up real debounce timers in unit tests.
    handler._schedule_reload = lambda _path: None
    return handler


def test_delete_evicts_hash_entry() -> None:
    handler = make_handler()
    handler._file_hashes["/ext/dist/old-chunk.abc123.js"] = "digest"

    handler.on_any_event(FileDeletedEvent("/ext/dist/old-chunk.abc123.js"))

    assert "/ext/dist/old-chunk.abc123.js" not in handler._file_hashes


def test_delete_of_untracked_path_is_a_noop() -> None:
    handler = make_handler()

    handler.on_any_event(FileDeletedEvent("/ext/dist/never-seen.js"))

    assert handler._file_hashes == {}


def test_move_out_of_dist_evicts_source_hash_entry() -> None:
    handler = make_handler()
    handler._file_hashes["/ext/dist/chunk.js"] = "digest"

    handler.on_any_event(FileMovedEvent("/ext/dist/chunk.js", "/ext/tmp/chunk.js"))

    assert "/ext/dist/chunk.js" not in handler._file_hashes
