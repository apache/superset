"""Warnings for using type(x) == Y or type(x) is Y instead of isinstance(x, Y)."""
# pylint: disable=missing-docstring,expression-not-assigned,redefined-builtin,invalid-name

def simple_positives():
    type(42) is int # [unidiomatic-typecheck]
    type(42) is not int # [unidiomatic-typecheck]
    type(42) == int # [unidiomatic-typecheck]
    type(42) != int # [unidiomatic-typecheck]
    type(42) in [int] # [unidiomatic-typecheck]
    type(42) not in [int] # [unidiomatic-typecheck]

def simple_inference_positives():
    alias = type
    alias(42) is int # [unidiomatic-typecheck]
    alias(42) is not int # [unidiomatic-typecheck]
    alias(42) == int # [unidiomatic-typecheck]
    alias(42) != int # [unidiomatic-typecheck]
    alias(42) in [int] # [unidiomatic-typecheck]
    alias(42) not in [int] # [unidiomatic-typecheck]

def type_creation_negatives():
    type('Q', (object,), dict(a=1)) is int
    type('Q', (object,), dict(a=1)) is not int
    type('Q', (object,), dict(a=1)) == int
    type('Q', (object,), dict(a=1)) != int
    type('Q', (object,), dict(a=1)) in [int]
    type('Q', (object,), dict(a=1)) not in [int]

def invalid_type_call_negatives(**kwargs):
    type(bad=7) is int
    type(bad=7) is not int
    type(bad=7) == int
    type(bad=7) != int
    type(bad=7) in [int]
    type(bad=7) not in [int]
    type('bad', 7) is int
    type('bad', 7) is not int
    type('bad', 7) == int
    type('bad', 7) != int
    type('bad', 7) in [int]
    type('bad', 7) not in [int]
    type(**kwargs) is int
    type(**kwargs) is not int
    type(**kwargs) == int
    type(**kwargs) != int
    type(**kwargs) in [int]
    type(**kwargs) not in [int]

def local_var_shadowing_inference_negatives():
    type = lambda dummy: 7
    type(42) is int
    type(42) is not int
    type(42) == int
    type(42) != int
    type(42) in [int]
    type(42) not in [int]

def parameter_shadowing_inference_negatives(type):
    type(42) is int
    type(42) is not int
    type(42) == int
    type(42) != int
    type(42) in [int]
    type(42) not in [int]

def deliberate_subclass_check_negatives(b):
    type(42) is type(b)
    type(42) is not type(b)

def type_of_literals_positives(a):
    type(a) is type([]) # [unidiomatic-typecheck]
    type(a) is not type([]) # [unidiomatic-typecheck]
    type(a) is type({}) # [unidiomatic-typecheck]
    type(a) is not type({}) # [unidiomatic-typecheck]
    type(a) is type("") # [unidiomatic-typecheck]
    type(a) is not type("") # [unidiomatic-typecheck]
