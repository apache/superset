var assert = require('assert');
var math = require('../../../index');
var Matrix = math.type.Matrix;

describe('matrix', function() {

  describe('constructor', function() {

    it('should create a matrix', function() {
      var m = new Matrix();
      assert(m instanceof Matrix);
    });    

    it('should throw an error when called without new keyword', function () {
      assert.throws(function () { Matrix(); }, /Constructor must be called with the new operator/);
    });
    
    it('should have a property isMatrix', function () {
      var a = new Matrix();
      assert.strictEqual(a.isMatrix, true);
    });

    it('should have a property type', function () {
      var a = new Matrix();
      assert.strictEqual(a.type, 'Matrix');
    });

  });

  describe('size', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.size(); }, /Cannot invoke size on a Matrix interface/);
    });
  });

  describe('create', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.create([]); }, /Cannot invoke create on a Matrix interface/);
    });
  });

  describe('toString', function() {
    
    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.toString(); }, /Cannot invoke toString on a Matrix interface/);
    });
  });
  
  describe('format', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.format(); }, /Cannot invoke format on a Matrix interface/);
    });
  });
  
  describe('resize', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.resize(); }, /Cannot invoke resize on a Matrix interface/);
    });
  });

  describe('reshape', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.reshape(); }, /Cannot invoke reshape on a Matrix interface/);
    });
  });
  
  describe('get', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.get(); }, /Cannot invoke get on a Matrix interface/);
    });
  });
  
  describe('set', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.set(); }, /Cannot invoke set on a Matrix interface/);
    });
  });
  
  describe('subset', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.subset(); }, /Cannot invoke subset on a Matrix interface/);
    });
  });
  
  describe('map', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.map(); }, /Cannot invoke map on a Matrix interface/);
    });
  });
  
  describe('forEach', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.forEach(); }, /Cannot invoke forEach on a Matrix interface/);
    });
  });
  
  describe('clone', function() {

    it('should throw exception', function() {
      var m = new Matrix();
      assert.throws(function () { m.clone(); }, /Cannot invoke clone on a Matrix interface/);
    });
  });
});
