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
import json
import logging
import time

import requests
from requests import HTTPError, RequestException, Timeout

from superset.exceptions import NoAPIKeySuppliedException


class GeocoderUtil:  # pylint: disable=too-few-public-methods
    """
    The GeoCoder object holds the logic for geocoding given data
    """

    logger = logging.getLogger(__name__)
    interruptflag = False
    conf: dict = {}
    progress: dict = {}

    def __init__(self, config):
        self.conf = config

    def geocode(self, geocoder: str, data: list):
        try:
            if geocoder == "MapTiler":
                return self._geocode_maptiler(data)
            return []
        except Exception as e:
            raise e
        finally:
            self.progress["progress"] = 0
            self.progress["is_in_progress"] = False

    def _geocode_maptiler(self, data: list) -> list:
        """
        geocode the data using the Maptiler API
        :param data: the addresses to be geocoded as a list of tuples
        :return: a dictionary containing the addresses and their long,lat values
        """
        if not self.conf["MAPTILER_API_KEY"]:
            raise NoAPIKeySuppliedException("No API Key for MapTiler was supplied")
        geocoded_data: list = []
        data_length: int = len(data)
        counter: int = 0
        self.progress["success_counter"] = 0
        self.progress["doubt_counter"] = 0
        self.progress["failed_counter"] = 0
        self.progress["is_in_progress"] = True
        self.progress["progress"] = 0

        for datum in data:
            try:
                if self.interruptflag:
                    self.interruptflag = False
                    self.progress["progress"] = 0
                    self.progress["is_in_progress"] = False
                    return geocoded_data
                datum = list(map(str, datum))
                address = " ".join(datum)
                geocoded = self._get_coordinates_from_address(address)
                if geocoded is not None:
                    center_coordinates = geocoded[0]
                    relevance = geocoded[1]
                    if relevance > 0.8:
                        self.progress["success_counter"] += 1
                    elif relevance > 0.49:
                        self.progress["doubt_counter"] += 1
                    else:
                        self.progress["failed_counter"] += 1
                    datum.append(str(center_coordinates[0]))
                    datum.append(str(center_coordinates[1]))
                    geocoded_data.append(datum)
                else:
                    self.progress["failed_counter"] += 1

                counter += 1
                self.progress["progress"] = counter / data_length
            except ConnectionError as e:
                self.logger.exception(
                    f"Geocoding ConnectionError for address: {address} "
                    f"exception-message: {e}"
                )
            except HTTPError as e:
                self.logger.exception(
                    f"Geocoding HTTPError for address: {address} exception-message: {e}"
                )
            except Timeout as e:
                self.logger.exception(
                    f"Geocoding Timeout for address: {address} exception-message: {e}"
                )
            except RequestException as e:
                self.logger.exception(
                    f"Geocoding RequestException for address: {address} "
                    f"exception-message: {e}"
                )

        self.progress["progress"] = 100
        self.progress["is_in_progress"] = False
        success_dict = {
            "success": self.progress["success_counter"],
            "doubt": self.progress["doubt_counter"],
            "failed": self.progress["failed_counter"],
        }
        return [geocoded_data, success_dict]

    def _get_coordinates_from_address(self, address: str):
        base_url = "https://api.maptiler.com/geocoding/"
        response = requests.get(
            base_url + address + ".json?key=" + self.conf["MAPTILER_API_KEY"]
        )
        decoded_data = json.loads(response.content.decode())
        features = decoded_data["features"]
        if features:
            feature = features[0]
            center = feature["center"]
            relevance = feature["relevance"]
            return [center, relevance] or None
        return None

class GeocoderUtilMock(GeocoderUtil):  # pylint: disable=too-few-public-methods
    geocoded_data = {
        "Oberseestrasse 10 Rapperswil Switzerland": [47.224, 8.8181],
        "Grossmünsterplatz Zürich Switzerland": [47.370, 8.544],
        "Uetliberg Zürich Switzerland": [47.353, 8.492],
        "Zürichbergstrasse 221 Zürich Switzerland": [47.387, 8.574],
        "Bahnhofstrasse Zürich Switzerland": [47.372, 8.539],
    }

    def _get_coordinates_from_address(self, address):
        time.sleep(2)
        return [self.geocoded_data.get(address), 0.8]