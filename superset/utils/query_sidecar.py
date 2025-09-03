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
Query Sidecar Client

Provides functionality to communicate with the Node.js sidecar service
that generates QueryObjects from form_data, eliminating staleness issues
in Alerts & Reports.
"""

import logging
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import requests
from flask import current_app

from superset.common.query_object import QueryObject
from superset.exceptions import SupersetException

logger = logging.getLogger(__name__)


class QuerySidecarException(SupersetException):
    """Exception raised when the query sidecar service fails."""


class QuerySidecarClient:
    """
    Client for communicating with the Node.js query sidecar service.

    This client transforms form_data into QueryObject format using the same
    logic as the frontend, ensuring consistency and eliminating staleness.
    """

    def __init__(self, base_url: Optional[str] = None, timeout: int = 10) -> None:
        """
        Initialize the query sidecar client.

        Args:
            base_url: Base URL of the sidecar service. If None, reads from config.
            timeout: Request timeout in seconds.
        """
        self._base_url = base_url or current_app.config.get(
            "QUERY_SIDECAR_BASE_URL", "http://localhost:3001"
        )
        self._timeout = timeout
        self._session = requests.Session()

        # Set default headers
        self._session.headers.update(
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def build_query_object(
        self, form_data: Dict[str, Any], query_fields: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Build a QueryObject from form_data using the sidecar service.

        Args:
            form_data: The form data from Superset frontend/chart configuration
            query_fields: Optional query field aliases for visualization-specific
                mappings

        Returns:
            Dict containing the QueryObject data

        Raises:
            QuerySidecarException: If the service is unavailable or returns an error
        """
        if not form_data:
            raise QuerySidecarException("form_data is required")

        # Validate required form_data fields
        if not form_data.get("datasource") or not form_data.get("viz_type"):
            raise QuerySidecarException(
                "form_data must include datasource and viz_type"
            )

        url = urljoin(self._base_url, "/api/v1/query-object")
        payload = {
            "form_data": form_data,
            "query_fields": query_fields,
        }

        try:
            logger.debug("Calling sidecar service at %s", url)
            response = self._session.post(url, json=payload, timeout=self._timeout)
            response.raise_for_status()

            data = response.json()
            if "error" in data:
                raise QuerySidecarException(f"Sidecar service error: {data['error']}")

            return data["query_object"]

        except requests.exceptions.Timeout as ex:
            logger.error("Timeout calling query sidecar service")
            raise QuerySidecarException(
                "Query sidecar service timeout. Please check service availability."
            ) from ex
        except requests.exceptions.ConnectionError as ex:
            logger.error("Connection error calling query sidecar service")
            raise QuerySidecarException(
                "Unable to connect to query sidecar service. "
                "Please check service availability."
            ) from ex
        except requests.exceptions.HTTPError as ex:
            logger.error("HTTP error calling query sidecar service: %s", ex)
            if ex.response.status_code >= 500:
                raise QuerySidecarException(
                    "Query sidecar service is experiencing issues. "
                    "Please try again later."
                ) from ex
            else:
                try:
                    error_data = ex.response.json()
                    error_message = error_data.get("error", str(ex))
                except (ValueError, KeyError):
                    error_message = str(ex)
                raise QuerySidecarException(
                    f"Query sidecar service error: {error_message}"
                ) from ex
        except Exception as ex:
            logger.error("Unexpected error calling query sidecar service: %s", ex)
            raise QuerySidecarException(
                f"Unexpected error communicating with query sidecar service: {ex}"
            ) from ex

    def create_query_object_from_form_data(
        self,
        form_data: Dict[str, Any],
        query_fields: Optional[Dict[str, str]] = None,
        datasource: Optional[Any] = None,
    ) -> QueryObject:
        """
        Create a QueryObject instance from form_data using the sidecar service.

        This is a convenience method that returns a QueryObject instance
        rather than raw dictionary data.

        Args:
            form_data: The form data from Superset frontend/chart configuration
            query_fields: Optional query field aliases for visualization-specific
                mappings
            datasource: Optional datasource instance to attach to the QueryObject

        Returns:
            QueryObject instance

        Raises:
            QuerySidecarException: If the service is unavailable or returns an error
        """
        query_data = self.build_query_object(form_data, query_fields)

        # Create QueryObject instance from the returned data
        # Convert the dictionary to QueryObject constructor parameters
        query_object = QueryObject(
            datasource=datasource,
            columns=query_data.get("columns"),
            metrics=query_data.get("metrics"),
            filters=query_data.get("filters", []),
            granularity=query_data.get("granularity"),
            extras=query_data.get("extras", {}),
            orderby=query_data.get("orderby", []),
            annotation_layers=query_data.get("annotation_layers", []),
            row_limit=query_data.get("row_limit"),
            row_offset=query_data.get("row_offset"),
            series_columns=query_data.get("series_columns"),
            series_limit=query_data.get("series_limit", 0),
            series_limit_metric=query_data.get("series_limit_metric"),
            order_desc=query_data.get("order_desc", True),
            time_range=query_data.get("time_range"),
        )

        return query_object

    def health_check(self) -> bool:
        """
        Check if the sidecar service is healthy.

        Returns:
            True if service is healthy, False otherwise
        """
        try:
            url = urljoin(self._base_url, "/health")
            response = self._session.get(url, timeout=5)
            response.raise_for_status()

            data = response.json()
            return data.get("status") == "healthy"

        except Exception as ex:
            logger.warning("Query sidecar health check failed: %s", ex)
            return False


# Global client instance
_sidecar_client: Optional[QuerySidecarClient] = None


def get_query_sidecar_client() -> QuerySidecarClient:
    """
    Get the global query sidecar client instance.

    Returns:
        QuerySidecarClient instance
    """
    global _sidecar_client

    if _sidecar_client is None:
        _sidecar_client = QuerySidecarClient()

    return _sidecar_client


def build_query_object_from_form_data(
    form_data: Dict[str, Any],
    query_fields: Optional[Dict[str, str]] = None,
    datasource: Optional[Any] = None,
) -> QueryObject:
    """
    Convenience function to build a QueryObject from form_data using the sidecar
    service.

    Args:
        form_data: The form data from Superset frontend/chart configuration
        query_fields: Optional query field aliases for visualization-specific mappings
        datasource: Optional datasource instance to attach to the QueryObject

    Returns:
        QueryObject instance

    Raises:
        QuerySidecarException: If the service is unavailable or returns an error
    """
    client = get_query_sidecar_client()
    return client.create_query_object_from_form_data(
        form_data, query_fields, datasource
    )
