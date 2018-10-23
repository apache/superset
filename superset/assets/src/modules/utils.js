/* eslint camelcase: 0 */
import d3 from 'd3';
import $ from 'jquery';
import { SupersetClient } from '@superset-ui/core';
import { formatDate, UTC } from './dates';
import { COMMON_ERR_MESSAGES } from '../utils/common';
import { t } from '../locales';

const siFormatter = d3.format('.3s');

export function defaultNumberFormatter(n) {
  let si = siFormatter(n);
  // Removing trailing `.00` if any
  if (si.slice(-1) < 'A') {
    si = parseFloat(si).toString();
  }
  return si;
}

export function d3FormatPreset(format) {
  // like d3.format, but with support for presets like 'smart_date'
  if (format === 'smart_date') {
    return formatDate;
  }
  if (format) {
    return d3.format(format);
  }
  return defaultNumberFormatter;
}
export const d3TimeFormatPreset = function (format) {
  const effFormat = format || 'smart_date';
  if (effFormat === 'smart_date') {
    return formatDate;
  }
  const f = d3.time.format(effFormat);
  return function (dttm) {
    const d = UTC(new Date(dttm));
    return f(d);
  };
};

/*
  Utility function that takes a d3 svg:text selection and a max width, and splits the
  text's text across multiple tspan lines such that any given line does not exceed max width

  If text does not span multiple lines AND adjustedY is passed,
  will set the text to the passed val
*/
export function wrapSvgText(text, width, adjustedY) {
  const lineHeight = 1;
  // ems
  text.each(function () {
    const d3Text = d3.select(this);
    const words = d3Text.text().split(/\s+/);
    let word;
    let line = [];
    let lineNumber = 0;
    const x = d3Text.attr('x');
    const y = d3Text.attr('y');
    const dy = parseFloat(d3Text.attr('dy'));
    let tspan =
      d3Text.text(null).append('tspan').attr('x', x)
            .attr('y', y)
            .attr('dy', dy + 'em');

    let didWrap = false;
    for (let i = 0; i < words.length; i++) {
      word = words[i];
      line.push(word);
      tspan.text(line.join(' '));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        // remove word that pushes over the limit
        tspan.text(line.join(' '));
        line = [word];
        tspan =
          d3Text.append('tspan').attr('x', x).attr('y', y)
                .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                .text(word);
        didWrap = true;
      }
    }
    if (!didWrap && typeof adjustedY !== 'undefined') {
      tspan.attr('y', adjustedY);
    }
  });
}

/**
 * Sets the body and title content of a modal, and shows it. Assumes HTML for modal exists and that
 * it handles closing (i.e., works with bootstrap)
 *
 * @param {object} options object of the form
 *  {
 *    title: {string},
 *    body: {string},
 *    modalSelector: {string, default: '.misc-modal' },
 *    titleSelector: {string, default: '.misc-modal .modal-title' },
 *    bodySelector:  {string, default: '.misc-modal .modal-body' },
 *   }
 */
export function showModal(options) {
  /* eslint no-param-reassign: 0 */
  options.modalSelector = options.modalSelector || '.misc-modal';
  options.titleSelector = options.titleSelector || '.misc-modal .modal-title';
  options.bodySelector = options.bodySelector || '.misc-modal .modal-body';
  $(options.titleSelector).html(options.title || '');
  $(options.bodySelector).html(options.body || '');
  $(options.modalSelector).modal('show');
}


function showApiMessage(resp) {
  const template =
    '<div class="alert"> ' +
    '<button type="button" class="close" ' +
    'data-dismiss="alert">\xD7</button> </div>';
  const severity = resp.severity || 'info';
  $(template).addClass('alert-' + severity)
             .append(resp.message)
             .appendTo($('#alert-container'));
}

