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
"""fix_table_chart_conditional_formatting_add_flag

Revision ID: da125679ebb8
Revises: c233f5365c9e
Create Date: 2025-08-13 19:09:41.796801

"""

import logging

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils import json

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "da125679ebb8"
down_revision = "c233f5365c9e"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def _process_slice_params_upgrade(params):
    conditional_formatting = params.get("conditional_formatting", [])

    if not conditional_formatting:
        return params

    new_conditional_formatting = []
    for formatter in conditional_formatting:
        color_scheme = formatter.get("colorScheme")

        if color_scheme not in ["Green", "Red"]:
            new_conditional_formatting.append(
                {
                    **formatter,
                    "toAllRow": False,
                    "toTextColor": False,
                }
            )
        else:
            new_conditional_formatting.append(formatter)

    params["conditional_formatting"] = new_conditional_formatting
    return params


def _process_slice_params_downgrade(params):
    conditional_formatting = params.get("conditional_formatting", [])

    if not conditional_formatting:
        return params

    new_conditional_formatting = []
    for formatter in conditional_formatting:
        if "toAllRow" in formatter or "toTextColor" in formatter:
            new_formatter = formatter.copy()
            new_formatter.pop("toAllRow", None)
            new_formatter.pop("toTextColor", None)
            new_conditional_formatting.append(new_formatter)
        else:
            new_conditional_formatting.append(formatter)

    params["conditional_formatting"] = new_conditional_formatting
    return params


def _process_slices_in_batches(session, process_func, migration_type):
    total_count = session.query(Slice).filter(Slice.viz_type == "table").count()
    logger.info(f"Found {total_count} table slices to process for {migration_type}")

    batch_size = 1000
    processed = 0

    while processed < total_count:
        try:
            slices_batch = (
                session.query(Slice)
                .filter(Slice.viz_type == "table")
                .offset(processed)
                .limit(batch_size)
                .all()
            )

            if not slices_batch:
                break

            for slc in slices_batch:
                try:
                    params = json.loads(slc.params)
                    processed_params = process_func(params)

                    if processed_params != params:
                        slc.params = json.dumps(processed_params)

                except Exception as e:
                    logger.error(f"Error processing slice {slc.id}: {str(e)}")
                    continue

            session.commit()
            processed += len(slices_batch)
            logger.info(
                f"Processed {processed}/{total_count} slices for {migration_type}"
            )

        except SQLAlchemyError as e:
            session.rollback()
            logger.error(
                f"Error processing batch {processed}-{processed + batch_size} "
                f"for {migration_type}: {str(e)}"
            )
            processed += batch_size


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    try:
        _process_slices_in_batches(session, _process_slice_params_upgrade, "upgrade")
        logger.info("Upgrade migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error in upgrade migration: {str(e)}")
        raise

    finally:
        session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    try:
        _process_slices_in_batches(
            session, _process_slice_params_downgrade, "downgrade"
        )
        logger.info("Downgrade migration completed successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error in downgrade migration: {str(e)}")
        raise

    finally:
        session.close()
