/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const SyncHook = require("../SyncHook");

describe("Hook", () => {
	it("should allow to insert hooks before others and in stages", () => {
		const hook = new SyncHook();

		const calls = [];
		hook.tap("A", () => calls.push("A"));
		hook.tap(
			{
				name: "B",
				before: "A"
			},
			() => calls.push("B")
		);

		calls.length = 0;
		hook.call();
		expect(calls).toEqual(["B", "A"]);

		hook.tap(
			{
				name: "C",
				before: ["A", "B"]
			},
			() => calls.push("C")
		);

		calls.length = 0;
		hook.call();
		expect(calls).toEqual(["C", "B", "A"]);

		hook.tap(
			{
				name: "D",
				before: "B"
			},
			() => calls.push("D")
		);

		calls.length = 0;
		hook.call();
		expect(calls).toEqual(["C", "D", "B", "A"]);

		hook.tap(
			{
				name: "E",
				stage: -5
			},
			() => calls.push("E")
		);
		hook.tap(
			{
				name: "F",
				stage: -3
			},
			() => calls.push("F")
		);

		calls.length = 0;
		hook.call();
		expect(calls).toEqual(["E", "F", "C", "D", "B", "A"]);
	});
});
