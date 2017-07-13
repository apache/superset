"""Attribute selector plugin.

Oftentimes when testing you will want to select tests based on
criteria rather then simply by filename. For example, you might want
to run all tests except for the slow ones. You can do this with the
Attribute selector plugin by setting attributes on your test methods.
Here is an example:

.. code-block:: python

    def test_big_download():
        import urllib
        # commence slowness...

    test_big_download.slow = 1

Once you've assigned an attribute ``slow = 1`` you can exclude that
test and all other tests having the slow attribute by running ::

    $ nosetests -a '!slow'

There is also a decorator available for you that will set attributes.
Here's how to set ``slow=1`` like above with the decorator:

.. code-block:: python

    from nose.plugins.attrib import attr
    @attr('slow')
    def test_big_download():
        import urllib
        # commence slowness...

And here's how to set an attribute with a specific value:

.. code-block:: python

    from nose.plugins.attrib import attr
    @attr(speed='slow')
    def test_big_download():
        import urllib
        # commence slowness...

This test could be run with ::

    $ nosetests -a speed=slow

In Python 2.6 and higher, ``@attr`` can be used on a class to set attributes
on all its test methods at once.  For example:

.. code-block:: python

    from nose.plugins.attrib import attr
    @attr(speed='slow')
    class MyTestCase:
        def test_long_integration(self):
            pass
        def test_end_to_end_something(self):
            pass

Below is a reference to the different syntaxes available.

Simple syntax
-------------

Examples of using the ``-a`` and ``--attr`` options:

* ``nosetests -a status=stable``
   Only runs tests with attribute "status" having value "stable"

* ``nosetests -a priority=2,status=stable``
   Runs tests having both attributes and values

* ``nosetests -a priority=2 -a slow``
   Runs tests that match either attribute

* ``nosetests -a tags=http``
   If a test's ``tags`` attribute was a list and it contained the value
   ``http`` then it would be run

* ``nosetests -a slow``
   Runs tests with the attribute ``slow`` if its value does not equal False
   (False, [], "", etc...)

* ``nosetests -a '!slow'``
   Runs tests that do NOT have the attribute ``slow`` or have a ``slow``
   attribute that is equal to False
   **NOTE**:
   if your shell (like bash) interprets '!' as a special character make sure to
   put single quotes around it.

Expression Evaluation
---------------------

Examples using the ``-A`` and ``--eval-attr`` options:

* ``nosetests -A "not slow"``
  Evaluates the Python expression "not slow" and runs the test if True

* ``nosetests -A "(priority > 5) and not slow"``
  Evaluates a complex Python expression and runs the test if True

"""
import inspect
import logging
import os
import sys
from inspect import isfunction
from nose.plugins.base import Plugin
from nose.util import tolist

log = logging.getLogger('nose.plugins.attrib')
compat_24 = sys.version_info >= (2, 4)

def attr(*args, **kwargs):
    """Decorator that adds attributes to classes or functions
    for use with the Attribute (-a) plugin.
    """
    def wrap_ob(ob):
        for name in args:
            setattr(ob, name, True)
        for name, value in kwargs.iteritems():
            setattr(ob, name, value)
        return ob
    return wrap_ob

def get_method_attr(method, cls, attr_name, default = False):
    """Look up an attribute on a method/ function. 
    If the attribute isn't found there, looking it up in the
    method's class, if any.
    """
    Missing = object()
    value = getattr(method, attr_name, Missing)
    if value is Missing and cls is not None:
        value = getattr(cls, attr_name, Missing)
    if value is Missing:
        return default
    return value


class ContextHelper:
    """Object that can act as context dictionary for eval and looks up
    names as attributes on a method/ function and its class. 
    """
    def __init__(self, method, cls):
        self.method = method
        self.cls = cls

    def __getitem__(self, name):
        return get_method_attr(self.method, self.cls, name)


class AttributeSelector(Plugin):
    """Selects test cases to be run based on their attributes.
    """

    def __init__(self):
        Plugin.__init__(self)
        self.attribs = []

    def options(self, parser, env):
        """Register command line options"""
        parser.add_option("-a", "--attr",
                          dest="attr", action="append",
                          default=env.get('NOSE_ATTR'),
                          metavar="ATTR",
                          help="Run only tests that have attributes "
                          "specified by ATTR [NOSE_ATTR]")
        # disable in < 2.4: eval can't take needed args
        if compat_24:
            parser.add_option("-A", "--eval-attr",
                              dest="eval_attr", metavar="EXPR", action="append",
                              default=env.get('NOSE_EVAL_ATTR'),
                              help="Run only tests for whose attributes "
                              "the Python expression EXPR evaluates "
                              "to True [NOSE_EVAL_ATTR]")

    def configure(self, options, config):
        """Configure the plugin and system, based on selected options.

        attr and eval_attr may each be lists.

        self.attribs will be a list of lists of tuples. In that list, each
        list is a group of attributes, all of which must match for the rule to
        match.
        """
        self.attribs = []

        # handle python eval-expression parameter
        if compat_24 and options.eval_attr:
            eval_attr = tolist(options.eval_attr)
            for attr in eval_attr:
                # "<python expression>"
                # -> eval(expr) in attribute context must be True
                def eval_in_context(expr, obj, cls):
                    return eval(expr, None, ContextHelper(obj, cls))
                self.attribs.append([(attr, eval_in_context)])

        # attribute requirements are a comma separated list of
        # 'key=value' pairs
        if options.attr:
            std_attr = tolist(options.attr)
            for attr in std_attr:
                # all attributes within an attribute group must match
                attr_group = []
                for attrib in attr.strip().split(","):
                    # don't die on trailing comma
                    if not attrib:
                        continue
                    items = attrib.split("=", 1)
                    if len(items) > 1:
                        # "name=value"
                        # -> 'str(obj.name) == value' must be True
                        key, value = items
                    else:
                        key = items[0]
                        if key[0] == "!":
                            # "!name"
                            # 'bool(obj.name)' must be False
                            key = key[1:]
                            value = False
                        else:
                            # "name"
                            # -> 'bool(obj.name)' must be True
                            value = True
                    attr_group.append((key, value))
                self.attribs.append(attr_group)
        if self.attribs:
            self.enabled = True

    def validateAttrib(self, method, cls = None):
        """Verify whether a method has the required attributes
        The method is considered a match if it matches all attributes
        for any attribute group.
        ."""
        # TODO: is there a need for case-sensitive value comparison?
        any = False
        for group in self.attribs:
            match = True
            for key, value in group:
                attr = get_method_attr(method, cls, key)
                if callable(value):
                    if not value(key, method, cls):
                        match = False
                        break
                elif value is True:
                    # value must exist and be True
                    if not bool(attr):
                        match = False
                        break
                elif value is False:
                    # value must not exist or be False
                    if bool(attr):
                        match = False
                        break
                elif type(attr) in (list, tuple):
                    # value must be found in the list attribute
                    if not str(value).lower() in [str(x).lower()
                                                  for x in attr]:
                        match = False
                        break
                else:
                    # value must match, convert to string and compare
                    if (value != attr
                        and str(value).lower() != str(attr).lower()):
                        match = False
                        break
            any = any or match
        if any:
            # not True because we don't want to FORCE the selection of the
            # item, only say that it is acceptable
            return None
        return False

    def wantFunction(self, function):
        """Accept the function if its attributes match.
        """
        return self.validateAttrib(function)

    def wantMethod(self, method):
        """Accept the method if its attributes match.
        """
        try:
            cls = method.im_class
        except AttributeError:
            return False
        return self.validateAttrib(method, cls)
