PATH="$PATH:~/Dropbox/Projects/naptha/libs/emscripten/"
cd ocrad-*
emconfigure ./configure
emmake make

emcc -O2 -v -s EXPORTED_FUNCTIONS="['_OCRAD_set_exportfile', '_OCRAD_version', '_OCRAD_open', '_OCRAD_close', '_OCRAD_get_errno', '_OCRAD_set_image', '_OCRAD_set_image_from_file', '_OCRAD_set_utf8_format', '_OCRAD_set_threshold', '_OCRAD_scale', '_OCRAD_recognize', '_OCRAD_result_blocks', '_OCRAD_result_lines', '_OCRAD_result_chars_total', '_OCRAD_result_chars_block', '_OCRAD_result_chars_line', '_OCRAD_result_line', '_OCRAD_result_first_character']" ocradlib.o page_image_io.o page_image.o rectangle.o textpage.o bitmap.o blob.o textblock.o character_r11.o ucs.o character.o textline.o track.o rational.o profile.o mask.o feats.o common.o feats_test0.o feats_test1.o segment.o character_r12.o character_r13.o textline_r2.o -o ../ocrad.js --pre-js ../pre.js --post-js ../post.js

make clean