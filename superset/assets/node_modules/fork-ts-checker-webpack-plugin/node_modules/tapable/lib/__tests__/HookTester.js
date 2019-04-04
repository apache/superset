/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

require("babel-polyfill");

describe("HookTester", () => {
	it("should run", () => {});
});

process.on("unhandledRejection", err => console.error(err.stack));

class HookTester {
	constructor(hookCreator, sync) {
		this.hookCreator = hookCreator;
		this.sync = sync;
	}

	async run(syncOnly) {
		const result = {
			sync: {},
			async: {},
			intercept: {}
		};

		if (syncOnly) {
			await this.runSync(result.sync, "call");
		} else {
			await this.runAsync(result.async, "callAsync");
			await this.runAsync(result.async, "promise");

			await this.runIntercept(result.intercept, "callAsync");
			await this.runIntercept(result.intercept, "promise");
		}

		await this.runSync(result.sync, "callAsync");
		await this.runSync(result.sync, "promise");

		return result;
	}

	async runForLoop(syncOnly) {
		const result = {
			sync: {},
			async: {}
		};

		if (syncOnly) {
			await this.runForLoopSync(result.sync, "call");
		} else {
			await this.runForLoopAsync(result.async, "callAsync");
			await this.runForLoopAsync(result.async, "promise");
		}

		await this.runForLoopSync(result.sync, "callAsync");
		await this.runForLoopSync(result.sync, "promise");

		return result;
	}

