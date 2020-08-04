'use strict';

var S2 = require('../src/s2geometry.js').S2;

for(var level = 1; level <= 20; level++) {
	var success = 0;
	var total = 0;
	for (var x = -180.0; x < 180; x += 0.5) {
		for (var y = -180.0; y < 180; y += 0.5) {

				var latlng = { lat: x, lng: y };
				var cell = S2.S2Cell.FromLatLng(latlng, level);
				var quadKey = cell.toHilbertQuadkey();
				var cell2 = S2.S2Cell.FromHilbertQuadKey(quadKey);

				if(cell.face != cell2.face ||
					cell.ij[0] != cell2.ij[0] ||
					cell.ij[1] != cell2.ij[1] ||
					cell.level != cell2.level)
					{
						/*console.log({
							cell: cell,
							cell2: cell2})*/

					}
					else
					{
						success++;
					}
					total++;
				// check equal
		}
	}

	console.log("level:" + level + "\t total:" + total + "\t success:" + success);
}
