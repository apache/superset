import d3 from 'd3';
import { fixDataTableBodyHeight } from '../javascripts/modules/utils';
import { timeFormatFactory, formatDate } from '../javascripts/modules/dates';

require('./table.css');
const $ = require('jquery');
require('jquery-ui');

require('datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
import 'datatables.net';
import dt from 'datatables.net-bs';
dt(window, $);

function tableVis(slice) {
  let count = 0;
  const fC = d3.format('0,000');
  let timestampFormatter;
  const container = $(slice.selector);

  function refresh() {
    function onError(xhr) {
      slice.error(xhr.responseText, xhr);
      return;
    }


    // get slice by sliceId
    function sliceUrl(sliceId) {
      const navigateSlice = $.ajax({
        url: '/superset/rest/api/sliceUrl',
        async: false,
        data: { sliceId: sliceId },
        dataType: 'json',
      });
      return navigateSlice.responseText;
    }

    // add a modal
    function showModal(title, url) {
      let modals;
      if ($('#modals').attr('id') !== undefined) {
        modals = $('#modals');
      } else {
        modals = document.createElement('div');
        $(modals).attr('id', 'modals');
        document.body.append(modals);
      }
      const myModal = document.createElement('div');
      const modalCount = $('#modals').children().length;
      $(myModal).attr('id', modalCount)
      .attr('class', 'modal fade')
      .attr('role', 'dialog')
      .attr('aria-hidden', true)
      .attr('id', 'newSlice_' + modalCount);
      const modalDialog = document.createElement('div');
      $(modalDialog).attr('class', 'modal-dialog');
      const modalContent = document.createElement('div');
      $(modalContent).attr('class', 'modal-content');
      const modalHeader = document.createElement('div');
      $(modalHeader).attr('class', 'modal-header');
      const modalTitle = document.createElement('h4');
      $(modalTitle).attr('class', 'modal-title')
      .text(title);
      const modalBody = document.createElement('div');
      $(modalBody).attr('class', 'modal-body');
      const iframe = document.createElement('iframe');
      $(iframe).attr('id', 'iframe_' + modalCount)
      .attr('src', url)
      .attr('height', '50%')
      .attr('width', '100%')
      .attr('frameborder', 0);
      $(modalBody).append(iframe);
      $(modalContent).append(modalHeader);
      $(modalContent).append(modalBody);
      $(modalHeader).append(modalTitle);
      $(modalDialog).append(modalContent);
      $(myModal).append(modalDialog);
      $(modals).append(myModal);
      $(myModal).draggable({
        handle: '.modal-header',
      });
      $(myModal).modal({ show: true });
      // const myModal = $('#newSlice').clone();
      // const modalCount = $('#modals').children().length;
      // myModal.attr('id', 'newSlice_' + modalCount);
      // $('#modals').append(myModal);
      // $('#newSlice_' + modalCount + ' iframe').attr('src', url);
      // $('#newSlice_' + modalCount + ' iframe').attr('id', 'iframe_' + modalCount);
      // $('#newSlice_' + modalCount + ' .modal-title').text(title);
      // myModal.attr('display', 'block');
      // myModal.draggable({
      //   handle: '.modal-header',
      // });
      // myModal.modal({ show: true });
      // $('.modal-backdrop').each(function () {
      //   $(this).attr('id', 'id_' + Math.random());
      // });
    }

    // add listener to get navigate message
    $(document).ready(function () {
      window.addEventListener('message', function (e) {
        if (e.data.type === 'newWindow') {
          window.open(e.data.url, null, null);
        } else {
           // make modal can be add only once
          if ($('#newSlice_' + count).attr('id') === undefined) {
            showModal(e.data.title, e.data.url);
            count++;
          }
        }
      }, false);
    });

    // add filter by change url
    function addFilter(url, colArr) {
      let newUrl = url;
      for (let i = 0; i < colArr.length; i++) {
        const flt = newUrl.match(/flt_col/g);
        let nextFltIndex = 0;
        if (flt === null || flt === '') {
          nextFltIndex = 1;
        } else {
          nextFltIndex = flt.length + 1;
        }
        const col = colArr[i].col;
        const val = colArr[i].val;
        const nextFlt = '&flt_col_' + nextFltIndex + '=' + col + '&flt_op_' + nextFltIndex +
            '=in&flt_eq_' + nextFltIndex + '=' + val;
        newUrl += nextFlt;
      }
      return newUrl;
    }


    function GetQueryString(url, name) {
      const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
      const r = url.substring(url.indexOf('?')).substr(1).match(reg);
      if (r != null) {
        return unescape(r[2]);
      }
      return null;
    }


    function onSuccess(json) {
      const data = json.data;
      const fd = json.form_data;
      // console.log("form_data:");
      // console.log(fd);
      // Removing metrics (aggregates) that are strings
      const realMetrics = [];
      for (const k in data.records[0]) {
        if (fd.metrics.indexOf(k) > -1 && !isNaN(data.records[0][k])) {
          realMetrics.push(k);
        }
      }
      const metrics = realMetrics;

      function col(c) {
        const arr = [];
        for (let i = 0; i < data.records.length; i++) {
          arr.push(data.records[i][c]);
        }
        return arr;
      }
      const maxes = {};
      for (let i = 0; i < metrics.length; i++) {
        maxes[metrics[i]] = d3.max(col(metrics[i]));
      }

      if (fd.table_timestamp_format === 'smart_date') {
        timestampFormatter = formatDate;
      } else if (fd.table_timestamp_format !== undefined) {
        timestampFormatter = timeFormatFactory(fd.table_timestamp_format);
      }

      const div = d3.select(slice.selector);
      div.html('');
      const table = div.append('table')
        .classed(
          'dataframe dataframe table table-striped table-bordered ' +
          'table-condensed table-hover dataTable no-footer', true)
        .attr('width', '100%');

      // add header style
      const headerStyle = fd.headerValue;
      table.append('thead').append('tr')
        .selectAll('th')
        .data(data.columns)
        .enter()
        .append('th')
        .attr('style', headerStyle)
        .text(function (d) {
          return d;
        });

      // get compare info from form_data
      const compareMetricLefts = [];
      const compareMetricRights = [];
      const compareExprs = [];
      const compareValues = [];
      for (let i = 1; i < 10; i++) {
        if (fd['compare_expr_' + i] !== '') {
          compareMetricLefts.push(col(fd['compare_metricLeft_' + i]));
          compareMetricRights.push(col(fd['compare_metricRight_' + i]));
          compareExprs.push(fd['compare_expr_' + i]);
          compareValues.push(fd['compare_value_' + i]);
        }
      }

      table.append('tbody')
        .selectAll('tr')
        .data(data.records)
        .enter()
        .append('tr')
        .selectAll('td')
        .data((row) => data.columns.map((c) => {
          let val = row[c];
          if (c === 'timestamp') {
            val = timestampFormatter(val);
          }
          return {
            col: c,
            val,
            isMetric: metrics.indexOf(c) >= 0,
          };
        }))
        .enter()
        .append('td')
        /* .style('background-image', function (d) {
          if (d.isMetric) {
            const perc = Math.round((d.val / maxes[d.col]) * 100);
            return (
              `linear-gradient(to right, lightgrey, lightgrey ${perc}%, ` +
              `rgba(100,100,100,100) ${perc}%`
            );
          }
          return null;
        }) */
        .attr('style', function (d) {
          // add body style
          let bodyStyle = fd.bodyValue;

          // add column style
          for (let i = 1; i < 10; i++) {
            if (fd['colStyle_value_' + i] !== '') {
              if (d.col === fd['colStyle_metric_' + i]) {
                bodyStyle += fd['colStyle_value_' + i] + ';';
                break;
              }
            } else {
              break;
            }
          }

          // add condition style
          for (let i = 1; i < 10; i++) {
            if (fd['style_expr_' + i] !== '') {
              if (d.isMetric && d.col === fd['style_metric_' + i]) {
                let expr = fd['style_expr_' + i].replace(/x/g, d.val);
                // make '=' to '=='
                expr = expr.replace(/=/g, '==').replace(/>==/g, '>=').replace(/<==/g, '<=');
                // console.log(expr);
                if ((expr.indexOf('$.inArray') === -1 && eval(expr))
                  || (expr.indexOf('$.inArray') !== -1 && eval(expr) !== -1)) {
                  // console.log(fd['style_value_' + i]);
                  bodyStyle += fd['style_value_' + i] + ';';
                }
              }
            } else {
              break;
            }
          }

          // add two colums compare style
          for (let i = 0; i < compareExprs.length; i++) {
            if (d.isMetric && d.col === fd['compare_metricLeft_' + (i + 1)]) {
              const expr = compareExprs[i].replace('x', compareMetricLefts[i][0])
                         .replace('y', compareMetricRights[i][0]).replace(/=/g, '==')
                         .replace(/>==/g, '>=').replace(/<==/g, '<=');
              // console.log(expr);
              if (d.val === compareMetricLefts[i][0] && eval(expr)) {
                bodyStyle += compareValues[i];
              }
              // delete the first element
              compareMetricLefts[i].splice(0, 1);
              compareMetricRights[i].splice(0, 1);
              break;
            }
          }
          return bodyStyle;
        })
        .attr('title', (d) => {
          if (!isNaN(d.val)) {
            return fC(d.val);
          }
          return null;
        })
        .attr('data-sort', function (d) {
          return (d.isMetric) ? d.val : null;
        })
        // .on('click', function (d) {
        //   if (!d.isMetric && fd.table_filter) {
        //     const td = d3.select(this);
        //     if (td.classed('filtered')) {
        //       slice.removeFilter(d.col, [d.val]);
        //       d3.select(this).classed('filtered', false);
        //     } else {
        //       d3.select(this).classed('filtered', true);
        //       slice.addFilter(d.col, [d.val]);
        //     }
        //   }
        // })
        // .style('cursor', function (d) {
        //   return (!d.isMetric) ? 'pointer' : '';
        // })
        .on('click', function (d) {
          for (let i = 1; i <= 10; i++) {
            if (fd['navigate_expr_' + i] !== '') {
              if (d.isMetric && d.col === fd['navigate_metric_' + i]) {
                let expr = fd['navigate_expr_' + i].replace(/x/g, d.val);
                // make '=' to '=='
                expr = expr.replace(/=/g, '==').replace(/>==/g, '>=').replace(/<==/g, '<=');
                if (((expr.indexOf('$.inArray') === -1 && eval(expr))
                || (expr.indexOf('$.inArray') !== -1 && eval(expr) !== -1))) {
                  const type = fd['navigate_open_' + i];
                  const slc = JSON.parse(sliceUrl(fd['navigate_slice_' + i]));
                  let url = slc.url;
                  const title = slc.title;
                  if (url != null) {
                    const standlone = GetQueryString('standalone');
                    if (standlone === null) {
                      if (url.indexOf('standalone') !== -1) {
                        url = url.replace(/standalone=/, 'standalone=true');
                      } else {
                        url += '&standalone=true';
                      }
                    }
                    const groupby = fd.groupby;
                    const colArr = [];
                    for (let j = 0; j < groupby.length; j++) {
                      const ele = this.parentNode.childNodes[j];
                      colArr.push({
                        val: ele.title,
                        col: groupby[j],
                      });
                    }
                    url = addFilter(url, colArr);
                    const postData = { url: url, title: title, type: type };
                    window.parent.parent.postMessage(postData, '*');  // send message to navigate
                  }
                }
              }
            }
          }
        })
        .style('cursor', function (d) {
          return (d.isMetric) ? 'pointer' : '';
        })
        .html((d) => {
          let html = '';
          let icon = '';
          let color = 'black';
          if (d.isMetric) {
            html = slice.d3format(d.col, d.val);
          } else {
            html = d.val;
          }
          for (let i = 1; i < 10; i++) {
            if (fd['style_expr_' + i] !== '') {
              if (d.isMetric && d.col === fd['style_metric_' + i]) {
                let expr = fd['style_expr_' + i].replace(/x/g, d.val);
                // make '=' to '=='
                expr = expr.replace(/=/g, '==').replace(/>==/g, '>=').replace(/<==/g, '<=');
                if ((expr.indexOf('$.inArray') === -1 && eval(expr))
                  || (expr.indexOf('$.inArray') !== -1 && eval(expr) !== -1)) {
                  icon = fd['style_icon_' + i];
                }
              }
            } else {
              break;
            }
          }
          // set icon color
          if (icon === 'fa fa-arrow-up' || icon === 'fa fa-angle-double-up') {
            color = 'green;';
          } else if (icon === 'fa fa-arrow-down' || icon === 'fa fa-angle-double-down') {
            color = 'red;';
          }

          // set link style
          for (let i = 1; i < 10; i++) {
            if (fd['navigate_expr_' + i] !== '') {
              if (d.isMetric && d.col === fd['navigate_metric_' + i]) {
                let expr = fd['navigate_expr_' + i].replace(/x/g, d.val);
                // make '=' to '=='
                expr = expr.replace(/=/g, '==').replace(/>==/g, '>=').replace(/<==/g, '<=');
                if ((expr.indexOf('$.inArray') === -1 && eval(expr))
                  || (expr.indexOf('$.inArray') !== -1 && eval(expr) !== -1)) {
                  html = '<a href="#">' + html + '</a>';
                  break;
                }
              }
            } else {
              break;
            }
          }

          return html + '<i style="margin-left:20px;color:'
                      + color + '" class="' + icon + '" aria-hidden="true"></i>';
        });
      const height = slice.height();
      let paging = false;
      let pageLength;
      if (fd.page_length && fd.page_length > 0) {
        paging = true;
        pageLength = parseInt(fd.page_length, 10);
      }
      const datatable = container.find('.dataTable').DataTable({
        paging,
        pageLength,
        aaSorting: [],
        searching: fd.include_search,
        bInfo: false,
        scrollY: height + 'px',
        scrollCollapse: true,
        scrollX: true,
      });
      fixDataTableBodyHeight(
          container.find('.dataTables_wrapper'), height);
      // Sorting table by main column
      if (fd.metrics.length > 0) {
        const mainMetric = fd.metrics[0];
        datatable.column(data.columns.indexOf(mainMetric)).order('desc').draw();
      }
      slice.done(json);
      container.parents('.widget').find('.tooltip').remove();
    }
    $.getJSON(slice.jsonEndpoint(), onSuccess).fail(onError);
  }

  return {
    render: refresh,
    resize() {},
  };
}

module.exports = tableVis;
