# pylint: disable=missing-docstring,too-few-public-methods,import-error
from UNINFERABLE import ImportedMetaclass


class Meta(type):
    pass


class Class(metaclass=Meta):
    pass


def func_scope():
    class Meta2(type):
        pass

    class Class2(metaclass=Meta2):
        pass

    return Class2


class ClassScope:
    class Meta3(type):
        pass

    class Class3(metaclass=Meta3):
        pass

    instance = Class3()


def mixed_scopes():
    class ClassM(metaclass=Meta):
        pass

    return ClassM


def imported_and_nested_scope1():
    class ClassImp1(metaclass=ImportedMetaclass):
        pass

    class ClassImp2(metaclass=ImportedMetaclass):
        pass

    return ClassImp1, ClassImp2


def imported_and_nested_scope2():
    from UNINFERABLE import ImportedMetaclass2

    class ClassImp3(metaclass=ImportedMetaclass2):
        pass

    return ClassImp3