export function getClientErrorObject(response) {
  // takes a Response object as input, attempts to read response as Json if possible,
  // and returns a Promise that resolves to a plain object with error key and text value.
  return new Promise((resolve) => {
    if (typeof response === 'string') {
      resolve({ error: response });
    } else if (response && response.constructor === Response && !response.bodyUsed) {
      // attempt to read the body as json, and fallback to text. we must clone the
      // response in order to fallback to .text() because Response is single-read
      response.clone().json().then((errorJson) => {
        let error = { ...response, ...errorJson };
        if (error.stack) {
          error = {
            ...error,
            error: t('Unexpected error: ') +
              (error.description || t('(no description, click to see stack trace)')),
            stacktrace: error.stack,
          };
        } else if (error.responseText && error.responseText.indexOf('CSRF') >= 0) {
          error = {
            ...error,
            error: COMMON_ERR_MESSAGES.SESSION_TIMED_OUT,
          };
        }
        resolve(error);
      }).catch(() => {
        // fall back to reading as text
        response.text().then((errorText) => {
          resolve({ ...response, error: errorText });
        });
      });
    } else {
      // fall back to Response.statusText or generic error of we cannot read the response
      resolve({ ...response, error: response.statusText || t('An error occurred') });
    }
  });

}

export function toggleCheckbox(apiUrlPrefix, selector) {
  SupersetClient.get({ endpoint: apiUrlPrefix + $(selector)[0].checked })
    .then(() => {})
    .catch(response =>
      getClientErrorObject(response)
        .then((parsedResp) => {
          if (parsedResp && parsedResp.message) {
            showApiMessage(parsedResp);
          }
        }),
      );
}

/**
 * Fix the height of the table body of a DataTable with scrollY set
 */
export const fixDataTableBodyHeight = function ($tableDom, height) {
  const headHeight = $tableDom.find('.dataTables_scrollHead').height();
  const filterHeight = $tableDom.find('.dataTables_filter').height() || 0;
  const pageLengthHeight = $tableDom.find('.dataTables_length').height() || 0;
  const paginationHeight = $tableDom.find('.dataTables_paginate').height() || 0;
  const controlsHeight = (pageLengthHeight > filterHeight) ? pageLengthHeight : filterHeight;
  $tableDom.find('.dataTables_scrollBody').css('max-height', height - headHeight - controlsHeight - paginationHeight);
};

export function d3format(format, number) {
  const formatters = {};
  // Formats a number and memoizes formatters to be reused
  format = format || '.3s';
  if (!(format in formatters)) {
    formatters[format] = d3.format(format);
  }
  try {
    return formatters[format](number);
  } catch (e) {
    return 'ERR';
  }
}

// Slice objects interact with their context through objects that implement
// this controllerInterface (dashboard, explore, standalone)
export const controllerInterface = {
  type: null,
  done: () => {},
  error: () => {},
  always: () => {},
  addFiler: () => {},
  setFilter: () => {},
  getFilters: () => false,
  removeFilter: () => {},
  filters: {},
};

export function formatSelectOptionsForRange(start, end) {
  // outputs array of arrays
  // formatSelectOptionsForRange(1, 5)
  // returns [[1,1], [2,2], [3,3], [4,4], [5,5]]
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push([i, i.toString()]);
  }
  return options;
}

export function formatSelectOptions(options) {
  return options.map(opt =>
     [opt, opt.toString()],
  );
}

export function getDatasourceParameter(datasourceId, datasourceType) {
  return `${datasourceId}__${datasourceType}`;
}

export function getParam(name) {
  /* eslint no-useless-escape: 0 */
  const formattedName = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + formattedName + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

export function mainMetric(savedMetrics) {
  // Using 'count' as default metric if it exists, otherwise using whatever one shows up first
  let metric;
  if (savedMetrics && savedMetrics.length > 0) {
    savedMetrics.forEach((m) => {
      if (m.metric_name === 'count') {
        metric = 'count';
      }
    });
    if (!metric) {
      metric = savedMetrics[0].metric_name;
    }
  }
  return metric;
}
