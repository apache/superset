import imp
import os
import unittest
import urllib2
os.environ['PANORAMIX_CONFIG'] = 'tests.panoramix_test_config'
from flask.ext.testing import LiveServerTestCase, TestCase

from panoramix import app, db, models
BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/panoramix")


class LiveTest(TestCase):

    def create_app(self):
        app.config['LIVESERVER_PORT'] = 8873
        app.config['TESTING'] = True
        return app

    def setUp(self):
        print BASE_DIR

    def test_load_examples(self):
        cli.load_examples(sample=True)

    def test_slices(self):
        Slc = models.Slice
        for slc in db.session.query(Slc).all():
            self.client.get(slc.slice_url)
            viz = slc.viz
            if hasattr(viz, 'get_json'):
                self.client.get(viz.get_json())

    def test_dashboard(self):
        for dash in db.session.query(models.Dashboard).all():
            self.client.get(dash.url)

    def tearDown(self):
        pass

if __name__ == '__main__':
    unittest.main()
