/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
module.exports = function createInnerCallback(callback, options, message) {
	var log = options.log;
	if(!log) {
		if(options.stack !== callback.stack) {
			function callbackWrapper() {
				return callback.apply(this, arguments);
			}
			callbackWrapper.stack = options.stack;
			callbackWrapper.missing = options.missing;
		}
		return callback;
	}
	function loggingCallbackWrapper() {
		log(message);
		for(var i = 0; i < theLog.length; i++)
			log("  " + theLog[i]);
		return callback.apply(this, arguments);
	}
	var theLog = [];
	loggingCallbackWrapper.log = function writeLog(msg) {
		theLog.push(msg);
	};
	loggingCallbackWrapper.stack = options.stack;
	loggingCallbackWrapper.missing = options.missing;
	return loggingCallbackWrapper;
}