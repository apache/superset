s2-geometry (JavaScript/ES5.1)
======================

| Sponsored by [ppl](https://ppl.family)

A pure JavaScript/ES5.1 port of Google/Niantic's S2 Geometry library (as used by **Ingress**, **Pokemon GO**)

Currently contains basic support for S2Cell

<table>
<tr>
<td></td>
<td>
Face 2
<br>
Orientation A

<a href="http://i.imgur.com/SODO4bT.jpg" target="_face2"><img src="http://i.imgur.com/SODO4bTt.jpg" title="Face 2" alt="Face 2"></a>

<br>
The North Pole<br>(and Canada / Europe)
</td>
<td></td>
</tr>
<tr>
<td>
Face 0
<br>
Orientation A

<a href="http://i.imgur.com/dLI5Zd1.jpg" target="_face0"><img src="http://i.imgur.com/dLI5Zd1t.jpg" title="Face 0" alt="Face 0"></a>

<br>
Africa
</td>
<td>
Face 1
<br>
Orientation D

<a href="http://i.imgur.com/duTLDTV.jpg" target="_face1"><img src="http://i.imgur.com/duTLDTVt.jpg" title="Face 1" alt="Face 1"></a>

<br>
Asia
</td>
<td>
Face 3
<br>
Orientation D

<a href="http://i.imgur.com/6Ho35Tc.jpg" target="_face3"><img src="http://i.imgur.com/6Ho35Tct.jpg" title="Face 3" alt="Face 3"></a>

<br>
Nothing<br>(and Australia)
</td>
<td>
Face 4
<br>
Orientation A

<a href="http://i.imgur.com/3IBAfqj.jpg" target="_face4"><img src="http://i.imgur.com/3IBAfqjt.jpg" title="Face 4" alt="Face 4"></a>

<br>
The Americas<br>(and Provo, UT)
</td>
</tr>
<tr>
<td></td>
<td></td>
<td></td>
<td>
Face 5
<br>
Orientation D

<a href="http://i.imgur.com/HZCBvgy.jpg" target="_face5"><img src="http://i.imgur.com/HZCBvgyt.jpg" title="Face 5" alt="Face 5"></a>

<br>
Antarctica
</td>
</tr>
</table>

Where is this being used?
---------------------

* [pokemap-webapp](https://github.com/Daplie/pokemap-webapp)
* [node-pokemap](https://github.com/Daplie/node-pokemap)
* [Pokemon-GO-node-api](https://github.com/Daplie/Pokemon-GO-node-api)

Simple Examples
---------------

```javascript
'use strict';

var S2 = require('s2-geometry').S2;

var lat = 40.2574448;
var lng = -111.7089464;
var level = 15;



//
// Convert from Lat / Lng
//
var key = S2.latLngToKey(lat, lng, level);
// '4/032212303102210'



//
// Convert between Hilbert Curve Quadtree Key and S2 Cell Id
//
var id = S2.keyToId(key);
// '9749618446378729472'

var key = S2.idToKey(id);
// '9749618446378729472'


//
// Convert between Quadkey and Id
//
var latlng = S2.keyToLatLng(key);
var latlng = S2.idToLatLng(id);



//
// Neighbors
//
var neighbors = S2.latLngToNeighborKeys(lat, lng, level);
// [ keyLeft, keyDown, keyRight, keyUp ]



//
// Previous, Next, and Step
//
var nextKey = S2.nextKey(key);
var prevKey = S2.prevKey(key);

var backTenKeys = S2.stepKey(key, -10);
```

Previous and Next
-----------------

You can get the previous and next S2CellId from any given Key:

1. Convert from Lat/Lng to Key (Face and Hilbert Curve Quadtree)
2. Get the Previous or Next Key
3. Convert the Key to an Id (uint64 string)

```javascript
var key = S2.latLngToKey(40.2574448, -111.7089464, 15);   // '4/032212303102210'
var id = S2.keyToId(key);                                 // '9749618446378729472'

var nextKey = S2.nextKey(key);
var nextId = S2.keyToId(nextKey);

var prevKey = S2.prevKey(key);
var prevId = S2.keyToId(prevKey);

var backTenKeys = S2.stepKey(key, -10);

// See it
console.log(prevKey);                                 // '4/032212303102203'
console.log(key);                                     // '4/032212303102210'
console.log(nextKey);                                 // '4/032212303102211'
console.log(nextId);
```

convert Cell Id to Hilbert Curve Quad Tree
------------------

Convert from base 10 (decimal) `S2 Cell Id` to base 4 `quadkey` (aka hilbert curve quadtree id)

Example '4/032212303102210' becomes '9749618446378729472'

```javascript
'use strict';

var quadkey = '4/032212303102210'
var parts = quadkey.split('/');
var face = parts[0];                  // 4
var position = parts[1];              // '032212303102210';
var level = '032212303102210'.length; // 15

var cellId = S2.facePosLevelToId(face, position, level);

console.log(cellId);
```

Convert from hilbert quadtree id to s2 cell id:

Example '9749618446378729472' becomes '4/032212303102210'

```javascript
'use strict';

var cellId = '9749618446378729472';

var hilbertQuadkey = S2.idToKey(cellId);

console.log(hilbertQuadkey);
```

Convert Key and Id to LatLng
---------------------

```javascript
var latlng = S2.keyToLatLng('4/032212303102210');

var latlng = S2.idToLatLng('9749618446378729472');
```
