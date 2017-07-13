"""
CLI arguments definition.
"""

import argparse
import sys


class ArgumentParser(argparse.ArgumentParser):
    def __init__(self):
        argparse.ArgumentParser.__init__(
            self,
            prog="codeclimate-test-reporter",
            description="Report test coverage to Code Climate"
        )

        self.add_argument(
            "--file",
            help="A coverage.py coverage file to report",
            default="./.coverage"
        )

        self.add_argument("--token", help="Code Climate repo token")
        self.add_argument("--stdout", help="Output to STDOUT", action="store_true")
        self.add_argument("--debug", help="Enable debug mode", action="store_true")
        self.add_argument("--version", help="Show the version", action="store_true")
