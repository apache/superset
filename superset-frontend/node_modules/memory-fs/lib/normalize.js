var doubleSlashWinRegExp = /\\+/g;
var doubleSlashNixRegExp = /\/+/g;
var currentDirectoryWinMiddleRegExp = /\\(\.\\)+/;
var currentDirectoryWinEndRegExp = /\\\.$/;
var parentDirectoryWinMiddleRegExp = /\\+[^\\]+\\+\.\.\\/;
var parentDirectoryWinEndRegExp1 = /([A-Z]:\\)\\*[^\\]+\\+\.\.$/i;
var parentDirectoryWinEndRegExp2 = /\\+[^\\]+\\+\.\.$/;
var currentDirectoryNixMiddleRegExp = /\/+(\.\/)+/;
var currentDirectoryNixEndRegExp1 = /^\/+\.$/;
var currentDirectoryNixEndRegExp2 = /\/+\.$/;
var parentDirectoryNixMiddleRegExp = /(^|\/[^\/]+)\/+\.\.\/+/;
var parentDirectoryNixEndRegExp1 = /^\/[^\/]+\/+\.\.$/;
var parentDirectoryNixEndRegExp2 = /\/+[^\/]+\/+\.\.$/;
var parentDirectoryNixEndRegExp3 = /^\/+\.\.$/;

// RegExp magic :)

module.exports = function normalize(path) {
	while(currentDirectoryWinMiddleRegExp.test(path))
		path = path.replace(currentDirectoryWinMiddleRegExp, "\\");
	path = path.replace(currentDirectoryWinEndRegExp, "");
	while(parentDirectoryWinMiddleRegExp.test(path))
		path = path.replace(parentDirectoryWinMiddleRegExp, "\\");
	path = path.replace(parentDirectoryWinEndRegExp1, "$1");
	path = path.replace(parentDirectoryWinEndRegExp2, "");

	while(currentDirectoryNixMiddleRegExp.test(path))
		path = path.replace(currentDirectoryNixMiddleRegExp, "/");
	path = path.replace(currentDirectoryNixEndRegExp1, "/");
	path = path.replace(currentDirectoryNixEndRegExp2, "");
	while(parentDirectoryNixMiddleRegExp.test(path))
		path = path.replace(parentDirectoryNixMiddleRegExp, "/");
	path = path.replace(parentDirectoryNixEndRegExp1, "/");
	path = path.replace(parentDirectoryNixEndRegExp2, "");
	path = path.replace(parentDirectoryNixEndRegExp3, "/");

	return path.replace(doubleSlashWinRegExp, "\\").replace(doubleSlashNixRegExp, "/");
};