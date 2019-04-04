'use strict';

function factory (type, config, load, typed) {
  
  var smaller = load(require('../../function/relational/smaller'));
  var larger = load(require('../../function/relational/larger'));
  
  var oneOverLogPhi = 1.0 / Math.log((1.0 + Math.sqrt(5.0)) / 2.0);
  
  /**
   * Fibonacci Heap implementation, used interally for Matrix math.
   * @class FibonacciHeap
   * @constructor FibonacciHeap
   */
  function FibonacciHeap() {
    if (!(this instanceof FibonacciHeap))
      throw new SyntaxError('Constructor must be called with the new operator');

    // initialize fields
    this._minimum = null;
    this._size = 0;
  }

  /**
   * Attach type information
   */
  FibonacciHeap.prototype.type = 'FibonacciHeap';
  FibonacciHeap.prototype.isFibonacciHeap = true;

  /**
   * Inserts a new data element into the heap. No heap consolidation is
   * performed at this time, the new node is simply inserted into the root
   * list of this heap. Running time: O(1) actual.
   * @memberof FibonacciHeap
   */
  FibonacciHeap.prototype.insert = function (key, value) {
    // create node
    var node = {
      key: key,
      value: value,
      degree: 0
    };
    // check we have a node in the minimum
    if (this._minimum) {
      // minimum node
      var minimum = this._minimum;
      // update left & right of node
      node.left = minimum;
      node.right = minimum.right;
      minimum.right = node;
      node.right.left = node;
      // update minimum node in heap if needed
      if (smaller(key, minimum.key)) {
        // node has a smaller key, use it as minimum
        this._minimum = node;
      }
    }
    else {
      // set left & right
      node.left = node;
      node.right = node;
      // this is the first node
      this._minimum = node;
    }
    // increment number of nodes in heap
    this._size++;
    // return node
    return node;
  };

  /**
   * Returns the number of nodes in heap. Running time: O(1) actual.
   * @memberof FibonacciHeap
   */
  FibonacciHeap.prototype.size = function () {
    return this._size;
  };

  /**
   * Removes all elements from this heap.
   * @memberof FibonacciHeap
   */
  FibonacciHeap.prototype.clear = function () {
    this._minimum = null;
    this._size = 0;
  };

  /**
   * Returns true if the heap is empty, otherwise false.
   * @memberof FibonacciHeap
   */
  FibonacciHeap.prototype.isEmpty = function () {
    return this._size === 0;
  };
  
  /**
   * Extracts the node with minimum key from heap. Amortized running 
   * time: O(log n).
   * @memberof FibonacciHeap
   */
  FibonacciHeap.prototype.extractMinimum = function () {
    // node to remove
    var node = this._minimum;
    // check we have a minimum
    if (node === null)
      return node;
    // current minimum
    var minimum = this._minimum;
    // get number of children
    var numberOfChildren = node.degree;
    // pointer to the first child
    var x = node.child;
    // for each child of node do...
    while (numberOfChildren > 0) {
      // store node in right side
      var tempRight = x.right;
      // remove x from child list
      x.left.right = x.right;
      x.right.left = x.left;
      // add x to root list of heap
      x.left = minimum;
      x.right = minimum.right;
      minimum.right = x;
      x.right.left = x;
      // set Parent[x] to null
      x.parent = null;
      x = tempRight;
      numberOfChildren--;
    }
    // remove node from root list of heap
    node.left.right = node.right;
    node.right.left = node.left;
    // update minimum
    if (node == node.right) {
      // empty
      minimum = null;
    }
    else {
      // update minimum
      minimum = node.right;
      // we need to update the pointer to the root with minimum key
      minimum = _findMinimumNode(minimum, this._size);
    }
    // decrement size of heap
    this._size--;
    // update minimum
    this._minimum = minimum;
    // return node
    return node;
  };
  
  /**
   * Removes a node from the heap given the reference to the node. The trees
   * in the heap will be consolidated, if necessary. This operation may fail
   * to remove the correct element if there are nodes with key value -Infinity.
   * Running time: O(log n) amortized.
   * @memberof FibonacciHeap
   */
  FibonacciHeap.prototype.remove = function (node) {
    // decrease key value
    this._minimum = _decreaseKey(this._minimum, node, -1);
    // remove the smallest
    this.extractMinimum();
  };
  
  /**
   * Decreases the key value for a heap node, given the new value to take on.
   * The structure of the heap may be changed and will not be consolidated. 
   * Running time: O(1) amortized.
   * @memberof FibonacciHeap
   */
  var _decreaseKey = function (minimum, node, key) {
    // set node key
    node.key = key;
    // get parent node
    var parent = node.parent;
    if (parent && smaller(node.key, parent.key)) {
      // remove node from parent
      _cut(minimum, node, parent);
      // remove all nodes from parent to the root parent
      _cascadingCut(minimum, parent);
    }
    // update minimum node if needed
    if (smaller(node.key, minimum.key))
      minimum = node;
    // return minimum
    return minimum;
  };
  
  /**
   * The reverse of the link operation: removes node from the child list of parent.
   * This method assumes that min is non-null. Running time: O(1).
   * @memberof FibonacciHeap
   */
  var _cut = function (minimum, node, parent) {
    // remove node from parent children and decrement Degree[parent]
    node.left.right = node.right;
    node.right.left = node.left;
    parent.degree--;
    // reset y.child if necessary
    if (parent.child == node)
      parent.child = node.right;
    // remove child if degree is 0
    if (parent.degree === 0)
      parent.child = null;
    // add node to root list of heap
    node.left = minimum;
    node.right = minimum.right;
    minimum.right = node;
    node.right.left = node;
    // set parent[node] to null
    node.parent = null;
    // set mark[node] to false
    node.mark = false;
  };
  
  /**
   * Performs a cascading cut operation. This cuts node from its parent and then
   * does the same for its parent, and so on up the tree.
   * Running time: O(log n); O(1) excluding the recursion.
   * @memberof FibonacciHeap
   */
  var _cascadingCut= function (minimum, node) {
    // store parent node
    var parent = node.parent;
    // if there's a parent...
    if (!parent)
      return;
    // if node is unmarked, set it marked
    if (!node.mark) {
      node.mark = true;
    }
    else {
      // it's marked, cut it from parent
      _cut(minimum, node, parent);
      // cut its parent as well
      _cascadingCut(parent);
    }
  };
  
  /**
   * Make the first node a child of the second one. Running time: O(1) actual.
   * @memberof FibonacciHeap
   */
  var _linkNodes = function (node, parent) {
    // remove node from root list of heap
    node.left.right = node.right;
    node.right.left = node.left;
    // make node a Child of parent
    node.parent = parent;
    if (!parent.child) {
      parent.child = node;
      node.right = node;
      node.left = node;
    }
    else {
      node.left = parent.child;
      node.right = parent.child.right;
      parent.child.right = node;
      node.right.left = node;
    }
    // increase degree[parent]
    parent.degree++;
    // set mark[node] false
    node.mark = false;
  };
  
  var _findMinimumNode = function (minimum, size) {
    // to find trees of the same degree efficiently we use an array of length O(log n) in which we keep a pointer to one root of each degree
    var arraySize = Math.floor(Math.log(size) * oneOverLogPhi) + 1;
    // create list with initial capacity
    var array = new Array(arraySize);
    // find the number of root nodes.
    var numRoots = 0;
    var x = minimum;
    if (x) {
      numRoots++;
      x = x.right;
      while (x !== minimum) {
        numRoots++;
        x = x.right;
      }
    }
    // vars
    var y;
    // For each node in root list do...
    while (numRoots > 0) {
      // access this node's degree..
      var d = x.degree;
      // get next node
      var next = x.right;
      // check if there is a node already in array with the same degree
      while (true) {
        // get node with the same degree is any
        y = array[d];
        if (!y)
          break;
        // make one node with the same degree a child of the other, do this based on the key value.
        if (larger(x.key, y.key)) {
          var temp = y;
          y = x;
          x = temp;
        }
        // make y a child of x
        _linkNodes(y, x);
        // we have handled this degree, go to next one.
        array[d] = null;
        d++;
      }
      // save this node for later when we might encounter another of the same degree.
      array[d] = x;
      // move forward through list.
      x = next;
      numRoots--;
    }
    // Set min to null (effectively losing the root list) and reconstruct the root list from the array entries in array[].
    minimum = null;
    // loop nodes in array
    for (var i = 0; i < arraySize; i++) {
      // get current node
      y = array[i];
      if (!y)
        continue;
      // check if we have a linked list
      if (minimum) {
        // First remove node from root list.
        y.left.right = y.right;
        y.right.left = y.left;
        // now add to root list, again.
        y.left = minimum;
        y.right = minimum.right;
        minimum.right = y;
        y.right.left = y;
        // check if this is a new min.
        if (smaller(y.key, minimum.key))
          minimum = y;
      }
      else
        minimum = y;
    }
    return minimum;
  };
  
  return FibonacciHeap;
}

exports.name = 'FibonacciHeap';
exports.path = 'type';
exports.factory = factory;
