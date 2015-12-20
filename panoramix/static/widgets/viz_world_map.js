/*
 Using the awesome lib at http://datamaps.github.io/
*/

function viz_world_map(slice) {
    var token = d3.select('#' + slice.data.token);
    var render = function() {
    // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
    var div = token;
    var xy = div.node().getBoundingClientRect();
    var width = xy.width;
    var height = xy.height - 25;

    d3.json(slice.data.json_endpoint, function(error, json){

      if (error != null){
        slice.error(error.responseText);
        return '';
      }
      var ext = d3.extent(json.data, function(d){return d.m1});
      var extRadius = d3.extent(json.data, function(d){return d.m2});
      var radiusScale = d3.scale.linear()
          .domain([extRadius[0], extRadius[1]])
          .range([1, slice.data.form_data.max_bubble_size]);
      json.data.forEach(function(d){
        d.radius = radiusScale(d.m2);
      })
      var colorScale = d3.scale.linear()
          .domain([ext[0], ext[1]])
          .range(["#FFF", "black"]);
      var d = {};
      for (var i=0; i<json.data.length; i++){
        var country = json.data[i];
        country['fillColor'] = colorScale(country.m1);
        d[country.country] = country;
      }
      f = d3.format('.3s');
      var map = new Datamap({
        element: document.getElementById(slice.data.token),
        data: json.data,
        fills: {
          defaultFill: 'grey'
        },
        geographyConfig: {
          popupOnHover: true,
          highlightOnHover: true,
          borderWidth: 1,
          borderColor: 'grey',
          highlightBorderColor: 'black',
          highlightFillColor: '#005a63',
          highlightBorderWidth: 1,
          popupTemplate: function(geo, data) {
            return '<div class="hoverinfo"><strong>' + data.name + '</strong><br>'+ f(data.m1) + '</div>';
          },
        },
        bubblesConfig: {
          borderWidth: 1,
          borderOpacity: 1,
          borderColor: '#005a63',
          popupOnHover: true,
          radius: null,
          popupTemplate: function(geo, data) {
            return '<div class="hoverinfo"><strong>' + data.name + '</strong><br>'+ f(data.m2) + '</div>';
          },
          fillOpacity: 0.5,
          animate: true,
          highlightOnHover: true,
          highlightFillColor: '#005a63',
          highlightBorderColor: 'black',
          highlightBorderWidth: 2,
          highlightBorderOpacity: 1,
          highlightFillOpacity: 0.85,
          exitDelay: 100,
          key: JSON.stringify
      },
      });
      map.updateChoropleth(d);
      if(slice.data.form_data.show_bubbles){
        map.bubbles(json.data);
        token.selectAll("circle.datamaps-bubble").style('fill', '#005a63');
      }
      slice.done(json);
    });
  }

  return {
    render: render,
    resize: render,
  };
}
px.registerViz('world_map', viz_world_map);
