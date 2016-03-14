var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/panoramix.js');
var d3 = require('d3');
require('bootstrap');

var ace = require('brace');
require('brace/mode/css');
require('brace/theme/crimson_editor');

require('./panoramix-select2.js');
require('../node_modules/gridster/dist/jquery.gridster.min.css');
require('../node_modules/gridster/dist/jquery.gridster.min.js');

var Dashboard = function (dashboardData) {
  var dashboard = $.extend(dashboardData, {
    filters: {},
    init: function () {
      this.initDashboardView();
      var sliceObjects = [],
        dash = this;
      dashboard.slices.forEach(function (data) {
        var slice = px.Slice(data, dash);
        $("#slice_" + data.slice_id).find('a.refresh').click(function () {
          slice.render();
        });
        sliceObjects.push(slice);
        slice.render();
      });
      this.slices = sliceObjects;
    },
    setFilter: function (slice_id, col, vals) {
      this.addFilter(slice_id, col, vals, false);
    },
    addFilter: function (slice_id, col, vals, merge) {
      if (merge === undefined) {
        merge = true;
      }
      if (!(slice_id in this.filters)) {
        this.filters[slice_id] = {};
      }
      if (!(col in this.filters[slice_id]) || !merge) {
        this.filters[slice_id][col] = vals;
      } else {
        this.filters[slice_id][col] = d3.merge([this.filters[slice_id][col], vals]);
      }
      this.refreshExcept(slice_id);
    },
    readFilters: function () {
      // Returns a list of human readable active filters
      return JSON.stringify(this.filters, null, 4);
    },
    refreshExcept: function (slice_id) {
      var immune = this.metadata.filter_immune_slices;
      if (immune) {
        this.slices.forEach(function (slice) {
          if (slice.data.slice_id !== slice_id && immune.indexOf(slice.data.slice_id) === -1) {
            slice.render();
          }
        });
      }
    },
    clearFilters: function (slice_id) {
      delete this.filters[slice_id];
      this.refreshExcept(slice_id);
    },
    removeFilter: function (slice_id, col, vals) {
      if (slice_id in this.filters) {
        if (col in this.filters[slice_id]) {
          var a = [];
          this.filters[slice_id][col].forEach(function (v) {
            if (vals.indexOf(v) < 0) {
              a.push(v);
            }
          });
          this.filters[slice_id][col] = a;
        }
      }
      this.refreshExcept(slice_id);
    },
    getSlice: function (slice_id) {
      this.slices.forEach(function (slice, i) {
        if (slice.slice_id === slice_id) {
          return slice;
        }
      });
    },
    initDashboardView: function () {
      dashboard = this;
      var gridster = $(".gridster ul").gridster({
        autogrow_cols: true,
        widget_margins: [10, 10],
        widget_base_dimensions: [100, 100],
        draggable: {
          handle: '.drag'
        },
        resize: {
          enabled: true,
          stop: function (e, ui, element) {
            var slice_data = $(element).data('slice');
            if (slice_data) {
              dashboard.getSlice(slice_data.slice_id).resize();
            }
          }
        },
        serialize_params: function (_w, wgd) {
          return {
            slice_id: $(_w).attr('slice_id'),
            col: wgd.col,
            row: wgd.row,
            size_x: wgd.size_x,
            size_y: wgd.size_y
          };
        }
      }).data('gridster');
      $("div.gridster").css('visibility', 'visible');
      $("#savedash").click(function () {
        var expanded_slices = {};
        $.each($(".slice_info"), function (i, d) {
          var widget = $(this).parents('.widget');
          var slice_description = widget.find('.slice_description');
          if (slice_description.is(":visible")) {
            expanded_slices[$(d).attr('slice_id')] = true;
          }
        });
        var data = {
          positions: gridster.serialize(),
          css: editor.getValue(),
          expanded_slices: expanded_slices
        };
        $.ajax({
          type: "POST",
          url: '/panoramix/save_dash/' + dashboard.id + '/',
          data: {
            data: JSON.stringify(data)
          },
          success: function () {
            alert("Saved!");
          },
          error: function () {
            alert("Error :(");
          }
        });
      });

      var editor = ace.edit("dash_css");
      editor.$blockScrolling = Infinity;

      editor.setTheme("ace/theme/crimson_editor");
      editor.setOptions({
        minLines: 16,
        maxLines: Infinity
      });
      editor.getSession().setMode("ace/mode/css");

      $(".select2").select2({
        dropdownAutoWidth: true
      });
      $("#css_template").on("change", function () {
        var css = $(this).find('option:selected').data('css');
        editor.setValue(css);
        $('#dash_css').val(css);
        $("#user_style").html(css);
      });
      $('#filters').click(function () {
        alert(dashboard.readFilters());
      });
      $("a.remove-chart").click(function () {
        var li = $(this).parents("li");
        gridster.remove_widget(li);
      });

      $(".slice_info").click(function () {
        var widget = $(this).parents('.widget');
        var slice_description = widget.find('.slice_description');
        slice_description.slideToggle(500, function () {
          widget.find('.refresh').click();
        });
      });

      editor.on("change", function () {
        var css = editor.getValue();
        $('#dash_css').val(css);
        $("#user_style").html(css);
      });
    }
  });
  dashboard.init();
  return dashboard;
};

$(document).ready(function () {
  Dashboard($('.dashboard').data('dashboard'));
});
