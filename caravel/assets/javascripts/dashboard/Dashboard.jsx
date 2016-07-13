var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('../modules/caravel.js');
var d3 = require('d3');
var urlLib = require('url');
var showModal = require('../modules/utils.js').showModal;

import React from 'react';
import { render } from 'react-dom';
import SliceAdder from './components/SliceAdder.jsx';
import GridLayout from './components/GridLayout.jsx';

var ace = require('brace');
require('bootstrap');
require('brace/mode/css');
require('brace/theme/crimson_editor');
require('../caravel-select2.js');
require('../../stylesheets/dashboard.css');

var Dashboard = function (dashboardData) {
  var dashboard = $.extend(dashboardData, {
    filters: {},
    init: function () {
      this.initDashboardView();
      this.firstLoad = true;
      px.initFavStars();
      var sliceObjects = [],
        dash = this;
      dashboard.slices.forEach(function (data) {
        if (data.error) {
          var html = '<div class="alert alert-danger">' + data.error + '</div>';
          $('#slice_' + data.slice_id).find('.token').html(html);
        } else {
          var slice = px.Slice(data, dash);
          $('#slice_' + data.slice_id).find('a.refresh').click(function () {
            slice.render(true);
          });
          sliceObjects.push(slice);
        }
      });
      this.slices = sliceObjects;
      this.refreshTimer = null;
      this.loadPreSelectFilters();
      this.startPeriodicRender(0);
      this.bindResizeToWindowResize();
    },
    loadPreSelectFilters: function () {
      try {
        var filters = JSON.parse(px.getParam("preselect_filters") || "{}");
        for (var slice_id in filters) {
          for (var col in filters[slice_id]) {
            this.setFilter(slice_id, col, filters[slice_id][col], false, false);
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
    setFilter: function (slice_id, col, vals, refresh) {
      this.addFilter(slice_id, col, vals, false, refresh);
    },
    addFilter: function (slice_id, col, vals, merge = true, refresh = true) {
      if (!(slice_id in this.filters)) {
        this.filters[slice_id] = {};
      }
      if (!(col in this.filters[slice_id]) || !merge) {
        this.filters[slice_id][col] = vals;
      } else {
        this.filters[slice_id][col] = d3.merge([this.filters[slice_id][col], vals]);
      }
      if (refresh) {
        this.refreshExcept(slice_id);
      }
      this.updateFilterParamsInUrl();
    },
    readFilters: function () {
      // Returns a list of human readable active filters
      return JSON.stringify(this.filters, null, 4);
    },
    updateFilterParamsInUrl: function () {
      var urlObj = urlLib.parse(location.href, true);
      urlObj.query = urlObj.query || {};
      urlObj.query.preselect_filters = this.readFilters();
      urlObj.search = null;
      history.pushState(urlObj.query, window.title, urlLib.format(urlObj));
    },
    bindResizeToWindowResize: function () {
      var resizeTimer;
      var dash = this;
      $(window).on('resize', function (e) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          dash.slices.forEach(function (slice) {
            slice.resize();
          });
        }, 500);
      });
    },
    stopPeriodicRender: function () {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
    },
    startPeriodicRender: function (interval) {
      this.stopPeriodicRender();
      var dash = this;
      var maxRandomDelay = Math.min(interval * 0.2, 5000);
      var refreshAll = function () {
        dash.slices.forEach(function (slice) {
          var force = !dash.firstLoad;
          setTimeout(function () {
            slice.render(force);
          },
          //Randomize to prevent all widgets refreshing at the same time
          maxRandomDelay * Math.random());
        });
        dash.firstLoad = false;
      };

      var fetchAndRender = function () {
        refreshAll();
        if (interval > 0) {
          dash.refreshTimer = setTimeout(function () {
            fetchAndRender();
          }, interval);
        }
      };
      fetchAndRender();
    },
    refreshExcept: function (slice_id) {
      var immune = this.metadata.filter_immune_slices || [];
      this.slices.forEach(function (slice) {
        if (slice.data.slice_id !== slice_id && immune.indexOf(slice.data.slice_id) === -1) {
          slice.render();
        }
      });
    },
    clearFilters: function (slice_id) {
      delete this.filters[slice_id];
      this.refreshExcept(slice_id);
      this.updateFilterParamsInUrl();
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
      this.updateFilterParamsInUrl();
    },
    getSlice: function (slice_id) {
      slice_id = parseInt(slice_id, 10);
      for (var i=0; i < this.slices.length; i++) {
        if (this.slices[i].data.slice_id === slice_id) {
          return this.slices[i];
        }
      }
    },
    showAddSlice: function () {
      var slicesOnDashMap = {};
      this.reactGridLayout.serialize().forEach(function (position) {
        slicesOnDashMap[position.slice_id] = true;
      }, this);

      render(
        <SliceAdder dashboard={dashboard} slicesOnDashMap={slicesOnDashMap} caravel={px} />,
        document.getElementById("add-slice-container")
      );
    },
    getAjaxErrorMsg: function (error) {
      var respJSON = error.responseJSON;
      return (respJSON && respJSON.message) ? respJSON.message :
              error.responseText;
    },
    addSlicesToDashboard: function (sliceIds) {
      $.ajax({
        type: "POST",
        url: '/caravel/add_slices/' + dashboard.id + '/',
        data: {
          data: JSON.stringify({ slice_ids: sliceIds })
        },
        success: function () {
          // Refresh page to allow for slices to re-render
          window.location.reload();
        },
        error: function (error) {
          var errorMsg = this.getAjaxErrorMsg(error);
          showModal({
            title: "Error",
            body: "Sorry, there was an error adding slices to this dashboard: </ br>" + errorMsg
          });
        }.bind(this)
      });
    },
    saveDashboard: function () {
      var expandedSlices = {};
      $.each($(".slice_info"), function (i, d) {
        var widget = $(this).parents('.widget');
        var sliceDescription = widget.find('.slice_description');
        if (sliceDescription.is(":visible")) {
          expandedSlices[$(widget).attr('data-slice-id')] = true;
        }
      });
      var data = {
        positions: this.reactGridLayout.serialize(),
        css: this.editor.getValue(),
        expanded_slices: expandedSlices
      };
      $.ajax({
        type: "POST",
        url: '/caravel/save_dash/' + dashboard.id + '/',
        data: {
          data: JSON.stringify(data)
        },
        success: function () {
          showModal({
            title: "Success",
            body: "This dashboard was saved successfully."
          });
        },
        error: function (error) {
          var errorMsg = this.getAjaxErrorMsg(error);
          showModal({
            title: "Error",
            body: "Sorry, there was an error saving this dashboard: </ br>" + errorMsg
          });
        }
      });
    },
    initDashboardView: function () {
      this.posDict = {};
      this.position_json.forEach(function (position) {
        this.posDict[position.slice_id] = position;
      }, this);

      this.reactGridLayout = render(
        <GridLayout slices={this.slices} posDict={this.posDict} dashboard={dashboard}/>,
        document.getElementById("grid-container")
      );

      this.curUserId = $('.dashboard').data('user');

      dashboard = this;

      // Displaying widget controls on hover
      $('.chart-header').hover(
        function () {
          $(this).find('.chart-controls').fadeIn(300);
        },
        function () {
          $(this).find('.chart-controls').fadeOut(300);
        }
      );
      $("div.grid-container").css('visibility', 'visible');
      $("#savedash").click(this.saveDashboard.bind(this));
      $("#add-slice").click(this.showAddSlice.bind(this));

      var editor = ace.edit("dash_css");
      this.editor = editor;
      editor.$blockScrolling = Infinity;

      editor.setTheme("ace/theme/crimson_editor");
      editor.setOptions({
        minLines: 16,
        maxLines: Infinity,
        useWorker: false
      });
      editor.getSession().setMode("ace/mode/css");

      $(".select2").select2({
        dropdownAutoWidth: true
      });
      $("#css_template").on("change", function () {
        var css = $(this).find('option:selected').data('css');
        editor.setValue(css);

        $('#dash_css').val(css);
        injectCss("dashboard-template", css);

      });
      $('#filters').click(function () {
        showModal({
          title: "<span class='fa fa-info-circle'></span> Current Global Filters",
          body: "The following global filters are currently applied:<br/>" + dashboard.readFilters()
        });
      });
      $("#refresh_dash_interval").on("change", function () {
        var interval = $(this).find('option:selected').val() * 1000;
        dashboard.startPeriodicRender(interval);
      });
      $('#refresh_dash').click(function () {
        dashboard.slices.forEach(function (slice) {
          slice.render(true);
        });
      });

      $("div.widget").click(function (e) {
        var $this = $(this);
        var $target = $(e.target);

        if ($target.hasClass("slice_info")) {
          $this.find(".slice_description").slideToggle(0, function () {
            $this.find('.refresh').click();
          });
        } else if ($target.hasClass("controls-toggle")) {
          $this.find(".chart-controls").toggle();
        }
      });

      editor.on("change", function () {
        var css = editor.getValue();
        $('#dash_css').val(css);
        injectCss("dashboard-template", css);
      });

      var css = $('.dashboard').data('css');
      injectCss("dashboard-template", css);

      // Injects the passed css string into a style sheet with the specified className
      // If a stylesheet doesn't exist with the passed className, one will be injected into <head>
      function injectCss(className, css) {

        var head  = document.head || document.getElementsByTagName('head')[0];
        var style = document.querySelector('.' + className);

        if (!style) {
          if (className.split(' ').length > 1) {
            throw new Error("This method only supports selections with a single class name.");
          }
          style = document.createElement('style');
          style.className = className;
          style.type = 'text/css';
          head.appendChild(style);
        }

        if (style.styleSheet) {
          style.styleSheet.cssText = css;
        } else {
          style.innerHTML = css;
        }
      }
    }
  });
  dashboard.init();
  return dashboard;
};

$(document).ready(function () {
  Dashboard($('.dashboard').data('dashboard'));
  $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
});
