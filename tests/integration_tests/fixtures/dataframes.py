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
from datetime import date, datetime

from pandas import DataFrame, to_datetime

names_df = DataFrame(
    [
        {
            "dt": date(2020, 1, 2),
            "name": "John",
            "region": "EU",
            "country": "United Kingdom",
            "cars": 3,
            "bikes": 1,
            "seconds": 30,
        },
        {
            "dt": date(2020, 1, 2),
            "name": "Peter",
            "region": "EU",
            "country": "Sweden",
            "cars": 4,
            "bikes": 2,
            "seconds": 1,
        },
        {
            "dt": date(2020, 1, 3),
            "name": "Mary",
            "region": "EU",
            "country": "Finland",
            "cars": 5,
            "bikes": 3,
            "seconds": None,
        },
        {
            "dt": date(2020, 1, 3),
            "name": "Peter",
            "region": "Asia",
            "country": "India",
            "cars": 6,
            "bikes": 4,
            "seconds": 12,
        },
        {
            "dt": date(2020, 1, 4),
            "name": "John",
            "region": "EU",
            "country": "Portugal",
            "cars": 7,
            "bikes": None,
            "seconds": 75,
        },
        {
            "dt": date(2020, 1, 4),
            "name": "Peter",
            "region": "EU",
            "country": "Italy",
            "cars": None,
            "bikes": 5,
            "seconds": 600,
        },
        {
            "dt": date(2020, 1, 4),
            "name": "Mary",
            "region": None,
            "country": None,
            "cars": 9,
            "bikes": 6,
            "seconds": 2,
        },
        {
            "dt": date(2020, 1, 4),
            "name": None,
            "region": "Oceania",
            "country": "Australia",
            "cars": 10,
            "bikes": 7,
            "seconds": 99,
        },
        {
            "dt": date(2020, 1, 1),
            "name": "John",
            "region": "North America",
            "country": "USA",
            "cars": 1,
            "bikes": 8,
            "seconds": None,
        },
        {
            "dt": date(2020, 1, 1),
            "name": "Mary",
            "region": "Oceania",
            "country": "Fiji",
            "cars": 2,
            "bikes": 9,
            "seconds": 50,
        },
    ]
)

categories_df = DataFrame(
    {
        "constant": ["dummy" for _ in range(0, 101)],
        "category": [f"cat{i%3}" for i in range(0, 101)],
        "dept": [f"dept{i%5}" for i in range(0, 101)],
        "name": [f"person{i}" for i in range(0, 101)],
        "asc_idx": [i for i in range(0, 101)],
        "desc_idx": [i for i in range(100, -1, -1)],
        "idx_nulls": [i if i % 5 == 0 else None for i in range(0, 101)],
    }
)

timeseries_df = DataFrame(
    index=to_datetime(["2019-01-01", "2019-01-02", "2019-01-05", "2019-01-07"]),
    data={"label": ["x", "y", "z", "q"], "y": [1.0, 2.0, 3.0, 4.0]},
)

timeseries_df2 = DataFrame(
    index=to_datetime(["2019-01-01", "2019-01-02", "2019-01-05", "2019-01-07"]),
    data={
        "label": ["x", "y", "z", "q"],
        "y": [2.0, 2.0, 2.0, 2.0],
        "z": [2.0, 4.0, 10.0, 8.0],
    },
)

lonlat_df = DataFrame(
    {
        "city": ["New York City", "Sydney"],
        "geohash": ["dr5regw3pg6f", "r3gx2u9qdevk"],
        "latitude": [40.71277496, -33.85598011],
        "longitude": [-74.00597306, 151.20666526],
        "altitude": [5.5, 0.012],
        "geodetic": [
            "40.71277496, -74.00597306, 5.5km",
            "-33.85598011, 151.20666526, 12m",
        ],
    }
)

prophet_df = DataFrame(
    {
        "__timestamp": [
            datetime(2018, 12, 31),
            datetime(2019, 12, 31),
            datetime(2020, 12, 31),
            datetime(2021, 12, 31),
        ],
        "a": [1.1, 1, 1.9, 3.15],
        "b": [4, 3, 4.1, 3.95],
    }
)

single_metric_df = DataFrame(
    {
        "dttm": to_datetime(["2019-01-01", "2019-01-01", "2019-01-02", "2019-01-02",]),
        "country": ["UK", "US", "UK", "US"],
        "sum_metric": [5, 6, 7, 8],
    }
)
multiple_metrics_df = DataFrame(
    {
        "dttm": to_datetime(["2019-01-01", "2019-01-01", "2019-01-02", "2019-01-02",]),
        "country": ["UK", "US", "UK", "US"],
        "sum_metric": [5, 6, 7, 8],
        "count_metric": [1, 2, 3, 4],
    }
)
