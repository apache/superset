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
"""International sales dataset demonstrating multi-currency transactions."""

import logging

import pandas as pd
from sqlalchemy import Date, inspect, Integer, Numeric, String

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.sql.parse import Table

from ..utils.database import get_example_database  # noqa: TID252
from .helpers import get_table_connector_registry

logger = logging.getLogger(__name__)


def get_international_sales_data() -> pd.DataFrame:
    """Generate the international sales dataset with multiple currencies."""
    # fmt: off
    data = [
        # North America - USA (USD)
        (1, "2024-01-15", "North America", "USA", "Electronics", "Laptop Pro",
         50, 1299.99, 64999.50, 45000.00, 19999.50, "USD", "$"),
        (2, "2024-01-15", "North America", "USA", "Electronics", "Smartphone X",
         200, 899.99, 179998.00, 120000.00, 59998.00, "USD", "$"),
        (3, "2024-01-15", "North America", "USA", "Software", "Office Suite",
         500, 149.99, 74995.00, 15000.00, 59995.00, "USD", "$"),
        (4, "2024-02-15", "North America", "USA", "Electronics", "Laptop Pro",
         75, 1299.99, 97499.25, 67500.00, 29999.25, "USD", "$"),
        (5, "2024-02-15", "North America", "USA", "Electronics", "Smartphone X",
         250, 899.99, 224997.50, 150000.00, 74997.50, "USD", "$"),
        (6, "2024-02-15", "North America", "USA", "Software", "Office Suite",
         600, 149.99, 89994.00, 18000.00, 71994.00, "USD", "$"),
        (7, "2024-03-15", "North America", "USA", "Electronics", "Laptop Pro",
         100, 1299.99, 129999.00, 90000.00, 39999.00, "USD", "$"),
        (8, "2024-03-15", "North America", "USA", "Electronics", "Smartphone X",
         300, 899.99, 269997.00, 180000.00, 89997.00, "USD", "$"),
        # Case normalization test - lowercase 'usd'
        (9, "2024-03-15", "North America", "USA", "Software", "Office Suite",
         700, 149.99, 104993.00, 21000.00, 83993.00, "usd", "$"),
        # North America - Canada (CAD)
        (10, "2024-01-15", "North America", "Canada", "Electronics", "Laptop Pro",
         30, 1599.99, 47999.70, 35000.00, 12999.70, "CAD", "CA$"),
        (11, "2024-01-15", "North America", "Canada", "Electronics", "Smartphone X",
         100, 1099.99, 109999.00, 75000.00, 34999.00, "CAD", "CA$"),
        (12, "2024-02-15", "North America", "Canada", "Electronics", "Laptop Pro",
         40, 1599.99, 63999.60, 46000.00, 17999.60, "CAD", "CA$"),
        (13, "2024-02-15", "North America", "Canada", "Software", "Office Suite",
         200, 199.99, 39998.00, 8000.00, 31998.00, "CAD", "CA$"),
        # Case normalization test - mixed case 'Cad'
        (14, "2024-03-15", "North America", "Canada", "Electronics", "Laptop Pro",
         50, 1599.99, 79999.50, 57500.00, 22499.50, "Cad", "CA$"),
        # Europe - Germany/France (EUR)
        (15, "2024-01-15", "Europe", "Germany", "Electronics", "Laptop Pro",
         40, 1199.99, 47999.60, 32000.00, 15999.60, "EUR", "€"),
        (16, "2024-01-15", "Europe", "Germany", "Electronics", "Smartphone X",
         150, 849.99, 127498.50, 85000.00, 42498.50, "EUR", "€"),
        (17, "2024-01-15", "Europe", "France", "Software", "Office Suite",
         300, 139.99, 41997.00, 9000.00, 32997.00, "EUR", "€"),
        (18, "2024-02-15", "Europe", "Germany", "Electronics", "Laptop Pro",
         55, 1199.99, 65999.45, 44000.00, 21999.45, "EUR", "€"),
        (19, "2024-02-15", "Europe", "France", "Electronics", "Smartphone X",
         180, 849.99, 152998.20, 102000.00, 50998.20, "EUR", "€"),
        # Case normalization test - lowercase 'eur'
        (20, "2024-02-15", "Europe", "Germany", "Software", "Office Suite",
         350, 139.99, 48996.50, 10500.00, 38496.50, "eur", "€"),
        # Europe - UK (GBP)
        (21, "2024-01-15", "Europe", "UK", "Electronics", "Laptop Pro",
         35, 999.99, 34999.65, 24500.00, 10499.65, "GBP", "£"),
        (22, "2024-01-15", "Europe", "UK", "Electronics", "Smartphone X",
         120, 749.99, 89998.80, 66000.00, 23998.80, "GBP", "£"),
        (23, "2024-02-15", "Europe", "UK", "Electronics", "Laptop Pro",
         45, 999.99, 44999.55, 31500.00, 13499.55, "GBP", "£"),
        (24, "2024-02-15", "Europe", "UK", "Software", "Office Suite",
         250, 119.99, 29997.50, 7500.00, 22497.50, "GBP", "£"),
        # Case normalization test - mixed case 'Gbp'
        (25, "2024-03-15", "Europe", "UK", "Electronics", "Laptop Pro",
         60, 999.99, 59999.40, 42000.00, 17999.40, "Gbp", "£"),
        # Asia - Japan (JPY)
        (26, "2024-01-15", "Asia", "Japan", "Electronics", "Laptop Pro",
         25, 149999.00, 3749975.00, 2625000.00, 1124975.00, "JPY", "¥"),
        (27, "2024-01-15", "Asia", "Japan", "Electronics", "Smartphone X",
         80, 99999.00, 7999920.00, 5600000.00, 2399920.00, "JPY", "¥"),
        (28, "2024-02-15", "Asia", "Japan", "Electronics", "Laptop Pro",
         30, 149999.00, 4499970.00, 3150000.00, 1349970.00, "JPY", "¥"),
        (29, "2024-03-15", "Asia", "Japan", "Software", "Office Suite",
         150, 14999.00, 2249850.00, 450000.00, 1799850.00, "JPY", "¥"),
        # Asia Pacific - Australia (AUD)
        (30, "2024-01-15", "Asia Pacific", "Australia", "Electronics", "Laptop Pro",
         20, 1899.99, 37999.80, 26000.00, 11999.80, "AUD", "A$"),
        (31, "2024-02-15", "Asia Pacific", "Australia", "Electronics", "Smartphone X",
         60, 1299.99, 77999.40, 48000.00, 29999.40, "AUD", "A$"),
        (32, "2024-03-15", "Asia Pacific", "Australia", "Software", "Office Suite",
         100, 219.99, 21999.00, 6000.00, 15999.00, "AUD", "A$"),
        # NULL currency tests - Other region
        (33, "2024-01-15", "Other", "Unknown", "Electronics", "Generic Device",
         10, 500.00, 5000.00, 3500.00, 1500.00, None, None),
        (34, "2024-02-15", "Other", "Unknown", "Software", "Basic App",
         50, 50.00, 2500.00, 1000.00, 1500.00, None, None),
        # Empty string currency test
        (35, "2024-03-15", "Other", "Unknown", "Electronics", "Unknown Product",
         5, 100.00, 500.00, 350.00, 150.00, "", ""),
        # Additional rows for aggregation tests
        (36, "2024-01-15", "North America", "USA", "Electronics", "Tablet Pro",
         80, 599.99, 47999.20, 32000.00, 15999.20, "USD", "$"),
        (37, "2024-02-15", "Europe", "Germany", "Electronics", "Tablet Pro",
         65, 549.99, 35749.35, 22750.00, 12999.35, "EUR", "€"),
        (38, "2024-03-15", "Asia", "Japan", "Electronics", "Tablet Pro",
         45, 64999.00, 2924955.00, 1575000.00, 1349955.00, "JPY", "¥"),
        # Euro word/symbol normalization tests
        (39, "2024-01-15", "Europe", "Spain", "Software", "Cloud Service",
         100, 99.99, 9999.00, 5000.00, 4999.00, "euro", "€"),
        (40, "2024-02-15", "Europe", "Italy", "Software", "Cloud Service",
         120, 99.99, 11998.80, 6000.00, 5998.80, "EURO", "€"),
        (41, "2024-03-15", "Europe", "Portugal", "Software", "Cloud Service",
         80, 99.99, 7999.20, 4000.00, 3999.20, "€", "€"),
        # Invalid currency code fallback test
        (42, "2024-01-15", "Other", "Unknown", "Electronics", "Mystery Device",
         25, 200.00, 5000.00, 3000.00, 2000.00, "XYZ", "?"),
    ]
    # fmt: on

    columns = [
        "id",
        "transaction_date",
        "region",
        "country",
        "product_category",
        "product_name",
        "quantity",
        "unit_price",
        "revenue",
        "cost",
        "profit",
        "currency_code",
        "currency_symbol",
    ]

    return pd.DataFrame(data, columns=columns)


