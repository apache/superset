/*! geolib.elevation 2.0.23 by Manuel Bieh
*
* Elevation Addon for Geolib.js
* 
* @author Manuel Bieh
* @url http://www.manuelbieh.com/
* @version 2.0.23
* @license MIT
*/
;(function(global, geolib, undefined) {

	var elevation = {

		/*global google:true geolib:true require:true module:true elevationResult:true */

		/**
		*  @param      Array Collection of coords [{latitude: 51.510, longitude: 7.1321}, {latitude: 49.1238, longitude: "8° 30' W"}, ...]
		*  @return     Array [{lat:#lat, lng:#lng, elev:#elev},....]}
		*/
		getElevation: function() {
			if (typeof global.navigator !== 'undefined') {
				this.getElevationClient.apply(this, arguments);
			} else {
				this.getElevationServer.apply(this, arguments);
			}
		},


		/* Optional elevation addon requires Googlemaps API JS */
		getElevationClient: function(coords, cb) {

			if (!global.google) {
				throw new Error("Google maps api not loaded");
			}

			if (coords.length === 0) {
				return cb(null, null);
			}

			if (coords.length === 1) {
				return cb(new Error("getElevation requires at least 2 points."));
			}

			var path  = [];

			for(var i = 0; i < coords.length; i++) {
				path.push(new google.maps.LatLng(
					this.latitude(coords[i]),
					this.longitude(coords[i])
				));
			}

			var positionalRequest = {
				'path': path,
				'samples': path.length
			};

			var elevationService = new google.maps.ElevationService();
			var geolib = this;

			elevationService.getElevationAlongPath(positionalRequest, function (results, status) {
				geolib.elevationHandler(results, status, coords, cb);
			});

		},


		getElevationServer: function(coords, cb) {

			if (coords.length === 0) {
				return cb(null, null);
			}

			if (coords.length === 1) {
				return cb(new Error("getElevation requires at least 2 points."));
			}

			var gm = require('googlemaps');
			var path  = [];

			for(var i = 0; i < coords.length; i++) {
				path.push(
					this.latitude(coords[i]) + ',' + this.longitude(coords[i])
				);
			}

			var geolib = this;

			gm.elevationFromPath(path.join('|'), path.length, function(err, results) {
				geolib.elevationHandler(results.results, results.status, coords, cb);
			});

		},


		elevationHandler: function(results, status, coords, cb) {

			var latsLngsElevs = [];

			if (status == "OK" ) {

				for (var i = 0; i < results.length; i++) {
					latsLngsElevs.push({
						"lat": this.latitude(coords[i]),
						"lng": this.longitude(coords[i]),
						"elev":results[i].elevation
					});
				}

				cb(null, latsLngsElevs);

			} else {

				cb(new Error("Could not get elevation using Google's API"), elevationResult.status);

			}

		},


		/**
		*  @param      Array [{lat:#lat, lng:#lng, elev:#elev},....]}
		*  @return     Number % grade
		*/
		getGrade: function(coords) {

			var rise = Math.abs(
				this.elevation(coords[coords.length-1]) - this.elevation(coords[0])
			);

			var run = this.getPathLength(coords);

			return Math.floor((rise/run)*100);

		},


		/**
		*  @param      Array [{lat:#lat, lng:#lng, elev:#elev},....]}
		*  @return     Object {gain:#gain, loss:#loss}
		*/
		getTotalElevationGainAndLoss: function(coords) {

			var gain = 0;
			var loss = 0;

			for(var i = 0; i < coords.length - 1; i++) {

				var deltaElev = this.elevation(coords[i]) - this.elevation(coords[i + 1]);

				if (deltaElev > 0) {
					loss += deltaElev;
				} else {
					gain += Math.abs(deltaElev);
				}

			}

			return {
				"gain": gain,
				"loss": loss
			};

		}

	};

	// Node module
	if (typeof module !== 'undefined' && 
		typeof module.exports !== 'undefined') {

		geolib = require('geolib');
		geolib.extend(elevation);

	// AMD module
	} else if (typeof define === "function" && define.amd) {

		define(["geolib"], function (geolib) {
			geolib.extend(elevation);
			return geolib;
		});

	// we're in a browser
	} else {

		geolib.extend(elevation);

	}

}(this, this.geolib));