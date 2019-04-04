'use strict';

var FastPriorityQueue = require('fastpriorityqueue');

var N = 1000000;

var data = [];
for (var i = 0; i < N; i++) data[i] = {value: Math.random()};

var q = new FastPriorityQueue(compare);

function compare(a, b) {
    return a.value < b.value;
}

console.time('push ' + N);
for (i = 0; i < 1000000; i++) q.add(data[i]);
console.timeEnd('push ' + N);

console.time('pop ' + N);
for (i = 0; i < 1000000; i++) q.poll();
console.timeEnd('pop ' + N);
