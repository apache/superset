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

logger = logging.getLogger(__name__)

# Sentinel file Flask watches via --extra-files.  Touching it on a real change
# triggers a server reload without depending on cwd or the location of any
# Python source file.
RELOAD_TRIGGER = Path(__file__).resolve().parent / ".reload_trigger"

# Guard to prevent multiple initializations
_watcher_initialized = False
_watcher_lock = threading.Lock()


def _get_file_handler_class() -> Any:  # noqa: C901
    """Get the file handler class, importing watchdog only when needed."""
    try:
        import hashlib

        from watchdog.events import (
            FileCreatedEvent,
            FileModifiedEvent,
            FileMovedEvent,
            FileSystemEventHandler,
        )

        class LocalExtensionFileHandler(FileSystemEventHandler):
            """Custom file system event handler for LOCAL_EXTENSIONS directories.

            Only reacts to genuine content changes (create / modify / move) in the
            dist directory, verified by comparing a SHA-256 of the file's content.
            This avoids the Docker VirtioFS / osxfs problem where reading a file
            generates inotify events that watchdog surfaces as modifications.
            """

            def __init__(self) -> None:
                super().__init__()
                # sha256 of last-seen content, keyed by absolute path. Populated
                # from existing files in watched `dist` dirs at startup (see
                # `prime_baseline`) so that startup-noise inotify events from
                # Docker VirtioFS reads don't get treated as the first real edit.
                self._file_hashes: dict[str, str] = {}
                self._lock = threading.Lock()
                # Trailing debounce: schedule a single reload after a quiet
                # window so simultaneous webpack writes coalesce into one
                # restart that fires *after* the build settles.
                self._debounce_seconds = 1.0
                self._pending_timer: threading.Timer | None = None

            # ── helpers ──────────────────────────────────────────────────────

            @staticmethod
            def _sha256(path: str) -> str | None:
                try:
                    with open(path, "rb") as fh:
                        return hashlib.sha256(fh.read()).hexdigest()
                except OSError:
                    return None

            def prime_baseline(self, watch_dirs: set[str]) -> None:
                """Pre-populate content hashes for existing files in watched
                `dist` directories. Called once at watcher startup so a
                developer's first real edit registers as a content change
                rather than as the file's 'first observation'."""
                for root_dir in watch_dirs:
                    root = Path(root_dir)
                    for path in root.rglob("*"):
                        if not path.is_file():
                            continue
                        if "dist" not in path.parts:
                            continue
                        digest = self._sha256(str(path))
                        if digest is not None:
                            self._file_hashes[str(path)] = digest

            def _content_changed(self, path: str) -> bool:
                """Return True when the file's content differs from last seen.

                With `prime_baseline` called at startup, the baseline reflects
                what was on disk when the watcher started. A first observation
                that differs (or doesn't exist in baseline) is treated as a
                genuine change.
                """
                digest = self._sha256(path)
                if digest is None:
                    return False
                old_digest = self._file_hashes.get(path)
                self._file_hashes[path] = digest
                # New file (not in baseline) is a real change; otherwise compare.
                return old_digest != digest

            def _trigger_reload(self, source_path: str) -> None:
                """Touch the reload-trigger sentinel; Flask's --extra-files
                watcher reloads on its mtime change."""
                logger.info("File change settled in LOCAL_EXTENSIONS: %s", source_path)
                logger.info("Triggering restart by touching %s", RELOAD_TRIGGER)
                try:
                    os.utime(RELOAD_TRIGGER, (time.time(), time.time()))
                except OSError as e:
                    logger.warning(
                        "Failed to touch reload trigger %s: %s", RELOAD_TRIGGER, e
                    )

            def _schedule_reload(self, source_path: str) -> None:
                """Trailing-debounce: cancel any pending reload and schedule a
                new one for `_debounce_seconds` from now. Each new event resets
                the timer, so the reload fires only after a quiet window."""
                with self._lock:
                    if self._pending_timer is not None:
                        self._pending_timer.cancel()
                    timer = threading.Timer(
                        self._debounce_seconds,
                        self._trigger_reload,
                        args=(source_path,),
                    )
                    timer.daemon = True
                    self._pending_timer = timer
                    timer.start()

            # ── event handler ─────────────────────────────────────────────────

            def on_any_event(self, event: Any) -> None:
                """Handle file system events in the watched directories."""
                if event.is_directory:
                    return

                # Only react to true write events; skip access / close / open etc.
                if not isinstance(
                    event, (FileCreatedEvent, FileModifiedEvent, FileMovedEvent)
                ):
                    return

                # For atomic-build move workflows (e.g., webpack writing to
                # tmp + rename into dist) the meaningful path is dest_path.
                # For Create/Modify events watchdog only sets src_path.
                if isinstance(event, FileMovedEvent):
                    target = getattr(event, "dest_path", None) or getattr(
                        event, "src_path", None
                    )
                else:
                    target = getattr(event, "src_path", None)

                if not isinstance(target, str):
                    return

                # Only care about paths inside a `dist` directory.
                if "dist" not in Path(target).parts:
                    return

                # Moves into/out of `dist` are explicit signals — trigger
                # regardless of content match (the source may already be gone
                # or the destination may not have a meaningful hash yet).
                if isinstance(event, FileMovedEvent):
                    self._schedule_reload(target)
                    return

                # For Create/Modify, verify the content actually changed to
                # ignore spurious inotify events generated by Docker bind-mount
                # reads.
                if not self._content_changed(target):
                    return

                self._schedule_reload(target)

        return LocalExtensionFileHandler
    except ImportError:
        logger.warning("watchdog not installed, LOCAL_EXTENSIONS watcher disabled")
        return None


