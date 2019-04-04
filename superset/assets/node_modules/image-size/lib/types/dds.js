'use strict';

function isDDS(buffer){
	return buffer.readUInt32LE(0) === 0x20534444;
}

function calculate(buffer){
	// read file resolution metadata
	return {
		'height': buffer.readUInt32LE(12),
		'width': buffer.readUInt32LE(16)
	};
}

module.exports = {
	'detect': isDDS,
	'calculate': calculate
};
