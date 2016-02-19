require('select2');
require('./vendor/bootstrap-toggle.min.js');
require('./vendor/select2.sortable.js');

$(document).ready(function() {
  px.initExploreView();

  var data  = $('.slice').data('slice');
  var slice = px.Slice(data);

  $('.slice').data('slice', slice);

  px.renderSlice();

  $(':checkbox')
    .addClass('pull-right')
    .attr("data-onstyle", "default")
    .bootstrapToggle({size: 'mini'});

  $('div.toggle').addClass('pull-right');
});
