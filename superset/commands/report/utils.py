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


def remove_post_processed(url: str) -> str:
    """Remove the type=post_processed parameter from the URL query string.

    Args:
        url (str): The URL to process.
    Returns:
        str: The URL with the type=post_processed parameter removed."""
    if "?" not in url:
        return url
    base_url, query_string = url.split("?", 1)
    params = query_string.split("&")
    filtered_params = [param for param in params if param != "type=post_processed"]
    filtered_query_string = "&".join(filtered_params)
    filtered_url = f"{base_url}?{filtered_query_string}"
    return filtered_url
