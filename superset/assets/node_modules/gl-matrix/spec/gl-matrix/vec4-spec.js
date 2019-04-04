import * as vec3 from "../../src/gl-matrix/vec3"
import * as vec4 from "../../src/gl-matrix/vec4"

describe("vec4", function() {
    let out, vecA, vecB, result;

    beforeEach(function() { vecA = [1, 2, 3, 4]; vecB = [5, 6, 7, 8]; out = [0, 0, 0, 0]; });

    describe("create", function() {
        beforeEach(function() { result = vec4.create(); });
        it("should return a 4 element array initialized to 0s", function() { expect(result).toBeEqualish([0, 0, 0, 0]); });
    });

    describe("clone", function() {
        beforeEach(function() { result = vec4.clone(vecA); });
        it("should return a 4 element array initialized to the values in vecA", function() { expect(result).toBeEqualish(vecA); });
    });

    describe("fromValues", function() {
        beforeEach(function() { result = vec4.fromValues(1, 2, 3, 4); });
        it("should return a 4 element array initialized to the values passed", function() { expect(result).toBeEqualish([1, 2, 3, 4]); });
    });

    describe("copy", function() {
        beforeEach(function() { result = vec4.copy(out, vecA); });
        it("should place values into out", function() { expect(out).toBeEqualish([1, 2, 3, 4]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("set", function() {
        beforeEach(function() { result = vec4.set(out, 1, 2, 3, 4); });
        it("should place values into out", function() { expect(out).toBeEqualish([1, 2, 3, 4]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("add", function() {
        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.add(out, vecA, vecB); });

            it("should place values into out", function() { expect(out).toBeEqualish([6, 8, 10, 12]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.add(vecA, vecA, vecB); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([6, 8, 10, 12]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.add(vecB, vecA, vecB); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([6, 8, 10, 12]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("subtract", function() {
        it("should have an alias called 'sub'", function() { expect(vec4.sub).toEqual(vec4.subtract); });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.subtract(out, vecA, vecB); });

            it("should place values into out", function() { expect(out).toBeEqualish([-4, -4, -4, -4]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.subtract(vecA, vecA, vecB); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([-4, -4, -4, -4]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.subtract(vecB, vecA, vecB); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([-4, -4, -4, -4]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("multiply", function() {
        it("should have an alias called 'mul'", function() { expect(vec4.mul).toEqual(vec4.multiply); });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.multiply(out, vecA, vecB); });

            it("should place values into out", function() { expect(out).toBeEqualish([5, 12, 21, 32]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.multiply(vecA, vecA, vecB); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([5, 12, 21, 32]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.multiply(vecB, vecA, vecB); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([5, 12, 21, 32]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("divide", function() {
        it("should have an alias called 'div'", function() { expect(vec4.div).toEqual(vec4.divide); });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.divide(out, vecA, vecB); });

            it("should place values into out", function() { expect(out).toBeEqualish([0.2, 0.333333, 0.428571, 0.5]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.divide(vecA, vecA, vecB); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([0.2, 0.333333, 0.428571, 0.5]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.divide(vecB, vecA, vecB); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([0.2, 0.333333, 0.428571, 0.5]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("ceil", function() {
        beforeEach(function() { vecA = [Math.E, Math.PI, Math.SQRT2, Math.SQRT1_2]; });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.ceil(out, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 4, 2, 1]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([Math.E, Math.PI, Math.SQRT2, Math.SQRT1_2]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.ceil(vecA, vecA); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([3, 4, 2, 1]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
        });
    });

    describe("floor", function() {
        beforeEach(function() { vecA = [Math.E, Math.PI, Math.SQRT2, Math.SQRT1_2]; });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.floor(out, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([2, 3, 1, 0]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([Math.E, Math.PI, Math.SQRT2, Math.SQRT1_2]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.floor(vecA, vecA); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([2, 3, 1, 0]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
        });
    });

    describe("min", function() {
        beforeEach(function() { vecA = [1, 3, 1, 3]; vecB = [3, 1, 3, 1]; });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.min(out, vecA, vecB); });

            it("should place values into out", function() { expect(out).toBeEqualish([1, 1, 1, 1]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 3, 1, 3]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([3, 1, 3, 1]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.min(vecA, vecA, vecB); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([1, 1, 1, 1]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([3, 1, 3, 1]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.min(vecB, vecA, vecB); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([1, 1, 1, 1]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 3, 1, 3]); });
        });
    });

    describe("max", function() {
        beforeEach(function() { vecA = [1, 3, 1, 3]; vecB = [3, 1, 3, 1]; });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.max(out, vecA, vecB); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 3, 3, 3]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 3, 1, 3]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([3, 1, 3, 1]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.max(vecA, vecA, vecB); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([3, 3, 3, 3]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([3, 1, 3, 1]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.max(vecB, vecA, vecB); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([3, 3, 3, 3]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 3, 1, 3]); });
        });
    });

    describe("round", function() {
        beforeEach(function() { vecA = [Math.E, Math.PI, Math.SQRT2, Math.SQRT1_2]; });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.round(out, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 3, 1, 1]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([Math.E, Math.PI, Math.SQRT2, Math.SQRT1_2]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.round(vecA, vecA); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([3, 3, 1, 1]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
        });
    });

    describe("scale", function() {
        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.scale(out, vecA, 2); });

            it("should place values into out", function() { expect(out).toBeEqualish([2, 4, 6, 8]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.scale(vecA, vecA, 2); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([2, 4, 6, 8]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
        });
    });

    describe("scaleAndAdd", function() {
        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.scaleAndAdd(out, vecA, vecB, 0.5); });

            it("should place values into out", function() { expect(out).toBeEqualish([3.5, 5, 6.5, 8]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.scaleAndAdd(vecA, vecA, vecB, 0.5); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([3.5, 5, 6.5, 8]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.scaleAndAdd(vecB, vecA, vecB, 0.5); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([3.5, 5, 6.5, 8]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("distance", function() {
        it("should have an alias called 'dist'", function() { expect(vec4.dist).toEqual(vec4.distance); });

        beforeEach(function() { result = vec4.distance(vecA, vecB); });

        it("should return the distance", function() { expect(result).toBeEqualish(8); });
    });

    describe("squaredDistance", function() {
        it("should have an alias called 'sqrDist'", function() { expect(vec4.sqrDist).toEqual(vec4.squaredDistance); });

        beforeEach(function() { result = vec4.squaredDistance(vecA, vecB); });

        it("should return the squared distance", function() { expect(result).toEqual(64); });
    });

    describe("length", function() {
        it("should have an alias called 'len'", function() { expect(vec4.len).toEqual(vec4.length); });

        beforeEach(function() { result = vec4.len(vecA); });

        it("should return the length", function() { expect(result).toBeEqualish(5.477225); });
    });

    describe("squaredLength", function() {
        it("should have an alias called 'sqrLen'", function() { expect(vec4.sqrLen).toEqual(vec4.squaredLength); });

        beforeEach(function() { result = vec4.squaredLength(vecA); });

        it("should return the squared length", function() { expect(result).toEqual(30); });
    });

    describe("negate", function() {
        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.negate(out, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([-1, -2, -3, -4]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.negate(vecA, vecA); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([-1, -2, -3, -4]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
        });
    });

    describe("normalize", function() {
        beforeEach(function() { vecA = [5, 0, 0, 0]; });

        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.normalize(out, vecA); });

            it("should place values into out", function() { expect(out).toBeEqualish([1, 0, 0, 0]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([5, 0, 0, 0]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.normalize(vecA, vecA); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([1, 0, 0, 0]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
        });
    });

    describe("dot", function() {
        beforeEach(function() { result = vec4.dot(vecA, vecB); });

        it("should return the dot product", function() { expect(result).toEqual(70); });
        it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
    });

    describe("lerp", function() {
        describe("with a separate output vector", function() {
            beforeEach(function() { result = vec4.lerp(out, vecA, vecB, 0.5); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 4, 5, 6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecA is the output vector", function() {
            beforeEach(function() { result = vec4.lerp(vecA, vecA, vecB, 0.5); });

            it("should place values into vecA", function() { expect(vecA).toBeEqualish([3, 4, 5, 6]); });
            it("should return vecA", function() { expect(result).toBe(vecA); });
            it("should not modify vecB", function() { expect(vecB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when vecB is the output vector", function() {
            beforeEach(function() { result = vec4.lerp(vecB, vecA, vecB, 0.5); });

            it("should place values into vecB", function() { expect(vecB).toBeEqualish([3, 4, 5, 6]); });
            it("should return vecB", function() { expect(result).toBe(vecB); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("random", function() {
        describe("with no scale", function() {
            beforeEach(function() { result = vec4.random(out); });

            it("should result in a unit length vector", function() { expect(vec4.len(out)).toBeEqualish(1.0); });
            it("should return out", function() { expect(result).toBe(out); });
        });

        describe("with a scale", function() {
            beforeEach(function() { result = vec4.random(out, 5.0); });

            it("should result in a unit length vector", function() { expect(vec4.len(out)).toBeEqualish(5.0); });
            it("should return out", function() { expect(result).toBe(out); });
        });
    });

    describe("forEach", function() {
        let vecArray;

        beforeEach(function() {
            vecArray = [
                1, 2, 3, 4,
                5, 6, 7, 8,
                0, 0, 0, 0
            ];
        });

        describe("when performing operations that take no extra arguments", function() {
            beforeEach(function() { result = vec4.forEach(vecArray, 0, 0, 0, vec4.normalize); });

            it("should update all values", function() {
                expect(vecArray).toBeEqualish([
                    0.182574, 0.365148, 0.547722, 0.730296,
                    0.379049, 0.454858, 0.530668, 0.606478,
                    0, 0, 0, 0
                ]);
            });
            it("should return vecArray", function() { expect(result).toBe(vecArray); });
        });

        describe("when performing operations that takes one extra arguments", function() {
            beforeEach(function() { result = vec4.forEach(vecArray, 0, 0, 0, vec4.add, vecA); });

            it("should update all values", function() {
                expect(vecArray).toBeEqualish([
                    2, 4, 6, 8,
                    6, 8, 10, 12,
                    1, 2, 3, 4
                ]);
            });
            it("should return vecArray", function() { expect(result).toBe(vecArray); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when specifying an offset", function() {
            beforeEach(function() { result = vec4.forEach(vecArray, 0, 4, 0, vec4.add, vecA); });

            it("should update all values except the first vector", function() {
                expect(vecArray).toBeEqualish([
                    1, 2, 3, 4,
                    6, 8, 10, 12,
                    1, 2, 3, 4
                ]);
            });
            it("should return vecArray", function() { expect(result).toBe(vecArray); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when specifying a count", function() {
            beforeEach(function() { result = vec4.forEach(vecArray, 0, 0, 2, vec4.add, vecA); });

            it("should update all values except the last vector", function() {
                expect(vecArray).toBeEqualish([
                    2, 4, 6, 8,
                    6, 8, 10, 12,
                    0, 0, 0, 0
                ]);
            });
            it("should return vecArray", function() { expect(result).toBe(vecArray); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when specifying a stride", function() {
            beforeEach(function() { result = vec4.forEach(vecArray, 8, 0, 0, vec4.add, vecA); });

            it("should update all values except the second vector", function() {
                expect(vecArray).toBeEqualish([
                    2, 4, 6, 8,
                    5, 6, 7, 8,
                    1, 2, 3, 4
                ]);
            });
            it("should return vecArray", function() { expect(result).toBe(vecArray); });
            it("should not modify vecA", function() { expect(vecA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when calling a function that does not modify the out variable", function() {
            beforeEach(function() {
                result = vec3.forEach(vecArray, 0, 0, 0, function(out, vec) {});
            });

            it("values should remain unchanged", function() {
                expect(vecArray).toBeEqualish([
                    1, 2, 3, 4,
                    5, 6, 7, 8,
                    0, 0, 0, 0
                ]);
            });
            it("should return vecArray", function() { expect(result).toBe(vecArray); });
        });
    });

    describe("str", function() {
        beforeEach(function() { result = vec4.str(vecA); });

        it("should return a string representation of the vector", function() { expect(result).toEqual("vec4(1, 2, 3, 4)"); });
    });

    describe("exactEquals", function() {
        let vecC, r0, r1;
        beforeEach(function() {
            vecA = [0, 1, 2, 3];
            vecB = [0, 1, 2, 3];
            vecC = [1, 2, 3, 4];
            r0 = vec4.exactEquals(vecA, vecB);
            r1 = vec4.exactEquals(vecA, vecC);
        });

        it("should return true for identical vectors", function() { expect(r0).toBe(true); });
        it("should return false for different vectors", function() { expect(r1).toBe(false); });
        it("should not modify vecA", function() { expect(vecA).toBeEqualish([0, 1, 2, 3]); });
        it("should not modify vecB", function() { expect(vecB).toBeEqualish([0, 1, 2, 3]); });
    });

    describe("equals", function() {
        let vecC, vecD, r0, r1, r2;
        beforeEach(function() {
            vecA = [0, 1, 2, 3];
            vecB = [0, 1, 2, 3];
            vecC = [1, 2, 3, 4];
            vecD = [1e-16, 1, 2, 3];
            r0 = vec4.equals(vecA, vecB);
            r1 = vec4.equals(vecA, vecC);
            r2 = vec4.equals(vecA, vecD);
        });
        it("should return true for identical vectors", function() { expect(r0).toBe(true); });
        it("should return false for different vectors", function() { expect(r1).toBe(false); });
        it("should return true for close but not identical vectors", function() { expect(r2).toBe(true); });
        it("should not modify vecA", function() { expect(vecA).toBeEqualish([0, 1, 2, 3]); });
        it("should not modify vecB", function() { expect(vecB).toBeEqualish([0, 1, 2, 3]); });
    });
});
