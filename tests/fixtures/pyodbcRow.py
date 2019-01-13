# pylint: disable=C,R,W


class Row(object):
    def __init__(self, values):
        self.values = values

    def __name__(self):
        return 'Row'

    def __iter__(self):
        return (item for item in self.values)
