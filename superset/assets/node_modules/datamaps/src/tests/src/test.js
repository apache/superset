require(
  {
    paths: {
      'd3': '../../js/components/d3/d3.v2',
      'underscore': '../../js/components/underscore-amd/underscore',
      'jquery': '../../js/components/zepto/dist/zepto',
      'zepto': '../../js/components/zepto/dist/zepto',
      'backbone': '../../js/components/backbone-amd/backbone'
    }
  },
  [
    '../../../dist/datamaps'
  ], function(Map) {
    console.log(Map, 'hola');
});