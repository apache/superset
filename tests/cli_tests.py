import json

from superset import app, config
from .base_tests import SupersetTestCase


class SupersetCliTestCase(SupersetTestCase):

    @classmethod
    def setUp(self):
        self.runner = app.test_cli_runner()

    def test_version(self):
        """Test `superset version`"""
        version_result = self.runner.invoke(app.cli, ['version'])
        # Version result should contain version string
        self.assertTrue(config.get('VERSION_STRING') in version_result.output)

    def test_export_all_test_dashboards(self):
        """Test `superset export_dashboards`"""
        self.runner.invoke(app.cli, 'load_examples')
        result = self.runner.invoke(app.cli, ['export_dashboards'])
        data = json.loads(result.output)
        print(result.output)

        # Should export at least all 5 test dashboards
        self.assertGreaterEqual(len(data['dashboards']), 5)

    def text_export_dashboard_by_id(self):
        """Test `superset export_dashboards -i 3`"""
        self.runner.invoke(app.cli, 'load_examples')
        result = self.runner.invoke(app.cli, ['export_dashboards', '-i', '5'])
        data = json.loads(result.output)

        # Should export 1 dashboard with matching id
        ids = list(map(lambda d: d['__Dashboard__']['id'], data['dashboards']))
        self.assertEquals(len(ids), 1)
        self.assertEquals(ids[0], '5')

    def text_export_dashboard_by_title(self):
        """Test `superset export_dashboards -i 3`"""
        self.runner.invoke(app.cli, 'load_examples')
        result = self.runner.invoke(
            app.cli, ['export_dashboards', '-t', "World's Bank Data"])
        data = json.loads(result.output)

        # Should export 1 dashboard with matching id
        ids = list(map(
            lambda d: d['__Dashboard__']['dashboard_title'], data['dashboards']))
        self.assertEquals(len(ids), 1)
        self.assertEquals(ids[0], "World's Bank Data")
