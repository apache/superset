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
import time

import requests
from requests import RequestException


class GeocodingProgress:
    """
    This class is to be used as an object passed to the frontend to inform it whether
    or not the geocoding process is still running and what the overall progress
    of the task is
    """

    def __init__(self, is_in_progress=False, progress=0):
        self.is_in_progress = is_in_progress
        self.progress = progress


class GeoCoder:
    interruptflag = False
    conf: dict = {}
    progress = GeocodingProgress()

    def __init__(self, config):
        self.conf = config
        self.progress = GeocodingProgress()

    def geocode(self, geocoder: str, data: dict, async_flag=False):
        try:
            if geocoder == "MapTiler":
                return self.__geocode_maptiler(data, async_flag)
            return self.__geocode_testing(async_flag)
        except Exception as e:
            raise e
        finally:
            self.progress.progress = 0
            self.progress.is_in_progress = False

    def __geocode_maptiler(self, data: dict, async_flag) -> dict:
        if async_flag:
            raise Exception("Async not supported at this time")
        else:
            return self.__geocode_maptiler_sync(data)

    def __geocode_maptiler_sync(self, data: dict) -> dict:
        """
        geocode the data using the Maptiler API
        :param data:
        :return:
        """
        data = {"a": "HSR Oberseestrasse 10 Rapperswil", "b": "ETH Zürich"}
        baseurl = "https://api.maptiler.com/geocoding/"
        geocoded_data: dict = {}
        datalen = len(data)
        counter = 0
        success_counter = 0
        self.progress.is_in_progress = True
        self.progress.progress = 0
        # TODO this expects a dict, prob switch to a list of lists

        # for row in data:
        # request_string = ""
        # for elem in row:
        # request_string = request_string + " " + elem
        # resp = requests.get(
        # baseurl + request_string + ".json?key=" + self.conf["MAPTILER_API_KEY"]
        # )
        for datum_id in data:
            try:
                if self.interruptflag:
                    self.interruptflag = False
                    self.progress.progress = 0
                    self.progress.is_in_progress = False
                    return geocoded_data
                address = data[datum_id]
                resp = requests.get(
                    baseurl + address + ".json?key=" + self.conf["MAPTILER_API_KEY"]
                )
                resp_content = resp.content.decode()
                jsondat = json.loads(resp_content)
                # TODO give better names and clean
                # TODO make use of relevance if wanted
                features = jsondat["features"]
                feature_count = len(features)
                if feature_count != 0:
                    feature = features[0]
                    # TODO check if it is possible, that there is no center attribute
                    #  -> get API doc from mr. Keller
                    # TODO don't raise success_counter if there is no 'center' Attribute
                    geocoded_data[datum_id] = feature["center"] or ""
                    success_counter += 1
                counter += 1
                self.progress.progress = counter / datalen
            # TODO be more precise with the possible exceptions
            except RequestException as e:
                # TODO decide whether to interrupt here or keep going
                print(e)
        self.progress.progress = 100
        self.progress.is_in_progress = False
        # TODO also return amount of geocoded values or store in class-variable
        return geocoded_data

    def __geocode_testing(self, async_flag) -> dict:
        if async_flag:
            raise Exception("Async not supported at this time")
        else:
            return self.__geocode_testing_sync()

    def __geocode_testing_sync(self) -> dict:
        counter = 0
        datalen = 10
        self.progress.is_in_progress = True
        self.progress.progress = 0
        for _ in range(datalen):
            if self.interruptflag:
                self.interruptflag = False
                self.progress.is_in_progress = False
                self.progress.progress = 0
                return {0: ""}
            time.sleep(2)
            counter = counter + 1
            self.progress.progress = counter / datalen
        return {0: ""}
