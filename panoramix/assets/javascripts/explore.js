// Javascript for the explorer page
// Init explorer view -> load vis dependencies -> read data (from dynamic html) -> render slice
// nb: to add a new vis, you must also add a Python fn in viz.py
//
// js
var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/panoramix.js');
var d3 = require('d3');

require('jquery-ui');
$.widget.bridge('uitooltip', $.ui.tooltip); // Shutting down jq-ui tooltips
require('bootstrap');

require('select2');
require('../node_modules/bootstrap-toggle/js/bootstrap-toggle.min.js');
require('../vendor/select2.sortable.js');

// css
require('../vendor/pygments.css');
require('../node_modules/bootstrap-toggle/css/bootstrap-toggle.min.css');

var slice;

function initExploreView() {

  function druidify(){
    $('div.alert').remove();
    history.pushState({}, document.title, slice.querystring());
    px.renderSlice();
  }

  function get_collapsed_fieldsets(){
    var collapsed_fieldsets = $("#collapsed_fieldsets").val();

    if (collapsed_fieldsets != undefined && collapsed_fieldsets != "") {
      collapsed_fieldsets = collapsed_fieldsets.split('||');
    }
    else {
      collapsed_fieldsets = [];
    }
    return collapsed_fieldsets;
  }

  function toggle_fieldset(legend, animation) {
    var parent = legend.parent();
    var fieldset = parent.find(".legend_label").text();
    var collapsed_fieldsets = get_collapsed_fieldsets();

    if (!parent.hasClass("collapsed")){
      if (animation) {
        parent.find(".fieldset_content").slideUp();
      }
      else {
        parent.find(".fieldset_content").hide();
      }

      parent.addClass("collapsed");
      parent.find("span.collapser").text("[+]");
      var index = collapsed_fieldsets.indexOf(fieldset);
      if (index === -1 && fieldset !== "" && fieldset !== undefined) {
        collapsed_fieldsets.push(fieldset);
      }
    } else {
      if (animation) {
        parent.find(".fieldset_content").slideDown();
      }
      else {
        parent.find(".fieldset_content").show();
      }
      parent.removeClass("collapsed");
      parent.find("span.collapser").text("[-]");

      // removing from array, js is overcomplicated
      var index = collapsed_fieldsets.indexOf(fieldset);
      if (index !== -1) {
        collapsed_fieldsets.splice(index, 1);
      }
    }
    $("#collapsed_fieldsets").val(collapsed_fieldsets.join("||"));
  }

  $('legend').click(function () {
    toggle_fieldset($(this), true);
  });

  $('#shortner').click(function () {
    $.ajax({
      type: "POST",
      url: '/r/shortner/',
      data: {'data': '/' + window.location.pathname + slice.querystring()},
      success: function(data) {
        data += '&nbsp;&nbsp;&nbsp;<a style="cursor: pointer;"><i class="fa fa-close" id="close_shortner"></a>';
        $('#shortner').popover({content: data, placement: 'left', html: true, trigger: 'manual'});
        $('#shortner').popover('show');
        $('#close_shortner').click(function(){
          $('#shortner').popover('destroy');
        });
      },
      error: function() {alert("Error :(");},
    });
  });
  $("#viz_type").change(function() {$("#query").submit();});

  var collapsed_fieldsets = get_collapsed_fieldsets();
  for(var i=0; i < collapsed_fieldsets.length; i++){
    toggle_fieldset($('legend:contains("' + collapsed_fieldsets[i] + '")'), false);
  }

  $(".select2").select2({dropdownAutoWidth : true});
  $(".select2Sortable").select2({dropdownAutoWidth : true});
  $(".select2Sortable").select2Sortable({bindOrder: 'sortableStop'});
  $("form").show();
  $('[data-toggle="tooltip"]').tooltip({container: 'body'});
  $(".ui-helper-hidden-accessible").remove(); // jQuery-ui 1.11+ creates a div for every tooltip

  function set_filters(){
    for (var i = 1; i < 10; i++){
      var eq = px.getParam("flt_eq_" + i);
      if (eq != ''){
        add_filter(i);
      }
    }
  }
  set_filters();

  function add_filter(i) {
    var cp = $("#flt0").clone();
    $(cp).appendTo("#filters");
    $(cp).show();
    if (i != undefined){
      $(cp).find("#flt_eq_0").val(px.getParam("flt_eq_" + i));
      $(cp).find("#flt_op_0").val(px.getParam("flt_op_" + i));
      $(cp).find("#flt_col_0").val(px.getParam("flt_col_" + i));
    }
    $(cp).find('select').select2();
    $(cp).find('.remove').click(function() {
      $(this).parent().parent().remove();
    });
  }

  $(window).bind("popstate", function(event) {
    // Browser back button
    var returnLocation = history.location || document.location;
    // Could do something more lightweight here, but we're not optimizing
    // for the use of the back button anyways
    returnLocation.reload();
  });


  $("#plus").click(add_filter);
  $("#btn_save").click(function () {
    var slice_name = prompt("Name your slice!");
    if (slice_name != "" && slice_name != null) {
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

  $(".druidify").click(druidify);

  function create_choices(term, data) {
    var filtered = $(data).filter(function() {
      return this.text.localeCompare(term) === 0;
    });
    if (filtered.length === 0) {
      return {id: term, text: term};
    }
  }
  function initSelectionToValue(element, callback) {
    callback({id: element.val(), text: element.val()});
  }
  function list_data(arr) {
    var obj = [];
    for (var i=0; i<arr.length; i++){
      obj.push({id: arr[i], text: arr[i]});
    }
    return obj;
  }
  $(".select2_freeform").each(function(){
    var parent = $(this).parent();
    var name = $(this).attr('name');
    var l = [];
    var selected = '';
    for(var i=0; i<this.options.length; i++) {
      l.push({id: this.options[i].value, text: this.options[i].text});
      if(this.options[i].selected){
        selected = this.options[i].value;
      }
    }
    var obj = parent.append(
      '<input class="' + $(this).attr('class') + '" name="'+ name +'" type="text" value="' + selected + '">'
    );
    $("input[name='" + name  +"']").select2({
      createSearchChoice: create_choices,
      initSelection: initSelectionToValue,
      dropdownAutoWidth : true,
      multiple: false,
      data: l,
    });
    $(this).remove();
  });
}

$(document).ready(function() {
  initExploreView();

  // Dynamically register this visualization
  var visType = window.viz_type.value;
  px.registerViz(visType);


  var data  = $('.slice').data('slice');
  slice = px.Slice(data);

  //
  $('.slice').data('slice', slice);

  // call vis render method, which issues ajax
  px.renderSlice();

  // make checkbox inputs display as toggles
  $(':checkbox')
  .addClass('pull-right')
  .attr("data-onstyle", "default")
  .bootstrapToggle({size: 'mini'});

  $('div.toggle').addClass('pull-right');
});
