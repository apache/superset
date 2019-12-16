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
# pylint: disable=C,R,W

import json
import logging

from flask import flash
from requests import get, HTTPError, RequestException, Timeout

from superset.exceptions import NoAPIKeySuppliedException


class BaseGeocoder(object):
    """ Base class from which all geocoders inherit
    """

    logger = logging.getLogger(__name__)
    interruptflag = False
    conf: dict = {}
    progress: dict = {}

    def __init__(self, config: dict):
        self.conf = config
        self._set_initial_states()

    def geocode(self, data: list):
        raise NotImplementedError

    def _append_cords_to_data_entry(self, data_entry: list, geocoded: list):
        raise NotImplementedError

    def _set_initial_states(self):
        self.interruptflag = False
        self.progress["success_counter"] = 0
        self.progress["doubt_counter"] = 0
        self.progress["failed_counter"] = 0
        self.progress["is_in_progress"] = False
        self.progress["progress"] = 0

    def _set_dict(self):
        self.progress["is_in_progress"] = False
        success_dict = {
            "success": self.progress["success_counter"],
            "doubt": self.progress["doubt_counter"],
            "failed": self.progress["failed_counter"],
        }
        return success_dict

    def _geocode(self, data: list) -> list:
        """
        geocode the data using the Maptiler API
        :param data: the addresses to be geocoded as a list of tuples
        :return: a dictionary containing the addresses and their long,lat values
        """

        geocoded_data: list = []
        counter: int = 0
        exceptions: int = 0
        self._set_initial_states()

        for data_entry in data:
            try:
                if self.interruptflag:
                    self.progress["progress"] = 0
                    self.progress["is_in_progress"] = False
                    message = "successfully interrupted geocoding"
                    flash(message, "success")
                    return [message, [geocoded_data, self._set_dict()]]
                data_entry = list(map(str, data_entry))
                address = " ".join(data_entry)
                geocoded = self._get_coordinates_from_address(address)
                if geocoded is not None:
                    data_entry = self._append_cords_to_data_entry(data_entry, geocoded)
                    geocoded_data.append(data_entry)
                else:
                    self.progress["failed_counter"] += 1
                counter += 1

                self.progress["progress"] = counter / len(data)
                exceptions = 0

            except (ConnectionError, HTTPError, Timeout, RequestException) as e:
                exceptions += 1
                self.logger.exception(
                    f"Geocoding API returned an exception for address: {address}, message; {e}"
                )
            # this catch-all is needed so that we can always return the data geocoded so far in order to save it
            # if the user set this flag
            except Exception as e:  # pylint: disable=broad-except
                exceptions += 1
                self.logger.exception(
                    f"Unknown exception for address: {address} "
                    f"exception message: {e}"
                )
            if counter == 0 and exceptions == 1:
                message = f"First request to geocoding API returned an Error, aborting"
                flash(message, "error")
                return [message, [geocoded_data, self._set_dict()]]
            if exceptions >= 2:
                message = f"Geocoding API returned 2 errors in a row, aborting"
                flash(message, "error")
                return [message, [geocoded_data, self._set_dict()]]

        self.progress["progress"] = 100
        return ["", [geocoded_data, self._set_dict()]]

    def _get_coordinates_from_address(self, address: str):
        raise NotImplementedError

    def check_api_key(self):
        raise NotImplementedError


class MapTilerGeocoder(BaseGeocoder):
    """ The MapTiler geocoder"""

    def __init__(self, config: dict):
        BaseGeocoder.__init__(self, config)

    def _get_coordinates_from_address(self, address: str):
        base_url = "https://api.maptiler.com/geocoding/"
        response = get(
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

    def geocode(self, data: list):
        try:
            return self._geocode(data)
        finally:
            self.progress["progress"] = 0
            self.progress["is_in_progress"] = False

    def check_api_key(self):
        if not self.conf["MAPTILER_API_KEY"]:
            raise NoAPIKeySuppliedException("No API Key for MapTiler was supplied")

    def _append_cords_to_data_entry(self, data_entry: list, geocoded: list):
        center_coordinates = geocoded[0]
        relevance = geocoded[1]
        if relevance > 0.8:
            self.progress["success_counter"] += 1
        elif relevance > 0.49:
            self.progress["doubt_counter"] += 1
        else:
            self.progress["failed_counter"] += 1
        data_entry.append(str(center_coordinates[0]))
        data_entry.append(str(center_coordinates[1]))
        return data_entry


class TestingGeoCoder(BaseGeocoder):
    def check_api_key(self):
        pass
