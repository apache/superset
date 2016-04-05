// Javascript for the explorer page
// Init explorer view -> load vis dependencies -> read data (from dynamic html) -> render slice
// nb: to add a new vis, you must also add a Python fn in viz.py
//
// js
var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/caravel.js');
var showModal = require('./modules/utils.js').showModal;

require('jquery-ui');
$.widget.bridge('uitooltip', $.ui.tooltip); // Shutting down jq-ui tooltips
require('bootstrap');

require('./caravel-select2.js');

require('../node_modules/bootstrap-toggle/js/bootstrap-toggle.min.js');

// css
require('../vendor/pygments.css');
require('../node_modules/bootstrap-toggle/css/bootstrap-toggle.min.css');

var slice;

function prepForm() {
  var i = 1;
  // Assigning the right id to form elements in filters
  $("#filters > div").each(function () {
    $(this).attr("id", function () {
        return "flt_" + i;
      });
    $(this).find("#flt_col_0")
      .attr("id", function () {
        return "flt_col_" + i;
      })
      .attr("name", function () {
        return "flt_col_" + i;
      });
    $(this).find("#flt_op_0")
      .attr("id", function () {
        return "flt_op_" + i;
      })
      .attr("name", function () {
        return "flt_op_" + i;
      });
    $(this).find("#flt_eq_0")
      .attr("id", function () {
        return "flt_eq_" + i;
      })
      .attr("name", function () {
        return "flt_eq_" + i;
      });
    i++;
  });
}

function query(force, pushState) {
  if (force === undefined) {
    force = false;
  }
  if (pushState !== false) {
    history.pushState({}, document.title, slice.querystring());
  }
  $('.query-and-save button').attr('disabled', 'disabled');
  $('.btn-group.results span,a').attr('disabled', 'disabled');
  $('div.alert').remove();
  $('#is_cached').hide();
  prepForm();
  slice.render(force);
}

