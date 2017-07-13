from __future__ import print_function
from data import SSL1
class MyConnection(SSL1.Connection):

    """An SSL connection."""

    def __init__(self, dummy):
        print('MyConnection init')

if __name__ == '__main__':
    myConnection = MyConnection(' ')
    raw_input('Press Enter to continue...')
