var color = function(){
  // Color related utility functions go in this object
  var bnbColors = [
    //rausch    hackb      kazan      babu      lima        beach     barol
    '#ff5a5f', '#7b0051', '#007A87', '#00d1c1', '#8ce071', '#ffb400', '#b4a76c',
    '#ff8083', '#cc0086', '#00a1b3', '#00ffeb', '#bbedab', '#ffd266', '#cbc29a',
    '#ff3339', '#ff1ab1', '#005c66', '#00b3a5', '#55d12e', '#b37e00', '#988b4e',
  ];
  var spectrums = {
    'fire': ['white', 'yellow', 'red', 'black'],
    'blue_white_yellow': ['#00d1c1', 'white', '#ffb400'],
    'white_black': ['white', 'black'],
    'black_white': ['black', 'white'],
  }
  var colorBnb = function() {
    // Color factory
    var seen = {};
    return function(s){
      if(seen[s] === undefined)
        seen[s] = Object.keys(seen).length;
      return this.bnbColors[seen[s] % this.bnbColors.length];
    };
  };
  colorScalerFactory = function (colors, data, accessor){
    // Returns a linear scaler our of an array of color
    if(!Array.isArray(colors))
      colors = spectrums[colors];
    if(data !== undefined)
      var ext = d3.extent(data, accessor);
    else
      var ext = [0,1];

    var points = [];
    var chunkSize = (ext[1] - ext[0]) / colors.length;
    $.each(colors, function(i, c){
      points.push(i * chunkSize)
    });
    return d3.scale.linear().domain(points).range(colors);
  }
  return {
    bnbColors: bnbColors,
    category21: colorBnb(),
    colorScalerFactory: colorScalerFactory,
  }
};

