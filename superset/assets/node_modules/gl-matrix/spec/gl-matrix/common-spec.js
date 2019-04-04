import * as glMatrix from "../../src/gl-matrix/common"

describe("common", function(){
  let result;

  describe("toRadian", function(){
    beforeEach(function(){ result = glMatrix.toRadian(180); });
    it("should return a value of 3.141592654(Math.PI)", function(){ expect(result).toBeEqualish(Math.PI); });
  });

  describe("equals", function() {
    let r0, r1, r2;
    beforeEach(function() {
      r0 = glMatrix.equals(1.0, 0.0);
      r1 = glMatrix.equals(1.0, 1.0);
      r2 = glMatrix.equals(1.0+glMatrix.EPSILON/2, 1.0);
    });
    it("should return false for different numbers", function() { expect(r0).toBe(false); });
    it("should return true for the same number", function() { expect(r1).toBe(true); });
    it("should return true for numbers that are close", function() { expect(r2).toBe(true); });
  });

});
