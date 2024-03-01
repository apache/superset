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
import datetime

from sqlalchemy.orm.session import Session

from superset import db
from tests.unit_tests.conftest import with_feature_flags


class TestInstantTimeComparisonQueryGeneration:
    @staticmethod
    def base_setup(session: Session):
        from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
        from superset.models.core import Database

        engine = db.session.get_bind()
        SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

        table = SqlaTable(
            table_name="my_table",
            schema="my_schema",
            database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        )

        # Common columns
        columns = [
            {"column_name": "ds", "type": "DATETIME"},
            {"column_name": "gender", "type": "VARCHAR(255)"},
            {"column_name": "name", "type": "VARCHAR(255)"},
            {"column_name": "state", "type": "VARCHAR(255)"},
        ]

        # Add columns to the table
        for col in columns:
            TableColumn(column_name=col["column_name"], type=col["type"], table=table)

        # Common metrics
        metrics = [
            {"metric_name": "count", "expression": "count(*)"},
            {"metric_name": "sum_sum", "expression": "SUM"},
        ]

        # Add metrics to the table
        for metric in metrics:
            SqlMetric(
                metric_name=metric["metric_name"],
                expression=metric["expression"],
                table=table,
            )

        db.session.add(table)
        db.session.flush()

        return table

    @staticmethod
    def generate_base_query_obj():
        return {
            "apply_fetch_values_predicate": False,
            "columns": ["name"],
            "extras": {
                "having": "",
                "where": "",
                "instant_time_comparison_info": {
                    "range": "y",
                },
            },
            "filter": [
                {"op": "TEMPORAL_RANGE", "val": "1984-01-01 : 2024-02-14", "col": "ds"}
            ],
            "from_dttm": datetime.datetime(1984, 1, 1, 0, 0),
            "granularity": None,
            "inner_from_dttm": None,
            "inner_to_dttm": None,
            "is_rowcount": False,
            "is_timeseries": False,
            "order_desc": True,
            "orderby": [("SUM(num_boys)", False)],
            "row_limit": 10,
            "row_offset": 0,
            "series_columns": [],
            "series_limit": 0,
            "series_limit_metric": None,
            "to_dttm": datetime.datetime(2024, 2, 14, 0, 0),
            "time_shift": None,
            "metrics": [
                {
                    "aggregate": "SUM",
                    "column": {
                        "column_name": "num_boys",
                        "type": "BIGINT",
                        "filterable": True,
                        "groupby": True,
                        "id": 334,
                        "is_certified": False,
                        "is_dttm": False,
                        "type_generic": 0,
                    },
                    "datasourceWarning": False,
                    "expressionType": "SIMPLE",
                    "hasCustomLabel": False,
                    "label": "SUM(num_boys)",
                    "optionName": "metric_gzp6eq9g1lc_d8o0mj0mhq4",
                    "sqlExpression": None,
                },
                {
                    "aggregate": "SUM",
                    "column": {
                        "column_name": "num_girls",
                        "type": "BIGINT",
                        "filterable": True,
                        "groupby": True,  # Note: This will need adjustment in some cases
                        "id": 335,
                        "is_certified": False,
                        "is_dttm": False,
                        "type_generic": 0,
                    },
                    "datasourceWarning": False,
                    "expressionType": "SIMPLE",
                    "hasCustomLabel": False,
                    "label": "SUM(num_girls)",
                    "optionName": "metric_5gyhtmyfw1t_d42py86jpco",
                    "sqlExpression": None,
                },
            ],
        }

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
    def test_creates_time_comparison_query(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        str = table.get_query_str_extended(query_obj)
        expected_str = """
            WITH query_a_results AS
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
                AND ds < '2024-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 0)
            SELECT query_a_results.name AS name,
                query_a_results."SUM(num_boys)" AS "SUM(num_boys)",
                query_a_results."SUM(num_girls)" AS "SUM(num_girls)",
                anon_1."SUM(num_boys)" AS "prev_SUM(num_boys)",
                anon_1."SUM(num_girls)" AS "prev_SUM(num_girls)"
            FROM
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1983-01-01 00:00:00'
                AND ds < '2023-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC) AS anon_1
            JOIN query_a_results ON anon_1.name = query_a_results.name
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
    def test_creates_time_comparison_query_no_columns(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        query_obj["columns"] = []
        query_obj["metrics"][0]["column"]["groupby"] = False
        query_obj["metrics"][1]["column"]["groupby"] = False

        str = table.get_query_str_extended(query_obj)
        expected_str = """
            WITH query_a_results AS
            (SELECT sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
                AND ds < '2024-02-14 00:00:00'
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 0)
            SELECT query_a_results."SUM(num_boys)" AS "SUM(num_boys)",
                query_a_results."SUM(num_girls)" AS "SUM(num_girls)",
                anon_1."SUM(num_boys)" AS "prev_SUM(num_boys)",
                anon_1."SUM(num_girls)" AS "prev_SUM(num_girls)"
            FROM
            (SELECT sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1983-01-01 00:00:00'
                AND ds < '2023-02-14 00:00:00'
            ORDER BY "SUM(num_boys)" DESC) AS anon_1
            JOIN query_a_results ON 1 = 1
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
    def test_creates_time_comparison_rowcount_query(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        query_obj["is_rowcount"] = True
        str = table.get_query_str_extended(query_obj)
        expected_str = """
            WITH query_a_results AS
        (SELECT COUNT(*) AS rowcount
        FROM
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
                AND ds < '2024-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 0) AS rowcount_qry)
        SELECT query_a_results.rowcount AS rowcount,
            anon_1.rowcount AS prev_rowcount
        FROM
        (SELECT COUNT(*) AS rowcount
        FROM
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1983-01-01 00:00:00'
                AND ds < '2023-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC) AS rowcount_qry) AS anon_1
        JOIN query_a_results ON 1 = 1
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
    def test_creates_query_without_time_comparison(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        query_obj["extras"]["instant_time_comparison_info"] = None
        str = table.get_query_str_extended(query_obj)
        expected_str = """
            SELECT name AS name,
                sum(num_boys) AS "SUM(num_boys)",
                sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
            AND ds < '2024-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 0
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
    def test_creates_time_comparison_query_custom_filters(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        query_obj["extras"]["instant_time_comparison_info"] = {
            "range": "c",
            "filter": {
                "op": "TEMPORAL_RANGE",
                "val": "1900-01-01 : 1950-02-14",
                "col": "ds",
            },
        }
        str = table.get_query_str_extended(query_obj)
        expected_str = """
            WITH query_a_results AS
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
                AND ds < '2024-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 0)
            SELECT query_a_results.name AS name,
                query_a_results."SUM(num_boys)" AS "SUM(num_boys)",
                query_a_results."SUM(num_girls)" AS "SUM(num_girls)",
                anon_1."SUM(num_boys)" AS "prev_SUM(num_boys)",
                anon_1."SUM(num_girls)" AS "prev_SUM(num_girls)"
            FROM
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1900-01-01 00:00:00'
                AND ds < '1950-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC) AS anon_1
            JOIN query_a_results ON anon_1.name = query_a_results.name
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=True)
    def test_creates_time_comparison_query_paginated(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        query_obj["row_offset"] = 20
        str = table.get_query_str_extended(query_obj)
        expected_str = """
            WITH query_a_results AS
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
                AND ds < '2024-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 20)
            SELECT query_a_results.name AS name,
                query_a_results."SUM(num_boys)" AS "SUM(num_boys)",
                query_a_results."SUM(num_girls)" AS "SUM(num_girls)",
                anon_1."SUM(num_boys)" AS "prev_SUM(num_boys)",
                anon_1."SUM(num_girls)" AS "prev_SUM(num_girls)"
            FROM
            (SELECT name AS name,
                    sum(num_boys) AS "SUM(num_boys)",
                    sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1983-01-01 00:00:00'
                AND ds < '2023-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC) AS anon_1
            JOIN query_a_results ON anon_1.name = query_a_results.name
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2

    @with_feature_flags(CHART_PLUGINS_EXPERIMENTAL=False)
    def test_ignore_if_ff_off(session: Session):
        table = TestInstantTimeComparisonQueryGeneration.base_setup(session)
        query_obj = TestInstantTimeComparisonQueryGeneration.generate_base_query_obj()
        str = table.get_query_str_extended(query_obj)
        expected_str = """
            SELECT name AS name,
                sum(num_boys) AS "SUM(num_boys)",
                sum(num_girls) AS "SUM(num_girls)"
            FROM my_schema.my_table
            WHERE ds >= '1984-01-01 00:00:00'
            AND ds < '2024-02-14 00:00:00'
            GROUP BY name
            ORDER BY "SUM(num_boys)" DESC
            LIMIT 10
            OFFSET 0
        """
        simplified_query1 = " ".join(str.sql.split()).lower()
        simplified_query2 = " ".join(expected_str.split()).lower()
        assert table.id == 1
        assert simplified_query1 == simplified_query2
