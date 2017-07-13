"""Independent implementation of a Trie tree."""

__all__ = ('Trie', 'TrieNode')


def _iterate_stringlike_objects(string):
    for i in range(len(string)):
        yield string[i:i + 1]


class Trie(object):
    """The object that manages the trie nodes."""

    def __init__(self):
        """Initialize an empty trie."""
        self.root = TrieNode(None, None)

    def add(self, path, node_data):
        """Add the node data to the path described."""
        node = self.root
        for prefix in _iterate_stringlike_objects(path):
            child = node.find_prefix(prefix)
            if child is None:
                child = node.add_child(prefix, [])
            node = child
        node.data.append(node_data)

    def find(self, path):
        """Find a node based on the path provided."""
        node = self.root
        for prefix in _iterate_stringlike_objects(path):
            child = node.find_prefix(prefix)
            if child is None:
                return None
            node = child
        return node

    def traverse(self):
        """Traverse this tree.

        This performs a depth-first pre-order traversal of children in this
        tree. It returns the results consistently by first sorting the
        children based on their prefix and then traversing them in
        alphabetical order.
        """
        return self.root.traverse()


class TrieNode(object):
    """The majority of the implementation details of a Trie."""

    def __init__(self, prefix, data, children=None):
        """Initialize a TrieNode with data and children."""
        self.children = children or {}
        self.data = data
        self.prefix = prefix

    def __repr__(self):
        """Generate an easy to read representation of the node."""
        return 'TrieNode(prefix={0}, data={1})'.format(
            self.prefix, self.data
        )

    def find_prefix(self, prefix):
        """Find the prefix in the children of this node.

        :returns: A child matching the prefix or None.
        :rtype: :class:`~TrieNode` or None
        """
        return self.children.get(prefix, None)

    def add_child(self, prefix, data, children=None):
        """Create and add a new child node.

        :returns: The newly created node
        :rtype: :class:`~TrieNode`
        """
        new_node = TrieNode(prefix, data, children)
        self.children[prefix] = new_node
        return new_node

    def traverse(self):
        """Traverse children of this node.

        This performs a depth-first pre-order traversal of the remaining
        children in this sub-tree. It returns the results consistently by
        first sorting the children based on their prefix and then traversing
        them in alphabetical order.
        """
        if not self.children:
            return

        for prefix in sorted(self.children.keys()):
            child = self.children[prefix]
            yield child
            for child in child.traverse():
                yield child