function initExploreView() {

  function get_collapsed_fieldsets() {
    var collapsed_fieldsets = $("#collapsed_fieldsets").val();

    if (collapsed_fieldsets !== undefined && collapsed_fieldsets !== "") {
      collapsed_fieldsets = collapsed_fieldsets.split('||');
    } else {
      collapsed_fieldsets = [];
    }
    return collapsed_fieldsets;
  }

  function toggle_fieldset(legend, animation) {
    var parent = legend.parent();
    var fieldset = parent.find(".legend_label").text();
    var collapsed_fieldsets = get_collapsed_fieldsets();
    var index;

    if (parent.hasClass("collapsed")) {
      if (animation) {
        parent.find(".panel-body").slideDown();
      } else {
        parent.find(".panel-body").show();
      }
      parent.removeClass("collapsed");
      parent.find("span.collapser").text("[-]");

      // removing from array, js is overcomplicated
      index = collapsed_fieldsets.indexOf(fieldset);
      if (index !== -1) {
        collapsed_fieldsets.splice(index, 1);
      }
    } else { // not collapsed
      if (animation) {
        parent.find(".panel-body").slideUp();
      } else {
        parent.find(".panel-body").hide();
      }

      parent.addClass("collapsed");
      parent.find("span.collapser").text("[+]");
      index = collapsed_fieldsets.indexOf(fieldset);
      if (index === -1 && fieldset !== "" && fieldset !== undefined) {
        collapsed_fieldsets.push(fieldset);
      }
    }

    $("#collapsed_fieldsets").val(collapsed_fieldsets.join("||"));
  }

  px.initFavStars();

  $('form .panel-heading').click(function () {
    toggle_fieldset($(this), true);
    $(this).css('cursor', 'pointer');
  });

  function copyURLToClipboard(url) {
    var textArea = document.createElement("textarea");
    textArea.style.position = 'fixed';
    textArea.style.left = '-1000px';
    textArea.value = url;

    document.body.appendChild(textArea);
    textArea.select();

    try {
      var successful = document.execCommand('copy');
      if (!successful) {
        throw new Error("Not successful");
      }
    } catch (err) {
      window.alert("Sorry, your browser does not support copying. Use Ctrl / Cmd + C!");
    }
    document.body.removeChild(textArea);
    return successful;
  }

  $('#shortner').click(function () {
    $.ajax({
      type: "POST",
      url: '/r/shortner/',
      data: {
        data: '/' + window.location.pathname + slice.querystring()
      },
      success: function (data) {
        var close = '<a style="cursor: pointer;"><i class="fa fa-close" id="close_shortner"></i></a>';
        var copy = '<a style="cursor: pointer;"><i class="fa fa-clipboard" title="Copy to clipboard" id="copy_url"></i></a>';
        var spaces = '&nbsp;&nbsp;&nbsp;';
        var popover = data + spaces + copy + spaces + close;

        var $shortner = $('#shortner')
          .popover({
            content: popover,
            placement: 'left',
            html: true,
            trigger: 'manual'
          })
          .popover('show');

        $('#copy_url').tooltip().click(function () {
          var success = copyURLToClipboard(data);
          if (success) {
            $(this).attr("data-original-title", "Copied!").tooltip('fixTitle').tooltip('show');
            window.setTimeout(destroyPopover, 1200);
          }
        });
        $('#close_shortner').click(destroyPopover);

        function destroyPopover() {
          $shortner.popover('destroy');
        }
      },
      error: function (error) {
        showModal({
          title: "Error",
          body: "Sorry, an error occurred during this operation:<br/>" + error
        });
        console.warn("Short URL error", error);
      }
    });
  });

  $("#viz_type").change(function () {
    $("#query").submit();
  });

  $("#datasource_id").change(function () {
    var url = $(this).find('option:selected').attr('url');
    window.location = url;
  });

  var collapsed_fieldsets = get_collapsed_fieldsets();
  for (var i = 0; i < collapsed_fieldsets.length; i++) {
    toggle_fieldset($('legend:contains("' + collapsed_fieldsets[i] + '")'), false);
  }

  $(".select2").select2({
    dropdownAutoWidth: true
  });
  $(".select2Sortable").select2({
    dropdownAutoWidth: true
  });
  $(".select2Sortable").select2Sortable({
    bindOrder: 'sortableStop'
  });
  $("form").show();
  $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
  $(".ui-helper-hidden-accessible").remove(); // jQuery-ui 1.11+ creates a div for every tooltip

  function set_filters() {
    for (var i = 1; i < 10; i++) {
      var eq = px.getParam("flt_eq_" + i);
      if (eq !== '') {
        add_filter(i);
      }
    }
  }
  set_filters();

  function add_filter(i) {
    var cp = $("#flt0").clone();
    $(cp).appendTo("#filters");
    $(cp).show();
    if (i !== undefined) {
      $(cp).find("#flt_eq_0").val(px.getParam("flt_eq_" + i));
      $(cp).find("#flt_op_0").val(px.getParam("flt_op_" + i));
      $(cp).find("#flt_col_0").val(px.getParam("flt_col_" + i));
    }
    $(cp).find('select').select2();
    $(cp).find('.remove').click(function () {
      $(this).parent().parent().remove();
    });
  }

  $(window).bind("popstate", function (event) {
    // Browser back button
    var returnLocation = history.location || document.location;
    // Could do something more lightweight here, but we're not optimizing
    // for the use of the back button anyways
    returnLocation.reload();
  });

  $("#plus").click(add_filter);
  $("#btn_save").click(function () {
    var slice_name = prompt("Name your slice!");
    if (slice_name !== "" && slice_name !== null) {
      $("#slice_name").val(slice_name);
      prepForm();
      $("#action").val("save");
      $("#query").submit();
    }
  });
  $("#btn_overwrite").click(function () {
    var flag = confirm("Overwrite slice [" + $("#slice_name").val() + "] !?");
    if (flag) {
      $("#action").val("overwrite");
      prepForm();
      $("#query").submit();
    }
  });

  $(".query").click(function () {
    query(true);
  });

  function create_choices(term, data) {
    var filtered = $(data).filter(function () {
      return this.text.localeCompare(term) === 0;
    });
    if (filtered.length === 0) {
      return {
        id: term,
        text: term
      };
    }
  }

  function initSelectionToValue(element, callback) {
    callback({
      id: element.val(),
      text: element.val()
    });
  }

  $(".select2_freeform").each(function () {
    var parent = $(this).parent();
    var name = $(this).attr('name');
    var l = [];
    var selected = '';
    for (var i = 0; i < this.options.length; i++) {
      l.push({
        id: this.options[i].value,
        text: this.options[i].text
      });
      if (this.options[i].selected) {
        selected = this.options[i].value;
      }
    }
    parent.append(
      '<input class="' + $(this).attr('class') + '" name="' + name + '" type="text" value="' + selected + '">'
    );
    $("input[name='" + name + "']").select2({
      createSearchChoice: create_choices,
      initSelection: initSelectionToValue,
      dropdownAutoWidth: true,
      multiple: false,
      data: l
    });
    $(this).remove();
  });
}

$(document).ready(function () {
  initExploreView();

  // Dynamically register this visualization
  var visType = window.viz_type.value;
  px.registerViz(visType);

  var data = $('.slice').data('slice');
  slice = px.Slice(data);

  //
  $('.slice').data('slice', slice);

  // call vis render method, which issues ajax
  query(false, false);

  // make checkbox inputs display as toggles
  $(':checkbox')
    .addClass('pull-right')
    .attr("data-onstyle", "default")
    .bootstrapToggle({
      size: 'mini'
    });

  $('div.toggle').addClass('pull-right');
  slice.bindResizeToWindowResize();
});
