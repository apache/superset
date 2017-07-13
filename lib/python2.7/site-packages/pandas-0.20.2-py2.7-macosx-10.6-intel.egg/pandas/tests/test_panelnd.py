# -*- coding: utf-8 -*-
import pytest

from warnings import catch_warnings
from pandas.core import panelnd
from pandas.core.panel import Panel

from pandas.util.testing import assert_panel_equal
import pandas.util.testing as tm


class TestPanelnd(object):

    def setup_method(self, method):
        pass

    def test_4d_construction(self):

        with catch_warnings(record=True):

            # create a 4D
            Panel4D = panelnd.create_nd_panel_factory(
                klass_name='Panel4D',
                orders=['labels', 'items', 'major_axis', 'minor_axis'],
                slices={'items': 'items', 'major_axis': 'major_axis',
                        'minor_axis': 'minor_axis'},
                slicer=Panel,
                aliases={'major': 'major_axis', 'minor': 'minor_axis'},
                stat_axis=2)

            p4d = Panel4D(dict(L1=tm.makePanel(), L2=tm.makePanel()))  # noqa

    def test_4d_construction_alt(self):

        with catch_warnings(record=True):

            # create a 4D
            Panel4D = panelnd.create_nd_panel_factory(
                klass_name='Panel4D',
                orders=['labels', 'items', 'major_axis', 'minor_axis'],
                slices={'items': 'items', 'major_axis': 'major_axis',
                        'minor_axis': 'minor_axis'},
                slicer='Panel',
                aliases={'major': 'major_axis', 'minor': 'minor_axis'},
                stat_axis=2)

            p4d = Panel4D(dict(L1=tm.makePanel(), L2=tm.makePanel()))  # noqa

    def test_4d_construction_error(self):

        # create a 4D
        pytest.raises(Exception,
                      panelnd.create_nd_panel_factory,
                      klass_name='Panel4D',
                      orders=['labels', 'items', 'major_axis',
                              'minor_axis'],
                      slices={'items': 'items',
                              'major_axis': 'major_axis',
                              'minor_axis': 'minor_axis'},
                      slicer='foo',
                      aliases={'major': 'major_axis',
                               'minor': 'minor_axis'},
                      stat_axis=2)

    def test_5d_construction(self):

        with catch_warnings(record=True):

            # create a 4D
            Panel4D = panelnd.create_nd_panel_factory(
                klass_name='Panel4D',
                orders=['labels1', 'items', 'major_axis', 'minor_axis'],
                slices={'items': 'items', 'major_axis': 'major_axis',
                        'minor_axis': 'minor_axis'},
                slicer=Panel,
                aliases={'major': 'major_axis', 'minor': 'minor_axis'},
                stat_axis=2)

            # deprecation GH13564
            p4d = Panel4D(dict(L1=tm.makePanel(), L2=tm.makePanel()))

            # create a 5D
            Panel5D = panelnd.create_nd_panel_factory(
                klass_name='Panel5D',
                orders=['cool1', 'labels1', 'items', 'major_axis',
                        'minor_axis'],
                slices={'labels1': 'labels1', 'items': 'items',
                        'major_axis': 'major_axis',
                        'minor_axis': 'minor_axis'},
                slicer=Panel4D,
                aliases={'major': 'major_axis', 'minor': 'minor_axis'},
                stat_axis=2)

            # deprecation GH13564
            p5d = Panel5D(dict(C1=p4d))

            # slice back to 4d
            results = p5d.iloc[p5d.cool1.get_loc('C1'), :, :, 0:3, :]
            expected = p4d.iloc[:, :, 0:3, :]
            assert_panel_equal(results['L1'], expected['L1'])

            # test a transpose
            # results  = p5d.transpose(1,2,3,4,0)
            # expected =
