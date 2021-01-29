import pytest

from superset import db
from superset.utils.core import get_example_database
from tests.test_app import app


@pytest.fixture()
def expose_in_sqllab():
    with app.app_context():
        example_db = get_example_database()
        example_db.expose_in_sqllab = True
        db.session.commit()
        yield
        example_db.expose_in_sqllab = False
        db.session.commit()
