#-*- coding:utf-8 -*-
u'''
embedding youtube video to sphinx

usage:

First of all, add `sphinxcontrib.youtube` to sphinx extension list in conf.py

.. code-block:: python

   extensions = ['sphinxcontrib.youtube']


then use `youtube` directive.

.. code-block:: rst

   .. youtube:: http://www.youtube.com/watch?v=Ql9sn3aLLlI


finally, build your sphinx project.

.. code-block:: sh

   $ make html

'''

__version__ = '0.1.2'
__author__ = '@shomah4a'
__license__ = 'LGPLv3'



def setup(app):

    from . import youtube

    app.add_node(youtube.youtube,
                 html=(youtube.visit, youtube.depart))
    app.add_directive('youtube', youtube.YoutubeDirective)

