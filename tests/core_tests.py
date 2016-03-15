import imp
import doctest
import os
import unittest
os.environ['PANORAMIX_CONFIG'] = 'tests.panoramix_test_config'
from flask.ext.testing import LiveServerTestCase, TestCase

import panoramix
from panoramix import app, db, models, utils
BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/panoramix")


class LiveTest(TestCase):

    def create_app(self):
        app.config['LIVESERVER_PORT'] = 8873
        app.config['TESTING'] = True
        return app

    def setUp(self):
        pass

    def test_init(self):
        utils.init(panoramix)

    def test_load_examples(self):
        cli.load_examples(sample=True)

    def test_slices(self):
        # Testing by running all the examples
        Slc = models.Slice
        for slc in db.session.query(Slc).all():
            print(slc)
            self.client.get(slc.slice_url)
            viz = slc.viz
            self.client.get(viz.get_url())
            if hasattr(viz, 'get_json'):
                self.client.get(viz.get_json())

    def test_csv(self):
        self.client.get('/panoramix/explore/table/1/?viz_type=table&granularity=ds&since=100+years&until=now&metrics=count&groupby=name&limit=50&show_brush=y&show_brush=false&show_legend=y&show_brush=false&rich_tooltip=y&show_brush=false&show_brush=false&show_brush=false&show_brush=false&y_axis_format=&x_axis_showminmax=y&show_brush=false&line_interpolation=linear&rolling_type=None&rolling_periods=&time_compare=&num_period_compare=&where=&having=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&slice_id=14&slice_name=Boys&collapsed_fieldsets=&action=&datasource_name=birth_names&datasource_id=1&datasource_type=table&previous_viz_type=line&csv=true')

    def test_dashboard(self):
        for dash in db.session.query(models.Dashboard).all():
            self.client.get(dash.url)

    def test_doctests(self):
        modules = [utils]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def tearDown(self):
        pass

if __name__ == '__main__':
    unittest.main()
