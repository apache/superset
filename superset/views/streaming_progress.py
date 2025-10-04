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

"""Thread-safe progress tracking for streaming CSV exports."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ExportProgress:
    """Progress information for a streaming export."""

    export_id: str
    status: str = "streaming"  # streaming, completed, error
    rows_processed: int = 0
    total_rows: int | None = None
    bytes_processed: int = 0
    elapsed_time: float = 0.0
    start_time: float = 0.0
    error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON response."""
        percentage = None
        if self.total_rows and self.total_rows > 0:
            percentage = round((self.rows_processed / self.total_rows) * 100, 1)

        # Calculate speeds
        speed_rows_per_sec = 0.0
        speed_mb_per_sec = 0.0
        if self.elapsed_time > 0:
            speed_rows_per_sec = self.rows_processed / self.elapsed_time
            speed_mb_per_sec = (self.bytes_processed / self.elapsed_time) / (
                1024 * 1024
            )

        return {
            "export_id": self.export_id,
            "status": self.status,
            "rows_processed": self.rows_processed,
            "total_rows": self.total_rows,
            "bytes_processed": self.bytes_processed,
            "elapsed_time": round(self.elapsed_time, 2),
            "percentage": percentage,
            "speed_rows_per_sec": round(speed_rows_per_sec, 2),
            "speed_mb_per_sec": round(speed_mb_per_sec, 3),
            "error_message": self.error_message,
        }


class StreamingProgressTracker:
    """
    Thread-safe singleton for tracking streaming export progress.

    This allows the streaming generator to update progress while a separate
    polling endpoint reads the current state without blocking the stream.
    """

    _instance: StreamingProgressTracker | None = None
    _lock = threading.Lock()

    def __new__(cls) -> StreamingProgressTracker:
        """Singleton pattern to ensure single instance."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        """Initialize the progress tracker."""
        if self._initialized:
            return

        self._progress_map: dict[str, ExportProgress] = {}
        self._progress_lock = threading.Lock()
        self._cleanup_interval = 300  # Cleanup after 5 minutes
        self._last_cleanup = time.time()
        self._initialized = True

        logger.info("✅ StreamingProgressTracker initialized")

    def create_export(
        self, export_id: str, total_rows: int | None = None
    ) -> None:
        """Create a new export progress entry."""
        with self._progress_lock:
            self._progress_map[export_id] = ExportProgress(
                export_id=export_id,
                total_rows=total_rows,
                start_time=time.time(),
            )
            logger.info(
                "📊 Created progress tracker for export: %s (expected %s rows)",
                export_id,
                total_rows or "unknown",
            )

    def update_progress(
        self,
        export_id: str,
        rows_processed: int,
        bytes_processed: int,
    ) -> None:
        """Update progress for an export."""
        with self._progress_lock:
            if export_id not in self._progress_map:
                logger.warning("⚠️ Export ID not found: %s", export_id)
                return

            progress = self._progress_map[export_id]
            progress.rows_processed = rows_processed
            progress.bytes_processed = bytes_processed
            progress.elapsed_time = time.time() - progress.start_time

    def complete_export(self, export_id: str) -> None:
        """Mark export as completed."""
        with self._progress_lock:
            if export_id in self._progress_map:
                self._progress_map[export_id].status = "completed"
                self._progress_map[export_id].elapsed_time = (
                    time.time() - self._progress_map[export_id].start_time
                )
                logger.info("✅ Export completed: %s", export_id)

    def fail_export(self, export_id: str, error_message: str) -> None:
        """Mark export as failed."""
        with self._progress_lock:
            if export_id in self._progress_map:
                self._progress_map[export_id].status = "error"
                self._progress_map[export_id].error_message = error_message
                self._progress_map[export_id].elapsed_time = (
                    time.time() - self._progress_map[export_id].start_time
                )
                logger.error("❌ Export failed: %s - %s", export_id, error_message)

    def get_progress(self, export_id: str) -> dict[str, Any] | None:
        """Get current progress for an export."""
        with self._progress_lock:
            progress = self._progress_map.get(export_id)
            if progress:
                # Update elapsed time before returning
                progress.elapsed_time = time.time() - progress.start_time
                return progress.to_dict()
            return None

    def cleanup_old_exports(self, max_age_seconds: int = 300) -> None:
        """Remove old completed/failed exports to prevent memory leaks."""
        current_time = time.time()

        # Only cleanup periodically
        if current_time - self._last_cleanup < self._cleanup_interval:
            return

        with self._progress_lock:
            to_remove = []
            for export_id, progress in self._progress_map.items():
                age = current_time - progress.start_time
                if age > max_age_seconds and progress.status in ["completed", "error"]:
                    to_remove.append(export_id)

            for export_id in to_remove:
                del self._progress_map[export_id]

            self._last_cleanup = current_time

            if to_remove:
                logger.info(
                    "🧹 Cleaned up %d old exports, %d active remaining",
                    len(to_remove),
                    len(self._progress_map),
                )


# Global singleton instance
progress_tracker = StreamingProgressTracker()
