"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var color = require("./color");
var match = require("@sinonjs/samsam").createMatcher;
var timesInWords = require("./util/core/times-in-words");
var sinonFormat = require("./util/core/format");
var jsDiff = require("diff");

var join = arrayProto.join;
var map = arrayProto.map;
var push = arrayProto.push;

function colorSinonMatchText(matcher, calledArg, calledArgMessage) {
    var calledArgumentMessage = calledArgMessage;
    if (!matcher.test(calledArg)) {
        matcher.message = color.red(matcher.message);
        if (calledArgumentMessage) {
            calledArgumentMessage = color.green(calledArgumentMessage);
        }
    }
    return calledArgumentMessage + " " + matcher.message;
}

function colorDiffText(diff) {
    var objects = map(diff, function(part) {
        var text = part.value;
        if (part.added) {
            text = color.green(text);
        } else if (part.removed) {
            text = color.red(text);
        }
        if (diff.length === 2) {
            text += " "; // format simple diffs
        }
        return text;
    });
    return join(objects, "");
}

module.exports = {
    c: function(spyInstance) {
        return timesInWords(spyInstance.callCount);
    },

    n: function(spyInstance) {
        // eslint-disable-next-line local-rules/no-prototype-methods
        return spyInstance.toString();
    },

    D: function(spyInstance, args) {
        var message = "";

        for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
            // describe multiple calls
            if (l > 1) {
                message += "\nCall " + (i + 1) + ":";
            }
            var calledArgs = spyInstance.getCall(i).args;
            for (var j = 0; j < calledArgs.length || j < args.length; ++j) {
                message += "\n";
                var calledArgMessage = j < calledArgs.length ? sinonFormat(calledArgs[j]) : "";
                if (match.isMatcher(args[j])) {
                    message += colorSinonMatchText(args[j], calledArgs[j], calledArgMessage);
                } else {
                    var expectedArgMessage = j < args.length ? sinonFormat(args[j]) : "";
                    var diff = jsDiff.diffJson(calledArgMessage, expectedArgMessage);
                    message += colorDiffText(diff);
                }
            }
        }

        return message;
    },

    C: function(spyInstance) {
        var calls = [];

        for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
            // eslint-disable-next-line local-rules/no-prototype-methods
            var stringifiedCall = "    " + spyInstance.getCall(i).toString();
            if (/\n/.test(calls[i - 1])) {
                stringifiedCall = "\n" + stringifiedCall;
            }
            push(calls, stringifiedCall);
        }

        return calls.length > 0 ? "\n" + join(calls, "\n") : "";
    },

    t: function(spyInstance) {
        var objects = [];

        for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
            push(objects, sinonFormat(spyInstance.thisValues[i]));
        }

        return join(objects, ", ");
    },

    "*": function(spyInstance, args) {
        return join(
            map(args, function(arg) {
                return sinonFormat(arg);
            }),
            ", "
        );
    }
};
