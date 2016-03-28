import imp
import doctest
import os
import unittest
os.environ['DASHED_CONFIG'] = 'tests.dashed_test_config'
from flask.ext.testing import LiveServerTestCase, TestCase

import dashed
from dashed import app, db, models, utils, get_session
BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/dashed")


class LiveTest(unittest.TestCase):

    def create_app(self):
        app.config['LIVESERVER_PORT'] = 8873
        app.config['TESTING'] = True
        return app

    def setUp(self):
        self.client = self.create_app().test_client()

    def test_init(self):
        utils.init(dashed)

    def test_load_examples(self):
        cli.load_examples(sample=True)

    def test_slices(self):
        # Testing by running all the examples
        Slc = models.Slice
        session = get_session()
        urls = []
        for slc in session.query(Slc).all():
            urls.append(slc.slice_url)
            urls.append(slc.viz.json_endpoint)
        for url in urls:
            self.client.get(url)
        session.commit()
        session.close()

    def test_csv(self):
        self.client.get('/dashed/explore/table/1/?viz_type=table&granularity=ds&since=100+years&until=now&metrics=count&groupby=name&limit=50&show_brush=y&show_brush=false&show_legend=y&show_brush=false&rich_tooltip=y&show_brush=false&show_brush=false&show_brush=false&show_brush=false&y_axis_format=&x_axis_showminmax=y&show_brush=false&line_interpolation=linear&rolling_type=None&rolling_periods=&time_compare=&num_period_compare=&where=&having=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&slice_id=14&slice_name=Boys&collapsed_fieldsets=&action=&datasource_name=birth_names&datasource_id=1&datasource_type=table&previous_viz_type=line&csv=true')

    def misc(self):
        self.client.get('/health')
        self.client.get('/ping')

    def test_dashboard(self):
        for dash in db.session.query(models.Dashboard).all():
            self.client.get(dash.url)

    def test_doctests(self):
        modules = [utils]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def misc(self):
        self.client.get('/health')
        self.client.get('/ping')

    def tearDown(self):
        pass

if __name__ == '__main__':
    unittest.main()
