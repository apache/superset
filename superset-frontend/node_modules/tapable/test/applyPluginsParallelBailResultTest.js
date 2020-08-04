/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var Tapable = require("../lib/Tapable");
var should = require("should");

function makeTestPlugin(arr, index) {
	var last;
	var f = function() {
		f.shouldNotBeCalled();
		var args = Array.prototype.slice.call(arguments);
		args.unshift(index);
		last = args;
		arr.push(args);
	};
	f.issue = function() {
		f.shouldBeCalled();
		last.pop().apply(null, arguments);
		last = null;
	};
	f.shouldNotBeCalled = function() {
		if(last) throw new Error("Plugin " + index + " was called, but shouldn't be.");
	};
	f.shouldBeCalled = function() {
		if(!last) throw new Error("Plugin " + index + " was not called, but should be.");
	};
	f.shouldBeCalledAsyncWith = function() {
		f.shouldBeCalled();
		var args = Array.prototype.slice.call(arguments);
		for(var i = 0; i < args.length && i < last.length - 2; i++) {
			if(args[i] === null || args[i] === undefined) {
				should.not.exist(last[i+1]);
			} else {
				should.exist(last[i+1]);
				last[i+1].should.be.eql(args[i]);
			}
		}
		args.length.should.be.eql(last.length - 2);
	};
	return f;
}

describe("applyPluginsParallelBailResult", function() {
	it("should call all handlers", function() {
		var tapable = new Tapable();
		var log = [];
		var p1 = makeTestPlugin(log, 1);
		var p2 = makeTestPlugin(log, 2);
		var p3 = makeTestPlugin(log, 3);
		var p4 = makeTestPlugin(log, 4);
		var result = makeTestPlugin(log, 0);
		tapable.plugin("test", p1);
		tapable.plugin("test", p2);
		tapable.plugin("xxxx", p3);
		tapable.plugin("test", p4);
		tapable.applyPluginsParallelBailResult("test", 1, 2, result);
		p1.shouldBeCalledAsyncWith(1, 2);
		p2.shouldBeCalledAsyncWith(1, 2);
		p3.shouldNotBeCalled();
		p4.shouldBeCalledAsyncWith(1, 2);
		p1.issue();
		p2.issue(null, "ok");
		p4.issue(null, "fail");
		log.should.be.eql([
			[1, 1, 2],
			[2, 1, 2],
			[4, 1, 2],
			[0, null, "ok"]
		]);
	});
	it("should save valid results", function() {
		var tapable = new Tapable();
		var log = [];
		var p1 = makeTestPlugin(log, 1);
		var p2 = makeTestPlugin(log, 2);
		var p3 = makeTestPlugin(log, 3);
		tapable.plugin("test", p1);
		tapable.plugin("test", p2);
		tapable.plugin("test", p3);
		var result = makeTestPlugin(log, 0);
		tapable.applyPluginsParallelBailResult("test", "a", result);
		p3.issue(null, "fail");
		p2.issue(null, "ok");
		p1.issue();
		log.should.be.eql([
			[1, "a"],
			[2, "a"],
			[3, "a"],
			[0, null, "ok"],
		]);
	});
	it("should take the first result", function() {
		var tapable = new Tapable();
		var log = [];
		var p1 = makeTestPlugin(log, 1);
		var p2 = makeTestPlugin(log, 2);
		var p3 = makeTestPlugin(log, 3);
		tapable.plugin("test", p1);
		tapable.plugin("test", p2);
		tapable.plugin("test", p3);
		var result = makeTestPlugin(log, 0);
		tapable.applyPluginsParallelBailResult("test", "a", result);
		log.length.should.be.eql(3);
		p1.issue(null, "ok");
		log.length.should.be.eql(4);
		p2.issue(new Error("fail"));
		p3.issue();
		log.should.be.eql([
			[1, "a"],
			[2, "a"],
			[3, "a"],
			[0, null, "ok"],
		]);
	});
	it("should return errors", function() {
		var tapable = new Tapable();
		var log = [];
		var p1 = makeTestPlugin(log, 1);
		var p2 = makeTestPlugin(log, 2);
		var p3 = makeTestPlugin(log, 3);
		tapable.plugin("test", p1);
		tapable.plugin("test", p2);
		tapable.plugin("test", p3);
		var result = makeTestPlugin(log, 0);
		tapable.applyPluginsParallelBailResult("test", "a", result);
		log.length.should.be.eql(3);
		p1.issue("ok");
		log.length.should.be.eql(4);
		p2.issue();
		p3.issue(null, "fail");
		log.should.be.eql([
			[1, "a"],
			[2, "a"],
			[3, "a"],
			[0, "ok", undefined],
		]);
	});

});