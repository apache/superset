"""Check multiple key definition"""
# pylint: disable=C0103,pointless-statement

correct_dict = {
    'tea': 'for two',
    'two': 'for tea',
}

wrong_dict = {  # [duplicate-key]
    'tea': 'for two',
    'two': 'for tea',
    'tea': 'time',

}

{1: b'a', 1: u'a'} # [duplicate-key]
{1: 1, 1.0: 2} # [duplicate-key]
