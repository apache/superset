var px = (function() {

  var visualizations = [];

  function registerWidget(name, initializer) {
    visualizations[name] = initializer;
  }

  function makeNullWidget() {
    return {
      render: function() {},
      resize: function() {},
    };
  }

  function initializeWidget(data) {
    var name = data['viz_name'];
    var initializer = visualizations[name];
    var widget = initializer ? initializer(data) : makeNullWidget();
    return widget;
  }

function initializeDatasourceView() {
  function getParam(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  $(".select2").select2();
  $("form").show();
  $('[data-toggle="tooltip"]').tooltip({container: 'body'});

  function set_filters(){
    for (var i = 1; i < 10; i++){
      var eq = getParam("flt_eq_" + i);
      if (eq != ''){
        add_filter(i);
      }
    }
  }
  set_filters();

  function add_filter(i) {
    cp = $("#flt0").clone();
    $(cp).appendTo("#filters");
    $(cp).show();
    if (i != undefined){
      $(cp).find("#flt_eq_0").val(getParam("flt_eq_" + i));
      $(cp).find("#flt_op_0").val(getParam("flt_op_" + i));
      $(cp).find("#flt_col_0").val(getParam("flt_col_" + i));
    }
    $(cp).find('select').select2();
    $(cp).find('.remove').click(function() {
      $(this).parent().parent().remove();
    });
  }

  function druidify(){
    var i = 1;
    // Assigning the right id to form elements in filters
    $("#filters > div").each(function() {
      $(this).attr("id", function() {return "flt_" + i;})
      $(this).find("#flt_col_0")
        .attr("id", function() {return "flt_col_" + i;})
        .attr("name", function() {return "flt_col_" + i;});
      $(this).find("#flt_op_0")
        .attr("id", function() {return "flt_op_" + i;})
        .attr("name", function() {return "flt_op_" + i;});
      $(this).find("#flt_eq_0")
        .attr("id", function() {return "flt_eq_" + i;})
        .attr("name", function() {return "flt_eq_" + i;});
      i++;
    });
    $("#query").submit();
  }

  $("#plus").click(add_filter);
  $("#save").click(function () {
    var slice_name = prompt("Name your slice!");
    if (slice_name != "" && slice_name != null) {
      $("#slice_name").val(slice_name);
      $("#action").val("save");
      druidify();
    }
  })
  add_filter();
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
  $(".select2_free_since").select2({
    createSearchChoice: create_choices,
    initSelection: initSelectionToValue,
    multiple: false,
    data: list_data([
        '1 hour ago',
        '12 hours ago',
        '1 day ago',
        '7 days ago',
        '28 days ago',
        '90 days ago',
        '1 year ago'])
  });
  $(".select2_free_until").select2({
    createSearchChoice: create_choices,
    initSelection: initSelectionToValue,
    multiple: false,
    data: list_data([
        'now',
        '1 day ago',
        '7 days ago',
        '28 days ago',
        '90 days ago',
        '1 year ago'])
  });
  $(".select2_free_granularity").select2({
    createSearchChoice: create_choices,
    initSelection: initSelectionToValue,
    multiple: false,
    data: list_data([
        'all',
        '5 seconds',
        '30 seconds',
        '1 minute',
        '5 minutes',
        '1 hour',
        '6 hour',
        '1 day',
        '7 days'])
  });
}

function initializeDashboardView(dashboard_id) {
  var gridster = $(".gridster ul").gridster({
    widget_margins: [5, 5],
    widget_base_dimensions: [100, 100],
    draggable: {
      handle: '.drag',
    },
    resize: {
      enabled: true,
      stop: function(e, ui, element) {
        var widget = $(element).data('widget');
        widget.resize();
      }
    },
    serialize_params: function(_w, wgd) {
      return {
        slice_id: $(_w).attr('slice_id'),
        col: wgd.col,
        row: wgd.row,
        size_x: wgd.size_x,
        size_y: wgd.size_y
      };
    },
  }).data('gridster');
  $("div.gridster").css('visibility', 'visible');
  $("#savedash").click(function() {
    var data = {
        positions: gridster.serialize(),
        css: $("#dash_css").val()
    };
    $.ajax({
      type: "POST",
      url: '/panoramix/save_dash/' + dashboard_id + '/',
      data: {'data': JSON.stringify(data)},
      success: function() {alert("Saved!")},
      error: function() {alert("Error :(")},
    });
  });
  $("a.closewidget").click(function() {
    var li = $(this).parents("li");
    gridster.remove_widget(li);
  });
  $("table.widget_header").mouseover(function() {
    $(this).find("td.icons nobr").show();
  });
  $("table.widget_header").mouseout(function() {
    $(this).find("td.icons nobr").hide();
  });
  $("#dash_css").on("keyup", function(){
    css = $(this).val();
    $("#user_style").html(css);
  });
}

  // Export public functions
  return {
    registerWidget: registerWidget,
    initializeWidget: initializeWidget,
    initializeDatasourceView: initializeDatasourceView,
    initializeDashboardView: initializeDashboardView,
  }

})();

