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
"""Local extensions file watcher for development mode."""

from __future__ import annotations

import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

from flask import Flask
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger(__name__)


class LocalExtensionFileHandler(FileSystemEventHandler):
    """Custom file system event handler for LOCAL_EXTENSIONS directories."""

    def on_any_event(self, event: Any) -> None:
        """Handle any file system event in the watched directories."""
        if event.is_directory:
            return

        logger.info(f"File change detected in LOCAL_EXTENSIONS: {event.src_path} - restarting...")

        # Touch superset/__init__.py to trigger Flask's file watcher
        superset_init = Path("superset/__init__.py")
        logger.info(f"Triggering restart by touching {superset_init}")
        os.utime(superset_init, (time.time(), time.time()))


def setup_local_extensions_watcher(app: Flask) -> None:  # noqa: C901
    """Set up file watcher for LOCAL_EXTENSIONS directories."""
    # Only set up watcher in debug mode or when Flask reloader is enabled
    if not (app.debug or app.config.get("FLASK_USE_RELOAD", False)):
        return

    # Check if we're running under Flask's reloader to avoid conflicts
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        return

    local_extensions = app.config.get("LOCAL_EXTENSIONS", [])
    if not local_extensions:
        return

    # Collect dist directories to watch
    watch_dirs = []
    for ext_path in local_extensions:
        if not ext_path:
            continue

        ext_path = Path(ext_path).resolve()
        if not ext_path.exists():
            logger.warning(f"LOCAL_EXTENSIONS path does not exist: {ext_path}")
            continue

        dist_path = ext_path / "dist"
        watch_dirs.append(str(dist_path))
        logger.info(f"Watching LOCAL_EXTENSIONS dist directory: {dist_path}")

    if not watch_dirs:
        return

    try:
        # Set up and start the file watcher
        event_handler = LocalExtensionFileHandler()
        observer = Observer()

        for watch_dir in watch_dirs:
            try:
                observer.schedule(event_handler, watch_dir, recursive=True)
            except Exception as e:
                logger.warning(f"Failed to watch directory {watch_dir}: {e}")
                continue

        observer.daemon = True
        observer.start()

        logger.info(
            f"LOCAL_EXTENSIONS file watcher started for {len(watch_dirs)} directories"  # noqa: E501
        )

    except Exception as e:
        logger.error(f"Failed to start LOCAL_EXTENSIONS file watcher: {e}")


def start_local_extensions_watcher_thread(app: Flask) -> None:
    """Start the LOCAL_EXTENSIONS file watcher in a daemon thread."""
    # Start setup in daemon thread if we're in main thread
    if threading.current_thread() is threading.main_thread():
        threading.Thread(
            target=lambda: setup_local_extensions_watcher(app), daemon=True
        ).start()
