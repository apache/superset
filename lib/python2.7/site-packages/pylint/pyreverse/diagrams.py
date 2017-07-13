# Copyright (c) 2006, 2008-2010, 2012-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""diagram objects
"""

import astroid
from pylint.pyreverse.utils import is_interface, FilterMixIn
from pylint.checkers.utils import decorated_with_property


class Figure(object):
    """base class for counter handling"""


class Relationship(Figure):
    """a relation ship from an object in the diagram to another
    """
    def __init__(self, from_object, to_object, relation_type, name=None):
        Figure.__init__(self)
        self.from_object = from_object
        self.to_object = to_object
        self.type = relation_type
        self.name = name


class DiagramEntity(Figure):
    """a diagram object, i.e. a label associated to an astroid node
    """
    def __init__(self, title='No name', node=None):
        Figure.__init__(self)
        self.title = title
        self.node = node


class ClassDiagram(Figure, FilterMixIn):
    """main class diagram handling
    """
    TYPE = 'class'
    def __init__(self, title, mode):
        FilterMixIn.__init__(self, mode)
        Figure.__init__(self)
        self.title = title
        self.objects = []
        self.relationships = {}
        self._nodes = {}
        self.depends = []

    def get_relationships(self, role):
        # sorted to get predictable (hence testable) results
        return sorted(self.relationships.get(role, ()),
                      key=lambda x: (x.from_object.fig_id, x.to_object.fig_id))

    def add_relationship(self, from_object, to_object,
                         relation_type, name=None):
        """create a relation ship
        """
        rel = Relationship(from_object, to_object, relation_type, name)
        self.relationships.setdefault(relation_type, []).append(rel)

    def get_relationship(self, from_object, relation_type):
        """return a relation ship or None
        """
        for rel in self.relationships.get(relation_type, ()):
            if rel.from_object is from_object:
                return rel
        raise KeyError(relation_type)

    def get_attrs(self, node):
        """return visible attributes, possibly with class name"""
        attrs = []
        properties = [
            (n, m) for n, m in node.items()
            if isinstance(m, astroid.FunctionDef)
            and decorated_with_property(m)
        ]
        for node_name, ass_nodes in list(node.instance_attrs_type.items()) + \
                                    list(node.locals_type.items()) + properties:
            if not self.show_attr(node_name):
                continue
            names = self.class_names(ass_nodes)
            if names:
                node_name = "%s : %s" % (node_name, ", ".join(names))
            attrs.append(node_name)
        return sorted(attrs)

    def get_methods(self, node):
        """return visible methods"""
        methods = [
            m for m in node.values()
            if isinstance(m, astroid.FunctionDef)
            and not decorated_with_property(m)
            and self.show_attr(m.name)
        ]
        return sorted(methods, key=lambda n: n.name)

    def add_object(self, title, node):
        """create a diagram object
        """
        assert node not in self._nodes
        ent = DiagramEntity(title, node)
        self._nodes[node] = ent
        self.objects.append(ent)

    def class_names(self, nodes):
        """return class names if needed in diagram"""
        names = []
        for ass_node in nodes:
            if isinstance(ass_node, astroid.Instance):
                ass_node = ass_node._proxied
            if isinstance(ass_node, astroid.ClassDef) \
                and hasattr(ass_node, "name") and not self.has_node(ass_node):
                if ass_node.name not in names:
                    ass_name = ass_node.name
                    names.append(ass_name)
        return names

    def nodes(self):
        """return the list of underlying nodes
        """
        return self._nodes.keys()

    def has_node(self, node):
        """return true if the given node is included in the diagram
        """
        return node in self._nodes

    def object_from_node(self, node):
        """return the diagram object mapped to node
        """
        return self._nodes[node]

    def classes(self):
        """return all class nodes in the diagram"""
        return [o for o in self.objects if isinstance(o.node, astroid.ClassDef)]

    def classe(self, name):
        """return a class by its name, raise KeyError if not found
        """
        for klass in self.classes():
            if klass.node.name == name:
                return klass
        raise KeyError(name)

    def extract_relationships(self):
        """extract relation ships between nodes in the diagram
        """
        for obj in self.classes():
            node = obj.node
            obj.attrs = self.get_attrs(node)
            obj.methods = self.get_methods(node)
            # shape
            if is_interface(node):
                obj.shape = 'interface'
            else:
                obj.shape = 'class'
            # inheritance link
            for par_node in node.ancestors(recurs=False):
                try:
                    par_obj = self.object_from_node(par_node)
                    self.add_relationship(obj, par_obj, 'specialization')
                except KeyError:
                    continue
            # implements link
            for impl_node in node.implements:
                try:
                    impl_obj = self.object_from_node(impl_node)
                    self.add_relationship(obj, impl_obj, 'implements')
                except KeyError:
                    continue
            # associations link
            for name, values in list(node.instance_attrs_type.items()) + \
                                list(node.locals_type.items()):
                for value in values:
                    if value is astroid.YES:
                        continue
                    if isinstance(value, astroid.Instance):
                        value = value._proxied
                    try:
                        ass_obj = self.object_from_node(value)
                        self.add_relationship(ass_obj, obj, 'association', name)
                    except KeyError:
                        continue


class PackageDiagram(ClassDiagram):
    """package diagram handling
    """
    TYPE = 'package'

    def modules(self):
        """return all module nodes in the diagram"""
        return [o for o in self.objects if isinstance(o.node, astroid.Module)]

    def module(self, name):
        """return a module by its name, raise KeyError if not found
        """
        for mod in self.modules():
            if mod.node.name == name:
                return mod
        raise KeyError(name)

    def get_module(self, name, node):
        """return a module by its name, looking also for relative imports;
        raise KeyError if not found
        """
        for mod in self.modules():
            mod_name = mod.node.name
            if mod_name == name:
                return mod
            #search for fullname of relative import modules
            package = node.root().name
            if mod_name == "%s.%s" % (package, name):
                return mod
            if mod_name == "%s.%s" % (package.rsplit('.', 1)[0], name):
                return mod
        raise KeyError(name)

    def add_from_depend(self, node, from_module):
        """add dependencies created by from-imports
        """
        mod_name = node.root().name
        obj = self.module(mod_name)
        if from_module not in obj.node.depends:
            obj.node.depends.append(from_module)

    def extract_relationships(self):
        """extract relation ships between nodes in the diagram
        """
        ClassDiagram.extract_relationships(self)
        for obj in self.classes():
            # ownership
            try:
                mod = self.object_from_node(obj.node.root())
                self.add_relationship(obj, mod, 'ownership')
            except KeyError:
                continue
        for obj in self.modules():
            obj.shape = 'package'
            # dependencies
            for dep_name in obj.node.depends:
                try:
                    dep = self.get_module(dep_name, obj.node)
                except KeyError:
                    continue
                self.add_relationship(obj, dep, 'depends')
