"use strict";

// eslint-disable-next-line complexity
module.exports = function normalize(path) {
	var parts = path.split(/(\\+|\/+)/);
	if(parts.length === 1)
		return path;
	var result = [];
	var absolutePathStart = 0;
	for(var i = 0, sep = false; i < parts.length; i += 1, sep = !sep) {
		var part = parts[i];
		if(i === 0 && /^([A-Z]:)?$/i.test(part)) {
			result.push(part);
			absolutePathStart = 2;
		} else if(sep) {
			// UNC paths on Windows begin with a double backslash.
			if (i === 1 && parts[0].length === 0 && part === "\\\\") {
				result.push(part);
			} else {
				result.push(part[0]);
			}
		} else if(part === "..") {
			switch(result.length) {
				case 0:
					// i. e. ".." => ".."
					// i. e. "../a/b/c" => "../a/b/c"
					result.push(part);
					break;
				case 2:
					// i. e. "a/.." => ""
					// i. e. "/.." => "/"
					// i. e. "C:\.." => "C:\"
					// i. e. "a/../b/c" => "b/c"
					// i. e. "/../b/c" => "/b/c"
					// i. e. "C:\..\a\b\c" => "C:\a\b\c"
					if (result[0] !== ".") {
						i += 1;
						sep = !sep;
						result.length = absolutePathStart;
					} else {
						result.length = 0;
						result.push(part);
					}
					break;
				case 4:
					// i. e. "a/b/.." => "a"
					// i. e. "/a/.." => "/"
					// i. e. "C:\a\.." => "C:\"
					// i. e. "/a/../b/c" => "/b/c"
					if(absolutePathStart === 0) {
						result.length -= 3;
					} else {
						i += 1;
						sep = !sep;
						result.length = 2;
					}
					break;
				default:
					// i. e. "/a/b/.." => "/a"
					// i. e. "/a/b/../c" => "/a/c"
					result.length -= 3;
					break;
			}
		} else if(part === ".") {
			switch(result.length) {
				case 0:
					// i. e. "." => "."
					// i. e. "./a/b/c" => "./a/b/c"
					result.push(part);
					break;
				case 2:
					// i. e. "a/." => "a"
					// i. e. "/." => "/"
					// i. e. "C:\." => "C:\"
					// i. e. "C:\.\a\b\c" => "C:\a\b\c"
					if(absolutePathStart === 0) {
						result.length -= 1;
					} else {
						i += 1;
						sep = !sep;
					}
					break;
				default:
					// i. e. "a/b/." => "a/b"
					// i. e. "/a/." => "/"
					// i. e. "C:\a\." => "C:\"
					// i. e. "a/./b/c" => "a/b/c"
					// i. e. "/a/./b/c" => "/a/b/c"
					result.length -= 1;
					break;
			}
		} else if(part) {
			result.push(part);
		}
	}
	if(result.length === 1 && /^[A-Za-z]:$/.test(result[0]))
		return result[0] + "\\";
	return result.join("");
};
