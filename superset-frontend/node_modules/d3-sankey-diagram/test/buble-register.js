var fs = require( 'fs' );
var path = require( 'path' );
var crypto = require( 'crypto' );
var homedir = require( 'os-homedir' );
var buble = require( 'buble' );

var original = require.extensions[ '.js' ];
var nodeModulesPattern = path.sep === '/' ? /\/node_modules\// : /\\node_modules\\/;

var nodeVersion = /(?:0\.)?\d+/.exec( process.version )[0];
var versions = [ '0.10', '0.12', '4', '5', '6' ];

if ( !~versions.indexOf( nodeVersion ) ) {
	if ( +nodeVersion > 6 ) {
		nodeVersion = '6';
	} else {
		throw new Error( 'Unsupported version (' + nodeVersion + '). Please raise an issue at https://gitlab.com/Rich-Harris/buble/issues' );
	}
}

var options = {
	target: {
		node: nodeVersion
	},
  transforms: {
    modules: false
  }
};

function mkdirp ( dir ) {
	var parent = path.dirname( dir );
	if ( dir === parent ) return;
	mkdirp( parent );

	try {
		fs.mkdirSync( dir );
	} catch ( err ) {
		if ( err.code !== 'EEXIST' ) throw err;
	}
}

var home = homedir();
if ( home ) {
	var cachedir = path.join( home, '.buble-cache', nodeVersion );
	mkdirp( cachedir );
	fs.writeFileSync( path.join( home, '.buble-cache/README.txt' ), 'These files enable a faster startup when using buble/register. You can safely delete this folder at any time. See https://buble.surge.sh/guide/ for more information.' );
}

var optionsStringified = JSON.stringify( options );

require.extensions[ '.js' ] = function ( m, filename ) {
	if ( nodeModulesPattern.test( filename ) ) return original( m, filename );

	var source = fs.readFileSync( filename, 'utf-8' );
	var hash = crypto.createHash( 'sha256' );
	hash.update( buble.VERSION );
	hash.update( optionsStringified );
	hash.update( source );
	var key = hash.digest( 'hex' ) + '.json';
	var cachepath = path.join( cachedir, key );

	var compiled;

	if ( cachedir ) {
		try {
			compiled = JSON.parse( fs.readFileSync( cachepath, 'utf-8' ) );
		} catch ( err ) {
			// noop
		}
	}

	if ( !compiled ) {
		try {
			compiled = buble.transform( source, options );

			if ( cachedir ) {
				fs.writeFileSync( cachepath, JSON.stringify( compiled ) );
			}
		} catch ( err ) {
			if ( err.snippet ) {
				console.log( 'Error compiling ' + filename + ':\n---' );
				console.log( err.snippet );
				console.log( err.message );
				console.log( '' )
				process.exit( 1 );
			}

			throw err;
		}
	}

	m._compile( '"use strict";\n' + compiled.code, filename );
};
