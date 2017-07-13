from __future__ import absolute_import

import billiard

from .utils import Case


class test_billiard(Case):

    def test_has_version(self):
        self.assertTrue(billiard.__version__)
        self.assertIsInstance(billiard.__version__, str)
