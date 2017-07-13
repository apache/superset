""" Testing with statements that use generators. This should not crash. """

class Base(object):
    """ Base class. """
    val = 0

    def gen(self):
        """ A generator. """
        yield self.val

    def fun(self):
        """ With statement using a generator. """
        with self.gen():  # [not-context-manager]
            pass
