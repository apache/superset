px.registerViz('filter_box', function(slice) {
  var slice = slice;
  d3token = d3.select(slice.selector);

  var fltChanged = function() {
    filters = []
    d3token.selectAll('select.select2_box_filter').each(function(){
      val = $(this).val();
      name = $(this).attr('name');
      if (val !== null && val !== undefined){
        if (typeof val === 'string')
          val = [val];
        filters.push([name, val]);
      }
    });
    slice.addFilter(filters);
  }

  var refresh = function() {
      $('#code').attr('rows', '15')
      var container = d3token
        .append('div')
        .classed('padded', true);
      $.getJSON(slice.jsonEndpoint(), function(payload) {
        var maxes = {};
        for (filter in payload.data){
          var data = payload.data[filter];
          maxes[filter] = d3.max(data, function(d){return d.metric});
          var id = 'fltbox__' + filter;

          var div = container.append('div');
          div.append("label").text(filter);
          var sel = div
            .append('div')
            .attr('name', filter)
            .classed('form-control', true)
            .attr('multiple', '')
            .attr('id', id);

          $('#' + id).select2({
            placeholder: "Select [" + filter + ']',
            containment: 'parent',
            dropdownAutoWidth : true,
            data:data,
            multiple: true,
            formatResult: function(result, container, query, escapeMarkup) {
                var perc = Math.round((result.metric / maxes[result.filter]) * 100);
                var style = 'padding: 2px 5px;';
                style += "background-image: ";
                style += "linear-gradient(to right, lightgrey, lightgrey " + perc + "%, rgba(0,0,0,0) " + perc + "%";

                $(container).attr('style', 'padding: 0px; background: white;');
                $(container).addClass('filter_box');
                return '<div style="' + style + '"><span>' + result.text + '</span></div>';
            },
          })
          .on('change', fltChanged);
          /*
           .style('background-image', function(d){
              if (d.isMetric){
                var perc = Math.round((d.val / maxes[d.col]) * 100);
                return "linear-gradient(to right, lightgrey, lightgrey " + perc + "%, rgba(0,0,0,0) " + perc + "%";
              }
           })
          */
        }
        slice.done();
      })
      .fail(function(xhr) {
          slice.error(xhr.responseText);
        });
      };
  return {
    render: refresh,
    resize: refresh,
  };
});
