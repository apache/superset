# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Graph manipulation utilities.

(dot generation adapted from pypy/translator/tool/make_dot.py)
"""

import os.path as osp
import os
import sys
import tempfile
import codecs

def target_info_from_filename(filename):
    """Transforms /some/path/foo.png into ('/some/path', 'foo.png', 'png')."""
    basename = osp.basename(filename)
    storedir = osp.dirname(osp.abspath(filename))
    target = filename.split('.')[-1]
    return storedir, basename, target


class DotBackend(object):
    """Dot File backend."""
    def __init__(self, graphname, rankdir=None, size=None, ratio=None,
                 charset='utf-8', renderer='dot', additional_param=None):
        if additional_param is None:
            additional_param = {}
        self.graphname = graphname
        self.renderer = renderer
        self.lines = []
        self._source = None
        self.emit("digraph %s {" % normalize_node_id(graphname))
        if rankdir:
            self.emit('rankdir=%s' % rankdir)
        if ratio:
            self.emit('ratio=%s' % ratio)
        if size:
            self.emit('size="%s"' % size)
        if charset:
            assert charset.lower() in ('utf-8', 'iso-8859-1', 'latin1'), \
                   'unsupported charset %s' % charset
            self.emit('charset="%s"' % charset)
        for param in additional_param.items():
            self.emit('='.join(param))

    def get_source(self):
        """returns self._source"""
        if self._source is None:
            self.emit("}\n")
            self._source = '\n'.join(self.lines)
            del self.lines
        return self._source

    source = property(get_source)

    def generate(self, outputfile=None, dotfile=None, mapfile=None):
        """Generates a graph file.

        :param str outputfile: filename and path [defaults to graphname.png]
        :param str dotfile: filename and path [defaults to graphname.dot]
        :param str mapfile: filename and path

        :rtype: str
        :return: a path to the generated file
        """
        import subprocess # introduced in py 2.4
        name = self.graphname
        if not dotfile:
            # if 'outputfile' is a dot file use it as 'dotfile'
            if outputfile and outputfile.endswith(".dot"):
                dotfile = outputfile
            else:
                dotfile = '%s.dot' % name
        if outputfile is not None:
            storedir, _, target = target_info_from_filename(outputfile)
            if target != "dot":
                pdot, dot_sourcepath = tempfile.mkstemp(".dot", name)
                os.close(pdot)
            else:
                dot_sourcepath = osp.join(storedir, dotfile)
        else:
            target = 'png'
            pdot, dot_sourcepath = tempfile.mkstemp(".dot", name)
            ppng, outputfile = tempfile.mkstemp(".png", name)
            os.close(pdot)
            os.close(ppng)
        pdot = codecs.open(dot_sourcepath, 'w', encoding='utf8')
        pdot.write(self.source)
        pdot.close()
        if target != 'dot':
            use_shell = sys.platform == 'win32'
            if mapfile:
                subprocess.call([self.renderer, '-Tcmapx', '-o',
                                 mapfile, '-T', target, dot_sourcepath,
                                 '-o', outputfile],
                                shell=use_shell)
            else:
                subprocess.call([self.renderer, '-T', target,
                                 dot_sourcepath, '-o', outputfile],
                                shell=use_shell)
            os.unlink(dot_sourcepath)
        return outputfile

    def emit(self, line):
        """Adds <line> to final output."""
        self.lines.append(line)

    def emit_edge(self, name1, name2, **props):
        """emit an edge from <name1> to <name2>.
        edge properties: see http://www.graphviz.org/doc/info/attrs.html
        """
        attrs = ['%s="%s"' % (prop, value) for prop, value in props.items()]
        n_from, n_to = normalize_node_id(name1), normalize_node_id(name2)
        self.emit('%s -> %s [%s];' % (n_from, n_to, ', '.join(sorted(attrs))))

    def emit_node(self, name, **props):
        """emit a node with given properties.
        node properties: see http://www.graphviz.org/doc/info/attrs.html
        """
        attrs = ['%s="%s"' % (prop, value) for prop, value in props.items()]
        self.emit('%s [%s];' % (normalize_node_id(name), ', '.join(sorted(attrs))))

def normalize_node_id(nid):
    """Returns a suitable DOT node id for `nid`."""
    return '"%s"' % nid

def get_cycles(graph_dict, vertices=None):
    '''given a dictionary representing an ordered graph (i.e. key are vertices
    and values is a list of destination vertices representing edges), return a
    list of detected cycles
    '''
    if not graph_dict:
        return ()
    result = []
    if vertices is None:
        vertices = graph_dict.keys()
    for vertice in vertices:
        _get_cycles(graph_dict, [], set(), result, vertice)
    return result

def _get_cycles(graph_dict, path, visited, result, vertice):
    """recursive function doing the real work for get_cycles"""
    if vertice in path:
        cycle = [vertice]
        for node in path[::-1]:
            if node == vertice:
                break
            cycle.insert(0, node)
        # make a canonical representation
        start_from = min(cycle)
        index = cycle.index(start_from)
        cycle = cycle[index:] + cycle[0:index]
        # append it to result if not already in
        if cycle not in result:
            result.append(cycle)
        return
    path.append(vertice)
    try:
        for node in graph_dict[vertice]:
            # don't check already visited nodes again
            if node not in visited:
                _get_cycles(graph_dict, path, visited, result, node)
                visited.add(node)
    except KeyError:
        pass
    path.pop()
