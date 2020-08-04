var OCRAD = function(image){
	if(image.getContext) image = image.getContext('2d');
	if(image.getImageData) image = image.getImageData(0, 0, image.canvas.width, image.canvas.height);
	if(image.data){
		var width = image.width, height = image.height;
		var header = "P5\n" + width + " " + height + "\n255\n";
		var dst = new Uint8Array(header.length + width * height);
		var src = image.data;
		var srcLength = src.length | 0, srcLength_16 = (srcLength - 16) | 0;
		var j = header.length;
		for(var i = 0; i < j; i++){
			dst[i] = header.charCodeAt(i) // write the header
		}
		var coeff_r = 4899, coeff_g = 9617, coeff_b = 1868;

		for (var i = 0; i <= srcLength_16; i += 16, j += 4) {
			dst[j]     = (src[i] * coeff_r + src[i+1] * coeff_g + src[i+2] * coeff_b + 8192) >> 14;
			dst[j + 1] = (src[i+4] * coeff_r + src[i+5] * coeff_g + src[i+6] * coeff_b + 8192) >> 14;
			dst[j + 2] = (src[i+8] * coeff_r + src[i+9] * coeff_g + src[i+10] * coeff_b + 8192) >> 14;
			dst[j + 3] = (src[i+12] * coeff_r + src[i+13] * coeff_g + src[i+14] * coeff_b + 8192) >> 14;
		}
		for (; i < srcLength; i += 4, ++j) {
			dst[j] = (src[i] * coeff_r + src[i+1] * coeff_g + src[i+2] * coeff_b + 8192) >> 14;
		}
		image = dst;
	}
	if(image instanceof ArrayBuffer) image = new Uint8Array(image);

	OCRAD.write_file('/in.pnm', image);

	var desc = OCRAD.open();
	OCRAD.set_image_from_file(desc, 'in.pnm', 0);
	OCRAD.set_utf8_format(desc, 1);
	OCRAD.recognize(desc, 0)

	var text = '';
	var block_count = OCRAD.result_blocks(desc);
	
	for(var i = 0; i < block_count; i++){
		var line_count = OCRAD.result_lines(desc, i);
		for(var j = 0; j < line_count; j++){
			var line = OCRAD.result_line(desc, i, j);
			text += line;
		}
	}
	OCRAD.close(desc)

	return text;
}

OCRAD.write_file = function(filename, arr){
	FS.writeFile(filename, arr, {encoding: 'binary'});
}

OCRAD.version = Module.cwrap('OCRAD_version', 'string');
OCRAD.open = Module.cwrap('OCRAD_open', 'number');
OCRAD.close = Module.cwrap('OCRAD_close', 'number', ['number']);
OCRAD.get_errno = Module.cwrap('OCRAD_get_errno', 'number', ['number']);
OCRAD.set_image = Module.cwrap('OCRAD_set_image', 'number', ['number', 'number', 'number']);
OCRAD.set_image_from_file = Module.cwrap('OCRAD_set_image_from_file', 'number', ['number', 'string', 'number']);
OCRAD.set_exportfile = Module.cwrap('OCRAD_set_exportfile', 'number', ['number', 'string']);
OCRAD.set_utf8_format = Module.cwrap('OCRAD_set_utf8_format', 'number', ['number', 'number']);
OCRAD.set_threshold = Module.cwrap('OCRAD_set_threshold', 'number', ['number', 'number']);
OCRAD.scale = Module.cwrap('OCRAD_scale', 'number', ['number', 'number']);
OCRAD.recognize = Module.cwrap('OCRAD_recognize', 'number', ['number', 'number']);
OCRAD.result_blocks = Module.cwrap('OCRAD_result_blocks', 'number', ['number']);
OCRAD.result_lines = Module.cwrap('OCRAD_result_lines', 'number', ['number', 'number']);
OCRAD.result_chars_total = Module.cwrap('OCRAD_result_chars_total', 'number', ['number']);
OCRAD.result_chars_block = Module.cwrap('OCRAD_result_chars_block', 'number', ['number', 'number']);
OCRAD.result_chars_line = Module.cwrap('OCRAD_result_chars_line', 'number', ['number', 'number', 'number']);
OCRAD.result_line = Module.cwrap('OCRAD_result_line', 'string', ['number', 'number', 'number']);
OCRAD.result_first_character = Module.cwrap('OCRAD_result_first_character', 'number', ['number']);

return OCRAD;

})();