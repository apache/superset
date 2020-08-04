const { assert } = require("chai");
const { parse } = require("@webassemblyjs/wast-parser");

const { moduleContextFromModuleAST } = require("../lib");

const contextFromWast = wast => moduleContextFromModuleAST(parse(wast).body[0]);

describe("module context", () => {
  describe("start segment", () => {
    it("should return the start function offset", () => {
      const context = contextFromWast(`
        (module
          (func)
          (func)
          (start 1)
        )
      `);

      assert.isOk(context.getStart());
      assert.typeOf(context.getStart(), "number");
      assert.equal(context.getStart(), 1);
    });

    it("should return null if no start function", () => {
      const context = contextFromWast(`
        (module (func))
      `);

      assert.isNull(context.getStart());
    });

    it("should retrive the type of implemented functions", () => {
      const context = contextFromWast(`
        (module
          (func (param i32) (result i64))
          (func (param i64) (result i32))
          (func (result i64))
          (func)
        )
      `);

      assert.deepEqual(context.getFunction(0), {
        args: ["i32"],
        result: ["i64"]
      });
      assert.deepEqual(context.getFunction(1), {
        args: ["i64"],
        result: ["i32"]
      });
      assert.deepEqual(context.getFunction(2), { args: [], result: ["i64"] });
      assert.deepEqual(context.getFunction(3), { args: [], result: [] });
    });

    it("should retrive the type of imported functions", () => {
      const context = contextFromWast(`
        (module
          (import "a" "a" (func (param i32) (result i32)))
          (import "a" "b" (func (result i64)))
          (import "a" "c" (func))
          (func (result f32))
        )
      `);

      assert.deepEqual(context.getFunction(0), {
        args: ["i32"],
        result: ["i32"]
      });
      assert.deepEqual(context.getFunction(1), {
        args: [],
        result: ["i64"]
      });
      assert.deepEqual(context.getFunction(2), { args: [], result: [] });
      assert.deepEqual(context.getFunction(3), { args: [], result: ["f32"] });
    });

    it("should retrive the type of functions with type ref", () => {
      const context = contextFromWast(`
        (module
          (type (func (param i32) (result i32)))
          (type (func (result i64)))
          (type (func))

          (import "a" "a" (func (type 0)))
          (import "a" "b" (func (type 1)))
          (func (type 2))
        )
      `);

      assert.deepEqual(context.getFunction(0), {
        args: ["i32"],
        result: ["i32"]
      });
      assert.deepEqual(context.getFunction(1), {
        args: [],
        result: ["i64"]
      });
      assert.deepEqual(context.getFunction(2), { args: [], result: [] });
    });
  });
});