	async runForLoopAsync(result, method) {
		{
			const hook = this.createHook([], `${method}BrokenPromise`);
			hook.tapPromise("promise", () => "this is not a promise");
			result[`${method}BrokenPromise`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}
		{
			const hook = this.createHook([], `${method}SinglePromise`);
			hook.tapPromise("promise", () => {
				result[`${method}SinglePromiseCalled`] =
					(result[`${method}SinglePromiseCalled`] || 0) + 1;
				if (result[`${method}SinglePromiseCalled`] < 42)
					return Promise.resolve().then(() => true);
				return Promise.resolve().then(() => {});
			});
			result[`${method}SinglePromise`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook([], `${method}MultiplePromise`);
			hook.tapPromise("promise1", () => {
				result[`${method}MultiplePromiseCalled1`] =
					(result[`${method}MultiplePromiseCalled1`] || 0) + 1;
				if (result[`${method}MultiplePromiseCalled1`] < 42)
					return Promise.resolve().then(() => true);
				return Promise.resolve().then(() => {});
			});
			hook.tapPromise("promise2", () => {
				result[`${method}MultiplePromiseCalled2`] =
					(result[`${method}MultiplePromiseCalled2`] || 0) + 1;
				if (result[`${method}MultiplePromiseCalled2`] < 42)
					return Promise.resolve().then(() => true);
				return Promise.resolve().then(() => {});
			});
			result[`${method}MultiplePromise`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook([], `${method}SingleAsync`);
			hook.tapAsync("async", callback => {
				result[`${method}SingleAsyncCalled`] =
					(result[`${method}SingleAsyncCalled`] || 0) + 1;
				if (result[`${method}SingleAsyncCalled`] < 42)
					return Promise.resolve().then(() => callback(null, true));
				return Promise.resolve().then(() => callback());
			});
			result[`${method}SingleAsync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook([], `${method}MultipleAsync`);
			hook.tapAsync("async1", callback => {
				result[`${method}MultipleAsyncCalled1`] =
					(result[`${method}MultipleAsyncCalled1`] || 0) + 1;
				if (result[`${method}MultipleAsyncCalled1`] < 42)
					return Promise.resolve().then(() => callback(null, true));
				return Promise.resolve().then(() => callback());
			});
			hook.tapAsync("async2", callback => {
				result[`${method}MultipleAsyncCalled2`] =
					(result[`${method}MultipleAsyncCalled2`] || 0) + 1;
				if (result[`${method}MultipleAsyncCalled2`] < 42)
					return Promise.resolve().then(() => callback(null, true));
				return Promise.resolve().then(() => callback());
			});
			result[`${method}MultipleAsync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook([], `${method}Mixed`);
			hook.tapAsync("async1", callback => {
				result[`${method}MixedCalled1`] =
					(result[`${method}MixedCalled1`] || 0) + 1;
				if (result[`${method}MixedCalled1`] < 42)
					return Promise.resolve().then(() => callback(null, true));
				return Promise.resolve().then(() => callback());
			});
			hook.tap("sync2", () => {
				result[`${method}MixedCalled2`] =
					(result[`${method}MixedCalled2`] || 0) + 1;
				if (result[`${method}MixedCalled2`] < 42) return true;
			});
			hook.tapPromise("promise3", () => {
				result[`${method}MixedCalled3`] =
					(result[`${method}MixedCalled3`] || 0) + 1;
				if (result[`${method}MixedCalled3`] < 42)
					return Promise.resolve().then(() => true);
				return Promise.resolve().then(() => {});
			});
			result[`${method}Mixed`] = await this.gainResult(cb => hook[method](cb));
		}
	}

	async runForLoopSync(result, method) {
		{
			const hook = this.createHook([], `${method}None`);
			result[`${method}None`] = await this.gainResult(cb => hook[method](cb));
		}

		{
			const hook = this.createHook(["arg"], `${method}NoneWithArg`);
			result[`${method}NoneWithArg`] = await this.gainResult(cb =>
				hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${method}SingleSync`);
			hook.tap("sync", () => {
				result[`${method}SingleSyncCalled`] =
					(result[`${method}SingleSyncCalled`] || 0) + 1;
				if (result[`${method}SingleSyncCalled`] < 42) return true;
			});
			result[`${method}SingleSync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook([], `${method}MultipleSync`);
			hook.tap("sync1", () => {
				result[`${method}MultipleSyncCalled1`] =
					(result[`${method}MultipleSyncCalled1`] || 0) + 1;
				if (result[`${method}MultipleSyncCalled1`] < 42) return true;
			});
			hook.tap("sync2", () => {
				result[`${method}MultipleSyncCalled2`] =
					(result[`${method}MultipleSyncCalled2`] || 0) + 1;
				if (result[`${method}MultipleSyncCalled2`] < 42) return true;
			});
			result[`${method}MultipleSync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook([], `${method}InterceptedSync`);
			hook.tap("sync1", () => {
				result[`${method}InterceptedSyncCalled1`] =
					(result[`${method}InterceptedSyncCalled1`] || 0) + 1;
				if (result[`${method}InterceptedSyncCalled1`] < 42) return true;
			});
			hook.tap("sync2", () => {
				result[`${method}InterceptedSyncCalled2`] =
					(result[`${method}InterceptedSyncCalled2`] || 0) + 1;
				if (result[`${method}InterceptedSyncCalled2`] < 42) return true;
			});
			hook.intercept({
				call: a =>
					(result[`${method}InterceptedSyncCalledCall`] =
						(result[`${method}InterceptedSyncCalledCall`] || 0) + 1),
				loop: a =>
					(result[`${method}InterceptedSyncCalledLoop`] =
						(result[`${method}InterceptedSyncCalledLoop`] || 0) + 1),
				tap: tap => {
					result[`${method}InterceptedSyncCalledTap`] =
						(result[`${method}InterceptedSyncCalledTap`] || 0) + 1;
				}
			});
			result[`${method}InterceptedSync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}
	}

	async runSync(result, method) {
		{
			const hook = this.createHook([], `${method}None`);
			result[`${method}None`] = await this.gainResult(cb => hook[method](cb));
		}

		{
			const hook = this.createHook(["arg"], `${method}NoneWithArg`);
			result[`${method}NoneWithArg`] = await this.gainResult(cb =>
				hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${method}SingleSync`);
			hook.tap("sync", () => {
				result[`${method}SingleSyncCalled`] = true;
				return 42;
			});
			result[`${method}SingleSync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook(["myArg"], `${method}SingleSyncWithArg`);
			hook.tap("sync", nr => {
				result[`${method}SingleSyncWithArgCalled`] = nr;
				return nr;
			});
			result[`${method}SingleSyncWithArg`] = await this.gainResult(cb =>
				hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${method}MultipleSync`);
			hook.tap("sync1", () => {
				result[`${method}MultipleSyncCalled1`] = true;
				return 42;
			});
			hook.tap("sync2", () => {
				result[`${method}MultipleSyncCalled2`] = true;
				return 43;
			});
			result[`${method}MultipleSync`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook(["a"], `${method}MultipleSyncWithArg`);
			hook.tap("sync1", a => {
				result[`${method}MultipleSyncWithArgCalled1`] = a;
				return 42 + a;
			});
			hook.tap("sync2", a => {
				result[`${method}MultipleSyncWithArgCalled2`] = a;
				return 43 + a;
			});
			result[`${method}MultipleSyncWithArg`] = await this.gainResult(cb =>
				hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["a"],
				`${method}MultipleSyncWithArgNoReturn`
			);
			hook.tap("sync1", a => {
				result[`${method}MultipleSyncWithArgNoReturnCalled1`] = a;
			});
			hook.tap("sync2", a => {
				result[`${method}MultipleSyncWithArgNoReturnCalled2`] = a;
			});
			result[`${method}MultipleSyncWithArgNoReturn`] = await this.gainResult(
				cb => hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["a"],
				`${method}MultipleSyncWithArgFirstReturn`
			);
			hook.tap("sync1", a => {
				result[`${method}MultipleSyncWithArgFirstReturnCalled1`] = a;
				return 42 + a;
			});
			hook.tap("sync2", a => {
				result[`${method}MultipleSyncWithArgFirstReturnCalled2`] = a;
			});
			result[`${method}MultipleSyncWithArgFirstReturn`] = await this.gainResult(
				cb => hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["a"],
				`${method}MultipleSyncWithArgLastReturn`
			);
			hook.tap("sync1", a => {
				result[`${method}MultipleSyncWithArgLastReturnCalled1`] = a;
			});
			hook.tap("sync2", a => {
				result[`${method}MultipleSyncWithArgLastReturnCalled2`] = a;
				return 43 + a;
			});
			result[`${method}MultipleSyncWithArgLastReturn`] = await this.gainResult(
				cb => hook[method](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["a", "b", "c"],
				`${method}MultipleSyncWithArgs`
			);
			hook.tap("sync1", (a, b, c) => {
				result[`${method}MultipleSyncWithArgsCalled1`] = [a, b, c];
				return a + b + c;
			});
			hook.tap("sync2", (a, b, c) => {
				result[`${method}MultipleSyncWithArgsCalled2`] = [a, b, c];
				return a + b + c + 1;
			});
			result[`${method}MultipleSyncWithArgs`] = await this.gainResult(cb =>
				hook[method](42, 43, 44, cb)
			);
		}

		{
			const hook = this.createHook([], `${method}MultipleSyncError`);
			hook.tap("sync1", () => {
				result[`${method}MultipleSyncErrorCalled1`] = true;
			});
			hook.tap("sync2", () => {
				result[`${method}MultipleSyncErrorCalled2`] = true;
				throw new Error("Error in sync2");
			});
			hook.tap("sync3", () => {
				result[`${method}MultipleSyncErrorCalled3`] = true;
			});
			result[`${method}MultipleSyncError`] = await this.gainResult(cb =>
				hook[method](cb)
			);
		}

		{
			const hook = this.createHook(["a", "b", "c"], `${method}Intercepted`);
			hook.intercept({
				call: (a, b, c) => {
					result[`${method}InterceptedCall1`] = [a, b, c];
				},
				tap: tap => {
					result[`${method}InterceptedTap1`] = Object.assign({}, tap, {
						fn: tap.fn.length
					});
				}
			});
			hook.intercept({
				call: (a, b, c) => {
					result[`${method}InterceptedCall2`] = [a, b, c];
				},
				tap: tap => {
					if (!result[`${method}InterceptedTap2`])
						result[`${method}InterceptedTap2`] = Object.assign({}, tap, {
							fn: tap.fn.length
						});
				}
			});
			hook.tap("sync1", (a, b, c) => a + b + c);
			hook.tap("sync2", (a, b) => a + b + 1);
			result[`${method}Intercepted`] = await this.gainResult(cb =>
				hook[method](1, 2, 3, cb)
			);
		}
	}

	async runAsync(result, type) {
		{
			const hook = this.createHook([], `${type}None`);
			result[`${type}None`] = await this.gainResult(cb => hook[type](cb));
		}

		{
			const hook = this.createHook(["arg"], `${type}NoneWithArg`);
			result[`${type}NoneWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${type}SingleSync`);
			hook.tap("sync", () => {
				result[`${type}SingleSyncCalled1`] = true;
				return 42;
			});
			result[`${type}SingleSync`] = await this.gainResult(cb => hook[type](cb));
		}

		{
			const hook = this.createHook(["x"], `${type}SingleSyncWithArg`);
			hook.tap("sync", arg => {
				result[`${type}SingleSyncWithArgCalled1`] = arg;
				return arg + 1;
			});
			result[`${type}SingleSyncWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}SingleSyncWithArgNoReturn`);
			hook.tap("sync", arg => {
				result[`${type}SingleSyncWithArgNoReturnCalled1`] = arg;
			});
			result[`${type}SingleSyncWithArgNoReturn`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleSync`);
			hook.tap("sync1", () => {
				result[`${type}MultipleSyncCalled1`] = true;
				return 42;
			});
			hook.tap("sync2", () => {
				result[`${type}MultipleSyncCalled2`] = true;
				return 43;
			});
			result[`${type}MultipleSync`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleSyncLastReturn`);
			hook.tap("sync1", () => {
				result[`${type}MultipleSyncLastReturnCalled1`] = true;
			});
			hook.tap("sync2", () => {
				result[`${type}MultipleSyncLastReturnCalled2`] = true;
				return 43;
			});
			result[`${type}MultipleSyncLastReturn`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleSyncNoReturn`);
			hook.tap("sync1", () => {
				result[`${type}MultipleSyncNoReturnCalled1`] = true;
			});
			hook.tap("sync2", () => {
				result[`${type}MultipleSyncNoReturnCalled2`] = true;
			});
			result[`${type}MultipleSyncNoReturn`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook(["arg"], `${type}MultipleSyncWithArg`);
			hook.tap("sync1", arg => {
				result[`${type}MultipleSyncWithArgCalled1`] = arg;
				return arg + 1;
			});
			hook.tap("sync2", arg => {
				result[`${type}MultipleSyncWithArgCalled2`] = arg;
				return arg + 2;
			});
			result[`${type}MultipleSyncWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["arg"],
				`${type}MultipleSyncWithArgNoReturn`
			);
			hook.tap("sync1", arg => {
				result[`${type}MultipleSyncWithArgNoReturnCalled1`] = arg;
			});
			hook.tap("sync2", arg => {
				result[`${type}MultipleSyncWithArgNoReturnCalled2`] = arg;
			});
			result[`${type}MultipleSyncWithArgNoReturn`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["arg"],
				`${type}MultipleSyncWithArgLastReturn`
			);
			hook.tap("sync1", arg => {
				result[`${type}MultipleSyncWithArgLastReturnCalled1`] = arg;
			});
			hook.tap("sync2", arg => {
				result[`${type}MultipleSyncWithArgLastReturnCalled2`] = arg;
				return arg + 2;
			});
			result[`${type}MultipleSyncWithArgLastReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["arg"],
				`${type}MultipleSyncWithArgFirstReturn`
			);
			hook.tap("sync1", arg => {
				result[`${type}MultipleSyncWithArgFirstReturnCalled1`] = arg;
				return arg + 1;
			});
			hook.tap("sync2", arg => {
				result[`${type}MultipleSyncWithArgFirstReturnCalled2`] = arg;
			});
			result[`${type}MultipleSyncWithArgFirstReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}SingleAsyncWithArg`);
			hook.tapAsync("async", (arg, callback) => {
				result[`${type}SingleAsyncWithArgCalled1`] = arg;
				callback(null, arg);
			});
			result[`${type}SingleAsyncWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleAsyncWithArg`);
			hook.tapAsync("async1", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgCalled1`] = arg;
				callback(null, arg + 1);
			});
			hook.tapAsync("async2", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgCalled2`] = arg;
				callback(null, arg + 2);
			});
			result[`${type}MultipleAsyncWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["x"],
				`${type}MultipleAsyncWithArgNoReturn`
			);
			hook.tapAsync("async1", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgNoReturnCalled1`] = arg;
				callback();
			});
			hook.tapAsync("async2", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgNoReturnCalled2`] = arg;
				callback();
			});
			result[`${type}MultipleAsyncWithArgNoReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["x"],
				`${type}MultipleAsyncWithArgFirstReturn`
			);
			hook.tapAsync("async1", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgFirstReturnCalled1`] = arg;
				callback(null, arg + 1);
			});
			hook.tapAsync("async2", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgFirstReturnCalled2`] = arg;
				callback();
			});
			result[`${type}MultipleAsyncWithArgFirstReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["x"],
				`${type}MultipleAsyncWithArgLastReturn`
			);
			hook.tapAsync("async1", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgLastReturnCalled1`] = arg;
				callback();
			});
			hook.tapAsync("async2", (arg, callback) => {
				result[`${type}MultipleAsyncWithArgLastReturnCalled2`] = arg;
				callback(null, arg + 2);
			});
			result[`${type}MultipleAsyncWithArgLastReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}SinglePromiseWithArg`);
			hook.tapPromise("promise", arg => {
				result[`${type}SinglePromiseWithArgCalled1`] = arg;
				return Promise.resolve(arg + 1);
			});
			result[`${type}SinglePromiseWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultiplePromiseWithArg`);
			hook.tapPromise("promise1", arg => {
				result[`${type}MultiplePromiseWithArgCalled1`] = arg;
				return Promise.resolve(arg + 1);
			});
			hook.tapPromise("promise2", arg => {
				result[`${type}MultiplePromiseWithArgCalled2`] = arg;
				return Promise.resolve(arg + 2);
			});
			result[`${type}MultiplePromiseWithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["x"],
				`${type}MultiplePromiseWithArgNoReturn`
			);
			hook.tapPromise("promise1", arg => {
				result[`${type}MultiplePromiseWithArgNoReturnCalled1`] = arg;
				return Promise.resolve();
			});
			hook.tapPromise("promise2", arg => {
				result[`${type}MultiplePromiseWithArgNoReturnCalled2`] = arg;
				return Promise.resolve();
			});
			result[`${type}MultiplePromiseWithArgNoReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(
				["x"],
				`${type}MultiplePromiseWithArgFirstReturn`
			);
			hook.tapPromise("promise1", arg => {
				result[`${type}MultiplePromiseWithArgFirstReturnCalled1`] = arg;
				return Promise.resolve(arg + 1);
			});
			hook.tapPromise("promise2", arg => {
				result[`${type}MultiplePromiseWithArgFirstReturnCalled2`] = arg;
				return Promise.resolve();
			});
			result[
				`${type}MultiplePromiseWithArgFirstReturn`
			] = await this.gainResult(cb => hook[type](42, cb));
		}

		{
			const hook = this.createHook(
				["x"],
				`${type}MultiplePromiseWithArgLastReturn`
			);
			hook.tapPromise("promise1", arg => {
				result[`${type}MultiplePromiseWithArgLastReturnCalled1`] = arg;
				return Promise.resolve();
			});
			hook.tapPromise("promise2", arg => {
				result[`${type}MultiplePromiseWithArgLastReturnCalled2`] = arg;
				return Promise.resolve(arg + 2);
			});
			result[`${type}MultiplePromiseWithArgLastReturn`] = await this.gainResult(
				cb => hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleMixed1WithArg`);
			hook.tapAsync("async", (arg, callback) => {
				result[`${type}MultipleMixed1WithArgCalled1`] = arg;
				callback(null, arg + 1);
			});
			hook.tapPromise("promise", arg => {
				result[`${type}MultipleMixed1WithArgCalled2`] = arg;
				return Promise.resolve(arg + 2);
			});
			hook.tap("sync", arg => {
				result[`${type}MultipleMixed1WithArgCalled3`] = arg;
				return arg + 3;
			});
			result[`${type}MultipleMixed1WithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleMixed2WithArg`);
			hook.tapAsync("async", (arg, callback) => {
				result[`${type}MultipleMixed2WithArgCalled1`] = arg;
				setTimeout(() => callback(null, arg + 1), 100);
			});
			hook.tapPromise("promise", arg => {
				result[`${type}MultipleMixed2WithArgCalled2`] = arg;
				return Promise.resolve(arg + 2);
			});
			result[`${type}MultipleMixed2WithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleMixed3WithArg`);
			hook.tapAsync("async1", (arg, callback) => {
				result[`${type}MultipleMixed3WithArgCalled1`] = arg;
				callback(null, arg + 1);
			});
			hook.tapPromise("promise", arg => {
				result[`${type}MultipleMixed3WithArgCalled2`] = arg;
				return Promise.resolve(arg + 2);
			});
			hook.tapAsync("async2", (arg, callback) => {
				result[`${type}MultipleMixed3WithArgCalled3`] = arg;
				setTimeout(() => callback(null, arg + 3), 100);
			});
			result[`${type}MultipleMixed3WithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleSyncError`);
			hook.tap("sync1", () => {
				result[`${type}MultipleSyncErrorCalled1`] = true;
			});
			hook.tap("sync2", () => {
				throw new Error("Error in sync2");
			});
			hook.tap("sync3", () => {
				result[`${type}MultipleSyncErrorCalled3`] = true;
			});
			result[`${type}MultipleSyncError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleAsyncError`);
			hook.tapAsync("async1", callback => {
				result[`${type}MultipleAsyncErrorCalled1`] = true;
				callback();
			});
			hook.tapAsync("async2", callback => {
				callback(new Error("Error in async2"));
			});
			hook.tapAsync("async3", callback => {
				result[`${type}MultipleAsyncErrorCalled3`] = true;
				callback();
			});
			result[`${type}MultipleAsyncError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleAsyncLateError`);
			hook.tapAsync("async1", callback => {
				result[`${type}MultipleAsyncLateErrorCalled1`] = true;
				callback();
			});
			hook.tapAsync("async2", callback => {
				setTimeout(() => callback(new Error("Error in async2")), 100);
			});
			hook.tapAsync("async3", callback => {
				result[`${type}MultipleAsyncLateErrorCalled3`] = true;
				callback();
			});
			result[`${type}MultipleAsyncLateError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook(
				[],
				`${type}MultipleAsyncLateErrorEarlyResult1`
			);
			hook.tapAsync("async1", callback => {
				result[`${type}MultipleAsyncLateErrorEarlyResult1Called1`] = true;
				callback();
			});
			hook.tapAsync("async2", callback => {
				setTimeout(() => callback(new Error("Error in async2")), 100);
			});
			hook.tapAsync("async3", callback => {
				result[`${type}MultipleAsyncLateErrorEarlyResult1Called3`] = true;
				callback(null, 7);
			});
			result[
				`${type}MultipleAsyncLateErrorEarlyResult1`
			] = await this.gainResult(cb => hook[type](cb));
		}

		{
			const hook = this.createHook(
				[],
				`${type}MultipleAsyncLateErrorEarlyResult2`
			);
			hook.tapAsync("async1", callback => {
				result[`${type}MultipleAsyncLateErrorEarlyResult2Called1`] = true;
				setTimeout(() => callback(null, 42), 200);
			});
			hook.tapAsync("async2", callback => {
				setTimeout(() => callback(new Error("Error in async2")), 100);
			});
			hook.tapAsync("async3", callback => {
				result[`${type}MultipleAsyncLateErrorEarlyResult2Called3`] = true;
				callback(null, 7);
			});
			result[
				`${type}MultipleAsyncLateErrorEarlyResult2`
			] = await this.gainResult(cb => hook[type](cb));
		}

		{
			const hook = this.createHook([], `${type}MultipleAsyncEarlyError`);
			hook.tapAsync("async1", callback => {
				result[`${type}MultipleAsyncEarlyErrorCalled1`] = true;
				setTimeout(() => callback(), 100);
			});
			hook.tapAsync("async2", callback => {
				callback(new Error("Error in async2"));
			});
			hook.tapAsync("async3", callback => {
				result[`${type}MultipleAsyncEarlyErrorCalled3`] = true;
				setTimeout(() => callback(), 100);
			});
			result[`${type}MultipleAsyncEarlyError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultiplePromiseError`);
			hook.tapPromise("promise1", () => {
				result[`${type}MultiplePromiseErrorCalled1`] = true;
				return Promise.resolve();
			});
			hook.tapPromise("promise2", () => {
				return Promise.resolve().then(() => {
					throw new Error("Error in async2");
				});
			});
			hook.tapPromise("promise3", () => {
				result[`${type}MultiplePromiseErrorCalled3`] = true;
				return Promise.resolve();
			});
			result[`${type}MultiplePromiseError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultiplePromiseLateError`);
			hook.tapPromise("promise1", () => {
				result[`${type}MultiplePromiseLateErrorCalled1`] = true;
				return Promise.resolve();
			});
			hook.tapPromise("promise2", () => {
				return new Promise((resolve, reject) => {
					setTimeout(() => reject(new Error("Error in async2")), 100);
				});
			});
			hook.tapPromise("promise3", () => {
				result[`${type}MultiplePromiseLateErrorCalled3`] = true;
				return Promise.resolve();
			});
			result[`${type}MultiplePromiseLateError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultiplePromiseEarlyError`);
			hook.tapPromise("promise1", () => {
				result[`${type}MultiplePromiseEarlyErrorCalled1`] = true;
				return new Promise(resolve => setTimeout(() => resolve(), 100));
			});
			hook.tapPromise("promise2", () => {
				return Promise.resolve().then(() => {
					throw new Error("Error in async2");
				});
			});
			hook.tapPromise("promise3", () => {
				result[`${type}MultiplePromiseEarlyErrorCalled3`] = true;
				return new Promise(resolve => setTimeout(() => resolve(), 100));
			});
			result[`${type}MultiplePromiseEarlyError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleMixedError1WithArg`);
			hook.tapAsync("async", (arg, callback) => {
				result[`${type}MultipleMixedError1WithArgCalled1`] = arg;
				callback(null, arg);
			});
			hook.tapPromise("promise", arg => {
				result[`${type}MultipleMixedError1WithArgCalled2`] = arg;
				return Promise.resolve(arg + 1);
			});
			hook.tap("sync", arg => {
				result[`${type}MultipleMixedError1WithArgCalled3`] = arg;
				throw new Error("Error in sync");
			});
			result[`${type}MultipleMixedError1WithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleMixedError2WithArg`);
			hook.tapAsync("async", (arg, callback) => {
				result[`${type}MultipleMixedError2WithArgCalled1`] = arg;
				callback(null, arg);
			});
			hook.tapPromise("promise", arg => {
				result[`${type}MultipleMixedError2WithArgCalled2`] = arg;
				return Promise.resolve().then(() => {
					throw new Error("Error in promise");
				});
			});
			hook.tap("sync", arg => {
				result[`${type}MultipleMixedError2WithArgCalled3`] = arg;
				return arg + 2;
			});
			result[`${type}MultipleMixedError2WithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook(["x"], `${type}MultipleMixedError3WithArg`);
			hook.tapAsync("async", (arg, callback) => {
				result[`${type}MultipleMixedError3WithArgCalled1`] = arg;
				callback(new Error("Error in async"));
			});
			hook.tapPromise("promise", arg => {
				result[`${type}MultipleMixedError3WithArgCalled2`] = arg;
				return Promise.resolve(arg + 1);
			});
			hook.tap("sync", arg => {
				result[`${type}MultipleMixedError3WithArgCalled3`] = arg;
				return arg + 2;
			});
			result[`${type}MultipleMixedError3WithArg`] = await this.gainResult(cb =>
				hook[type](42, cb)
			);
		}

		{
			const hook = this.createHook([], `${type}MultipleMixedLateError`);
			hook.tapAsync("async", callback => {
				result[`${type}MultipleMixedLateErrorCalled1`] = true;
				setTimeout(() => callback(new Error("Error in async")), 100);
			});
			hook.tapPromise("promise", () => {
				result[`${type}MultipleMixedLateErrorCalled2`] = true;
				return Promise.resolve(42);
			});
			hook.tap("sync", () => {
				result[`${type}MultipleMixedLateErrorCalled3`] = true;
				return 43;
			});
			result[`${type}MultipleMixedLateError`] = await this.gainResult(cb =>
				hook[type](cb)
			);
		}
	}

	async runIntercept(result, type) {
		{
			const hook = this.createHook(["a", "b", "c"], `${type}Intercepted`);
			hook.intercept({
				call: (a, b, c) => {
					result[`${type}InterceptedCall1`] = [a, b, c];
				},
				tap: tap => {
					result[`${type}InterceptedTap1`] = Object.assign({}, tap, {
						fn: tap.fn.length
					});
				}
			});
			hook.intercept({
				call: (a, b, c) => {
					result[`${type}InterceptedCall2`] = [a, b, c];
				},
				tap: tap => {
					if (!result[`${type}InterceptedTap2`])
						result[`${type}InterceptedTap2`] = Object.assign({}, tap, {
							fn: tap.fn.length
						});
				}
			});
			hook.tap("sync", (a, b, c) => a + b + c);
			hook.tapPromise("promise", (a, b) => Promise.resolve(a + b + 1));
			result[`${type}Intercepted`] = await this.gainResult(cb =>
				hook[type](1, 2, 3, cb)
			);
		}

		{
			const hook = this.createHook(
				["a", "b", "c"],
				`${type}ContextIntercepted`
			);
			hook.intercept({
				call: (context, a, b, c) => {
					context.number = 42;
					result[`${type}ContextInterceptedCall1`] = [context, a, b, c];
				},
				loop: (context, a, b, c) => {
					context.number2 = 88;
					result[`${type}ContextInterceptedLoop1`] = [context, a, b, c];
				},
				tap: (context, tap) => {
					result[`${type}ContextInterceptedTap1`] = context;
				},
				context: true
			});
			hook.intercept({
				call: (a, b, c) => {
					result[`${type}ContextInterceptedCall2`] = [a, b, c];
				}
			});
			hook.tap(
				{
					name: "sync",
					context: true
				},
				(context, a, b, c) => context.number + a + b + c
			);
			result[`${type}ContextIntercepted`] = await this.gainResult(cb =>
				hook[type](1, 2, 3, cb)
			);
		}

		{
			const hook = this.createHook(
				["a", "b", "c"],
				`${type}UnusedContextIntercepted`
			);
			hook.intercept({
				call: (context, a, b, c) => {
					result[`${type}UnusedContextInterceptedCall1`] = [context, a, b, c];
				},
				tap: (context, tap) => {
					result[`${type}UnusedContextInterceptedTap1`] = context;
				},
				context: true
			});
			hook.intercept({
				call: (a, b, c) => {
					result[`${type}UnusedContextInterceptedCall2`] = [a, b, c];
				}
			});
			hook.tap("sync", (a, b, c) => a + b + c);
			result[`${type}UnusedContextIntercepted`] = await this.gainResult(cb =>
				hook[type](1, 2, 3, cb)
			);
		}
	}

	gainResult(fn) {
		return Promise.race([
			new Promise(resolve => {
				try {
					const ret = fn((err, result) => {
						if (err) {
							resolve({
								type: "async",
								error: err.message
							});
						} else {
							resolve({
								type: "async",
								value: result
							});
						}
					});
					if (ret instanceof Promise) {
						resolve(
							ret.then(
								res => ({
									type: "promise",
									value: res
								}),
								err => ({
									type: "promise",
									error: err.message
								})
							)
						);
					} else if (ret !== undefined) {
						resolve({
							type: "return",
							value: ret
						});
					}
				} catch (e) {
					resolve({
						error: e.message
					});
				}
			}),
			new Promise(resolve => {
				setTimeout(
					() =>
						resolve({
							type: "no result"
						}),
					1000
				);
			})
		]);
	}

	createHook(args, name) {
		try {
			return this.hookCreator(args, name);
		} catch (err) {
			return {
				tap: () => {},
				tapPromise: () => {},
				tapAsync: () => {},
				intercept: () => {},
				call: () => {
					throw err;
				},
				callAsync: () => {
					throw err;
				},
				promise: () => {
					throw err;
				}
			};
		}
	}
}

module.exports = HookTester;
