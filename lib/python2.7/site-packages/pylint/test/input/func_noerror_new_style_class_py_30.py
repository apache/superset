"""check builtin data descriptors such as mode and name attributes
on a file are correctly handled

bug notified by Pierre Rouleau on 2005-04-24
"""
from __future__ import print_function
__revision__ = None

class File(file):  # pylint: disable=file-builtin
    """ Testing new-style class inheritance from file"""

    #
    def __init__(self, name, mode="r", buffering=-1, verbose=False):
        """Constructor"""

        self.was_modified = False
        self.verbose = verbose
        super(File, self).__init__(name, mode, buffering)
        if self.verbose:
            print("File %s is opened.  The mode is: %s" % (self.name,
                                                           self.mode))

    #
    def write(self, a_string):
        """ Write a string to the file."""

        super(File, self).write(a_string)
        self.was_modified = True

    #
    def writelines(self, sequence):
        """ Write a sequence of strings to the file. """

        super(File, self).writelines(sequence)
        self.was_modified = True

    #
    def close(self):
        """Close the file."""

        if self.verbose:
            print("Closing file %s" % self.name)

        super(File, self).close()
        self.was_modified = False