def setup_local_extensions_watcher(app: Flask) -> None:  # noqa: C901
    """Set up file watcher for LOCAL_EXTENSIONS directories."""
    global _watcher_initialized

    # Prevent multiple initializations
    with _watcher_lock:
        if _watcher_initialized:
            return
        _watcher_initialized = True

    # Only set up watcher in debug mode or when Flask reloader is enabled
    if not (app.debug or app.config.get("FLASK_USE_RELOAD", False)):
        return

    # Check if we're running under Flask's reloader to avoid conflicts
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        return

    local_extensions = app.config.get("LOCAL_EXTENSIONS", [])
    if not local_extensions:
        return

    # Try to import watchdog and get handler class
    handler_class = _get_file_handler_class()
    if not handler_class:
        return

    # Collect extension directories to watch
    # We watch the parent extension directory instead of just dist/
    # to avoid the observer stopping when dist/ is deleted/recreated
    # Use a set to avoid duplicate entries
    watch_dirs: set[str] = set()
    for ext_path in local_extensions:
        if not ext_path:
            continue

        ext_path = Path(ext_path).resolve()
        if not ext_path.exists():
            logger.warning("LOCAL_EXTENSIONS path does not exist: %s", ext_path)
            continue

        # Ensure we're watching a directory, not a file
        if ext_path.is_file():
            logger.warning(
                "LOCAL_EXTENSIONS path is a file, not a directory: %s. "
                "Provide the extension directory path instead.",
                ext_path,
            )
            continue

        if not ext_path.is_dir():
            logger.warning("LOCAL_EXTENSIONS path is not a directory: %s", ext_path)
            continue

        # Add to set (automatically handles duplicates)
        watch_dir_str = str(ext_path)
        if watch_dir_str not in watch_dirs:
            watch_dirs.add(watch_dir_str)
            logger.info("Watching LOCAL_EXTENSIONS directory: %s", ext_path)

    if not watch_dirs:
        return

    # Ensure the sentinel exists so os.utime() and Flask's --extra-files watcher
    # both have a real path to operate on.
    try:
        RELOAD_TRIGGER.touch(exist_ok=True)
    except OSError as e:
        logger.warning("Could not create reload trigger %s: %s", RELOAD_TRIGGER, e)
        return

    try:
        from watchdog.observers import Observer

        # Set up and start the file watcher
        event_handler = handler_class()
        # Pre-populate baseline hashes from existing dist files so the
        # developer's first real edit isn't silently dropped as a "first
        # observation".
        event_handler.prime_baseline(watch_dirs)
        observer = Observer()

        for watch_dir in watch_dirs:
            try:
                observer.schedule(event_handler, watch_dir, recursive=True)
            except Exception as e:
                logger.warning("Failed to watch directory %s: %s", watch_dir, e)
                continue

        observer.daemon = True
        observer.start()

        logger.info(
            "LOCAL_EXTENSIONS file watcher started for %s directories",  # noqa: E501
            len(watch_dirs),
        )

    except Exception as e:
        logger.error("Failed to start LOCAL_EXTENSIONS file watcher: %s", e)


def start_local_extensions_watcher_thread(app: Flask) -> None:
    """Start the LOCAL_EXTENSIONS file watcher in a daemon thread."""
    # Start setup in daemon thread if we're in main thread
    if threading.current_thread() is threading.main_thread():
        threading.Thread(
            target=lambda: setup_local_extensions_watcher(app), daemon=True
        ).start()
