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
import pandas as pd
from sqlalchemy import DateTime, inspect

import superset.utils.database as database_utils
from superset import db

from .helpers import get_example_data, get_table_connector_registry


def load_flights(only_metadata: bool = False, force: bool = False) -> None:
    """Loading random time series data from a zip file in the repo"""
    tbl_name = "flights"
    database = database_utils.get_example_database()
    engine = database.get_sqla_engine()
    schema = inspect(engine).default_schema_name
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("flight_data.csv.gz", make_bytes=True)
        pdf = pd.read_csv(data, encoding="latin-1")

        # Loading airports info to join and get lat/long
        airports_bytes = get_example_data("airports.csv.gz", make_bytes=True)
        airports = pd.read_csv(airports_bytes, encoding="latin-1")
        airports = airports.set_index("IATA_CODE")

        pdf[  # pylint: disable=unsupported-assignment-operation,useless-suppression
            "ds"
        ] = (pdf.YEAR.map(str) + "-0" + pdf.MONTH.map(str) + "-0" + pdf.DAY.map(str))
        pdf.ds = pd.to_datetime(pdf.ds)
        pdf.drop(columns=["DAY", "MONTH", "YEAR"])
        pdf = pdf.join(airports, on="ORIGIN_AIRPORT", rsuffix="_ORIG")
        pdf = pdf.join(airports, on="DESTINATION_AIRPORT", rsuffix="_DEST")
        pdf.to_sql(
            tbl_name,
            engine,
            schema=schema,
            if_exists="replace",
            chunksize=500,
            dtype={"ds": DateTime},
            index=False,
        )

    table = get_table_connector_registry()
    tbl = db.session.query(table).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = table(table_name=tbl_name, schema=schema)
    tbl.description = "Random set of flights in the US"
    tbl.database = database
    tbl.filter_select_enabled = True
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
    print("Done loading table!")
