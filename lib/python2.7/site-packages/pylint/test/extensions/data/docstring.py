"""Checks of Dosctrings 'docstring-first-line-empty' 'bad-docstring-quotes'"""


def check_messages(*messages):
    """
    docstring"""
    return messages

def function2():
    """Test Ok"""
    pass

class FFFF(object):
    """
    Test Docstring First Line Empty
    """

    def method1(self):
        '''
        Test Triple Single Quotes docstring
        '''
        pass

    def method2(self):
        "bad docstring 1"
        pass

    def method3(self):
        'bad docstring 2'
        pass

    def method4(self):
        ' """bad docstring 3 '
        pass

    @check_messages('bad-open-mode', 'redundant-unittest-assert',
                    'deprecated-module')
    def method5(self):
        """Test OK 1 with decorators"""
        pass

    def method6(self):
        r"""Test OK 2 with raw string"""
        pass

    def method7(self):
        u"""Test OK 3 with unicode string"""
        pass
