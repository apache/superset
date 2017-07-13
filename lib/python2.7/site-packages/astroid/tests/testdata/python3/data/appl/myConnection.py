from data import SSL1
class MyConnection(SSL1.Connection):

    """An SSL connection."""

    def __init__(self, dummy):
        print('MyConnection init')

if __name__ == '__main__':
    myConnection = MyConnection(' ')
    input('Press Enter to continue...')
