requirejs.config({
  'baseUrl': 'js',
  'paths': {
    'app': '../app',
    'datamaps': '../../rel/datamaps.all',
    'topojson': 'https://rawgithub.com/mbostock/topojson/master/topojson',
    'd3': 'http://rawgithub.com/mbostock/d3/master/d3'
  },
  shim: {
    d3: {
      exports: 'd3'
    },
    topojson: {
      deps: ['d3'],
      exports: 'topojson'
    },
    datamaps: {
      deps: ['d3', 'topojson']
    }
  }

});

/** Load main module to start app **/
requirejs(["./main"]);
