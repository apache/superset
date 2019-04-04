/**
 * Copyright (c) 2015 Guyon Roche
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";

module.exports = {
    nearestNeighbor: function(src, dst, options) {
        
        var wSrc = src.width;
        var hSrc = src.height;
        //console.log("wSrc="+wSrc + ", hSrc="+hSrc);
        
        var wDst = dst.width;
        var hDst = dst.height;
        //console.log("wDst="+wDst + ", hDst="+hDst);
        
        var bufSrc = src.data;
        var bufDst = dst.data;

        for (var i = 0; i < hDst; i++) {
            for (var j = 0; j < wDst; j++) {
                var posDst = (i * wDst + j) * 4;
                
                var iSrc = Math.round(i * hSrc / hDst);
                var jSrc = Math.round(j * wSrc / wDst);
                var posSrc = (iSrc * wSrc + jSrc) * 4;
                
                bufDst[posDst++] = bufSrc[posSrc++];
                bufDst[posDst++] = bufSrc[posSrc++];
                bufDst[posDst++] = bufSrc[posSrc++];
                bufDst[posDst++] = bufSrc[posSrc++];
            }
        }
    },
    bilinearInterpolation: function(src, dst, options) {
        
        var wSrc = src.width;
        var hSrc = src.height;
        //console.log("wSrc="+wSrc + ", hSrc="+hSrc);
        
        var wDst = dst.width;
        var hDst = dst.height;
        //console.log("wDst="+wDst + ", hDst="+hDst);
        
        var bufSrc = src.data;
        var bufDst = dst.data;
        
        var interpolate = function(k, kMin, vMin, kMax, vMax) {
            // special case - k is integer
            if (kMin === kMax) {
                return vMin;
            }
            
            return Math.round((k - kMin) * vMax + (kMax - k) * vMin);
        };
        var assign = function(pos, offset, x, xMin, xMax, y, yMin, yMax) {
            var posMin = (yMin * wSrc + xMin) * 4 + offset;
            var posMax = (yMin * wSrc + xMax) * 4 + offset;
            var vMin = interpolate(x, xMin, bufSrc[posMin], xMax, bufSrc[posMax]);
            
            // special case, y is integer
            if (yMax === yMin) {
                bufDst[pos+offset] = vMin;
            } else {
                posMin = (yMax * wSrc + xMin) * 4 + offset;
                posMax = (yMax * wSrc + xMax) * 4 + offset;
                var vMax = interpolate(x, xMin, bufSrc[posMin], xMax, bufSrc[posMax]);
                
                bufDst[pos+offset] = interpolate(y, yMin, vMin, yMax, vMax);
            }
        }
        
        for (var i = 0; i < hDst; i++) {
            for (var j = 0; j < wDst; j++) {
                var posDst = (i * wDst + j) * 4;
                
                // x & y in src coordinates
                var x = j * wSrc / wDst;
                var xMin = Math.floor(x);
                var xMax = Math.min(Math.ceil(x), wSrc-1);
                
                var y = i * hSrc / hDst;
                var yMin = Math.floor(y);
                var yMax = Math.min(Math.ceil(y), hSrc-1);
                
                assign(posDst, 0, x, xMin, xMax, y, yMin, yMax);
                assign(posDst, 1, x, xMin, xMax, y, yMin, yMax);
                assign(posDst, 2, x, xMin, xMax, y, yMin, yMax);
                assign(posDst, 3, x, xMin, xMax, y, yMin, yMax);
            }
        }
    },
    
    _interpolate2D: function(src, dst, options, interpolate) {
        
        var bufSrc = src.data;
        var bufDst = dst.data;
        
        var wSrc = src.width;
        var hSrc = src.height;
        //console.log("wSrc="+wSrc + ", hSrc="+hSrc + ", srcLen="+bufSrc.length);
        
        var wDst = dst.width;
        var hDst = dst.height;
        //console.log("wDst="+wDst + ", hDst="+hDst + ", dstLen="+bufDst.length);
        
        // when dst smaller than src/2, interpolate first to a multiple between 0.5 and 1.0 src, then sum squares
        var wM = Math.max(1, Math.floor(wSrc / wDst));
        var wDst2 = wDst * wM;
        var hM = Math.max(1, Math.floor(hSrc / hDst));
        var hDst2 = hDst * hM;
        //console.log("wM="+wM + ", wDst2="+wDst2 + ", hM="+hM + ", hDst2="+hDst2);
        
        // ===========================================================
        // Pass 1 - interpolate rows
        // buf1 has width of dst2 and height of src
        var buf1 = new Buffer(wDst2 * hSrc * 4);
        for (var i = 0; i < hSrc; i++) {
            for (var j = 0; j < wDst2; j++) {
                // i in src coords, j in dst coords
                
                // calculate x in src coords
                // this interpolation requires 4 sample points and the two inner ones must be real
                // the outer points can be fudged for the edges.
                // therefore (wSrc-1)/wDst2
                var x = j * (wSrc-1) / wDst2;
                var xPos = Math.floor(x);
                var t = x - xPos;
                var srcPos = (i * wSrc + xPos) * 4;
                
                var buf1Pos = (i * wDst2 + j) * 4;
                for (var k = 0; k < 4; k++) {
                    var kPos = srcPos + k;
                    var x0 = (xPos > 0) ? bufSrc[kPos - 4] : 2*bufSrc[kPos]-bufSrc[kPos+4];
                    var x1 = bufSrc[kPos];
                    var x2 = bufSrc[kPos + 4];
                    var x3 = (xPos < wSrc - 2) ? bufSrc[kPos + 8] : 2*bufSrc[kPos + 4]-bufSrc[kPos];
                    buf1[buf1Pos+k] = interpolate(x0,x1,x2,x3,t);
                }
            }
        }
        //this._writeFile(wDst2, hSrc, buf1, "out/buf1.jpg");
        
        // ===========================================================
        // Pass 2 - interpolate columns
        // buf2 has width and height of dst2
        var buf2 = new Buffer(wDst2 * hDst2 * 4);
        for (var i = 0; i < hDst2; i++) {
            for (var j = 0; j < wDst2; j++) {
                // i&j in dst2 coords
                
                // calculate y in buf1 coords
                // this interpolation requires 4 sample points and the two inner ones must be real
                // the outer points can be fudged for the edges.
                // therefore (hSrc-1)/hDst2
                var y = i * (hSrc-1) / hDst2;
                var yPos = Math.floor(y);
                var t = y - yPos;
                var buf1Pos = (yPos * wDst2 + j) * 4;
                var buf2Pos = (i * wDst2 + j) * 4;
                for (var k = 0; k < 4; k++) {
                    var kPos = buf1Pos + k;
                    var y0 = (yPos > 0) ? buf1[kPos - wDst2*4] : 2*buf1[kPos]-buf1[kPos + wDst2*4];
                    var y1 = buf1[kPos];
                    var y2 = buf1[kPos + wDst2*4];
                    var y3 = (yPos < hSrc-2) ? buf1[kPos + wDst2*8] : 2*buf1[kPos + wDst2*4]-buf1[kPos];
                    
                    buf2[buf2Pos + k] = interpolate(y0,y1,y2,y3,t);
                }
            }
        }
        //this._writeFile(wDst2, hDst2, buf2, "out/buf2.jpg");
        
        // ===========================================================
        // Pass 3 - scale to dst
        var m = wM * hM;
        if (m > 1) {
            for (var i = 0; i < hDst; i++) {
                for (var j = 0; j < wDst; j++) {
                    // i&j in dst bounded coords
                    var r = 0;
                    var g = 0;
                    var b = 0;
                    var a = 0;
                    var realColors = 0;
                    for (var y = 0; y < hM; y++) {
                        var yPos = i * hM + y;
                        for (var x = 0; x < wM; x++) {
                            var xPos = j * wM + x;
                            var xyPos = (yPos * wDst2 + xPos) * 4;
                            var pixelAplha = buf2[xyPos+3];

                            if (pixelAplha) {
                                r += buf2[xyPos];
                                g += buf2[xyPos+1];
                                b += buf2[xyPos+2];
                                realColors++;
                            }

                            a += pixelAplha;
                        }
                    }
                    
                    var pos = (i*wDst + j) * 4;
                    bufDst[pos]   = realColors ? Math.round(r / realColors) : 0;
                    bufDst[pos+1] = realColors ? Math.round(g / realColors) : 0;
                    bufDst[pos+2] = realColors ? Math.round(b / realColors) : 0;
                    bufDst[pos+3] = Math.round(a / m);
                }
            }
        } else {
            // replace dst buffer with buf2
            dst.data = buf2;
        }
    },
    
    bicubicInterpolation: function(src, dst, options) {
        var interpolateCubic = function(x0, x1, x2, x3, t) {
            var a0 = x3 - x2 - x0 + x1;
            var a1 = x0 - x1 - a0;
            var a2 = x2 - x0;
            var a3 = x1;
            return Math.max(0,Math.min(255,(a0 * (t * t * t)) + (a1 * (t * t)) + (a2 * t) + (a3)));
        }
        return this._interpolate2D(src, dst, options, interpolateCubic);
    },
    
    hermiteInterpolation: function(src, dst, options) {
        var interpolateHermite = function(x0, x1, x2, x3, t)
        {
            var c0 = x1;
            var c1 = 0.5 * (x2 - x0);
            var c2 = x0 - (2.5 * x1) + (2 * x2) - (0.5 * x3);
            var c3 = (0.5 * (x3 - x0)) + (1.5 * (x1 - x2));
            return  Math.max(0,Math.min(255,Math.round((((((c3 * t) + c2) * t) + c1) * t) + c0)));
        }
        return this._interpolate2D(src, dst, options, interpolateHermite);
    },
    
    bezierInterpolation: function(src, dst, options) {
        // between 2 points y(n), y(n+1), use next points out, y(n-1), y(n+2)
        // to predict control points (a & b) to be placed at n+0.5
        //  ya(n) = y(n) + (y(n+1)-y(n-1))/4
        //  yb(n) = y(n+1) - (y(n+2)-y(n))/4
        // then use std bezier to interpolate [n,n+1)
        //  y(n+t) = y(n)*(1-t)^3 + 3 * ya(n)*(1-t)^2*t + 3 * yb(n)*(1-t)*t^2 + y(n+1)*t^3
        //  note the 3* factor for the two control points
        // for edge cases, can choose:
        //  y(-1) = y(0) - 2*(y(1)-y(0))
        //  y(w) = y(w-1) + 2*(y(w-1)-y(w-2))
        // but can go with y(-1) = y(0) and y(w) = y(w-1)
        var interpolateBezier = function(x0, x1, x2, x3, t) {
            // x1, x2 are the knots, use x0 and x3 to calculate control points
            var cp1 = x1 + (x2-x0)/4;
            var cp2 = x2 - (x3-x1)/4;
            var nt = 1-t;
            var c0 =      x1 * nt * nt * nt;
            var c1 = 3 * cp1 * nt * nt *  t;
            var c2 = 3 * cp2 * nt *  t *  t;
            var c3 =      x2 *  t *  t *  t;
            return Math.max(0,Math.min(255,Math.round(c0 + c1 + c2 + c3)));
        }
        return this._interpolate2D(src, dst, options, interpolateBezier);
    }
}
