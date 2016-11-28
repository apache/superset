/* eslint camelcase: 0 */
const d3 = require('d3');
const $ = require('jquery');

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

export function toggleCheckbox(apiUrlPrefix, selector) {
  const apiUrl = apiUrlPrefix + $(selector)[0].checked;
  $.get(apiUrl).fail(function (xhr) {
    const resp = xhr.responseJSON;
    if (resp && resp.message) {
      showApiMessage(resp);
    }
  });
}

/**
 * Fix the height of the table body of a DataTable with scrollY set
 */
export const fixDataTableBodyHeight = function ($tableDom, height) {
  const headHeight = $tableDom.find('.dataTables_scrollHead').height();
  $tableDom.find('.dataTables_scrollBody').css('max-height', height - headHeight);
};

export function d3format(format, number) {
  const formatters = {};
  // Formats a number and memoizes formatters to be reused
  format = format || '.3s';
  if (!(format in formatters)) {
    formatters[format] = d3.format(format);
  }
  return formatters[format](number);
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
  clearFilter: () => {},
  removeFilter: () => {},
  filters: {},
};

export function formatSelectOptionsForRange(start, end) {
  // outputs array of arrays
  // formatSelectOptionsForRange(1, 5)
  // returns [[1,1], [2,2], [3,3], [4,4], [5,5]]
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push([i.toString(), i.toString()]);
  }
  return options;
}

export function formatSelectOptions(options) {
  return options.map((opt) =>
     [opt.toString(), opt.toString()]
  );
}

export function slugify(string) {
  // slugify('My Neat Label! '); returns 'my-neat-label'
  return string
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[\s\W-]+/g, '-') // replace spaces, non-word chars, w/ a single dash (-)
          .replace(/-$/, ''); // remove last floating dash
}

function formatFilters(filters) {
  // outputs an object of url params of filters
  // prefix can be 'flt' or 'having'
  const params = {};
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    params[`${filter.prefix}_col_${i + 1}`] = filter.col;
    params[`${filter.prefix}_op_${i + 1}`] = filter.op;
    params[`${filter.prefix}_eq_${i + 1}`] = filter.value;
  }
  return params;
}

export function getParamObject(form_data, datasource_type) {
  const data = {
    // V2 tag temporarily for updating url
    // Todo: remove after launch
    V2: true,
    datasource_id: form_data.datasource,
    datasource_type,
  };
  Object.keys(form_data).forEach((field) => {
    // filter out null fields
    if (form_data[field] !== null && field !== 'datasource') {
      data[field] = form_data[field];
    }
  });
  const filterParams = formatFilters(form_data.filters);
  Object.assign(data, filterParams);
  return data;
}
