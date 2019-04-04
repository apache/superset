// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import log from './log';

// Linear scale maps continuous domain to continuous range
export function linearScale(domain, range, value) {
  return (value - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]) + range[0];
}

// Quantize scale is similar to linear scales,
// except it uses a discrete rather than continuous range
export function quantizeScale(domain, range, value) {
  const domainRange = domain[1] - domain[0];
  if (domainRange <= 0) {
    log.warn('quantizeScale: invalid domain, returning range[0]');
    return range[0];
  }
  const step = domainRange / range.length;
  const idx = Math.floor((value - domain[0]) / step);
  const clampIdx = Math.max(Math.min(idx, range.length - 1), 0);

  return range[clampIdx];
}

// return a quantize scale function
export function getQuantizeScale(domain, range) {
  return value => quantizeScale(domain, range, value);
}

// return a linear scale funciton
export function getLinearScale(domain, range) {
  return value => (value - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]) + range[0];
}
