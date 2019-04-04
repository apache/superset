"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var childProcess = require("child_process");
var path = require("path");
var process = require("process");
var WorkResult_1 = require("./WorkResult");
var NormalizedMessage_1 = require("./NormalizedMessage");
// fork workers...
var division = parseInt(process.env.WORK_DIVISION, 10);
var workers = [];
for (var num = 0; num < division; num++) {
    workers.push(childProcess.fork(path.resolve(__dirname, './service.js'), [], {
        execArgv: ['--max-old-space-size=' + process.env.MEMORY_LIMIT],
        env: Object.assign({}, process.env, { WORK_NUMBER: num }),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }));
}
var pids = workers.map(function (worker) { return worker.pid; });
var result = new WorkResult_1.WorkResult(pids);
process.on('message', function (message) {
    // broadcast message to all workers
    workers.forEach(function (worker) {
        try {
            worker.send(message);
        }
        catch (e) {
            // channel closed - something went wrong - close cluster...
            process.exit();
        }
    });
    // clear previous result set
    result.clear();
});
// listen to all workers
workers.forEach(function (worker) {
    worker.on('message', function (message) {
        // set result from worker
        result.set(worker.pid, {
            diagnostics: message.diagnostics.map(NormalizedMessage_1.NormalizedMessage.createFromJSON),
            lints: message.lints.map(NormalizedMessage_1.NormalizedMessage.createFromJSON)
        });
        // if we have result from all workers, send merged
        if (result.hasAll()) {
            var merged = result.reduce(function (innerMerged, innerResult) { return ({
                diagnostics: innerMerged.diagnostics.concat(innerResult.diagnostics),
                lints: innerMerged.lints.concat(innerResult.lints)
            }); }, { diagnostics: [], lints: [] });
            merged.diagnostics = NormalizedMessage_1.NormalizedMessage.deduplicate(merged.diagnostics);
            merged.lints = NormalizedMessage_1.NormalizedMessage.deduplicate(merged.lints);
            try {
                process.send(merged);
            }
            catch (e) {
                // channel closed...
                process.exit();
            }
        }
    });
});
process.on('SIGINT', function () {
    process.exit();
});
process.on('exit', function () {
    workers.forEach(function (worker) {
        try {
            worker.kill();
        }
        catch (e) {
            // do nothing...
        }
    });
});
