import * as mat2d from "../../src/gl-matrix/mat2d"

describe("mat2d", function() {
    let out, matA, matB, oldA, oldB, identity, result;

    beforeEach(function() {
        matA = [1, 2,
                3, 4,
                5, 6];

        oldA = [1, 2,
                3, 4,
                5, 6];

        matB = [7, 8,
                9, 10,
                11, 12];

        oldB = [7, 8,
                9, 10,
                11, 12];

        out =  [0, 0,
                0, 0,
                0, 0];

        identity = [1, 0,
                    0, 1,
                    0, 0];
    });

    describe("create", function() {
        beforeEach(function() { result = mat2d.create(); });
        it("should return a 6 element array initialized to a 2x3 identity matrix", function() { expect(result).toBeEqualish(identity); });
    });

    describe("clone", function() {
        beforeEach(function() { result = mat2d.clone(matA); });
        it("should return a 6 element array initialized to the values in matA", function() { expect(result).toBeEqualish(matA); });
    });

    describe("copy", function() {
        beforeEach(function() { result = mat2d.copy(out, matA); });
        it("should place values into out", function() { expect(out).toBeEqualish(matA); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("identity", function() {
        beforeEach(function() { result = mat2d.identity(out); });
        it("should place values into out", function() { expect(result).toBeEqualish(identity); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("invert", function() {
        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.invert(out, matA); });

            it("should place values into out", function() { expect(out).toBeEqualish([ -2, 1, 1.5, -0.5, 1, -2 ]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.invert(matA, matA); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([ -2, 1, 1.5, -0.5, 1, -2 ]); });
            it("should return matA", function() { expect(result).toBe(matA); });
        });
    });

    describe("determinant", function() {
        beforeEach(function() { result = mat2d.determinant(matA); });

        it("should return the determinant", function() { expect(result).toEqual(-2); });
    });

    describe("multiply", function() {
        it("should have an alias called 'mul'", function() { expect(mat2d.mul).toEqual(mat2d.multiply); });

        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.multiply(out, matA, matB); });

            it("should place values into out", function() { expect(out).toBeEqualish([31, 46, 39, 58, 52, 76]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish(oldB); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.multiply(matA, matA, matB); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([31, 46, 39, 58, 52, 76]); });
            it("should return matA", function() { expect(result).toBe(matA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish(oldB); });
        });

        describe("when matB is the output matrix", function() {
            beforeEach(function() { result = mat2d.multiply(matB, matA, matB); });

            it("should place values into matB", function() { expect(matB).toBeEqualish([31, 46, 39, 58, 52, 76]); });
            it("should return matB", function() { expect(result).toBe(matB); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });
    });

    describe("rotate", function() {
        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.rotate(out, matA, Math.PI * 0.5); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 4, -1, -2, 5, 6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.rotate(matA, matA, Math.PI * 0.5); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([3, 4, -1, -2, 5, 6]); });
            it("should return matA", function() { expect(result).toBe(matA); });
        });
    });

    describe("scale", function() {
        let vecA;
        beforeEach(function() { vecA = [2, 3]; });

        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.scale(out, matA, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([2, 4, 9, 12, 5, 6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.scale(matA, matA, vecA); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([2, 4, 9, 12, 5, 6]); });
            it("should return matA", function() { expect(result).toBe(matA); });
        });
    });

    describe("translate", function() {
        let vecA;
        beforeEach(function() { vecA = [2, 3]; });

        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.translate(out, matA, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([1, 2, 3, 4, 16, 22]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.translate(matA, matA, vecA); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([1, 2, 3, 4, 16, 22]); });
            it("should return matA", function() { expect(result).toBe(matA); });
        });
    });

    describe("str", function() {
        beforeEach(function() { result = mat2d.str(matA); });

        it("should return a string representation of the matrix", function() { expect(result).toEqual("mat2d(1, 2, 3, 4, 5, 6)"); });
    });

   describe("frob", function() {
        beforeEach(function() { result = mat2d.frob(matA); });
        it("should return the Frobenius Norm of the matrix", function() { expect(result).toEqual( Math.sqrt(Math.pow(1, 2) + Math.pow(2, 2) + Math.pow(3, 2) + Math.pow(4, 2) + Math.pow(5, 2) + Math.pow(6, 2) + 1)); });
   });

    describe("add", function() {
        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.add(out, matA, matB); });

            it("should place values into out", function() { expect(out).toBeEqualish([8, 10, 12, 14, 16, 18]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish(oldB); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.add(matA, matA, matB); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([8, 10, 12, 14, 16, 18]); });
            it("should return matA", function() { expect(result).toBe(matA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish(oldB); });
        });

        describe("when matB is the output matrix", function() {
            beforeEach(function() { result = mat2d.add(matB, matA, matB); });

            it("should place values into matB", function() { expect(matB).toBeEqualish([8, 10, 12, 14, 16, 18]); });
            it("should return matB", function() { expect(result).toBe(matB); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });
    });

    describe("subtract", function() {
        it("should have an alias called 'sub'", function() { expect(mat2d.sub).toEqual(mat2d.subtract); });

        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.subtract(out, matA, matB); });

            it("should place values into out", function() { expect(out).toBeEqualish([-6, -6, -6, -6, -6, -6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish(oldB); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.subtract(matA, matA, matB); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([-6, -6, -6, -6, -6, -6]); });
            it("should return matA", function() { expect(result).toBe(matA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish(oldB); });
        });

        describe("when matB is the output matrix", function() {
            beforeEach(function() { result = mat2d.subtract(matB, matA, matB); });

            it("should place values into matB", function() { expect(matB).toBeEqualish([-6, -6, -6, -6, -6, -6]); });
            it("should return matB", function() { expect(result).toBe(matB); });
            it("should not modify matA", function() { expect(matA).toBeEqualish(oldA); });
        });
    });

    describe("fromValues", function() {
        beforeEach(function() { result = mat2d.fromValues(1, 2, 3, 4, 5, 6); });
        it("should return a 6 element array initialized to the values passed", function() { expect(result).toBeEqualish([1, 2, 3, 4, 5, 6]); });
    });

    describe("set", function() {
        beforeEach(function() { result = mat2d.set(out, 1, 2, 3, 4, 5, 6); });
        it("should place values into out", function() { expect(out).toBeEqualish([1, 2, 3, 4, 5, 6]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("multiplyScalar", function() {
        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.multiplyScalar(out, matA, 2); });

            it("should place values into out", function() { expect(out).toBeEqualish([2, 4, 6, 8, 10, 12]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish([1, 2, 3, 4, 5, 6]); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.multiplyScalar(matA, matA, 2); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([2, 4, 6, 8, 10, 12]); });
            it("should return matA", function() { expect(result).toBe(matA); });
        });
    });

    describe("multiplyScalarAndAdd", function() {
        describe("with a separate output matrix", function() {
            beforeEach(function() { result = mat2d.multiplyScalarAndAdd(out, matA, matB, 0.5); });

            it("should place values into out", function() { expect(out).toBeEqualish([4.5, 6, 7.5, 9, 10.5, 12]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify matA", function() { expect(matA).toBeEqualish([1, 2, 3, 4, 5, 6]); });
            it("should not modify matB", function() { expect(matB).toBeEqualish([7, 8, 9, 10, 11, 12]); });
        });

        describe("when matA is the output matrix", function() {
            beforeEach(function() { result = mat2d.multiplyScalarAndAdd(matA, matA, matB, 0.5); });

            it("should place values into matA", function() { expect(matA).toBeEqualish([4.5, 6, 7.5, 9, 10.5, 12]); });
            it("should return matA", function() { expect(result).toBe(matA); });
            it("should not modify matB", function() { expect(matB).toBeEqualish([7, 8, 9, 10, 11, 12]); });
        });

        describe("when matB is the output matrix", function() {
            beforeEach(function() { result = mat2d.multiplyScalarAndAdd(matB, matA, matB, 0.5); });

            it("should place values into matB", function() { expect(matB).toBeEqualish([4.5, 6, 7.5, 9, 10.5, 12]); });
            it("should return matB", function() { expect(result).toBe(matB); });
            it("should not modify matA", function() { expect(matA).toBeEqualish([1, 2, 3, 4, 5, 6]); });
        });
    });

    describe("exactEquals", function() {
        let matC, r0, r1;
        beforeEach(function() {
            matA = [0, 1, 2, 3, 4, 5];
            matB = [0, 1, 2, 3, 4, 5];
            matC = [1, 2, 3, 4, 5, 6];
            r0 = mat2d.exactEquals(matA, matB);
            r1 = mat2d.exactEquals(matA, matC);
        });

        it("should return true for identical matrices", function() { expect(r0).toBe(true); });
        it("should return false for different matrices", function() { expect(r1).toBe(false); });
        it("should not modify matA", function() { expect(matA).toBeEqualish([0, 1, 2, 3, 4, 5]); });
        it("should not modify matB", function() { expect(matB).toBeEqualish([0, 1, 2, 3, 4, 5]); });
    });

    describe("equals", function() {
        let matC, matD, r0, r1, r2;
        beforeEach(function() {
            matA = [0, 1, 2, 3, 4, 5];
            matB = [0, 1, 2, 3, 4, 5];
            matC = [1, 2, 3, 4, 5, 6];
            matD = [1e-16, 1, 2, 3, 4, 5];
            r0 = mat2d.equals(matA, matB);
            r1 = mat2d.equals(matA, matC);
            r2 = mat2d.equals(matA, matD);
        });
        it("should return true for identical matrices", function() { expect(r0).toBe(true); });
        it("should return false for different matrices", function() { expect(r1).toBe(false); });
        it("should return true for close but not identical matrices", function() { expect(r2).toBe(true); });
        it("should not modify matA", function() { expect(matA).toBeEqualish([0, 1, 2, 3, 4, 5]); });
        it("should not modify matB", function() { expect(matB).toBeEqualish([0, 1, 2, 3, 4, 5]); });
    });

});