def load_data(tbl_name: str, database: Database) -> None:
    """Load the international sales data into the database."""
    pdf = get_international_sales_data()
    pdf["transaction_date"] = pd.to_datetime(pdf["transaction_date"])

    with database.get_sqla_engine() as engine:
        schema = inspect(engine).default_schema_name

        pdf.to_sql(
            tbl_name,
            engine,
            schema=schema,
            if_exists="replace",
            chunksize=50,
            dtype={
                "id": Integer,
                "transaction_date": Date,
                "region": String(50),
                "country": String(50),
                "product_category": String(50),
                "product_name": String(100),
                "quantity": Integer,
                "unit_price": Numeric(12, 2),
                "revenue": Numeric(14, 2),
                "cost": Numeric(14, 2),
                "profit": Numeric(14, 2),
                "currency_code": String(10),
                "currency_symbol": String(10),
            },
            method="multi",
            index=False,
        )
    logger.debug("Done loading international sales data!")


def load_international_sales(only_metadata: bool = False, force: bool = False) -> None:
    """Load international sales dataset for demonstrating dynamic currency formatting.

    This dataset contains multi-currency transaction data with:
    - Multiple currencies (USD, EUR, GBP, JPY, CAD, AUD)
    - Case variations for normalization testing (usd, eur, Gbp, Cad)
    - Word variations for normalization testing (euro, EURO)
    - Symbol variations for normalization testing (€)
    - NULL and empty string currency values for fallback testing
    - Invalid currency code (XYZ) for fallback testing
    - Multiple monetary columns (revenue, cost, profit, unit_price)
    """
    database = get_example_database()
    tbl_name = "international_sales"

    with database.get_sqla_engine() as engine:
        schema = inspect(engine).default_schema_name
        table_exists = database.has_table(Table(tbl_name, schema))

    if not only_metadata and (not table_exists or force):
        load_data(tbl_name, database)

    table = get_table_connector_registry()
    obj = db.session.query(table).filter_by(table_name=tbl_name, schema=schema).first()
    if not obj:
        logger.debug("Creating table [%s] reference", tbl_name)
        obj = table(table_name=tbl_name, schema=schema)
        db.session.add(obj)

    _set_table_metadata(obj, database)


def _set_table_metadata(datasource: SqlaTable, database: Database) -> None:
    """Set metadata for the international sales dataset."""
    datasource.main_dttm_col = "transaction_date"
    datasource.database = database
    datasource.filter_select_enabled = True
    datasource.description = (
        "International sales transactions across multiple currencies "
        "for demonstrating dynamic currency formatting features."
    )
    # Set the currency code column for dynamic currency detection
    datasource.currency_code_column = "currency_code"
    datasource.fetch_metadata()
