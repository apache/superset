<a name="FibonacciHeap"></a>
## FibonacciHeap
* [new FibonacciHeap()](#new_FibonacciHeap_new)
* _instance_
	* [.insert()](#FibonacciHeap+insert)
	* [.size()](#FibonacciHeap+size)
	* [.clear()](#FibonacciHeap+clear)
	* [.isEmpty()](#FibonacciHeap+isEmpty)
	* [.extractMinimum()](#FibonacciHeap+extractMinimum)
	* [.remove()](#FibonacciHeap+remove)
* _static_
	* [._decreaseKey()](#FibonacciHeap._decreaseKey)
	* [._cut()](#FibonacciHeap._cut)
	* [._cascadingCut()](#FibonacciHeap._cascadingCut)
	* [._linkNodes()](#FibonacciHeap._linkNodes)

<a name="new_FibonacciHeap_new"></a>
### new FibonacciHeap()
Creates a new instance of a Fibonacci Heap.

<a name="FibonacciHeap+insert"></a>
### fibonacciHeap.insert()
Inserts a new data element into the heap. No heap consolidation isperformed at this time, the new node is simply inserted into the rootlist of this heap. Running time: O(1) actual.

**Kind**: instance method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap+size"></a>
### fibonacciHeap.size()
Returns the number of nodes in heap. Running time: O(1) actual.

**Kind**: instance method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap+clear"></a>
### fibonacciHeap.clear()
Removes all elements from this heap.

**Kind**: instance method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap+isEmpty"></a>
### fibonacciHeap.isEmpty()
Returns true if the heap is empty, otherwise false.

**Kind**: instance method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap+extractMinimum"></a>
### fibonacciHeap.extractMinimum()
Extracts the node with minimum key from heap. Amortized running time: O(log n).

**Kind**: instance method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap+remove"></a>
### fibonacciHeap.remove()
Removes a node from the heap given the reference to the node. The treesin the heap will be consolidated, if necessary. This operation may failto remove the correct element if there are nodes with key value -Infinity.Running time: O(log n) amortized.

**Kind**: instance method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap._decreaseKey"></a>
### FibonacciHeap._decreaseKey()
Decreases the key value for a heap node, given the new value to take on.The structure of the heap may be changed and will not be consolidated. Running time: O(1) amortized.

**Kind**: static method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap._cut"></a>
### FibonacciHeap._cut()
The reverse of the link operation: removes node from the child list of parent.This method assumes that min is non-null. Running time: O(1).

**Kind**: static method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap._cascadingCut"></a>
### FibonacciHeap._cascadingCut()
Performs a cascading cut operation. This cuts node from its parent and thendoes the same for its parent, and so on up the tree.Running time: O(log n); O(1) excluding the recursion.

**Kind**: static method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
<a name="FibonacciHeap._linkNodes"></a>
### FibonacciHeap._linkNodes()
Make the first node a child of the second one. Running time: O(1) actual.

**Kind**: static method of <code>[FibonacciHeap](#FibonacciHeap)</code>  
