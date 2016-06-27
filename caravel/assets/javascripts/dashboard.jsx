var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/caravel.js');
var d3 = require('d3');
var showModal = require('./modules/utils.js').showModal;
require('bootstrap');
import React from 'react';
import { render } from 'react-dom';
import update from 'immutability-helper';

var ace = require('brace');
require('brace/mode/css');
require('brace/theme/crimson_editor');

require('./caravel-select2.js');
require('../node_modules/react-grid-layout/css/styles.css');
require('../node_modules/react-resizable/css/styles.css');

require('datatables.net-bs');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
require('../stylesheets/dashboard.css');

import { Responsive, WidthProvider } from "react-grid-layout";
const ResponsiveReactGridLayout = WidthProvider(Responsive);

class SliceCell extends React.Component {
  render() {
    const slice = this.props.slice,
          createMarkup = function () {
            return { __html: slice.description_markeddown };
          };

    return (
      <div>
        <div className="chart-header">
          <div className="row">
            <div className="col-md-12 text-center header">
              {slice.slice_name}
            </div>
            <div className="col-md-12 chart-controls">
              <div className="pull-left">
                <a title="Move chart" data-toggle="tooltip">
                  <i className="fa fa-arrows drag"/>
                </a>
                <a className="refresh" title="Force refresh data" data-toggle="tooltip">
                  <i className="fa fa-repeat"/>
                </a>
              </div>
              <div className="pull-right">
                {slice.description ?
                  <a title="Toggle chart description">
                    <i className="fa fa-info-circle slice_info" title={slice.description} data-toggle="tooltip"/>
                  </a>
                : ""}
                <a href={slice.edit_url} title="Edit chart" data-toggle="tooltip">
                  <i className="fa fa-pencil"/>
                </a>
                <a href={slice.slice_url} title="Explore chart" data-toggle="tooltip">
                  <i className="fa fa-share"/>
                </a>
                <a className="remove-chart" title="Remove chart from dashboard" data-toggle="tooltip">
                  <i className="fa fa-close" onClick={this.props.removeSlice.bind(null, slice.slice_id)}/>
                </a>
              </div>
            </div>

          </div>
        </div>
        <div
          className="slice_description bs-callout bs-callout-default"
          style={this.props.expandedSlices && this.props.expandedSlices[String(slice.slice_id)] ? {} : { display: "none" }}
          dangerouslySetInnerHTML={createMarkup()}>
        </div>
        <div className="row chart-container">
          <input type="hidden" value="false"/>
          <div id={slice.token} className="token col-md-12">
            <img src={"/static/assets/images/loading.gif"} className="loading" alt="loading"/>
            <div className="slice_container" id={slice.token + "_con"}></div>
          </div>
        </div>
      </div>
    );
  }
}

class GridLayout extends React.Component {
  removeSlice(sliceId) {
    $('[data-toggle="tooltip"]').tooltip("hide");
    this.setState({
      layout: this.state.layout.filter(function (reactPos) {
        return reactPos.i !== String(sliceId);
      }),
      slices: this.state.slices.filter(function (slice) {
        return slice.slice_id !== sliceId;
      })
    });
  }

  onResizeStop(layout, oldItem, newItem) {
    if (oldItem.w != newItem.w || oldItem.h != newItem.h) {
      this.setState({
        layout: layout
      }, function () {
        this.props.dashboard.getSlice(newItem.i).resize();
      });
    }
  }

  onDragStop(layout) {
    this.setState({
      layout: layout
    });
  }

  serialize() {
    return this.state.layout.map(function (reactPos) {
      return {
        slice_id: reactPos.i,
        col: reactPos.x + 1,
        row: reactPos.y,
        size_x: reactPos.w,
        size_y: reactPos.h
      };
    });
  }

  componentWillMount() {
    var layout = [];

    this.props.slices.forEach(function (slice, index) {
      var pos = this.props.posDict[slice.slice_id];
      if (!pos) {
        pos = {
          col: (index * 4 + 1) % 12,
          row: Math.floor((index) / 3) * 4,
          size_x: 4,
          size_y: 4
        };
      }

      layout.push({
        i: String(slice.slice_id),
        x: pos.col - 1,
        y: pos.row,
        w: pos.size_x,
        minW: 2,
        h: pos.size_y
      });
    }, this);

    this.setState({
      layout: layout,
      slices: this.props.slices
    });
  }

  render() {
    return (
      <ResponsiveReactGridLayout
        className="layout"
        layouts={{ lg: this.state.layout }}
        onResizeStop={this.onResizeStop.bind(this)}
        onDragStop={this.onDragStop.bind(this)}
        cols={{ lg: 12, md: 12, sm: 10, xs: 8, xxs: 6 }}
        rowHeight={100}
        autoSize={true}
        margin={[20, 20]}
        useCSSTransforms={false}
        draggableHandle=".drag">
        {this.state.slices.map(function (slice) {
          return (
            <div
              id={"slice_" + slice.slice_id}
              key={slice.slice_id}
              data-slice-id={slice.slice_id}
              className={"widget " + slice.viz_name}>
              <SliceCell
                slice={slice}
                removeSlice={this.removeSlice.bind(this)}
                expandedSlices={this.props.dashboard.metadata.expanded_slices}/>
            </div>
          );
        }, this)}
      </ResponsiveReactGridLayout>
    );
  }
}

