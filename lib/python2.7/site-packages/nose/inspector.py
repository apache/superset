"""Simple traceback introspection. Used to add additional information to
AssertionErrors in tests, so that failure messages may be more informative.
"""
import inspect
import logging
import re
import sys
import textwrap
import tokenize

try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

log = logging.getLogger(__name__)

def inspect_traceback(tb):
    """Inspect a traceback and its frame, returning source for the expression
    where the exception was raised, with simple variable replacement performed
    and the line on which the exception was raised marked with '>>'
    """
    log.debug('inspect traceback %s', tb)

    # we only want the innermost frame, where the exception was raised
    while tb.tb_next:
        tb = tb.tb_next
        
    frame = tb.tb_frame
    lines, exc_line = tbsource(tb)
        
    # figure out the set of lines to grab.
    inspect_lines, mark_line = find_inspectable_lines(lines, exc_line)
    src = StringIO(textwrap.dedent(''.join(inspect_lines)))
    exp = Expander(frame.f_locals, frame.f_globals)

    while inspect_lines:
        try:
            for tok in tokenize.generate_tokens(src.readline):
                exp(*tok)
        except tokenize.TokenError, e:
            # this can happen if our inspectable region happens to butt up
            # against the end of a construct like a docstring with the closing
            # """ on separate line
            log.debug("Tokenizer error: %s", e)
            inspect_lines.pop(0)
            mark_line -= 1
            src = StringIO(textwrap.dedent(''.join(inspect_lines)))
            exp = Expander(frame.f_locals, frame.f_globals)
            continue
        break
    padded = []
    if exp.expanded_source:
        exp_lines = exp.expanded_source.split('\n')
        ep = 0
        for line in exp_lines:
            if ep == mark_line:
                padded.append('>>  ' + line)
            else:
                padded.append('    ' + line)
            ep += 1
    return '\n'.join(padded)


def tbsource(tb, context=6):
    """Get source from  a traceback object.

    A tuple of two things is returned: a list of lines of context from
    the source code, and the index of the current line within that list.
    The optional second argument specifies the number of lines of context
    to return, which are centered around the current line.

    .. Note ::
       This is adapted from inspect.py in the python 2.4 standard library, 
       since a bug in the 2.3 version of inspect prevents it from correctly
       locating source lines in a traceback frame.
    """
    
    lineno = tb.tb_lineno
    frame = tb.tb_frame

    if context > 0:
        start = lineno - 1 - context//2
        log.debug("lineno: %s start: %s", lineno, start)
        
        try:
            lines, dummy = inspect.findsource(frame)
        except IOError:
            lines, index = [''], 0
        else:
            all_lines = lines
            start = max(start, 1)
            start = max(0, min(start, len(lines) - context))
            lines = lines[start:start+context]
            index = lineno - 1 - start
            
            # python 2.5 compat: if previous line ends in a continuation,
            # decrement start by 1 to match 2.4 behavior                
            if sys.version_info >= (2, 5) and index > 0:
                while lines[index-1].strip().endswith('\\'):
                    start -= 1
                    lines = all_lines[start:start+context]
    else:
        lines, index = [''], 0
    log.debug("tbsource lines '''%s''' around index %s", lines, index)
    return (lines, index)    

    
def find_inspectable_lines(lines, pos):
    """Find lines in home that are inspectable.
    
    Walk back from the err line up to 3 lines, but don't walk back over
    changes in indent level.

    Walk forward up to 3 lines, counting \ separated lines as 1. Don't walk
    over changes in indent level (unless part of an extended line)
    """
    cnt = re.compile(r'\\[\s\n]*$')
    df = re.compile(r':[\s\n]*$')
    ind = re.compile(r'^(\s*)')
    toinspect = []
    home = lines[pos]
    home_indent = ind.match(home).groups()[0]
    
    before = lines[max(pos-3, 0):pos]
    before.reverse()
    after = lines[pos+1:min(pos+4, len(lines))]

    for line in before:
        if ind.match(line).groups()[0] == home_indent:
            toinspect.append(line)
        else:
            break
    toinspect.reverse()
    toinspect.append(home)
    home_pos = len(toinspect)-1
    continued = cnt.search(home)
    for line in after:
        if ((continued or ind.match(line).groups()[0] == home_indent)
            and not df.search(line)):
            toinspect.append(line)
            continued = cnt.search(line)
        else:
            break
    log.debug("Inspecting lines '''%s''' around %s", toinspect, home_pos)
    return toinspect, home_pos


class Expander:
    """Simple expression expander. Uses tokenize to find the names and
    expands any that can be looked up in the frame.
    """
    def __init__(self, locals, globals):
        self.locals = locals
        self.globals = globals
        self.lpos = None
        self.expanded_source = ''
         
    def __call__(self, ttype, tok, start, end, line):
        # TODO
        # deal with unicode properly
        
        # TODO
        # Dealing with instance members
        #   always keep the last thing seen  
        #   if the current token is a dot,
        #      get ready to getattr(lastthing, this thing) on the
        #      next call.
        
        if self.lpos is not None:
            if start[1] >= self.lpos:
                self.expanded_source += ' ' * (start[1]-self.lpos)
            elif start[1] < self.lpos:
                # newline, indent correctly
                self.expanded_source += ' ' * start[1]
        self.lpos = end[1]
      
        if ttype == tokenize.INDENT:
            pass
        elif ttype == tokenize.NAME:
            # Clean this junk up
            try:
                val = self.locals[tok]
                if callable(val):
                    val = tok
                else:
                    val = repr(val)
            except KeyError:
                try:
                    val = self.globals[tok]
                    if callable(val):
                        val = tok
                    else:
                        val = repr(val)

                except KeyError:
                    val = tok
            # FIXME... not sure how to handle things like funcs, classes
            # FIXME this is broken for some unicode strings
            self.expanded_source += val
        else:
            self.expanded_source += tok
        # if this is the end of the line and the line ends with
        # \, then tack a \ and newline onto the output
        # print line[end[1]:]
        if re.match(r'\s+\\\n', line[end[1]:]):
            self.expanded_source += ' \\\n'
