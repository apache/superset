var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/panoramix.js');
var d3 = require('d3');
require('bootstrap');

var ace = require('brace');
require('brace/mode/css');
require('brace/theme/crimson_editor');

require('select2');
require('../node_modules/gridster/dist/jquery.gridster.min.js');
require('../node_modules/gridster/dist/jquery.gridster.min.js');

var dashboard;

var Dashboard = function(id){
  var dash = {
    slices: [],
    filters: {},
    id: id,
    addFilter: function(slice_id, filters) {
      this.filters[slice_id] = filters;
      this.refreshExcept(slice_id);
    },
    readFilters: function() {
      // Returns a list of human readable active filters
      return JSON.stringify(this.filters, null, 4);
    },
    refreshExcept: function(slice_id) {
      this.slices.forEach(function(slice){
        if(slice.data.slice_id != slice_id){
          slice.render();
        }
      });
    },
    clearFilter: function(slice_id) {
      delete this.filters[slice_id];
      this.refreshExcept(slice_id);
    },
    getSlice: function(slice_id) {
      for(var i=0; i<this.slices.length; i++){
        if (this.slices[i].data.slice_id == slice_id)
          return this.slices[i];
      }
    }
  }
  $('.dashboard li.widget').each(function() {
    var data = $(this).data('slice');
    var slice = px.Slice(data, dash);
    $(this).find('a.refresh').click(function(){
      slice.render();
    });
    dash.slices.push(slice);
    slice.render();
  });
  dashboard = dash;
  return dash;
}

function initDashboardView() {
  var gridster = $(".gridster ul").gridster({
    widget_margins: [5, 5],
    widget_base_dimensions: [100, 100],
    draggable: {
      handle: '.drag',
    },
    resize: {
      enabled: true,
      stop: function(e, ui, element) {
        var slice_data = $(element).data('slice');
        dashboard.getSlice(slice_data.slice_id).resize();
      }
    },
    serialize_params: function(_w, wgd) {
      return {
        slice_id: $(_w).attr('slice_id'),
        col: wgd.col,
        row: wgd.row,
        size_x: wgd.size_x,
        size_y: wgd.size_y
      };
    },
  }).data('gridster');
  $("div.gridster").css('visibility', 'visible');
  $("#savedash").click(function() {
    var expanded_slices = {};
    $.each($(".slice_info"), function(i, d){
      var widget = $(this).parents('.widget');
      var slice_description = widget.find('.slice_description');
      if(slice_description.is(":visible"))
        expanded_slices[$(d).attr('slice_id')] = true;
    });
    var data = {
        positions: gridster.serialize(),
        css: editor.getValue(),
        expanded_slices: expanded_slices,
    };
    $.ajax({
      type: "POST",
      url: '/panoramix/save_dash/' + dashboard.id + '/',
      data: {'data': JSON.stringify(data)},
      success: function() {alert("Saved!")},
      error: function() {alert("Error :(")},
    });
  });

  var editor = ace.edit("dash_css");
  editor.$blockScrolling = Infinity

  editor.setTheme("ace/theme/crimson_editor");
  editor.setOptions({
      minLines: 16,
      maxLines: Infinity,
  });
  editor.getSession().setMode("ace/mode/css");

  $(".select2").select2({dropdownAutoWidth : true});
  $("#css_template").on("change", function() {
    var css = $(this).find('option:selected').data('css');
    editor.setValue(css);
    $('#dash_css').val(css);
    $("#user_style").html(css);
  });
  $('#filters').click( function(){
    alert(dashboard.readFilters());
  });
  $("a.closeslice").click(function() {
    var li = $(this).parents("li");
    gridster.remove_widget(li);
  });
  $(".slice_info").click(function(){
    var widget = $(this).parents('.widget');
    var slice_description = widget.find('.slice_description');
    slice_description.slideToggle(500, function(){
      widget.find('.refresh').click();
    });
  });
  $("table.slice_header").mouseover(function() {
    $(this).find("td.icons nobr").show();
  });
  $("table.slice_header").mouseout(function() {
    $(this).find("td.icons nobr").hide();
  });
  editor.on("change", function(){
    var css = editor.getValue();
    $('#dash_css').val(css);
    $("#user_style").html(css);
  });
}

$(document).ready(function() {
  initDashboardView();
  var dashboard = Dashboard($('#dashboard_id').val());
});
