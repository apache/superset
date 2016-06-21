var $ = require('jquery');
var d3 = require('d3');

/*
    Utility function that takes a d3 svg:text selection and a max width, and splits the
    text's text across multiple tspan lines such that any given line does not exceed max width

    If text does not span multiple lines AND adjustedY is passed, will set the text to the passed val
 */
function wrapSvgText(text, width, adjustedY) {
  var lineHeight = 1; // ems

  text.each(function () {
    var text = d3.select(this),
        words = text.text().split(/\s+/),
        word,
        line = [],
        lineNumber = 0,
        x = text.attr("x"),
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null)
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", dy + "em");

    var didWrap = false;

    for (var i = 0; i < words.length; i++) {
      word = words[i];
      line.push(word);
      tspan.text(line.join(" "));

      if (tspan.node().getComputedTextLength() > width) {
        line.pop(); // remove word that pushes over the limit
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);

        didWrap = true;
      }
    }
    if (!didWrap && typeof adjustedY !== "undefined") {
      tspan.attr("y", adjustedY);
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
function showModal(options) {
  options.modalSelector = options.modalSelector || ".misc-modal";
  options.titleSelector = options.titleSelector || ".misc-modal .modal-title";
  options.bodySelector = options.bodySelector || ".misc-modal .modal-body";

  $(options.titleSelector).html(options.title || "");
  $(options.bodySelector).html(options.body || "");
  $(options.modalSelector).modal("show");
}

var showApiMessage = function (resp) {
  var template = '<div class="alert"> ' +
      '<button type="button" class="close" ' +
      'data-dismiss="alert">×</button> </div>';

  var severity = resp.severity || 'info';
  $(template)
      .addClass('alert-' + severity)
      .append(resp.message)
      .appendTo($('#alert-container'));
};

var toggleCheckbox = function (apiUrlPrefix, selector) {
  var apiUrl = apiUrlPrefix + $(selector)[0].checked;
  $.get(apiUrl).fail(function (xhr, textStatus, errorThrown) {
    var resp = xhr.responseJSON;
    if (resp && resp.message) {
      showApiMessage(resp);
    }
  });
};

/**
 * Fix the height of the table body of a DataTable with scrollY set
 */
var fixDataTableBodyHeight = function ($tableDom, height) {
  var headHeight = $tableDom.find('.dataTables_scrollHead').height();
  $tableDom.find('.dataTables_scrollBody')
      .css('max-height', height - headHeight);
};

module.exports = {
  wrapSvgText: wrapSvgText,
  showModal: showModal,
  toggleCheckbox: toggleCheckbox,
  fixDataTableBodyHeight: fixDataTableBodyHeight
};
