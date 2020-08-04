var nomnom = require("../nomnom");

var parser = nomnom()
    .option("addr", {
        abbr: "a",
        help: "host:port address",
        transform: function(value) {
            var parts = value.split(":");
            return {host: parts[0], port: Number(parts[1])};
        }
    })
    .option("string", {
        abbr: "s",
        help: "always a string",
        transform: function(value) {
            return value.toString();
        }
    });


exports.testTransformComplexValue = function(test) {
    var opts = parser.parse(["-a", "localhost:1234"]);

    test.strictEqual(opts.addr.host, "localhost");
    test.strictEqual(opts.addr.port, 1234);
    test.done();
};


exports.testTransformString = function(test) {
    var opts = parser.parse(["-s", "3"]);

    test.strictEqual(opts.string, "3");
    test.done();
};


exports.testTransformCommand = function(test) {
    test.expect(1);

    var parser = nomnom().scriptName("test")
        .options({
            addr: {
                transform: function(value) {
                    var parts = value.split(":");
                    return {host: parts[0], port: Number(parts[1])};
                }
            }
        });

    parser.command("run")
        .options({
            string: {
                transform: function(value) {
                    return value.toString();
                }
            }
        })
        .callback(function(options) {
            test.strictEqual(options.string, "true");
        });

    parser.parse(["run", "--string=true"]);
    test.done();
};
