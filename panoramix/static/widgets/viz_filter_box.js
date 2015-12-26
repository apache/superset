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
        for (filter in payload.data){
          data = payload.data[filter];
          var id = 'fltbox__' + filter;

          var div = container.append('div');
          div.append("label").text(filter);
          var sel = div
            .append('select')
            .attr('name', filter)
            .attr('multiple', '')
            .attr('id', id);

          sel.classed('select2_box_filter form-control', true);
          sel.selectAll('option').data(data).enter()
            .append('option')
            .attr('value', function(d){return d[0];})
            .text(function(d){return d[0];});
          $('#' + id).select2({
            //allowClear: true,
            placeholder: "Select [" + filter + ']',
            dropdownAutoWidth : true,
          })
          .on('change', fltChanged);
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
