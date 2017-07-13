# pylint: disable=missing-docstring
from __future__ import print_function

def function(arg1, arg2, arg3, arg4, arg5): # [too-many-locals]
    arg6, arg7, arg8, arg9 = arg1, arg2, arg3, arg4
    print(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9)
    loc1, loc2, loc3, loc4, loc5, loc6, loc7 = arg1, arg2, arg3, arg4, arg5, \
 arg6, arg7
    print(loc1, loc2, loc3, loc4, loc5, loc6, loc7)


def too_many_locals_function(): # [too-many-locals]
    """pylint will complains about too many local variables"""
    args0 = 0
    args1 = args0 * 1
    args2 = args1 * 2
    args3 = args2 * 3
    args4 = args3 * 4
    args5 = args4 * 5
    args6 = args5 * 6
    args7 = args6 * 7
    args8 = args7 * 8
    args9 = args8 * 9
    args10 = args9 * 10
    args11 = args10 * 11
    args12 = args11 * 12
    args13 = args12 * 13
    args14 = args13 * 14
    args15 = args14 * 15
    return args15

def too_many_arguments_function(arga, argu, argi, arge, argt, args): # [too-many-arguments]
    """pylint will complains about too many arguments."""
    arga = argu
    arga += argi
    arga += arge
    arga += argt
    arga += args
    return arga

def ignored_arguments_function(arga, argu, argi,
                               _arge=0, _argt=1, _args=None):
    """pylint will ignore _arge, _argt, _args.

    Consequently pylint will only coun 13 arguments.
    """
    arg0 = 0
    arg1 = arg0 * 1 + arga
    arg2 = arg1 * 2 + argu
    arg3 = arg2 * 3 + argi
    arg4 = arg3 * 4 + _arge
    arg5 = arg4 * 5 + _argt
    arg6 = arg5 * 6
    arg7 = arg6 * 7
    arg8 = arg7 * 8
    arg9 = arg8 * 9
    arg9 += arg0
    if _args:
        arg9 += sum(_args)
    return arg9
