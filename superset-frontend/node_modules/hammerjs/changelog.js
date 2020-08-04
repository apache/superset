var changelog = require( "changelogplease" );
var gittags = require( "git-tags" ).get( function( error, tags ) {
	if ( error ) {
		throw error
	}
	console.log( tags[ 1 ] + ".." + tags[ 0 ] );
	var exclude = [ "Merge", "Whitespace", "Fixup", "Cleanup", "Formatting", "Ignore" ];
	changelog( {
		ticketUrl: "https://github.com/hammerjs/hammer.js/issues/{id}",
		commitUrl: "https://github.com/hammerjs/hammerjs/commit/{id}",
		sort: false,
		repo: "./",
		committish: tags[ 1 ] + ".." + tags[ 0 ]
	}, function( error, log ) {
		if ( error ) {
			throw error;
		}
		log = parseLog( log );
		console.log( log );
	} );
	function parseLog( log ) {
		var lines = log.split( "\n" );
		var newLog = [];
		var log = [];
		var currentComponent;

		
		lines.shift();
		lines.forEach( function( line ) {
			var newLine = parseLine( line );
			if ( newLine ) {
				log.push( line );
			}
		} );
		var log = log.join( "\n" );
		return log.replace( /\*/g, "-" ).replace( /__TICKETREF__,/g, "" );
	}
	function parseLine( line ) {
		var parts = getParts( line );

		if ( exclude.indexOf( parts.component ) > -1 ) {
			return false;
		}
		return parts;
	}
	function getParts( line ) {
		var parts = line.split( ":" );
		var component = "";
		var message;
		var commits = line.match( /\{\{([A-Za-z0-9 ]){0,99}\}\}/ )

		if ( parts.length > 1 && parts[ 0 ].length <= 20 ) {
			component = parts[ 0 ];
			parts.shift();
			message = parts.join( ":" );
		} else {
			parts = line.split( " " );
			component = parts[ 1 ];
			parts.shift();
			message = parts.join( " " );
		}

		if ( component ) {
			component = component.replace( /\* |,/, "" );
		}
		return {
			component: component,
			message: message
		};
	}
} );
