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

    is_in_progress = False
    progress: float = 0

    def in_progress(self) -> bool:
        return self.is_in_progress

    def get_progress(self) -> int:
        return self.progress


class GeoCoder:
    interruptflag = False
    conf = {}
    geocoding_timeout = 0
    progress = GeocodingProgress()

    def __init__(self, config):
        conf = config
        self.geocoding_timeout = conf["GEOCODING_ASYNC_TIMEOUT"]
        self.progress = GeocodingProgress()

    def geocode(self, geocoder, data, async=False):
        try:
            if geocoder == "MapTiler":
                return self.__geocode_maptiler(data, async)
            else:
                return self.__geocode_testing(async)
        except Exception as e:
            raise e

    # TODO set query-status failed in poss exception

    def __geocode_maptiler(self, data: dict, async) -> dict:
        if async:
            raise Exception("Async not supported at this time")
        else:
            self.__geocode_maptiler(data)

    def __geocode_maptiler_async(self, data: dict) -> dict:
        baseurl = "https://api.maptiler.com/geocoding/"
        geocoded_data = dict
        data = {"a": "HSR Oberseestrasse 10 Rapperswil", "b": "ETH Zürich"}
        datalen = len(data)
        counter = 0
        self.progress.progress = 0
        for datum_id in data:
            try:
                if self.interruptflag:
                    self.interruptflag = False
                    return geocoded_data
                address = data[datum_id]
                resp = requests.get(
                    baseurl + address + ".json?key=" + self.conf["MAPTILER_API_KEY"]
                )
                dat = resp.content.decode()
                jsondat = json.loads(dat)
                # TODO give better names and clean
                features = jsondat["features"]
                feature_count = len(features)
                if feature_count != 0:
                    feature = features[0]
                    center = feature["center"]
                    geocoded_data[datum_id] = center
                counter += 1
                self.progress.progress = counter / datalen
            # TODO be more precise with the possible exceptions
            except Exception as e:
                # TODO decide whether to interrupt here or keep going
                print(e)
        self.progress.progress = 100
        self.progress.is_in_progress = False
        return geocoded_data

    def __geocode_testing(self, async) -> dict:
        if async:
            raise Exception("Async not supported at this time")
        else:
            self.__geocode_testing_async()

    def __geocode_testing_async(self) -> dict:
        counter = 0
        datalen = 10
        self.progress.progress = 0
        for _ in range(datalen):
            if self.interruptflag:
                self.interruptflag = False
                return {0: ""}
            time.sleep(2)
            counter = counter + 1
            self.progress.progress = counter / datalen
        return {0: ""}
