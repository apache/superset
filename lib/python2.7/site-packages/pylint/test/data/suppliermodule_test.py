""" file suppliermodule.py """

class Interface:
    def get_value(self):
        raise NotImplementedError

    def set_value(self, value):
        raise NotImplementedError

class DoNothing: pass
