import * as mat3 from "../../src/gl-matrix/mat3"
import * as mat4 from "../../src/gl-matrix/mat4"
import * as quat from "../../src/gl-matrix/quat"
import * as vec3 from "../../src/gl-matrix/vec3"

describe("quat", function() {
    let out, quatA, quatB, result;
    let vec, id, deg90;

    beforeEach(function() {
        quatA = [1, 2, 3, 4];
        quatB = [5, 6, 7, 8];
        out = [0, 0, 0, 0];
        vec = [1, 1, -1];
        id = [0, 0, 0, 1];
        deg90 = Math.PI / 2;
    });

    describe("slerp", function() {
        describe("the normal case", function() {
            beforeEach(function() {
                result = quat.slerp(out, [0, 0, 0, 1], [0, 1, 0, 0], 0.5);
            });

            it("should return out", function() { expect(result).toBe(out); });
            it("should calculate proper quat", function() {
                expect(result).toBeEqualish([0, 0.707106, 0, 0.707106]);
            });
        });

        describe("where a == b", function() {
            beforeEach(function() {
                result = quat.slerp(out, [0, 0, 0, 1], [0, 0, 0, 1], 0.5);
            });

            it("should return out", function() { expect(result).toBe(out); });
            it("should calculate proper quat", function() {
                expect(result).toBeEqualish([0, 0, 0, 1]);
            });
        });

        describe("where theta == 180deg", function() {
            beforeEach(function() {
                quat.rotateX(quatA, [1,0,0,0], Math.PI); // 180 deg
                result = quat.slerp(out, [1,0,0,0], quatA, 1);
            });

            it("should calculate proper quat", function() {
                expect(result).toBeEqualish([0,0,0,-1]);
            });
        });

        describe("where a == -b", function() {
            beforeEach(function() {
                result = quat.slerp(out, [1, 0, 0, 0], [-1, 0, 0, 0], 0.5);
            });

            it("should return out", function() { expect(result).toBe(out); });
            it("should calculate proper quat", function() {
                expect(result).toBeEqualish([1, 0, 0, 0]);
            });
        });
    });

    describe("rotateX", function() {
        beforeEach(function() {
            result = quat.rotateX(out, id, deg90);
        });

        it("should return out", function() { expect(result).toBe(out); });
        it("should transform vec accordingly", function() {
            vec3.transformQuat(vec, [0,0,-1], out);
            expect(vec).toBeEqualish([0, 1, 0]);
        });
    });

    describe("rotateY", function() {
        beforeEach(function() {
            result = quat.rotateY(out, id, deg90);
        });

        it("should return out", function() { expect(result).toBe(out); });
        it("should transform vec accordingly", function() {
            vec3.transformQuat(vec, [0,0,-1], out);
            expect(vec).toBeEqualish([-1, 0, 0]);
        });
    });

    describe("rotateZ", function() {
        beforeEach(function() {
            result = quat.rotateZ(out, id, deg90);
        });

        it("should return out", function() { expect(result).toBe(out); });
        it("should transform vec accordingly", function() {
            vec3.transformQuat(vec, [0,1,0], out);
            expect(vec).toBeEqualish([-1, 0, 0]);
        });
    });

    describe("fromMat3", function() {
        let matr;

        describe("legacy", function() {
            beforeEach(function() {
                matr = [ 1, 0,  0,
                         0, 0, -1,
                         0, 1,  0 ];
                result = quat.fromMat3(out, matr);
            });

            it("should set dest to the correct value", function() {
                expect(result).toBeEqualish([-0.707106, 0, 0, 0.707106]);
            });
        });

        describe("where trace > 0", function() {
            beforeEach(function() {
                matr = [ 1, 0,  0,
                         0, 0, -1,
                         0, 1,  0 ];
                result = quat.fromMat3(out, matr);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("should produce the correct transformation", function() {
                expect(vec3.transformQuat([], [0,1,0], out)).toBeEqualish([0,0,-1]);
            });
        });

        describe("from a normal matrix looking 'backward'", function() {
            beforeEach(function() {
                matr = mat3.create();
                mat3.transpose(matr, mat3.invert(matr, mat3.fromMat4(matr, mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, 1], [0, 1, 0]))));
                result = quat.fromMat3(out, matr);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("should produce the same transformation as the given matrix", function() {
                expect(vec3.transformQuat([], [3,2,-1], quat.normalize(out, out))).toBeEqualish(vec3.transformMat3([], [3,2,-1], matr));
            });
        });

        describe("from a normal matrix looking 'left' and 'upside down'", function() {
            beforeEach(function() {
                matr = mat3.create();
                mat3.transpose(matr, mat3.invert(matr, mat3.fromMat4(matr, mat4.lookAt(mat4.create(), [0, 0, 0], [-1, 0, 0], [0, -1, 0]))));
                result = quat.fromMat3(out, matr);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("should produce the same transformation as the given matrix", function() {
                expect(vec3.transformQuat([], [3,2,-1], quat.normalize(out, out))).toBeEqualish(vec3.transformMat3([], [3,2,-1], matr));
            });
        });

        describe("from a normal matrix looking 'upside down'", function() {
            beforeEach(function() {
                matr = mat3.create();
                mat3.transpose(matr, mat3.invert(matr, mat3.fromMat4(matr, mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, -1], [0, -1, 0]))));
                result = quat.fromMat3(out, matr);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("should produce the same transformation as the given matrix", function() {
                expect(vec3.transformQuat([], [3,2,-1], quat.normalize(out, out))).toBeEqualish(vec3.transformMat3([], [3,2,-1], matr));
            });
        });
    });

    describe("fromEuler", function() {
        describe("legacy", function() {
            beforeEach(function() {
                result = quat.fromEuler(out, -90, 0, 0);
            });

            it("should set dest to the correct value", function() {
                expect(result).toBeEqualish([-0.707106, 0, 0, 0.707106]);
            });
        });

        describe("where trace > 0", function() {
            beforeEach(function() {
                result = quat.fromEuler(out, -90, 0, 0);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("should produce the correct transformation", function() {
                expect(vec3.transformQuat([], [0,1,0], out)).toBeEqualish([0,0,-1]);
            });
        });
    });

    describe("setAxes", function() {
        let r;
        beforeEach(function() { r = vec3.create(); });

        describe("looking left", function() {
            let view, up, right;
            beforeEach(function() {
                view = [-1, 0, 0];
                up   = [ 0, 1, 0];
                right= [ 0, 0,-1];
                result = quat.setAxes([], view, right, up);
            });

            it("should transform local view into world left", function() {
                r = vec3.transformQuat([], [0,0,-1], result);
                expect(r).toBeEqualish([1, 0, 0]);
            });

            it("should transform local right into world front", function() {
                r = vec3.transformQuat([], [1,0,0], result);
                expect(r).toBeEqualish([0, 0, 1]);
            });
        });

        describe("given opengl defaults", function() {
            let view, up, right;
            beforeEach(function() {
                view = [0, 0, -1];
                up   = [0, 1,  0];
                right= [1, 0,  0];
                result = quat.setAxes(out, view, right, up);
            });

            it("should return out", function() {
                expect(result).toBe(out);
            });

            it("should produce identity", function() {
                expect(out).toBeEqualish([0, 0, 0, 1]);
            });
        });

        describe("legacy example", function() {
            let view, up, right;
            beforeEach(function() {
                right= [1,  0, 0];
                up   = [0,  0, 1];
                view = [0, -1, 0];
                result = quat.setAxes(out, view, right, up);
            });

            xit("should set correct quat4 values", function() {
                expect(result).toBeEqualish([0.707106, 0, 0, 0.707106]);
            });
        });
    });

    describe("rotationTo", function() {
        let r;
        beforeEach(function() { r = vec3.create(); });

        describe("at right angle", function() {
            beforeEach(function() {
                result = quat.rotationTo(out, [0, 1, 0], [1, 0, 0]);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("should calculate proper quaternion", function() {
                expect(out).toBeEqualish([0, 0, -0.707106, 0.707106]);
            });
        });

        describe("when vectors are parallel", function() {
            beforeEach(function() {
                result = quat.rotationTo(out, [0, 1, 0], [0, 1, 0]);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("multiplying A should produce B", function() {
                expect(vec3.transformQuat(r, [0, 1, 0], out)).toBeEqualish([0, 1, 0]);
            });
        });

        describe("when vectors are opposed X", function() {
            beforeEach(function() {
                result = quat.rotationTo(out, [1, 0, 0], [-1, 0, 0]);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("multiplying A should produce B", function() {
                expect(vec3.transformQuat(r, [1, 0, 0], out)).toBeEqualish([-1, 0, 0]);
            });
        });

        describe("when vectors are opposed Y", function() {
            beforeEach(function() {
                result = quat.rotationTo(out, [0, 1, 0], [0, -1, 0]);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("multiplying A should produce B", function() {
                expect(vec3.transformQuat(r, [0, 1, 0], out)).toBeEqualish([0, -1, 0]);
            });
        });

        describe("when vectors are opposed Z", function() {
            beforeEach(function() {
                result = quat.rotationTo(out, [0, 0, 1], [0, 0, -1]);
            });

            it("should return out", function() { expect(result).toBe(out); });

            it("multiplying A should produce B", function() {
                expect(vec3.transformQuat(r, [0, 0, 1], out)).toBeEqualish([0, 0, -1]);
            });
        });
    });

    describe("create", function() {
        beforeEach(function() { result = quat.create(); });
        it("should return a 4 element array initialized to an identity quaternion", function() { expect(result).toBeEqualish([0, 0, 0, 1]); });
    });

    describe("clone", function() {
        beforeEach(function() { result = quat.clone(quatA); });
        it("should return a 4 element array initialized to the values in quatA", function() { expect(result).toBeEqualish(quatA); });
    });

    describe("fromValues", function() {
        beforeEach(function() { result = quat.fromValues(1, 2, 3, 4); });
        it("should return a 4 element array initialized to the values passed", function() { expect(result).toBeEqualish([1, 2, 3, 4]); });
    });

    describe("copy", function() {
        beforeEach(function() { result = quat.copy(out, quatA); });
        it("should place values into out", function() { expect(out).toBeEqualish([1, 2, 3, 4]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("set", function() {
        beforeEach(function() { result = quat.set(out, 1, 2, 3, 4); });
        it("should place values into out", function() { expect(out).toBeEqualish([1, 2, 3, 4]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("identity", function() {
        beforeEach(function() { result = quat.identity(out); });
        it("should place values into out", function() { expect(result).toBeEqualish([0, 0, 0, 1]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("setAxisAngle", function() {
        beforeEach(function() { result = quat.setAxisAngle(out, [1, 0, 0], Math.PI * 0.5); });
        it("should place values into out", function() { expect(result).toBeEqualish([0.707106, 0, 0, 0.707106]); });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("getAxisAngle", function() {
        describe("for a quaternion representing no rotation", function() {
            beforeEach(function() { result = quat.setAxisAngle(out, [0, 1, 0], 0.0); deg90 = quat.getAxisAngle(vec, out); });
            it("should return a multiple of 2*PI as the angle component", function() { expect(deg90 % (Math.PI * 2.0)).toBeEqualish(0.0); });
        });

        describe("for a simple rotation about X axis", function() {
            beforeEach(function() { result = quat.setAxisAngle(out, [1, 0, 0], 0.7778); deg90 = quat.getAxisAngle(vec, out); });
            it("should return the same provided angle", function() { expect(deg90).toBeEqualish(0.7778); });
            it("should return the X axis as the angle", function() { expect(vec).toBeEqualish([1, 0, 0]); });
        });

        describe("for a simple rotation about Y axis", function() {
            beforeEach(function() { result = quat.setAxisAngle(out, [0, 1, 0], 0.879546); deg90 = quat.getAxisAngle(vec, out); });
            it("should return the same provided angle", function() { expect(deg90).toBeEqualish(0.879546); });
            it("should return the X axis as the angle", function() { expect(vec).toBeEqualish([0, 1, 0]); });
        });

        describe("for a simple rotation about Z axis", function() {
            beforeEach(function() { result = quat.setAxisAngle(out, [0, 0, 1], 0.123456); deg90 = quat.getAxisAngle(vec, out); });
            it("should return the same provided angle", function() { expect(deg90).toBeEqualish(0.123456); });
            it("should return the X axis as the angle", function() { expect(vec).toBeEqualish([0, 0, 1]); });
        });

        describe("for a slightly irregular axis and right angle", function() {
            beforeEach(function() { result = quat.setAxisAngle(out, [0.707106, 0, 0.707106], Math.PI * 0.5); deg90 = quat.getAxisAngle(vec, out); });
            it("should place values into vec", function() { expect(vec).toBeEqualish([0.707106, 0, 0.707106]); });
            it("should return a numeric angle", function() { expect(deg90).toBeEqualish(Math.PI * 0.5); });
        });

        describe("for a very irregular axis and negative input angle", function() {
            beforeEach(function() {
                quatA = quat.setAxisAngle(quatA, [0.65538555, 0.49153915, 0.57346237], 8.8888);
                deg90 = quat.getAxisAngle(vec, quatA);
                quatB = quat.setAxisAngle(quatB, vec, deg90);
            });
            it("should return an angle between 0 and 2*PI", function() { expect(deg90).toBeGreaterThan(0.0); expect(deg90).toBeLessThan(Math.PI * 2.0); });
            it("should create the same quaternion from axis and angle extracted", function() { expect(quatA).toBeEqualish(quatB); });
        });
    });

    describe("add", function() {
        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.add(out, quatA, quatB); });

            it("should place values into out", function() { expect(out).toBeEqualish([6, 8, 10, 12]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.add(quatA, quatA, quatB); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([6, 8, 10, 12]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatB is the output quaternion", function() {
            beforeEach(function() { result = quat.add(quatB, quatA, quatB); });

            it("should place values into quatB", function() { expect(quatB).toBeEqualish([6, 8, 10, 12]); });
            it("should return quatB", function() { expect(result).toBe(quatB); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("multiply", function() {
        it("should have an alias called 'mul'", function() { expect(quat.mul).toEqual(quat.multiply); });

        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.multiply(out, quatA, quatB); });

            it("should place values into out", function() { expect(out).toBeEqualish([24, 48, 48, -6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.multiply(quatA, quatA, quatB); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([24, 48, 48, -6]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatB is the output quaternion", function() {
            beforeEach(function() { result = quat.multiply(quatB, quatA, quatB); });

            it("should place values into quatB", function() { expect(quatB).toBeEqualish([24, 48, 48, -6]); });
            it("should return quatB", function() { expect(result).toBe(quatB); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("scale", function() {
        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.scale(out, quatA, 2); });

            it("should place values into out", function() { expect(out).toBeEqualish([2, 4, 6, 8]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.scale(quatA, quatA, 2); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([2, 4, 6, 8]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
        });
    });

    describe("length", function() {
        it("should have an alias called 'len'", function() { expect(quat.len).toEqual(quat.length); });

        beforeEach(function() { result = quat.len(quatA); });

        it("should return the length", function() { expect(result).toBeEqualish(5.477225); });
    });

    describe("squaredLength", function() {
        it("should have an alias called 'sqrLen'", function() { expect(quat.sqrLen).toEqual(quat.squaredLength); });

        beforeEach(function() { result = quat.squaredLength(quatA); });

        it("should return the squared length", function() { expect(result).toEqual(30); });
    });

    describe("normalize", function() {
        beforeEach(function() { quatA = [5, 0, 0, 0]; });

        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.normalize(out, quatA); });

            it("should place values into out", function() { expect(out).toBeEqualish([1, 0, 0, 0]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([5, 0, 0, 0]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.normalize(quatA, quatA); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([1, 0, 0, 0]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
        });
    });

    describe("lerp", function() {
        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.lerp(out, quatA, quatB, 0.5); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 4, 5, 6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.lerp(quatA, quatA, quatB, 0.5); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([3, 4, 5, 6]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatB is the output quaternion", function() {
            beforeEach(function() { result = quat.lerp(quatB, quatA, quatB, 0.5); });

            it("should place values into quatB", function() { expect(quatB).toBeEqualish([3, 4, 5, 6]); });
            it("should return quatB", function() { expect(result).toBe(quatB); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("slerp", function() {
        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.slerp(out, quatA, quatB, 0.5); });

            it("should place values into out", function() { expect(out).toBeEqualish([3, 4, 5, 6]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.slerp(quatA, quatA, quatB, 0.5); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([3, 4, 5, 6]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
            it("should not modify quatB", function() { expect(quatB).toBeEqualish([5, 6, 7, 8]); });
        });

        describe("when quatB is the output quaternion", function() {
            beforeEach(function() { result = quat.slerp(quatB, quatA, quatB, 0.5); });

            it("should place values into quatB", function() { expect(quatB).toBeEqualish([3, 4, 5, 6]); });
            it("should return quatB", function() { expect(result).toBe(quatB); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });
    });

    describe("random", function() {
        beforeEach(function() { result = quat.random(out); });

        it("should result in a normalized quaternion", function() {
            let copy = quat.clone(out);
            expect(quat.normalize(out, out)).toBeEqualish(copy);
        });
        it("should return out", function() { expect(result).toBe(out); });
    });

    describe("invert", function() {
        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.invert(out, quatA); });

            it("should place values into out", function() { expect(out).toBeEqualish([-0.033333, -0.066666, -0.1, 0.133333]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.invert(quatA, quatA); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([-0.033333, -0.066666, -0.1, 0.133333]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
        });
    });

    describe("conjugate", function() {
        describe("with a separate output quaternion", function() {
            beforeEach(function() { result = quat.conjugate(out, quatA); });

            it("should place values into out", function() { expect(out).toBeEqualish([-1, -2, -3, 4]); });
            it("should return out", function() { expect(result).toBe(out); });
            it("should not modify quatA", function() { expect(quatA).toBeEqualish([1, 2, 3, 4]); });
        });

        describe("when quatA is the output quaternion", function() {
            beforeEach(function() { result = quat.conjugate(quatA, quatA); });

            it("should place values into quatA", function() { expect(quatA).toBeEqualish([-1, -2, -3, 4]); });
            it("should return quatA", function() { expect(result).toBe(quatA); });
        });
    });

    describe("str", function() {
        beforeEach(function() { result = quat.str(quatA); });

        it("should return a string representation of the quaternion", function() { expect(result).toEqual("quat(1, 2, 3, 4)"); });
    });

    describe("exactEquals", function() {
        let quatC, r0, r1;
        beforeEach(function() {
            quatA = [0, 1, 2, 3];
            quatB = [0, 1, 2, 3];
            quatC = [1, 2, 3, 4];
            r0 = quat.exactEquals(quatA, quatB);
            r1 = quat.exactEquals(quatA, quatC);
        });

        it("should return true for identical quaternions", function() { expect(r0).toBe(true); });
        it("should return false for different quaternions", function() { expect(r1).toBe(false); });
        it("should not modify quatA", function() { expect(quatA).toBeEqualish([0, 1, 2, 3]); });
        it("should not modify quatB", function() { expect(quatB).toBeEqualish([0, 1, 2, 3]); });
    });

    describe("equals", function() {
        let quatC, quatD, r0, r1, r2;
        beforeEach(function() {
            quatA = [0, 1, 2, 3];
            quatB = [0, 1, 2, 3];
            quatC = [1, 2, 3, 4];
            quatD = [1e-16, 1, 2, 3];
            r0 = quat.equals(quatA, quatB);
            r1 = quat.equals(quatA, quatC);
            r2 = quat.equals(quatA, quatD);
        });
        it("should return true for identical quaternions", function() { expect(r0).toBe(true); });
        it("should return false for different quaternions", function() { expect(r1).toBe(false); });
        it("should return true for close but not identical quaternions", function() { expect(r2).toBe(true); });
        it("should not modify quatA", function() { expect(quatA).toBeEqualish([0, 1, 2, 3]); });
        it("should not modify quatB", function() { expect(quatB).toBeEqualish([0, 1, 2, 3]); });
    });
});
