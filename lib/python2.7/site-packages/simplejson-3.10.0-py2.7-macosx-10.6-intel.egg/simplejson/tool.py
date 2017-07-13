r"""Command-line tool to validate and pretty-print JSON

Usage::

    $ echo '{"json":"obj"}' | python -m simplejson.tool
    {
        "json": "obj"
    }
    $ echo '{ 1.2:3.4}' | python -m simplejson.tool
    Expecting property name: line 1 column 2 (char 2)

"""
from __future__ import with_statement
import sys
import simplejson as json

def main():
    if len(sys.argv) == 1:
        infile = sys.stdin
        outfile = sys.stdout
    elif len(sys.argv) == 2:
        infile = open(sys.argv[1], 'r')
        outfile = sys.stdout
    elif len(sys.argv) == 3:
        infile = open(sys.argv[1], 'r')
        outfile = open(sys.argv[2], 'w')
    else:
        raise SystemExit(sys.argv[0] + " [infile [outfile]]")
    with infile:
        try:
            obj = json.load(infile,
                            object_pairs_hook=json.OrderedDict,
                            use_decimal=True)
        except ValueError:
            raise SystemExit(sys.exc_info()[1])
    with outfile:
        json.dump(obj, outfile, sort_keys=True, indent='    ', use_decimal=True)
        outfile.write('\n')


if __name__ == '__main__':
    main()
