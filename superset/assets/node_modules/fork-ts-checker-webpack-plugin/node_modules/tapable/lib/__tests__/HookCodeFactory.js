/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const HookCodeFactory = require("../HookCodeFactory");

const expectNoSyntaxError = code => {
	new Function("a, b, c", code);
};

describe("HookCodeFactory", () => {
	describe("callTap", () => {
		const factoryConfigurations = {
			"no args, no intercept": {
				args: [],
				taps: [
					{
						type: "sync"
					},
					{
						type: "async"
					},
					{
						type: "promise"
					}
				],
				interceptors: []
			},
			"with args, no intercept": {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "sync"
					},
					{
						type: "async"
					},
					{
						type: "promise"
					}
				],
				interceptors: []
			},
			"with args, with intercept": {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "sync"
					},
					{
						type: "async"
					},
					{
						type: "promise"
					}
				],
				interceptors: [
					{
						call: () => {},
						tap: () => {}
					},
					{
						tap: () => {}
					},
					{
						call: () => {}
					}
				]
			}
		};
		for (const configurationName in factoryConfigurations) {
			describe(`(${configurationName})`, () => {
				let factory;
				beforeEach(() => {
					factory = new HookCodeFactory();
					factory.init(factoryConfigurations[configurationName]);
				});
				it("sync without onResult", () => {
					const code = factory.callTap(0, {
						onError: err => `onError(${err});\n`,
						onDone: () => "onDone();\n"
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("sync with onResult", () => {
					const code = factory.callTap(0, {
						onError: err => `onError(${err});\n`,
						onResult: result => `onResult(${result});\n`
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("async without onResult", () => {
					const code = factory.callTap(1, {
						onError: err => `onError(${err});\n`,
						onDone: () => "onDone();\n"
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("async with onResult", () => {
					const code = factory.callTap(1, {
						onError: err => `onError(${err});\n`,
						onResult: result => `onResult(${result});\n`
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("promise without onResult", () => {
					const code = factory.callTap(2, {
						onError: err => `onError(${err});\n`,
						onDone: () => "onDone();\n"
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("promise with onResult", () => {
					const code = factory.callTap(2, {
						onError: err => `onError(${err});\n`,
						onResult: result => `onResult(${result});\n`
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
			});
		}
	});
	describe("taps", () => {
		const factoryConfigurations = {
			none: {
				args: ["a", "b", "c"],
				taps: [],
				interceptors: []
			},
			"single sync": {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "sync"
					}
				],
				interceptors: []
			},
			"multiple sync": {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "sync"
					},
					{
						type: "sync"
					},
					{
						type: "sync"
					}
				],
				interceptors: []
			},
			"single async": {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "async"
					}
				],
				interceptors: []
			},
			"single promise": {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "promise"
					}
				],
				interceptors: []
			},
			mixed: {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "sync"
					},
					{
						type: "async"
					},
					{
						type: "promise"
					}
				],
				interceptors: []
			},
			mixed2: {
				args: ["a", "b", "c"],
				taps: [
					{
						type: "async"
					},
					{
						type: "promise"
					},
					{
						type: "sync"
					}
				],
				interceptors: []
			}
		};
		for (const configurationName in factoryConfigurations) {
			describe(`(${configurationName})`, () => {
				let factory;
				beforeEach(() => {
					factory = new HookCodeFactory();
					factory.init(factoryConfigurations[configurationName]);
				});
				it("callTapsSeries", () => {
					const code = factory.callTapsSeries({
						onError: (i, err) => `onError(${i}, ${err});\n`,
						onResult: (i, result, next, doneBreak) =>
							`onResult(${i}, ${result}, () => {\n${next()}}, () => {\n${doneBreak()}});\n`,
						onDone: () => "onDone();\n",
						rethrowIfPossible: true
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("callTapsParallel", () => {
					const code = factory.callTapsParallel({
						onError: (i, err) => `onError(${i}, ${err});\n`,
						onResult: (i, result, done, doneBreak) =>
							`onResult(${i}, ${result}, () => {\n${done()}}, () => {\n${doneBreak()}});\n`,
						onDone: () => "onDone();\n",
						rethrowIfPossible: true
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
				it("callTapsLooping", () => {
					const code = factory.callTapsLooping({
						onError: (i, err) => `onError(${i}, ${err});\n`,
						onDone: () => "onDone();\n",
						rethrowIfPossible: true
					});
					expect(code).toMatchSnapshot();
					expectNoSyntaxError(code);
				});
			});
		}
	});
});
