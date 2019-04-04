/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
module.exports = function popPathSeqment(pathInArray) {
	var i = pathInArray[0].lastIndexOf("/"),
		j = pathInArray[0].lastIndexOf("\\");
	var p = i < 0 ? j : j < 0 ? i : i < j ? j : i;
	if(p < 0) return null;
	var s = pathInArray[0].substr(p+1);
	pathInArray[0] = pathInArray[0].substr(0, p || 1);
	return s;
};
