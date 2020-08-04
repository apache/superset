#! /bin/sh
# check script for GNU Ocrad - Optical Character Recognition program
# Copyright (C) 2009, 2010, 2011, 2012, 2013 Antonio Diaz Diaz.
#
# This script is free software: you have unlimited permission
# to copy, distribute and modify it.

LC_ALL=C
export LC_ALL
objdir=`pwd`
testdir=`cd "$1" ; pwd`
OCRAD="${objdir}"/ocrad
OCRCHECK="${objdir}"/ocrcheck
framework_failure() { echo "failure in testing framework" ; exit 1 ; }

if [ ! -x "${OCRAD}" ] ; then
	echo "${OCRAD}: cannot execute"
	exit 1
fi

if [ -d tmp ] ; then rm -rf tmp ; fi
mkdir tmp
cd "${objdir}"/tmp

in="${testdir}"/test.pbm
txt="${testdir}"/test.txt
utxt="${testdir}"/test_utf8.txt
fail=0

printf "testing ocrad-%s..." "$2"

"${OCRAD}" -q -T-0.1 ${in} > /dev/null
if [ $? != 1 ] ; then fail=1 ; printf - ; else printf . ; fi
"${OCRAD}" -q -T 1.1 ${in} > /dev/null
if [ $? != 1 ] ; then fail=1 ; printf - ; else printf . ; fi
"${OCRAD}" -q -u -2,-1,1,1 ${in} > /dev/null
if [ $? != 1 ] ; then fail=1 ; printf - ; else printf . ; fi
"${OCRAD}" -q -u 1,1,1,1 ${in} > /dev/null
if [ $? != 1 ] ; then fail=1 ; printf - ; else printf . ; fi

"${OCRAD}" -q ${in} > out || fail=1
cmp ${txt} out || fail=1
printf .

"${OCRAD}" -q -u 0,0,1,1 ${in} > out
cmp ${txt} out || fail=1
printf .

"${OCRAD}" -q -u -1,-1,1,1 ${in} > out
cmp ${txt} out || fail=1
printf .

test_chars()
	{
	for coord in ${coords} ; do
		produced_chars="${produced_chars}`"${OCRAD}" -q -u${coord} ${in}`" || fail=1
	done

	if [ "${produced_chars}" != "${expected_chars}" ] ; then
		echo
		echo "expected \"${expected_chars}\""
		echo "produced \"${produced_chars}\""
		fail=1
	fi
	printf .
	}

coords=' 71,109,17,26  92,109,17,26 114,109,15,26 132,109,17,26
        152,109,18,26 172,109,19,26 193,109,17,26 214,109,17,26
        234,108,17,27 253,109,18,26 274,109,17,26  68,153,29,27
         97,153,24,27 126,153,23,27 153,153,27,27 183,153,24,27
        210,153,23,27 237,153,27,27 266,153,30,27 298,153,13,27
        313,153,20,27 335,153,29,27 365,153,23,27 391,153,34,27
        426,153,30,27  69,189,30,35 102,197,26,27 132,197,24,27
        159,197,26,34 188,197,26,27 217,197,20,27 241,197,24,27
        266,197,30,27 297,197,28,27 326,197,37,27 364,197,27,27
        390,197,28,27 420,197,21,27'
expected_chars="0ol23456789ABcDEFGHIJKLMN—opQRsTuvwxYz"
produced_chars=
test_chars

coords=' 71,250,18,18  90,240,20,28 112,250,15,18 131,240,19,28
        152,250,17,18 170,241,16,27 183,249,20,27 204,240,23,28
        227,241,11,27 236,241,11,35 251,240,22,28 274,240,11,28
        287,250,32,18 321,250,22,18  70,288,22,25  92,295,17,18
        111,295,19,26 132,295,20,26 152,295,16,18 169,295,14,18
        185,288,13,25 200,295,22,18 221,295,20,18 242,295,27,18
        270,295,20,18 289,295,20,26 310,295,16,18'
expected_chars="abcdefghijklmnÒopqrstuvwxyz"
produced_chars=
test_chars

coords=' 68,366,29,36  97,366,24,36 124,366,13,36 140,366,26,36
        168,366,30,36 208,366,29,36 237,366,24,36 265,366,13,36
        281,366,26,36 308,366,30,36 349,368,29,34 378,368,24,34
        405,368,13,34 421,368,26,34 449,368,30,34  68,410,29,36
         97,410,24,36 124,410,13,36 140,410,26,36 167,410,30,36
         71,463,18,27  91,463,17,27 109,463,11,27 123,463,17,27
        142,463,22,27 177,463,18,27 198,463,17,27 216,463,11,27
        229,463,17,27 249,463,22,27 284,466,18,24 305,466,17,24
        323,466,12,24 336,466,17,24 356,466,22,24 391,463,18,27
        411,463,17,27 431,463,10,27 443,463,17,27 462,463,22,27'
expected_chars="¡…ÕÛ˙¿»ÃÚ˘ƒÀœˆ¸¬ ŒÙ˚·ÈÌÛ˙‡ËÏÚ˘‰ÎÔˆ¸‚ÍÓÙ˚"
produced_chars=
test_chars

coords='137,516,19,19 174,508,15,15 192,508,11,27 245,509,19,26
        268,505,17,35 322,508,27,27 353,508,10,31 367,508,9,31
         70,558,15,29  86,552,14,27 104,552,9,31  128,552,15,27
        158,552,9,31  173,552,17,15 195,552,8,31  215,552,3,27
        228,552,9,31  252,560,19,19 275,560,19,19 347,561,15,26
        364,552,23,35 391,552,25,27  72,612,18,6   94,613,19,11
        114,602,19,22 134,597,12,15 150,597,11,15'
expected_chars="+*/#$&()ø?[\\]^{|}<>Á«@~¨±™∫"
produced_chars=
test_chars

"${OCRCHECK}" ${in} > out || fail=1
cmp ${txt} out || fail=1
printf .
"${OCRCHECK}" ${in} --utf8 > out || fail=1
cmp ${utxt} out || fail=1
printf .

echo
if [ ${fail} = 0 ] ; then
	echo "tests completed successfully."
	cd "${objdir}" && rm -r tmp
else
	echo "tests failed."
fi
exit ${fail}
