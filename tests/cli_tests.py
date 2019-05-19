import csv
from io import StringIO
import json
import logging
import unittest

from superset import app, cli
from tests.base_tests import SupersetTestCase

config = app.config


class SupersetCliTestCase(SupersetTestCase):

    @classmethod
    def setUp(self):
        self.runner = app.test_cli_runner()

    def test_version(self):
        """Test `superset version`"""
        version_result = self.runner.invoke(app.cli, ['version'])
        # Version result should contain version string
        logging.error(config.get('VERSION_STRING'))
        logging.error(version_result.output)
        self.assertTrue(config.get('VERSION_STRING') in version_result.output)

    def test_export_all_test_dashboards(self):
        """Test `superset export_dashboards`"""
        self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(app.cli, ['export_dashboards'])
        logging.error(result.output)
        data = json.loads(result.output)

        # Should export at least all 5 test dashboards
        self.assertGreaterEqual(len(data['dashboards']), 5)

    def test_export_dashboard_by_id(self):
        """Test `superset export_dashboards -i 3`"""
        self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(app.cli, ['export_dashboards', '-i', '5'])
        data = json.loads(result.output)

        # Should export 1 dashboard with matching id
        ids = list(map(lambda d: d['__Dashboard__']['id'], data['dashboards']))
        self.assertEqual(len(ids), 1)
        self.assertEqual(ids[0], 5)

    def test_export_dashboard_by_title(self):
        """Test `superset export_dashboards -i 3`"""
        self.runner.invoke(app.cli, ['load_examples'])
        result = self.runner.invoke(
            app.cli, ['export_dashboards', '-t', "World's Bank Data"])
        data = json.loads(result.output)

        # Should export 1 dashboard with matching id
        ids = list(map(
            lambda d: d['__Dashboard__']['dashboard_title'], data['dashboards']))
        self.assertEqual(len(ids), 1)
        self.assertEqual(ids[0], "World's Bank Data")

    def test_examples_menu(self):
        """Test `superset examples`"""
        result = self.runner.invoke(app.cli, ['examples'])
        self.assertIn('load', result.output)
        self.assertIn('list', result.output)
        self.assertIn('remove', result.output)

    def test_examples_list(self):
        """Test `superset examples list`"""
        result = self.runner.invoke(
            app.cli, ['examples', 'list']
        )
        output_f = StringIO(result.output)
        csv_reader = csv.DictReader(output_f, delimiter="\t",
            fieldnames=['title', 'description', 'total_size_mb', 
                'total_rows', 'updated_at'])
        examples = []
        for example in csv_reader:
            examples.append(example)
        examples = [e for e in csv_reader]
        self.assertGreater(len(examples), 0)

        wb = {'title': "World's Bank Data"}
        title_matches = list(filter(lambda x: all(item in x.items() for item in wb.items()) > 0, examples))
        self.assertEqual(len(title_matches), 1)

    def test_examples_load(self):
        """Test `superset examples load`"""
        pass

    def test_examples_remove(self):
        """Test `superset examples remove`"""
        pass

    def test_examples_create(self):
        """Test `superset examples create`"""
        pass

if __name__ == '__main__':
    unittest.main()
