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

from superset.models.helpers import QueryStatus
from superset.tasks.celery_app import app as celery_app


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
    conf = {}
    progress = GeocodingProgress()

    def __init__(self, config):
        self.conf = config
        self.progress = GeocodingProgress()

    def geocode(self, geocoder: str, data: dict, async=False):
        try:
            if geocoder == "MapTiler":
                return self.__geocode_maptiler(data, async)
            else:
                return self.__geocode_testing(async)
        except Exception as e:
            raise e
        finally:
            self.progress.progress = 0
            self.progress.is_in_progress = False

    def __geocode_maptiler(self, data: dict, asyncFlag) -> dict:
        if asyncFlag:
            raise Exception("Async not supported at this time")
        else:
            self.__geocode_maptiler_sync(data)

    def __geocode_maptiler_sync(self, data: dict) -> dict:
        baseurl = "https://api.maptiler.com/geocoding/"
        geocoded_data = dict
        data = {"a": "HSR Oberseestrasse 10 Rapperswil", "b": "ETH Zürich"}
        datalen = len(data)
        counter = 0
        success_counter = 0
        self.progress.is_in_progress = True
        self.progress.progress = 0
        for datum_id in data:
            try:
                if self.interruptflag:
                    # TODO check if save_flag is set
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
                features = jsondat["features"]
                feature_count = len(features)
                if feature_count != 0:
                    feature = features[0]
                    center = feature["center"]
                    geocoded_data[datum_id] = center
                    success_counter += 1
                counter += 1
                self.progress.progress = counter / datalen
            # TODO be more precise with the possible exceptions
            except Exception as e:
                # TODO decide whether to interrupt here or keep going
                print(e)
        self.progress.progress = 100
        self.progress.is_in_progress = False
        # TODO also return amount of succesfully geocoded values or store in class-variable
        return geocoded_data

    def __geocode_testing(self, asyncFlag) -> dict:
        if asyncFlag:
            raise Exception("Async not supported at this time")
        else:
            self.__geocode_testing_sync()

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