var px = (function() {

  var visualizations = {};
  var dashboard = undefined;

  function getParam(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function UTC(dttm){
    return v = new Date(dttm.getUTCFullYear(), dttm.getUTCMonth(), dttm.getUTCDate(),  dttm.getUTCHours(), dttm.getUTCMinutes(), dttm.getUTCSeconds());
  }
  var tickMultiFormat = d3.time.format.multi([
    [".%L", function(d) { return d.getMilliseconds(); }], // If there are millisections, show  only them
    [":%S", function(d) { return d.getSeconds(); }], // If there are seconds, show only them
    ["%a %b %d, %I:%M %p", function(d) { return d.getMinutes()!=0; }], // If there are non-zero minutes, show Date, Hour:Minute [AM/PM]
    ["%a %b %d, %I %p", function(d) { return d.getHours() != 0; }], // If there are hours that are multiples of 3, show date and AM/PM
    ["%a %b %d, %Y", function(d) { return d.getDate() != 1; }], // If not the first of the month, do "month day, year."
    ["%B %Y", function(d) { return d.getMonth() != 0 && d.getDate() == 1; }], // If the first of the month, do "month day, year."
    ["%Y", function(d) { return true; }] // fall back on month, year
  ]);
  function formatDate(dttm) {
    var d = UTC(new Date(dttm));
    //d = new Date(d.getTime() - 1 * 60 * 60 * 1000);
    return tickMultiFormat(d);
  }
  function timeFormatFactory(d3timeFormat) {
    var f = d3.time.format(d3timeFormat)
    return function(dttm){
      var d = UTC(new Date(dttm));
      return f(d);
    };
  }

  var Slice = function(data, dashboard){
    var timer;
    var token = $('#' + data.token);
    var container_id = data.token + '_con';
    var selector = '#' + container_id;
    var container = $(selector);
    var slice_id = data.slice_id;
    var name = data['viz_name'];
    var dttm = 0;
    var timer;
    var stopwatch = function () {
        dttm += 10;
        num = dttm / 1000;
        $('#timer').text(num.toFixed(2) + " sec");
    }
    var qrystr = '';
    var always = function(data) {
      //Private f, runs after done and error
      clearInterval(timer);
      $('#timer').removeClass('btn-warning');
    }
    slice = {
      data: data,
      container: container,
      container_id: container_id,
      selector: selector,
      querystring: function(){
        var parser = document.createElement('a');
        parser.href = data.json_endpoint;
        if (dashboard !== undefined){
          var flts = encodeURIComponent(JSON.stringify(dashboard.filters));
          qrystr = parser.search + "&extra_filters=" + flts;
        }
        else if ($('#query').length == 0){
          qrystr = parser.search;
        }
        else {
          qrystr = '?' + $('#query').serialize();
        }
        return qrystr;
      },
      jsonEndpoint: function() {
        var parser = document.createElement('a');
        parser.href = data.json_endpoint;
        var endpoint = parser.pathname + this.querystring() + "&json=true";
        return endpoint;
      },
      done: function (data) {
        clearInterval(timer);
        token.find("img.loading").hide()
        container.show();
        if(data !== undefined)
            $("#query_container").html(data.query);
        $('#timer').removeClass('btn-warning');
        $('#timer').addClass('btn-success');
        $('span.query').removeClass('disabled');
        $('#json').click(function(){window.location=data.json_endpoint});
        $('#standalone').click(function(){window.location=data.standalone_endpoint});
        $('#csv').click(function(){window.location=data.csv_endpoint});
        $('.btn-group.results span').removeAttr('disabled');
        always(data);
      },
      error: function (msg) {
        token.find("img.loading").hide();
        var err = '<div class="alert alert-danger">' + msg  + '</div>';
        container.html(err);
        container.show();
        $('span.query').removeClass('disabled');
        $('#timer').addClass('btn-danger');
        always(data);
      },
      width: function(){
        return token.width();
      },
      height: function(){
        var others = 0;
        var widget = container.parents('.widget');
        var slice_description = widget.find('.slice_description');
        if (slice_description.is(":visible"))
          others += widget.find('.slice_description').height() + 25;
        others += widget.find('.slice_header').height();
        return widget.height() - others;
      },
      render: function() {
        $('.btn-group.results span').attr('disabled','disabled');
        token.find("img.loading").show();
        container.hide();
        container.html('');
        dttm = 0;
        timer = setInterval(stopwatch, 10);
        $('#timer').removeClass('btn-danger btn-success');
        $('#timer').addClass('btn-warning');
        viz.render();
      },
      resize: function() {
        token.find("img.loading").show();
        container.hide();
        container.html('');
        viz.render();
        viz.resize();
      },
      addFilter: function(col, vals) {
        if(dashboard !== undefined)
          dashboard.addFilter(slice_id, col, vals);
      },
      clearFilter: function() {
        if(dashboard !== undefined)
          delete dashboard.clearFilter(slice_id);
      },
    };
    var viz = visualizations[data.form_data.viz_type](slice);
    slice['viz'] = viz;
    return slice;
  }

  var Dashboard = function(id){
    var dash = {
      slices: [],
      filters: {},
      id: id,
      addFilter: function(slice_id, filters) {
        this.filters[slice_id] = filters;
        this.refreshExcept(slice_id);
      },
      readFilters: function() {
        // Returns a list of human readable active filters
        return JSON.stringify(this.filters, null, 4);
      },
      refreshExcept: function(slice_id) {
        this.slices.forEach(function(slice){
          if(slice.data.slice_id != slice_id){
            slice.render();
          }
        });
      },
      clearFilter: function(slice_id) {
        delete this.filters[slice_id];
        this.refreshExcept(slice_id);
      },
      getSlice: function(slice_id) {
        for(var i=0; i<this.slices.length; i++){
          if (this.slices[i].data.slice_id == slice_id)
            return this.slices[i];
        }
      }
    }
    $('.dashboard li.widget').each(function() {
      var data = $(this).data('slice');
      var slice = Slice(data, dash);
      $(this).find('a.refresh').click(function(){
        slice.render();
      });
      dash.slices.push(slice);
      slice.render();
    });
    dashboard = dash;
    return dash;
  }

  function registerViz(name, initViz) {
    visualizations[name] = initViz;
  }
    function prepForm(){
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
    }
    function renderSlice(){
      prepForm();
      slice.render();
    }
    function druidify(){
      $('div.alert').remove();
      history.pushState({}, document.title, slice.querystring());
      renderSlice();
    }

  function initExploreView() {

    function get_collapsed_fieldsets(){
        collapsed_fieldsets = $("#collapsed_fieldsets").val();
        if (collapsed_fieldsets != undefined && collapsed_fieldsets != "")
          collapsed_fieldsets = collapsed_fieldsets.split('||');
        else
          collapsed_fieldsets = [];
        return collapsed_fieldsets;
    }

    function toggle_fieldset(legend, animation) {
        var parent = legend.parent();
        fieldset = parent.find(".legend_label").text();
        collapsed_fieldsets = get_collapsed_fieldsets();

        if (!parent.hasClass("collapsed")){
          if (animation)
            parent.find(".fieldset_content").slideUp();
          else
            parent.find(".fieldset_content").hide();

          parent.addClass("collapsed");
          parent.find("span.collapser").text("[+]");
          var index = collapsed_fieldsets.indexOf(fieldset);
          if (index === -1 && fieldset !== "" && fieldset !== undefined) {
            collapsed_fieldsets.push(fieldset);
          }
        } else {
          if (animation)
            parent.find(".fieldset_content").slideDown();
          else
            parent.find(".fieldset_content").show();
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
    collapsed_fieldsets = get_collapsed_fieldsets();
    for(var i=0; i < collapsed_fieldsets.length; i++){
      toggle_fieldset($('legend:contains("' + collapsed_fieldsets[i] + '")'), false);
    }

    $(".select2").select2({dropdownAutoWidth : true});
    $(".select2Sortable").select2({dropdownAutoWidth : true});
    $(".select2Sortable").select2Sortable({bindOrder: 'sortableStop'});
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
    $(".select2_freeform").each(function(){
      parent = $(this).parent();
      var name = $(this).attr('name');
      var l = [];
      var selected = '';
      for(var i=0; i<this.options.length; i++) {
          l.push({id: this.options[i].value, text: this.options[i].text});
          if(this.options[i].selected){
              selected = this.options[i].value;
          }
      }
      obj = parent.append(
          '<input class="' + $(this).attr('class') + '" name="'+ name +'" type="text" value="' + selected + '">');
      $("input[name='" + name  +"']")
        .select2({
          createSearchChoice: create_choices,
          initSelection: initSelectionToValue,
          dropdownAutoWidth : true,
          multiple: false,
          data: l,
        });
      $(this).remove();
    });
  }

  function initSqlEditorView() {
    var editor = ace.edit("sql");
    editor.$blockScrolling = Infinity

    var textarea = $('#sql').hide();
    editor.setTheme("ace/theme/crimson_editor");
    editor.setOptions({
        minLines: 16,
        maxLines: Infinity,
    });
    editor.getSession().setMode("ace/mode/sql");
    editor.focus();
    $("select").select2({dropdownAutoWidth : true});
    function showTableMetadata() {
      $(".metadata").load('/panoramix/table/' + $("#dbtable").val()  + '/');
    }
    $("#dbtable").on("change", showTableMetadata);
    showTableMetadata();
    $("#create_view").click(function(){alert("Not implemented");});
    $(".sqlcontent").show();
    $("#select_star").click(function(){
      $.ajax('/panoramix/select_star/' + $("#dbtable").val()  + '/')
        .done(function(msg){
          editor.setValue(msg);
        });
    });
    editor.setValue(getParam('sql'));
    $(window).bind("popstate", function(event) {
      // Browser back button
      var returnLocation = history.location || document.location;
      // Could do something more lightweight here, but we're not optimizing
      // for the use of the back button anyways
      editor.setValue(getParam('sql'));
      $("#run").click();
    });
    $("#run").click(function() {
      $('#results').hide(0);
      $('#loading').show(0);
      history.pushState({}, document.title, '?sql=' + encodeURIComponent(editor.getValue()));
      $.ajax({
        type: "POST",
        url: '/panoramix/runsql/',
        data: {
          'data': JSON.stringify({
          'database_id': $('#database_id').val(),
          'sql': editor.getSession().getValue(),
        })},
        success: function(data) {
          $('#loading').hide(0);
          $('#results').show(0);
          $('#results').html(data);

          var datatable = $('table.sql_results').DataTable({
            paging: false,
            searching: true,
            aaSorting: [],
          });
        },
        error: function(err, err2) {
          $('#loading').hide(0);
          $('#results').show(0);
          $('#results').html(err.responseText);
        },
      });
    });
  }

  function initDashboardView() {
    var gridster = $(".gridster ul").gridster({
      widget_margins: [5, 5],
      widget_base_dimensions: [100, 100],
      draggable: {
        handle: '.drag',
      },
      resize: {
        enabled: true,
        stop: function(e, ui, element) {
          var slice_data = $(element).data('slice');
          dashboard.getSlice(slice_data.slice_id).resize();
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
      var expanded_slices = {};
      $.each($(".slice_info"), function(i, d){
        var widget = $(this).parents('.widget');
        var slice_description = widget.find('.slice_description');
        if(slice_description.is(":visible"))
          expanded_slices[$(d).attr('slice_id')] = true;
      });
      var data = {
          positions: gridster.serialize(),
          css: editor.getValue(),
          expanded_slices: expanded_slices,
      };
      $.ajax({
        type: "POST",
        url: '/panoramix/save_dash/' + dashboard.id + '/',
        data: {'data': JSON.stringify(data)},
        success: function() {alert("Saved!")},
        error: function() {alert("Error :(")},
      });
    });

    var editor = ace.edit("dash_css");
    editor.$blockScrolling = Infinity

    editor.setTheme("ace/theme/crimson_editor");
    editor.setOptions({
        minLines: 16,
        maxLines: Infinity,
    });
    editor.getSession().setMode("ace/mode/css");

    $(".select2").select2({dropdownAutoWidth : true});
    $("#css_template").on("change", function() {
      var css = $(this).find('option:selected').data('css');
      editor.setValue(css);
      $('#dash_css').val(css);
      $("#user_style").html(css);
    });
    $('#filters').click( function(){
      alert(dashboard.readFilters());
    });
    $("a.closeslice").click(function() {
      var li = $(this).parents("li");
      gridster.remove_widget(li);
    });
    $(".slice_info").click(function(){
      var widget = $(this).parents('.widget');
      var slice_description = widget.find('.slice_description');
      slice_description.slideToggle(500, function(){
        widget.find('.refresh').click();
      });
    });
    $("table.slice_header").mouseover(function() {
      $(this).find("td.icons nobr").show();
    });
    $("table.slice_header").mouseout(function() {
      $(this).find("td.icons nobr").hide();
    });
    editor.on("change", function(){
      css = editor.getValue();
      $('#dash_css').val(css);
      $("#user_style").html(css);
    });
  }

  // Export public functions
  return {
    registerViz: registerViz,
    Slice: Slice,
    Dashboard: Dashboard,
    druidify: druidify,
    initExploreView: initExploreView,
    initDashboardView: initDashboardView,
    formatDate: formatDate,
    timeFormatFactory: timeFormatFactory,
    color: color(),
    renderSlice: renderSlice,
    initSqlEditorView: initSqlEditorView,
  }
})();
