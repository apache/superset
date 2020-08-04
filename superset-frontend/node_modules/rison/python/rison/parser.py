# encoding: utf-8

import os, sys, re

class ParserException(Exception):
    pass

class Parser(object):
    WHITESPACE = ''
    #WHITESPACE = " \t\n\r\f"

    # we divide the uri-safe glyphs into three sets
    # <rison> and <reserved> classes are illegal in ids.
    #   <rison> - used by rison (possibly later)
    #   <reserved> - not common in strings, reserved
    #not_idchar  = "'!=:(),*@$;&";

    idchar_punctuation = '_-./~'
    not_idchar  = ''.join([c for c in (chr(i) for i in range(127))
                           if not (c.isalnum()
                                   or c in idchar_punctuation)])

    # additionally, we need to distinguish ids and numbers by first char
    not_idstart = "-0123456789";

    # regexp string matching a valid id
    idrx = ('[^' + not_idstart + not_idchar + 
            '][^' + not_idchar + ']*')

    # regexp to check for valid rison ids
    id_ok_re = re.compile('^' + idrx + '$', re.M)

    # regexp to find the end of an id when parsing
    next_id_re = re.compile(idrx, re.M)

    """
    This parser supports RISON, RISON-A and RISON-O.
    """
    def parse(self, string, format=str):
        if format in [list, 'A']:
            self.string = "!({0})".format(string)
        elif format in [dict, 'O']:
            self.string = "({0})".format(string)
        elif format is str:
            self.string = string
        else:
            raise ValueError("""Parse format should be one of str, list, dict, 
                'A' (alias for list), '0' (alias for dict).""")
        
        self.index = 0

        value = self.readValue()
        if self.next():
            raise ParserException("unable to parse rison string %r" % (string,))
        return value
    
    def readValue(self):
        c = self.next()

        if c == '!':
            return self.parse_bang()
        if c == '(':
            return self.parse_open_paren()
        if c == "'":
            return self.parse_single_quote()
        if c in '-0123456789':
            return self.parse_number()

        # fell through table, parse as an id
        s = self.string
        i = self.index-1

        m = self.next_id_re.match(s, i)
        if m:
            id = m.group(0)
            self.index = i + len(id)
            return id  # a string

        if c:
            raise ParserException("invalid character: '" + c + "'")
        raise ParserException("empty expression")

    def parse_array(self):
        ar = []
        while 1:
            c = self.next()
            if c == ')':
                return ar

            if c is None:
                raise ParserException("unmatched '!('")

            if len(ar):
                if c != ',':
                    raise ParserException("missing ','")
            elif c == ',':
                raise ParserException("extra ','")
            else:
                self.index -= 1
            n = self.readValue()
            ar.append(n)

        return ar

    def parse_bang (self):
        s = self.string
        c = s[self.index]
        self.index += 1
        if c is None:
            raise ParserException('"!" at end of input')
        if c not in self.bangs:
            raise ParserException('unknown literal: "!' + c + '"')
        x = self.bangs[c]
        if callable(x):
            return x(self)

        return x


    def parse_open_paren (self):
        count = 0
        o = {}

        while 1:
            c = self.next()
            if c == ')':
                return o
            if count:
                if c != ',':
                    raise ParserException("missing ','")
            elif c == ',':
                raise ParserException("extra ','")
            else:
                self.index -= 1
            k = self.readValue()

            if self.next() != ':':
                raise ParserException("missing ':'")
            v = self.readValue()

            o[k] = v
            count += 1
        

    def parse_single_quote(self):
        s = self.string
        i = self.index
        start = i
        segments = []

        while 1:
            if i >= len(s):
                raise ParserException('unmatched "\'"')

            c = s[i]
            i += 1
            if c == "'":
                break

            if c == '!':
                if start < i-1:
                    segments.append(s[start:i-1])
                c = s[i]
                i += 1
                if c in "!'":
                    segments.append(c)
                else:
                    raise ParserException('invalid string escape: "!'+c+'"')
                
                start = i
            
        
        if start < i-1:
            segments.append(s[start:i-1])
        self.index = i
        return ''.join(segments)


    # Also any number start (digit or '-')
    def parse_number(self):
        s = self.string
        i = self.index
        start = i-1
        state = 'int'
        permittedSigns = '-'
        transitions = {
            'int+.': 'frac',
            'int+e': 'exp',
            'frac+e': 'exp'
            }
        
        while 1:
            if i >= len(s):
                i += 1
                break

            c = s[i]
            i += 1

            if '0' <= c and c <= '9':
                continue

            if permittedSigns.find(c) >= 0:
                permittedSigns = ''
                continue

            state = transitions.get(state + '+' + c.lower(), None)
            if state is None:
                break
            if state == 'exp':
                permittedSigns = '-'

        self.index = i - 1
        s = s[start:self.index]
        if s == '-':
            raise ParserException("invalid number")
        if re.search('[.e]', s):
            return float(s)
        return int(s)
    
    # return the next non-whitespace character, or undefined
    def next(self):
        l = len(self.string)
        s = self.string
        i = self.index

        while 1:
            if i == len(s):
                return None
            c = s[i]
            i += 1
            if c not in self.WHITESPACE:
                break

        self.index = i
        return c


    bangs = {
        't': True,
        'f': False,
        'n': None,
        '(': parse_array
        }

def loads(s, format=str):
    return Parser().parse(s, format=format)
