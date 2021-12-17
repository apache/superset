import pytest
import json
from superset import db
from tests.integration_tests.dashboard_utils import create_dashboard
from tests.integration_tests.test_app import app


@pytest.fixture()
def tabbed_dashboard():
    position_json = {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": ["TABS-IpViLohnyP"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "tabbed dashboard"},
            "type": "HEADER",
        },
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "TAB-j53G4gtKGF": {
            "children": [],
            "id": "TAB-j53G4gtKGF",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab 1",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-IpViLohnyP"],
            "type": "TAB",
        },
        "TAB-nerWR09Ju": {
            "children": [],
            "id": "TAB-nerWR09Ju",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab 2",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-IpViLohnyP"],
            "type": "TAB",
        },
        "TABS-IpViLohnyP": {
            "children": ["TAB-j53G4gtKGF", "TAB-nerWR09Ju"],
            "id": "TABS-IpViLohnyP",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "TABS",
        },
    }
    with app.app_context():
        dash = create_dashboard(
            "tabbed-dash-test", "Tabbed Dash Test", json.dumps(position_json), []
        )
    yield dash
    with app.app_context():
        db.session.delete(dash)
