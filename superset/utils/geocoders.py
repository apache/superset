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

    def geocode(self, data: list) -> list:
        """
        Runs the geocoding and resets the state
        :param data: The data to geocode
        """
        try:
            return self._geocode(data)
        finally:
            self.progress["progress"] = 0
            self.progress["is_in_progress"] = False

    def _append_cords_to_data_entry(self, data_entry: list, geocoded: list) -> list:
        """
        Appends the lat/lon coordinates to the data entry
        :param data_entry: The data entry
        :param geocoded: The geocoded values to add (0: lat, 1: lon)
        """
        coordinates = geocoded[0]
        relevance = geocoded[1]
        if relevance > 0.8:
            self.progress["success_counter"] += 1
        elif relevance > 0.49:
            self.progress["doubt_counter"] += 1
        else:
            self.progress["failed_counter"] += 1
        data_entry.append(str(coordinates[0]))
        data_entry.append(str(coordinates[1]))
        return data_entry

    def _set_initial_states(self, in_progress=False) -> None:
        """
        Sets the initial state of the progress
        :param in_progress: If the geocoding is in progress
        """
        self.interruptflag = False
        self.progress["success_counter"] = 0
        self.progress["doubt_counter"] = 0
        self.progress["failed_counter"] = 0
        self.progress["is_in_progress"] = in_progress
        self.progress["progress"] = 0

    def _set_result_precision_counters(self) -> dict:
        """
        Sets the success, doubt and faled counters
        :return: The dict containing the counters
        """
        success_dict = {
            "success": self.progress["success_counter"],
            "doubt": self.progress["doubt_counter"],
            "failed": self.progress["failed_counter"],
        }
        return success_dict

    def _geocode(self, data: list) -> list:
        """
        Factory method for the geocoding process
        :param data: the addresses to be geocoded as a list of tuples
        :return: a list containing the addresses and their lat, lon values
        """

        geocoded_data: list = []
        counter: int = 0
        exceptions: int = 0
        self._set_initial_states(True)

        for data_entry in data:
            try:
                if self.interruptflag:
                    self.progress["progress"] = 0
                    self.progress["is_in_progress"] = False
                    message = "successfully interrupted geocoding"
                    flash(message, "success")
                    return [
                        message,
                        [geocoded_data, self._set_result_precision_counters()],
                    ]
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
            except NotImplementedError as e:
                exceptions += 1
                self.logger.exception(
                    f"self._get_coordinates_from_address is not implemented, {e}"
                )
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
                message = "First request to geocoding API returned an Error, aborting"
                flash(message, "error")
                return [message, [geocoded_data, self._set_result_precision_counters()]]
            if exceptions >= 2:
                message = "Geocoding API returned 2 errors in a row, aborting"
                flash(message, "error")
                return [message, [geocoded_data, self._set_result_precision_counters()]]

        self.progress["progress"] = 100
        return ["", [geocoded_data, self._set_result_precision_counters()]]

    def _get_coordinates_from_address(self, address: str):
        """
        Gets the coordinates from an address using the geocoding api
        :param address: The address to geocode
        :raise NotImplementedError: If the method is not implemented
        """
        raise NotImplementedError

    def check_api_key(self):
        """
        Checks the api key from the config
        :raise NotImplementedError: If the method is not implemented
        """
        raise NotImplementedError


class MapTilerGeocoder(BaseGeocoder):
    """ The MapTiler geocoder"""

    def __init__(self, config: dict):
        BaseGeocoder.__init__(self, config)

    def _get_coordinates_from_address(self, address: str):
        """override"""
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
            if len(center) > 0:
                return [
                    [center[1], center[0]],
                    relevance,
                ]  # Make sure format is [lat, lon]
        return None

    def check_api_key(self):
        """override"""
        if not self.conf["MAPTILER_API_KEY"]:
            raise NoAPIKeySuppliedException("No API Key for MapTiler was supplied")


class GoogleGeocoder(BaseGeocoder):
    """ The Google geocoder"""

    def __init__(self, config: dict):
        BaseGeocoder.__init__(self, config)

    def _get_coordinates_from_address(self, address: str):
        """override"""
        base_url = "https://maps.googleapis.com/maps/api/geocode/"
        response = get(
            base_url + "json?address=" + address + "&key=" + self.conf["GOOGLE_API_KEY"]
        )
        decoded_data = json.loads(response.content.decode())
        results = decoded_data.get("results")
        status = decoded_data.get("status")

        if status == "OK" and results and results[0]:
            geometry = results[0].get("geometry")
            location_type = geometry.get("location_type")
            relevance = 1.0
            if (
                location_type == "RANGE_INTERPOLATED"
                or location_type == "APPROXIMATE"
                or location_type == "GEOMETRIC_CENTER"
            ):
                relevance = 0.5
            location = geometry.get("location")
            lat = location.get("lat")
            lon = location.get("lng")
            return [[lat, lon], relevance] or None
        elif (
            status == "OVER_DAILY_LIMIT"
            or status == "OVER_QUERY_LIMIT"
            or status == "REQUEST_DENIED"
            or status == "INVALID_REQUEST"
        ):
            raise RequestException(status)
        return None

    def check_api_key(self):
        """override"""
        if not self.conf["GOOGLE_API_KEY"]:
            raise NoAPIKeySuppliedException("No API Key for Google was supplied")
