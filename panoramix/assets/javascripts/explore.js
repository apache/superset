// Javascript for the explorer page
// Init explorer view -> load vis dependencies -> read data (from dynamic html) -> render slice
// nb: to add a new vis, you must also add a Python fn in viz.py

// css
require('../vendor/pygments.css');
require('../vendor/bootstrap-toggle/bootstrap-toggle.min.css');

// js
var $  = window.$  || require('jquery');
var px = window.px || require('./modules/panoramix.js');
require('select2');
require('../vendor/bootstrap-toggle/bootstrap-toggle.min.js');
require('../vendor/select2.sortable.js');

// vis sources
var sourceMap = {
  area:           'nvd3_vis.js',
  bar:            'nvd3_vis.js',
  bubble:         'nvd3_vis.js',
  big_number:     'big_number.js',
  compare:        'nvd3_vis.js',
  dist_bar:       'nvd3_vis.js',
  directed_force: 'directed_force.js',
  filter_box:     'filter_box.js',
  heatmap:        'heatmap.js',
  iframe:         'iframe.js',
  line:           'nvd3_vis.js',
  markup:         'markup.js',
  para:           'parallel_coordinates.js',
  pie:            'nvd3_vis.js',
  // pivot_table:    undefined,
  sankey:         'sankey.js',
  sunburst:       'sunburst.js',
  table:          'table.js',
  word_cloud:     'word_cloud.js',
  world_map:      'world_map.js',
};

$(document).ready(function() {
  px.initExploreView();

  // Dynamically register this visualization
  var visType = window.viz_type.value;
  var visSource = sourceMap[visType];

  if (visSource) {
    var visFactory = require('../visualizations/' + visSource);
    if (typeof visFactory === 'function') {
      // @TODO handle px.registerViz here instead of in each file?
      px.registerViz(visType, visFactory);
    }
  }
  else {
    console.error("require(", visType, ") failed.");
  }

  var data  = $('.slice').data('slice');
  var slice = px.Slice(data);

  //
  $('.slice').data('slice', slice);

  // call vis render method, which issues ajax
  px.renderSlice();

  // make checkbox inputs display as toggles
  $(':checkbox')
    .addClass('pull-right')
    .attr("data-onstyle", "default")
    .bootstrapToggle({size: 'mini'});

  $('div.toggle').addClass('pull-right');
});
