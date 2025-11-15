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
Utility functions for Azure Blob Storage operations.
Used to store report/alert attachments in Azure Blob Storage.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from flask import current_app

logger = logging.getLogger(__name__)


def upload_to_azure_blob(
    file_data: bytes,
    file_name: str,
    content_type: str = "application/octet-stream",
) -> Optional[str]:
    """
    Upload a file to Azure Blob Storage and return the blob URL.

    :param file_data: The file content as bytes
    :param file_name: The name of the file to store
    :param content_type: MIME type of the file
    :return: The URL of the uploaded blob, or None if upload fails
    """
    try:
        # Import azure-storage-blob only when needed to avoid hard dependency
        from azure.storage.blob import BlobServiceClient, ContentSettings

        # Get Azure Blob Storage configuration from app config
        connection_string = current_app.config.get("AZURE_BLOB_CONNECTION_STRING")
        container_name = current_app.config.get(
            "AZURE_BLOB_REPORTS_CONTAINER", "superset-reports"
        )

        if not connection_string:
            logger.warning(
                "Azure Blob Storage is not configured. "
                "Set AZURE_BLOB_CONNECTION_STRING in config."
            )
            return None

        # Create BlobServiceClient
        blob_service_client = BlobServiceClient.from_connection_string(
            connection_string
        )

        # Get container client (create if doesn't exist)
        container_client = blob_service_client.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()
            logger.info(f"Created Azure Blob container: {container_name}")

        # Generate unique blob name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        blob_name = f"{timestamp}_{file_name}"

        # Upload the blob
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(
            file_data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )

        blob_url = blob_client.url
        logger.info(f"Successfully uploaded file to Azure Blob: {blob_url}")
        return blob_url

    except ImportError:
        logger.error(
            "azure-storage-blob package is not installed. "
            "Install it with: pip install azure-storage-blob"
        )
        return None
    except Exception as ex:
        logger.error(f"Failed to upload file to Azure Blob Storage: {str(ex)}")
        return None


def generate_blob_sas_url(
    blob_url: str, expiry_hours: int = 168
) -> Optional[str]:  # 7 days default
    """
    Generate a SAS (Shared Access Signature) URL for a blob with read permissions.
    This allows temporary access to the blob without making it public.

    :param blob_url: The URL of the blob
    :param expiry_hours: Number of hours until the SAS token expires (default 7 days)
    :return: The blob URL with SAS token, or original URL if SAS generation fails
    """
    try:
        from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
        from datetime import timezone

        connection_string = current_app.config.get("AZURE_BLOB_CONNECTION_STRING")
        if not connection_string:
            logger.warning("Azure Blob Storage connection string not configured")
            return blob_url

        # Parse connection string to get account name and key
        conn_dict = dict(item.split("=", 1) for item in connection_string.split(";") if "=" in item)
        account_name = conn_dict.get("AccountName")
        account_key = conn_dict.get("AccountKey")

        if not account_name or not account_key:
            logger.warning("Could not extract account credentials from connection string")
            return blob_url

        # Extract container and blob name from URL
        # URL format: https://{account}.blob.core.windows.net/{container}/{blob}
        url_parts = blob_url.replace(f"https://{account_name}.blob.core.windows.net/", "").split("/", 1)
        if len(url_parts) != 2:
            logger.warning(f"Could not parse blob URL: {blob_url}")
            return blob_url

        container_name, blob_name = url_parts

        # Generate SAS token
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(hours=expiry_hours),
        )

        sas_url = f"{blob_url}?{sas_token}"
        return sas_url

    except ImportError:
        logger.error("azure-storage-blob package is not installed")
        return blob_url
    except Exception as ex:
        logger.error(f"Failed to generate SAS URL: {str(ex)}")
        return blob_url


def upload_report_attachments(
    csv_data: Optional[bytes] = None,
    pdf_data: Optional[bytes] = None,
    screenshots: Optional[list[bytes]] = None,
    report_name: str = "report",
) -> dict[str, str]:
    """
    Upload multiple report attachments to Azure Blob Storage.

    :param csv_data: CSV file data
    :param pdf_data: PDF file data
    :param screenshots: List of screenshot images
    :param report_name: Base name for the report files
    :return: Dictionary with attachment types as keys and blob URLs as values
    """
    urls = {}

    # Upload CSV if available
    if csv_data:
        csv_url = upload_to_azure_blob(
            csv_data, f"{report_name}.csv", "text/csv"
        )
        if csv_url:
            urls["csv"] = generate_blob_sas_url(csv_url) or csv_url

    # Upload PDF if available
    if pdf_data:
        pdf_url = upload_to_azure_blob(
            pdf_data, f"{report_name}.pdf", "application/pdf"
        )
        if pdf_url:
            urls["pdf"] = generate_blob_sas_url(pdf_url) or pdf_url

    # Upload screenshots if available
    if screenshots:
        screenshot_urls = []
        for idx, screenshot in enumerate(screenshots, 1):
            screenshot_url = upload_to_azure_blob(
                screenshot, f"{report_name}_screenshot_{idx}.png", "image/png"
            )
            if screenshot_url:
                sas_url = generate_blob_sas_url(screenshot_url)
                screenshot_urls.append(sas_url or screenshot_url)

        if screenshot_urls:
            urls["screenshots"] = screenshot_urls

    return urls
