import unittest


class TestCase(unittest.TestCase):

    def setUp(self):
        unittest.TestCase.setUp(self)


    def tearDown(self):
        unittest.TestCase.tearDown(self)

    def testIt(self):
        self.a = 10
        self.xxx()


    def xxx(self):
        if False:
            pass
            print('a')

        if False:
            pass
            pass

        if False:
            pass
            print('rara')


if __name__ == '__main__':
    print('test2')
    unittest.main()


