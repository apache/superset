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


class GeocodingProgress:
    """
    This class is to be used as an object passed to the frontend to inform it whether or not the geocoding
    process is still running and what the overall progress of the task is
    """

    is_in_progress = False
    progress = 0


class GeoCoder:
    conf = ""
    progress = GeocodingProgress()

    def __init__(self, config):
        conf = config

    def geocode(self, geocoder, data):
        if geocoder == "MapTiler":
            return self.__geocode_maptiler(data)
        else:
            return self.geocode_testing()

    def __geocode_maptiler(self, data: dict) -> dict:
        baseurl = "https://api.maptiler.com/geocoding/"
        geocoded_data = {}
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
                if len(features) != 0:
                    feature = features[0]
                    center = feature["center"]
                    geocoded_data[datum_id] = center
                counter += 1
                self.progress.progress = counter / datalen
            # TODO be more precise with the possible exceptions
            except Exception as e:
                # TODO decide whether to interrupt here or keep going
                print(e)
                pass
        self.progress.progress = 100
        self.progress.is_in_progress = False
        return geocoded_data

    def __geocode_testing(self) -> dict:
        counter = 0
        datalen = 10
        self.progress.progress = 0
        for i in range(datalen):
            if self.interruptflag:
                self.interruptflag = False
                return ""
            time.sleep(2)
            counter = counter + 1
            self.progress.progress = counter / datalen
        return ""
