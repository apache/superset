import random
from datetime import datetime, timedelta

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from sqlglot.dialects.dialect import Dialects
from superset_core.api import RestApi

from superset import db
from superset.daos.database import DatabaseDAO
from superset.sql.parse import (
    extract_tables_from_statement,
    SQLScript,
)


class DatasetReferencesAPI(RestApi):
    resource_name = "dataset_references"
    openapi_spec_tag = "Dataset references"
    class_permission_name = "dataset_references"

    @expose("/metadata", methods=("POST",))
    @protect()
    @safe
    @permission_name("read")
    def metadata(self) -> Response:
        # TODO: Discuss how to access host things from extensions.
        # Examples include utility functions, commands, and database connections.
        # Ideally, we want to use the same versioned API approach as the frontend.

        tables = {
            table.table
            for statement in SQLScript(
                request.json.get("sql"), Dialects.POSTGRES
            ).statements
            for table in extract_tables_from_statement(
                statement._parsed, Dialects.POSTGRES
            )
        }

        # Retrieve all table owners from the database
        owners = db.session.execute(
            """
            SELECT DISTINCT t.table_name, u.first_name, u.last_name
            FROM tables t
            JOIN sqlatable_user tu on tu.table_id = t.id
            JOIN ab_user u ON u.id = tu.user_id
            ORDER BY t.table_name, u.first_name, u.last_name
            """
        )

        # Build a mapping: table_name -> list of owner full names
        owners_map = {}
        for row in owners:
            table_name = row[0]
            owner_full_name = f"{row[1]} {row[2]}".strip()
            owners_map.setdefault(table_name, []).append(owner_full_name)

        # Get estimated row counts from PostgreSQL's pg_class and pg_namespace
        # Only works for tables in the current database/schema
        row_counts = {}
        if tables:
            table_names = ", ".join(f"'{t}'" for t in tables)
            count_estimates = (
                DatabaseDAO()
                .find_by_id(1)
                .get_df(
                    f"""
                        SELECT
                            relname AS table_name,
                            reltuples::BIGINT AS estimated_row_count
                        FROM pg_class
                        WHERE relname IN ({table_names})
                    """
                )
            )
            for _, row in count_estimates.iterrows():
                table_name = row["table_name"]
                estimated_row_count = row["estimated_row_count"]
                row_counts[table_name] = estimated_row_count

        result = []
        for table_name in tables:
            # Generate a random date within the last 60 days
            days_ago = random.randint(0, 60)
            latest_partition = (datetime.today() - timedelta(days=days_ago)).strftime(
                "%Y-%m-%d"
            )
            estimated_row_count = row_counts.get(table_name)
            result.append(
                {
                    "table_name": table_name,
                    "owners": owners_map.get(table_name, []),
                    "latest_partition": latest_partition,
                    "estimated_row_count": estimated_row_count,
                }
            )

        return self.response(200, result=result)
