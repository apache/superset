/*
 Using the awesome lib at http://datamaps.github.io/
*/

function viz_world_map(data_attribute) {
    var token = d3.select('#' + data_attribute.token);
    var render = function(done) {
    // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
    var div = token;
    var xy = div.node().getBoundingClientRect();
    var width = xy.width;
    var height = xy.height - 25;

    d3.json(data_attribute.json_endpoint, function(error, json){

      if (error != null){
        var err = '<div class="alert alert-danger">' + error.responseText  + '</div>';
        token.html(err);
        return '';
        done();
      }
      var ext = d3.extent(json.data, function(d){return d.metric});
      var extRadius = d3.extent(json.data, function(d){return d.radius});
      var radiusScale = d3.scale.linear()
          .domain([extRadius[0], extRadius[1]])
          .range([1, 40]);
      json.data.forEach(function(d){
        d.radius = radiusScale(d.radius);
      })
      var colorScale = d3.scale.linear()
          .domain([ext[0], ext[1]])
          .range(["#FFF", "black"]);
      var d = {};
      for (var i=0; i<json.data.length; i++){
        var country = json.data[i];
        d[country.country] = colorScale(country.metric);
      }
      var map = new Datamap({
        element: document.getElementById(data_attribute.token),
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
        },
        bubblesConfig: {
          borderWidth: 1,
          borderOpacity: 1,
          borderColor: '#005a63',
          popupOnHover: true,
          radius: null,
          popupTemplate: function(geography, data) {
            return '<div class="hoverinfo"><strong>' + data.country + '</strong></div>';
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
      if(data_attribute.form_data.show_bubbles){
        map.bubbles(json.data);
        token.selectAll("circle.datamaps-bubble").style('fill', '#005a63');
      }
      done(json);
    });
  }

  return {
    render: render,
    resize: render,
  };
}
px.registerWidget('world_map', viz_world_map);
