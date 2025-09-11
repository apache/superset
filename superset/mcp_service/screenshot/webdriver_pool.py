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
WebDriver connection pooling for improved screenshot performance
"""

import logging
import signal
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from queue import Empty, Full, Queue
from typing import Any, Dict, Generator, Optional

from flask import current_app
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.remote.webdriver import WebDriver

from superset.utils.webdriver import WebDriverSelenium, WindowSize

logger = logging.getLogger(__name__)


class WebDriverCreationError(Exception):
    """Exception raised when WebDriver creation times out"""

    pass


def _timeout_handler(signum: int, frame: Any) -> None:
    """Signal handler for WebDriver creation timeout"""
    raise WebDriverCreationError("WebDriver creation timed out")


@dataclass
class PooledWebDriver:
    """Wrapper for pooled WebDriver instance with metadata"""

    driver: WebDriver
    created_at: float
    last_used: float
    window_size: WindowSize
    user_id: Optional[int] = None
    is_healthy: bool = True
    usage_count: int = 0


class WebDriverPool:
    """
    Connection pool for WebDriver instances to improve screenshot performance.

    Features:
    - Reuses WebDriver instances across requests
    - Automatic health checking and recovery
    - TTL-based expiration to prevent memory leaks
    - Thread-safe operations
    - Per-user driver isolation for security
    """

    def __init__(
        self,
        max_pool_size: int = 5,
        max_age_seconds: int = 3600,  # 1 hour
        max_usage_count: int = 50,  # Recreate after 50 uses
        idle_timeout_seconds: int = 300,  # 5 minutes
        health_check_interval: int = 60,  # 1 minute
        creation_timeout_seconds: int = 30,  # SECURITY FIX: Timeout for driver creation
    ):
        self.max_pool_size = max_pool_size
        self.max_age_seconds = max_age_seconds
        self.max_usage_count = max_usage_count
        self.idle_timeout_seconds = idle_timeout_seconds
        self.health_check_interval = health_check_interval
        self.creation_timeout_seconds = creation_timeout_seconds

        # Thread-safe pool management
        self._pool: Queue[PooledWebDriver] = Queue(maxsize=max_pool_size)
        self._active_drivers: Dict[int, PooledWebDriver] = {}
        self._lock = threading.RLock()
        self._last_health_check = time.time()

        # Pool statistics
        self._stats = {
            "created": 0,
            "destroyed": 0,
            "borrowed": 0,
            "returned": 0,
            "health_check_failures": 0,
            "evictions": 0,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics for monitoring"""
        with self._lock:
            return {
                **self._stats,
                "pool_size": self._pool.qsize(),
                "active_count": len(self._active_drivers),
                "max_pool_size": self.max_pool_size,
            }

    def _create_driver(
        self, window_size: WindowSize, user_id: Optional[int] = None
    ) -> PooledWebDriver:
        """Create a new WebDriver instance with timeout protection"""
        driver = None
        old_handler = None

        try:
            # SECURITY FIX: Set up timeout protection for driver creation
            old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(self.creation_timeout_seconds)

            driver_type = current_app.config.get("WEBDRIVER_TYPE", "firefox")
            selenium_driver = WebDriverSelenium(driver_type, window_size)

            # Create the actual WebDriver with timeout protection
            driver = selenium_driver.create()
            driver.set_window_size(*window_size)

            # Clear the alarm - creation successful
            signal.alarm(0)

            pooled_driver = PooledWebDriver(
                driver=driver,
                created_at=time.time(),
                last_used=time.time(),
                window_size=window_size,
                user_id=user_id,
                is_healthy=True,
                usage_count=0,
            )

            self._stats["created"] += 1
            logger.debug(
                "Created new WebDriver instance for window size %s", window_size
            )
            return pooled_driver

        except WebDriverCreationError:
            logger.error(
                "WebDriver creation timed out after %s seconds",
                self.creation_timeout_seconds,
            )
            if driver:
                try:
                    driver.quit()
                except Exception:
                    logger.debug("Failed to cleanup driver during timeout")
            raise Exception("WebDriver creation timed out") from None

        except Exception as e:
            logger.error("Failed to create WebDriver: %s", e)
            if driver:
                try:
                    driver.quit()
                except Exception:
                    logger.debug("Failed to cleanup driver during error")
            raise

        finally:
            # Restore original signal handler and clear alarm
            signal.alarm(0)
            if old_handler is not None:
                signal.signal(signal.SIGALRM, old_handler)

    def _is_driver_valid(self, pooled_driver: PooledWebDriver) -> bool:
        """Check if a pooled driver is still valid for use"""
        now = time.time()

        # Check age limit
        if now - pooled_driver.created_at > self.max_age_seconds:
            logger.debug("Driver expired due to age")
            return False

        # Check usage count limit
        if pooled_driver.usage_count >= self.max_usage_count:
            logger.debug("Driver expired due to usage count")
            return False

        # Check idle timeout
        if now - pooled_driver.last_used > self.idle_timeout_seconds:
            logger.debug("Driver expired due to idle timeout")
            return False

        # Check if driver is healthy
        if not pooled_driver.is_healthy:
            logger.debug("Driver marked as unhealthy")
            return False

        return True

    def _health_check_driver(self, pooled_driver: PooledWebDriver) -> bool:
        """Perform health check on a WebDriver instance"""
        try:
            # Simple health check - try to get current URL
            # This will fail if the driver is dead/hung
            _ = pooled_driver.driver.current_url
            pooled_driver.is_healthy = True
            return True
        except WebDriverException:
            pooled_driver.is_healthy = False
            self._stats["health_check_failures"] += 1
            logger.warning("WebDriver failed health check")
            return False
        except Exception as e:
            pooled_driver.is_healthy = False
            self._stats["health_check_failures"] += 1
            logger.warning("WebDriver health check error: %s", e)
            return False

    def _destroy_driver(self, pooled_driver: PooledWebDriver) -> None:
        """Safely destroy a WebDriver instance"""
        try:
            WebDriverSelenium.destroy(pooled_driver.driver)
            self._stats["destroyed"] += 1
            logger.debug("Destroyed WebDriver instance")
        except Exception as e:
            logger.warning("Error destroying WebDriver: %s", e)

    def _cleanup_expired_drivers(self) -> None:
        """Remove expired drivers from the pool"""
        expired_drivers = []

        # Check pool for expired drivers
        while not self._pool.empty():
            try:
                pooled_driver = self._pool.get_nowait()
                if self._is_driver_valid(pooled_driver):
                    # Driver is still valid, put it back
                    self._pool.put_nowait(pooled_driver)
                    break
                else:
                    # Driver is expired
                    expired_drivers.append(pooled_driver)
                    self._stats["evictions"] += 1
            except Empty:
                break
            except Full:
                # Pool is full, stop checking
                break

        # Destroy expired drivers
        for pooled_driver in expired_drivers:
            self._destroy_driver(pooled_driver)

    def _periodic_health_check(self) -> None:
        """Perform periodic health checks if needed"""
        now = time.time()
        if now - self._last_health_check < self.health_check_interval:
            return

        self._last_health_check = now
        logger.debug("Performing periodic WebDriver pool health check")

        # Cleanup expired drivers
        self._cleanup_expired_drivers()

        # Health check active drivers
        unhealthy_drivers = []
        for driver_id, pooled_driver in self._active_drivers.items():
            if not self._health_check_driver(pooled_driver):
                unhealthy_drivers.append(driver_id)

        # Remove unhealthy active drivers
        for driver_id in unhealthy_drivers:
            pooled_driver = self._active_drivers.pop(driver_id)
            if pooled_driver:
                self._destroy_driver(pooled_driver)

    @contextmanager
    def get_driver(
        self, window_size: WindowSize, user_id: Optional[int] = None
    ) -> Generator[WebDriver, None, None]:
        """
        Context manager to get a WebDriver from the pool.

        Args:
            window_size: Required window size for the driver
            user_id: Optional user ID for driver isolation

        Yields:
            WebDriver instance ready for use
        """
        pooled_driver = None
        driver_id = None

        try:
            with self._lock:
                # Periodic maintenance
                self._periodic_health_check()

                # Try to get a driver from the pool
                while not self._pool.empty():
                    try:
                        candidate = self._pool.get_nowait()

                        # Check if driver is valid and matches requirements
                        if (
                            self._is_driver_valid(candidate)
                            and candidate.window_size == window_size
                        ):
                            # Update user_id for the reused driver
                            candidate.user_id = user_id
                            pooled_driver = candidate
                            break
                        else:
                            # Driver is invalid, destroy it
                            self._destroy_driver(candidate)
                            self._stats["evictions"] += 1
                    except Empty:
                        break

                # If no suitable driver found, create a new one
                if pooled_driver is None:
                    pooled_driver = self._create_driver(window_size, user_id)

                # Mark driver as in use
                driver_id = id(pooled_driver.driver)
                pooled_driver.last_used = time.time()
                pooled_driver.usage_count += 1
                self._active_drivers[driver_id] = pooled_driver
                self._stats["borrowed"] += 1

            # Yield the driver for use
            yield pooled_driver.driver

        except Exception as e:
            # Mark driver as unhealthy if an error occurred
            if pooled_driver:
                pooled_driver.is_healthy = False
            logger.error("Error using pooled WebDriver: %s", e)
            raise

        finally:
            # Return driver to pool or destroy if unhealthy
            if pooled_driver and driver_id:
                with self._lock:
                    self._active_drivers.pop(driver_id, None)

                    if pooled_driver.is_healthy and self._is_driver_valid(
                        pooled_driver
                    ):
                        # Try to return to pool
                        try:
                            self._pool.put_nowait(pooled_driver)
                            self._stats["returned"] += 1
                            logger.debug("Returned WebDriver to pool")
                        except Full:
                            # Pool is full, destroy the driver
                            self._destroy_driver(pooled_driver)
                            logger.debug("Pool full, destroyed WebDriver")
                    else:
                        # Driver is unhealthy or expired, destroy it
                        self._destroy_driver(pooled_driver)
                        logger.debug("Destroyed unhealthy/expired WebDriver")

    def shutdown(self) -> None:
        """Shutdown the pool and destroy all drivers"""
        with self._lock:
            logger.info("Shutting down WebDriver pool")

            # Destroy all active drivers
            for pooled_driver in self._active_drivers.values():
                self._destroy_driver(pooled_driver)
            self._active_drivers.clear()

            # Destroy all pooled drivers
            while not self._pool.empty():
                try:
                    pooled_driver = self._pool.get_nowait()
                    self._destroy_driver(pooled_driver)
                except Empty:
                    break

            logger.info(
                "WebDriver pool shutdown complete. Final stats: %s", self.get_stats()
            )


# Global pool instance
_global_pool: Optional[WebDriverPool] = None
_pool_lock = threading.Lock()


def get_webdriver_pool() -> WebDriverPool:
    """Get or create the global WebDriver pool"""
    global _global_pool

    if _global_pool is None:
        with _pool_lock:
            if _global_pool is None:
                # Get pool configuration from Flask config
                config = current_app.config
                pool_config = config.get("WEBDRIVER_POOL", {})

                _global_pool = WebDriverPool(
                    max_pool_size=pool_config.get("MAX_POOL_SIZE", 5),
                    max_age_seconds=pool_config.get("MAX_AGE_SECONDS", 3600),
                    max_usage_count=pool_config.get("MAX_USAGE_COUNT", 50),
                    idle_timeout_seconds=pool_config.get("IDLE_TIMEOUT_SECONDS", 300),
                    health_check_interval=pool_config.get("HEALTH_CHECK_INTERVAL", 60),
                )
                logger.info("Initialized global WebDriver pool")

    return _global_pool


def shutdown_webdriver_pool() -> None:
    """Shutdown the global WebDriver pool"""
    global _global_pool

    if _global_pool is not None:
        with _pool_lock:
            if _global_pool is not None:
                _global_pool.shutdown()
                _global_pool = None