class SliceAdder extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      slices: []
    };

    this.addSlices = this.addSlices.bind(this);
    this.toggleSlice = this.toggleSlice.bind(this);
    this.slicesLoaded = false;
  }

  addSlices() {
    var slices = this.state.slices.filter(function (slice) {
      return slice.isSelected;
    });
    var sliceIds = [];

    var sliceObjects = slices.map(function (slice) {
      var sliceObj = px.Slice(slice.data, this.props.dashboard);
      $("#slice_" + slice.data.slice_id).find('a.refresh').click(function () {
        sliceObj.render(true);
      });
      this.props.dashboard.slices.push(sliceObj);
      sliceIds.push(sliceObj.data.slice_id)
      return sliceObj;
    }, this);

    this.props.dashboard.addSlicesToDashboard(sliceIds);
  }

  toggleSlice(sliceIndex) {
    this.setState({
      slices: update(this.state.slices, {
        [sliceIndex]: {
          isSelected: {
            $set: !this.state.slices[sliceIndex].isSelected
          }
        }
      })
    });
  }

  componentDidMount() {
    var uri = "/sliceaddview/api/read?_flt_0_created_by=" + this.props.dashboard.curUserId;
    this.slicesRequest = $.get(uri, function (response) {
      this.slicesLoaded = true;
      this.setState({
        slices: response.result
      }, function () {
        $("#add-slice-container table").DataTable();
      });
    }.bind(this));
  }

  componentWillUnmount() {
    this.slicesRequest.abort();
  }

  render() {
    return (
      <div className="modal fade" id="add_slice_modal" role="dialog">
          <div className="modal-dialog" role="document">
              <div className="modal-content">
                  <div className="modal-header">
                      <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                      </button>
                      <h4 className="modal-title" id="myModalLabel">Add New Slices</h4>
                  </div>
                  <div className="modal-body">
                    <img src={"/static/assets/images/loading.gif"}
                         className={"loading " + (this.slicesLoaded ? "hidden" : "")}
                         alt="loading"/>
                    <table className="dataframe table table-condensed table-hover dataTable no-footer">
                      <thead className={this.slicesLoaded ? "" : "hidden"}>
                        <tr>
                          <th>Name</th>
                          <th>Viz</th>
                          <th>Creator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {this.state.slices.map(function (slice, i) {
                          if (this.props.slicesOnDashMap[String(slice.data.slice_id)]) {
                            return null;
                          }

                          return (
                            <tr key={i}
                                onClick={() => this.toggleSlice(i)}
                                className={slice.isSelected ? "add-slice-selected" : ""}>
                                <td>{slice.data.slice_name}</td>
                                <td>{slice.viz_type}</td>
                                <td>{slice.creator}</td>
                            </tr>
                          );
                        }, this)}
                      </tbody>
                    </table>
                  </div>
                  <div className="modal-footer">
                      <button type="button"
                              className="btn btn-default"
                              data-dismiss="modal">
                          Cancel
                      </button>
                      <button type="button"
                              className="btn btn-default"
                              data-dismiss="modal"
                              onClick={this.addSlices}>
                          Add Slices
                      </button>
                  </div>
              </div>
          </div>
      </div>
    );
  }
}

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
          $("#slice_" + data.slice_id).find('.token').html(html);
        } else {
          var slice = px.Slice(data, dash);
          $("#slice_" + data.slice_id).find('a.refresh').click(function () {
            slice.render(true);
          });
          sliceObjects.push(slice);
        }
      });
      this.slices = sliceObjects;
      this.refreshTimer = null;
      this.startPeriodicRender(0);
      this.bindResizeToWindowResize();
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
        <SliceAdder dashboard={dashboard} slicesOnDashMap={slicesOnDashMap}/>,
        document.getElementById("add-slice-container")
      );
    },
    addSlicesToDashboard: function (sliceIds) {
      $.ajax({
        type: "POST",
        url: '/caravel/add_slices/' + dashboard.id + '/',
        data: {
          data: JSON.stringify({slice_ids: sliceIds})
        },
        success: function () {
          // Refresh page to allow for slices to re-render
          window.location.reload();
        },
        error: function (error) {
          var respJSON = error.responseJSON;
          var errorMsg = (respJSON && respJSON.message) ? respJSON.message :
              error.responseText;
          showModal({
            title: "Error",
            body: "Sorry, there was an error adding slices to this dashboard:<br />" + errorMsg
          });
          console.warn("Add new slices error", error);
        }
      });
    },
    saveDashboard: function () {
      var expanded_slices = {};
      $.each($(".slice_info"), function (i, d) {
        var widget = $(this).parents('.widget');
        var slice_description = widget.find('.slice_description');
        if (slice_description.is(":visible")) {
          expanded_slices[$(widget).attr('data-slice-id')] = true;
        }
      });
      var data = {
        positions: this.reactGridLayout.serialize(),
        css: this.editor.getValue(),
        expanded_slices: expanded_slices
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
          var respJSON = error.responseJSON;
          var errorMsg = (respJSON && respJSON.message) ? respJSON.message :
              error.responseText;
          showModal({
            title: "Error",
            body: "Sorry, there was an error saving this dashboard:<br />" + errorMsg
          });
          console.warn("Save dashboard error", error);
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
