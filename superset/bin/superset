#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import warnings
import click
from flask.cli import FlaskGroup
from flask.exthook import ExtDeprecationWarning
from superset.cli import create_app

warnings.simplefilter('ignore', ExtDeprecationWarning)

@click.group(cls=FlaskGroup, create_app=create_app)
def cli():
    """This is a management script for the superset application."""

if __name__ == '__main__':
    cli()
