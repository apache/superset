/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

require("babel-polyfill");

const SyncBailHook = require("../SyncBailHook");

describe("SyncBailHook", () => {
	it("should allow to create sync bail hooks", async () => {
		const h1 = new SyncBailHook(["a"]);
		const h2 = new SyncBailHook(["a", "b"]);
		const h3 = new SyncBailHook(["a"]);

		let r = h1.call(1);
		expect(r).toEqual(undefined);

		h1.tap("A", a => undefined);
		h2.tap("A", (a, b) => [a, b]);

		expect(h1.call(1)).toEqual(undefined);
		expect(await h1.promise(1)).toEqual(undefined);
		expect(await pify(cb => h1.callAsync(1, cb))).toEqual(undefined);
		expect(h2.call(1, 2)).toEqual([1, 2]);
		expect(await h2.promise(1, 2)).toEqual([1, 2]);
		expect(await pify(cb => h2.callAsync(1, 2, cb))).toEqual([1, 2]);

		h1.tap("B", a => "ok" + a);
		h2.tap("B", (a, b) => "wrong");

		expect(h1.call(10)).toEqual("ok10");
		expect(await h1.promise(10)).toEqual("ok10");
		expect(await pify(cb => h1.callAsync(10, cb))).toEqual("ok10");
		expect(h2.call(10, 20)).toEqual([10, 20]);
		expect(await h2.promise(10, 20)).toEqual([10, 20]);
		expect(await pify(cb => h2.callAsync(10, 20, cb))).toEqual([10, 20]);
	});

	it("should allow to intercept calls", () => {
		const hook = new SyncBailHook(["x"]);

		const mockCall = jest.fn();
		const mockTap = jest.fn(x => x);

		hook.intercept({
			call: mockCall,
			tap: mockTap
		});

		hook.call(5);

		expect(mockCall).toHaveBeenLastCalledWith(5);
		expect(mockTap).not.toHaveBeenCalled();

		hook.tap("test", () => 10);

		hook.call(7);

		expect(mockCall).toHaveBeenLastCalledWith(7);
		expect(mockTap).toHaveBeenCalled();
	});
});

function pify(fn) {
	return new Promise((resolve, reject) => {
		fn((err, result) => {
			if (err) reject(err);
			else resolve(result);
		});
	});
}
