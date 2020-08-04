'use strict';

nv.models.differenceChart = function () {
  'use strict';

  var container = void 0;
  var multiChart = nv.models.multiChart();
  var focus = nv.models.focus(nv.models.line());
  // const dispatch = d3.dispatch();
  // yAccessor for multi chart
  // Not modifiable by end user. They can
  // overload yAccessor which is used during the processData step
  var yForMultiChart = function yForMultiChart(d) {
    // check if the data is for an area chart
    // which has y0 and y1 values
    if (isDefined(d.y0)) {
      return d.y0;
    }
    // otherwise assume it's for a line chart
    return d.y;
  };
  var xForMultiChart = function xForMultiChart(d) {
    return d.x;
  };
  var xAccessor = function xAccessor(d) {
    return d.x;
  };
  var keyForXValue = 'x';
  var yAccessor = function yAccessor(d) {
    return d.y;
  };
  var duration = 300;
  var keyForActualLessThanPredicted = null;
  var keyForActualGreaterThanPredicted = null;
  var height = null;
  var width = null;
  var margin = { top: 30, right: 50, bottom: 20, left: 70 };
  var focusMargin = { top: 0, right: 0, bottom: 0, left: 0 };
  var showPredictedLine = true;
  var interpolate = 'linear';
  var strokeWidth = 1;
  var xScale = d3.time.scale();
  var tickFormat = d3.time.format.multi([['%I:%M', function (d) {
    return d.getMinutes();
  }], ['%I %p', function (d) {
    return d.getHours();
  }], ['%a %d', function (d) {
    return d.getDay() && d.getDate() != 1;
  }], ['%b %d', function (d) {
    return d.getDate() != 1;
  }], ['%B', function (d) {
    return d.getMonth();
  }], ['%Y', function () {
    return true;
  }]]);

  function chart(selection) {
    selection.each(function (data) {
      container = d3.select(this);
      var dataWithoutDisabledSeries = (data || []).filter(function (dataset) {
        return !dataset.disabled;
      });
      if (!data || !dataWithoutDisabledSeries.length) {
        nv.utils.noData(chart, container);
        return chart;
      }
      var processedData = processData(data);
      var availableHeight = nv.utils.availableHeight(height, container, margin) - focus.height();
      var availableWidth = nv.utils.availableWidth(width, container, margin);

      container.attr('class', 'nv-differenceChart');

      nv.utils.initSVG(container);

      chart.container = this;

      multiChart.margin(margin).color(d3.scale.category10().range()).y(yForMultiChart).width(width).height(availableHeight).interpolate(interpolate).useInteractiveGuideline(true);

      multiChart.interactiveLayer.tooltip.valueFormatter(function (value, i, datum) {
        if (datum.key === keyForActualGreaterThanPredicted || datum.key === keyForActualLessThanPredicted) {
          var diff = Math.abs(datum.data.y0 - datum.data.y1);
          if (diff === 0) {
            return '-';
          }
          return diff;
        }
        return value;
      });

      multiChart.stack1.areaY1(function (d) {
        return multiChart.stack1.scatter.yScale()(d.display.y);
      });

      multiChart.stack1.transformData(function (d) {
        d.display = { y: d.y1, y0: d.y0 };
      });
      multiChart.xAxis.scale(xScale);
      multiChart.xAxis.tickFormat(tickFormat);
      var allValues = processedData.filter(function (dataset) {
        return !dataset.disabled;
      }).map(function (dataset) {
        return dataset.values;
      });
      var dateExtent = d3.extent(d3.merge(allValues), function (d) {
        return xForMultiChart(d);
      });
      multiChart.xAxis.domain(dateExtent).range([0, availableWidth]);

      var yExtent = d3.extent(d3.merge(allValues), function (d) {
        return yForMultiChart(d);
      });
      multiChart.yDomain1(yExtent);
      multiChart.yAxis1.tickFormat(d3.format(',.1f'));
      multiChart.yAxis2.tickFormat(d3.format(',.1f'));

      focus.width(availableWidth);
      focus.margin(focusMargin);
      focus.xScale(xScale.copy());
      focus.xAxis.tickFormat(tickFormat);
      focus.xAxis.rotateLabels(0);

      container.append('g').attr('class', 'nv-focusWrap').style('display', 'initial').attr('transform', 'translate(' + margin.left + ', ' + (availableHeight + focus.margin().top) + ')').datum(processedData.filter(function (dataset) {
        return dataset.type === 'line';
      })).call(focus);

      container.datum(processedData).call(multiChart);

      focus.dispatch.on('onBrush', function (extent) {
        var filteredData = processedData.map(function (datum) {
          var leftIndex = -1;
          var rightIndex = -1;
          datum.values.some(function (val, index) {
            if (leftIndex === -1 && val.x >= extent[0]) {
              leftIndex = index;
            }

            if (rightIndex === -1 && val.x >= extent[1]) {
              rightIndex = index;
              return true;
            }
            return false;
          });
          var filteredValues = datum.values.slice(leftIndex, rightIndex);
          var iterations = 0;
          // don't want to end up with an empty dataset as this will
          // break the viewfinder.
          while (filteredValues.length < 2 && iterations < 5) {
            leftIndex -= 1;
            rightIndex += 1;
            filteredValues = datum.values.slice(leftIndex, rightIndex);
            iterations++;
          }

          return Object.assign({}, datum, {
            values: filteredValues
          });
        });

        container.datum(filteredData);

        multiChart.xAxis.domain(extent);

        multiChart.update();
      });

      chart.update = function () {
        container.selectAll('*').remove();

        if (duration === 0) {
          container.call(chart);
        } else {
          container.transition().duration(duration).call(chart);
        }
      };

      return chart;
    });
  }

  chart.options = nv.utils.optionsFunc.bind(chart);

  chart._options = Object.create({}, {
    width: {
      get: function get() {
        return width;
      },
      set: function set(_) {
        width = _;
      }
    },
    height: {
      get: function get() {
        return height;
      },
      set: function set(_) {
        height = _;
      }
    },
    strokeWidth: {
      get: function get() {
        return strokeWidth;
      },
      set: function set(_) {
        strokeWidth = _;
      }
    },
    x: {
      get: function get() {
        return xAccessor;
      },
      set: function set(_) {
        xAccessor = _;
      }
    },
    keyForXValue: {
      get: function get() {
        return keyForXValue;
      },
      set: function set(_) {
        keyForXValue = _;
      }
    },
    y: {
      get: function get() {
        return yAccessor;
      },
      set: function set(_) {
        yAccessor = _;
      }
    },
    xScale: {
      get: function get() {
        return xScale;
      },
      set: function set(_) {
        xScale = _;
      }
    },
    keyForActualLessThanPredicted: {
      get: function get() {
        return keyForActualLessThanPredicted;
      },
      set: function set(_) {
        keyForActualLessThanPredicted = _;
      }
    },
    keyForActualGreaterThanPredicted: {
      get: function get() {
        return keyForActualGreaterThanPredicted;
      },
      set: function set(_) {
        keyForActualGreaterThanPredicted = _;
      }
    },
    showPredictedLine: {
      get: function get() {
        return showPredictedLine;
      },
      set: function set(_) {
        showPredictedLine = _;
      }
    },
    tickFormat: {
      get: function get() {
        return tickFormat;
      },
      set: function set(_) {
        tickFormat = _;
      }
    },
    interpolate: {
      get: function get() {
        return interpolate;
      },
      set: function set(_) {
        interpolate = _;
      }
    },
    focusMargin: {
      get: function get() {
        return focusMargin;
      },
      set: function set(_) {
        focusMargin.top = _.top !== undefined ? _.top : focusMargin.top;
        focusMargin.right = _.right !== undefined ? _.right : focusMargin.right;
        focusMargin.bottom = _.bottom !== undefined ? _.bottom : focusMargin.bottom;
        focusMargin.left = _.left !== undefined ? _.left : focusMargin.left;
      }
    },
    margin: {
      get: function get() {
        return margin;
      },
      set: function set(_) {
        margin.top = _.top !== undefined ? _.top : margin.top;
        margin.right = _.right !== undefined ? _.right : margin.right;
        margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
        margin.left = _.left !== undefined ? _.left : margin.left;
      }
    }
  });

  function processData(data) {
    var clonedData = data.slice(0);
    var allProcessed = clonedData.every(function (dataset) {
      return dataset.processed;
    });
    var actualData = clonedData.filter(function (dataSet) {
      return dataSet.type === 'actual';
    });
    var predictedData = clonedData.filter(function (dataSet) {
      return dataSet.type === 'expected';
    });

    if (allProcessed) {
      return clonedData;
    } else if (!actualData.length || !predictedData.length) {
      return [];
    }

    var defaultKeyForActualLessThanPredicted = predictedData[0].key + ' minus ' + actualData[0].key + ' (Predicted > Actual)';
    var defaultKeyForActualGreaterThanPredicted = predictedData[0].key + ' minus ' + actualData[0].key + ' (Predicted < Actual)';
    // processedData is mapped as follows:
    //  [0] => Savings (actual under predicted) area
    //  [1] => 'Loss' (actual over predicted) area
    //  [2] => Actual profile
    //  [3] => Predicted profile
    var processedData = [{
      key: keyForActualLessThanPredicted || defaultKeyForActualLessThanPredicted,
      type: 'area',
      values: [],
      yAxis: 1,
      color: 'rgba(44,160,44,.9)',
      processed: true,
      noHighlightSeries: true
    }, {
      key: keyForActualGreaterThanPredicted || defaultKeyForActualGreaterThanPredicted,
      type: 'area',
      values: [],
      yAxis: 1,
      color: 'rgba(234,39,40,.9)',
      processed: true,
      noHighlightSeries: true
    }, {
      key: actualData[0].key,
      type: 'line',
      values: [],
      yAxis: 1,
      color: '#666666',
      processed: true,
      strokeWidth: strokeWidth
    }];

    if (showPredictedLine) {
      processedData[3] = {
        key: predictedData[0].key,
        type: 'line',
        values: [],
        yAxis: 1,
        color: '#aec7e8',
        processed: true,
        strokeWidth: strokeWidth
      };
    }

    var actualDataAsMap = actualData[0].values.reduce(function (result, datum, idx) {
      result[xAccessor(datum)] = yAccessor(datum);
      return result;
    }, {});

    var predictedDataAsMap = predictedData[0].values.reduce(function (result, datum, idx) {
      result[xAccessor(datum)] = yAccessor(datum);
      return result;
    }, {});

    Object.keys(actualDataAsMap).forEach(function (stringifiedXValue, idx) {
      var actualUsage = actualDataAsMap[stringifiedXValue];
      var predictedUsage = predictedDataAsMap[stringifiedXValue];
      var fakeDatumToGetProperXValue = {};
      // NB - stringifiedXValue will not be the correct data type
      // e.g. you might want to use a number/date. Pass the stringified
      // version back through xAccessor.
      fakeDatumToGetProperXValue[keyForXValue] = stringifiedXValue;
      var correctlyFormattedXValue = xAccessor(fakeDatumToGetProperXValue);

      var predictedActualDelta = predictedUsage - actualUsage;
      // The below code generates data for the difference chart.
      // We have four series: two for the area (processedData[0] and processedData[1]) charts
      // and two for the line charts ([2] and [3]). The way we achieve difference chart
      // is that for each datapoint, we calculate whether it represents a 'savings'
      // (actual less than predicted) or a 'loss' (actual greater than predicted).
      // The two areas are different colours (e.g. out of the box, a loss is red and a
      // saving is green).
      // If it's a loss, then we add an area datapoint in the loss dataset ranging from actual to predicted
      // (the area represents the magnitude of the loss).
      // At the same time, for the savings dataset, we make the datapoint equivalent to actual usage so that
      // a dot renders rather than a proper area. This basically makes the savings area invisible
      // when there is a loss.
      //
      // The opposite occurs when predicted is greater than savings (a saving).
      if (isNaN(predictedActualDelta)) {
        // if there is no predicted value for this point, just use actual usage
        processedData[1].values[idx] = {
          x: correctlyFormattedXValue,
          y0: actualUsage,
          y1: actualUsage
        };
        processedData[0].values[idx] = {
          x: correctlyFormattedXValue,
          y0: actualUsage,
          y1: actualUsage
        };
      }
      else if (predictedActualDelta < 0) {
        // actual greater than predicted - this is a loss
        // add area for loss between actualUsage (y0) and predictedUsage(y1)
        processedData[1].values[idx] = {
          x: correctlyFormattedXValue,
          y0: actualUsage,
          y1: predictedUsage
        };
        // for the saving data series, render a dot (y0 and y1) at actualUsage - need
        // this rather than NaN because otherwise if the next datapoint is a saving,
        // D3 won't be able to link the two areas together
        processedData[0].values[idx] = {
          x: correctlyFormattedXValue,
          y0: actualUsage,
          y1: actualUsage
        };
      } else {
        processedData[0].values[idx] = {
          x: correctlyFormattedXValue,
          y0: actualUsage,
          y1: predictedUsage
        };
        processedData[1].values[idx] = {
          x: correctlyFormattedXValue,
          y0: actualUsage,
          y1: actualUsage
        };
      }
      // Set actual
      processedData[2].values[idx] = { x: correctlyFormattedXValue, y: actualUsage };
      // Set predicted
      if (showPredictedLine) {
        processedData[3].values[idx] = { x: correctlyFormattedXValue, y: predictedUsage };
      }
    });

    return processedData;
  }

  function isDefined(thingToCheck) {
    // NB: void 0 === undefined
    return thingToCheck !== void 0;
  }

  chart.xAxis = multiChart.xAxis;
  chart.yAxis = multiChart.yAxis1;
  chart.multiChart = multiChart;
  chart.focus = focus;
  chart.processData = processData;
  nv.utils.inheritOptions(chart, multiChart);
  nv.utils.initOptions(chart);

  return chart;
};
