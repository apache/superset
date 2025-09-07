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

"""
Fixtures for DAO integration tests.

These fixtures override the parent conftest to provide a minimal test environment
for DAO integration tests without requiring the full Superset database setup.
"""

import pytest
from flask_appbuilder.security.sqla.models import User

from superset.extensions import db


# Override the parent conftest's setup_sample_data to avoid loading sample data
@pytest.fixture(scope="module", autouse=True)
def setup_sample_data():
    """Override parent conftest setup_sample_data to do nothing."""
    # This prevents the parent conftest from loading CSS templates and other sample data
    pass


@pytest.fixture
def user_with_data(app_context):
    """Create a test user in the database."""

    # Create the User table if it doesn't exist
    User.metadata.create_all(db.session.get_bind())

    # First create an admin user if it doesn't exist (for foreign key constraints)
    admin = db.session.query(User).filter_by(id=1).first()
    if not admin:
        admin = User(
            id=1,
            username="admin",
            first_name="Admin",
            last_name="User",
            email="admin@example.com",
            active=True,
        )
        db.session.add(admin)
        db.session.commit()

    # Now create our test user
    user = User(
        id=101,
        username="testuser",
        first_name="Test",
        last_name="User",
        email="testuser@example.com",
        active=True,
        created_by_fk=1,
        changed_by_fk=1,
    )
    db.session.add(user)
    db.session.commit()

    yield db.session

    # Clean up
    db.session.query(User).filter_by(id=101).delete()
    db.session.commit()
