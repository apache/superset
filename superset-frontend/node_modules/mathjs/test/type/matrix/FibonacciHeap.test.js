var assert = require('assert');
var math = require('../../../index');
var FibonacciHeap = math.type.FibonacciHeap;

describe('FibonacciHeap', function () {

  describe('constructor', function () {
    
    it('should create heap', function () {
      var h = new FibonacciHeap();
      assert.equal(h._size, 0);
      assert(h._minimum === null);
    });

    it('should have a property isFibonacciHeap', function () {
      var a = new FibonacciHeap();
      assert.strictEqual(a.isFibonacciHeap, true);
    });

    it('should have a property type', function () {
      var a = new FibonacciHeap();
      assert.strictEqual(a.type, 'FibonacciHeap');
    });

    it('should throw an error when called without new keyword', function () {
      assert.throws(function () { FibonacciHeap(); }, /Constructor must be called with the new operator/);
    });
  });
  
  describe('insert', function () {
    
    it('should insert node when heap is empty', function () {
      var h = new FibonacciHeap();
      h.insert(1, 'v1');
      assert.equal(h._size, 1);
      assert(h._minimum !== null);
      assert.equal(h._minimum.key, 1);
      assert.equal(h._minimum.value, 'v1');
    });
    
    it('should insert two nodes when heap is empty', function () {
      var h = new FibonacciHeap();
      h.insert(1, 'v1');
      h.insert(10, 'v10');
      assert.equal(h._size, 2);
      assert(h._minimum !== null);
      assert.equal(h._minimum.key, 1);
      assert.equal(h._minimum.value, 'v1');
    });
    
    it('should insert two nodes when heap is empty, reverse order', function () {
      var h = new FibonacciHeap();
      h.insert(10, 'v10');
      h.insert(1, 'v1');
      assert.equal(h._size, 2);
      assert(h._minimum !== null);
      assert.equal(h._minimum.key, 1);
      assert.equal(h._minimum.value, 'v1');
    });
  });
  
  describe('extractMinimum', function () {
    
    it('should extract node from heap, one node', function () {
      var h = new FibonacciHeap();
      h.insert(1, 'v1');
      var n = h.extractMinimum();
      assert.equal(n.key, 1);
      assert.equal(n.value, 'v1');
      assert.equal(h._size, 0);
      assert(h._minimum === null);
    });
    
    it('should extract node from heap, two nodes', function () {
      var h = new FibonacciHeap();
      h.insert(1, 'v1');
      h.insert(10, 'v10');
      var n = h.extractMinimum();
      assert.equal(n.key, 1);
      assert.equal(n.value, 'v1');
      assert.equal(h._size, 1);
      assert.equal(h._minimum.key, 10);
      assert.equal(h._minimum.value, 'v10');
    });
    
    it('should extract nodes in ascending order', function () {
      var h = new FibonacciHeap();
      h.insert(5, 'v5');
      h.insert(4, 'v4');
      h.insert(1, 'v1');
      h.insert(3, 'v3');
      h.insert(2, 'v2');
      // extract all nodes      
      var n;
      var l = h.extractMinimum();
      var s = h._size;
      while (true) {
        n = h.extractMinimum();
        if (!n)
          break;
        assert(n.key > l.key);
        assert.equal(h._size, --s);
        l = n;
      }
      assert.equal(h._size, 0);
      assert(h._minimum === null);
    });
  });
  
  describe('remove', function () {
    
    it('should remove node, one node', function () {
      var h = new FibonacciHeap();
      var n = h.insert(1, 'v1');
      h.remove(n);
      assert.equal(h._size, 0);
      assert(h._minimum === null);
    });
    
    it('should remove node with smaller key', function () {
      var h = new FibonacciHeap();
      h.insert(20, 'v20');
      var n = h.insert(1, 'v1');
      h.insert(10, 'v10');
      h.insert(5, 'v5');
      h.insert(4, 'v4');
      h.remove(n);
      assert.equal(h._size, 4);
    });
    
    it('should remove node with largest key', function () {
      var h = new FibonacciHeap();      
      h.insert(1, 'v1');
      h.insert(10, 'v10');
      var n = h.insert(20, 'v20');
      h.insert(5, 'v5');
      h.insert(4, 'v4');
      h.remove(n);
      assert.equal(h._size, 4);
    });
  });

  it('should check whether emtpy', function () {
    var h = new FibonacciHeap();      
    assert.equal(h.isEmpty(), true);
    assert.equal(h.size(), 0);

    h.insert(1, 'v1');
    h.insert(10, 'v10');
    assert.equal(h.isEmpty(), false);
    assert.equal(h.size(), 2);
    
    h.clear();
    assert.equal(h.isEmpty(), true);
    assert.equal(h.size(), 0);
  })
});