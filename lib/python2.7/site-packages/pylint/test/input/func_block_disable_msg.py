# pylint: disable=C0302,bare-except,print-statement
"""pylint option block-disable"""
from __future__ import print_function

class Foo(object):
    """block-disable test"""

    def __init__(self):
        self._test = "42"

    def meth1(self, arg):
        """this issues a message"""
        print(self)

    def meth2(self, arg):
        """and this one not"""
        # pylint: disable=W0613
        print(self._test\
              + "foo")

    def meth3(self):
        """test one line disabling"""
        # no error
        print(self.bla) # pylint: disable=E1101
        # error
        print(self.blop)

    def meth4(self):
        """test re-enabling"""
        # pylint: disable=E1101
        # no error
        print(self.bla)
        print(self.blop)
        # pylint: enable=E1101
        # error
        print(self.blip)

    def meth5(self):
        """test IF sub-block re-enabling"""
        # pylint: disable=E1101
        # no error
        print(self.bla)
        if self.blop:
            # pylint: enable=E1101
            # error
            print(self.blip)
        else:
            # no error
            print(self.blip)
        # no error
        print(self.blip)

    def meth6(self):
        """test TRY/EXCEPT sub-block re-enabling"""
        # pylint: disable=E1101
        # no error
        print(self.bla)
        try:
            # pylint: enable=E1101
            # error
            print(self.blip)
        except UndefinedName: # pylint: disable=E0602
            # no error
            print(self.blip)
        # no error
        print(self.blip)

    def meth7(self):
        """test one line block opening disabling"""
        if self.blop: # pylint: disable=E1101
            # error
            print(self.blip)
        else:
            # error
            print(self.blip)
        # error
        print(self.blip)


    def meth8(self):
        """test late disabling"""
        # error
        print(self.blip)
        # pylint: disable=E1101
        # no error
        print(self.bla)
        print(self.blop)

    def meth9(self):
        """test re-enabling right after a block with whitespace"""
        eris = 5

        if eris: # pylint: disable=using-constant-test
            print("In block")

        # pylint: disable=E1101
        # no error
        print(self.bla)
        print(self.blu)
        # pylint: enable=E1101
        # error
        print(self.blip)

    def meth10(self):
        """Test double disable"""
        # pylint: disable=E1101
        # no error
        print(self.bla)
        # pylint: disable=E1101
        print(self.blu)


class ClassLevelMessage(object):
    """shouldn't display to much attributes/not enough methods messages
    """
    # pylint: disable=R0902,R0903

    def __init__(self):
        self.attr1 = 1
        self.attr2 = 1
        self.attr3 = 1
        self.attr4 = 1
        self.attr5 = 1
        self.attr6 = 1
        self.attr7 = 1
        self.attr8 = 1
        self.attr9 = 1
        self.attr0 = 1

    def too_complex_but_thats_ok(self, attr1, attr2):
        """THIS Method has too much branches and returns but i don't care
        """
        # pylint: disable=R0912,R0911
        try:
            attr3 = attr1+attr2
        except ValueError:
            attr3 = None
        except:
            return 'duh', self
        if attr1:
            for i in attr1:
                if attr2:
                    return i
            else:
                return 'duh'
        elif attr2:
            for i in attr2:
                if attr2:
                    return i
            else:
                return 'duh'
        else:
            for i in range(15):
                if attr3:
                    return i
            else:
                return 'doh'
        return None



































































































































































































































































































































































































































































































































































































































































































































































































































































































print('hop, too many lines but i don\'t care')
