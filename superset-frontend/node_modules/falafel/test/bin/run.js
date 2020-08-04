var path = require('path');
var glob = require('glob');

for (var i = 2; i < process.argv.length; i++) {
	glob(process.argv[i], function (er, files) {
		files.forEach(function (file) {
		    require(path.resolve(process.cwd(), file));
		});
	});
}
