""" Test for a crash found in
https://bitbucket.org/logilab/astroid/issue/45/attributeerror-module-object-has-no#comment-11944673
"""
# pylint: disable=no-init, invalid-name, too-few-public-methods, redefined-outer-name
def decor(trop):
    """ decorator """
    return trop

class Foo(object):
    """ Class """
    @decor
    def prop(self):
        """ method """
        return self

if __name__ == '__main__':
    trop = Foo()
    trop.prop = 42
