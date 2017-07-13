""" Checks for boolean uses of datetime.time. """
# pylint: disable=superfluous-parens,print-statement,no-absolute-import,consider-using-ternary
import datetime

if datetime.time(0, 0, 0): # [boolean-datetime]
    print("datetime.time(0,0,0) is not a bug!")
else:
    print("datetime.time(0,0,0) is a bug!")

if not datetime.time(0, 0, 1): # [boolean-datetime]
    print("datetime.time(0,0,1) is not a bug!")
else:
    print("datetime.time(0,0,1) is a bug!")

DATA = not datetime.time(0, 0, 0) # [boolean-datetime]
DATA1 = True if datetime.time(0, 0, 0) else False # [boolean-datetime]
DATA2 = datetime.time(0, 0, 0) or True # [boolean-datetime]
DATA3 = datetime.time(0, 0, 0) and True # [boolean-datetime]
DATA4 = False or True or datetime.time(0, 0, 0) # [boolean-datetime]
DATA5 = False and datetime.time(0, 0, 0) or True # [boolean-datetime]


def cant_infer(data):
    """ Can't infer what data is """
    hophop = not data
    troptrop = True if data else False
    toptop = data or True
    return hophop, troptrop, toptop

cant_infer(datetime.time(0, 0, 0))
