(function() {
  var svg;

  //save off default references
  var d3 = window.d3, topojson = window.topojson;

  var defaultOptions = {
    scope: 'world',
    responsive: false,
    aspectRatio: 0.5625,
    setProjection: setProjection,
    projection: 'equirectangular',
    dataType: 'json',
    data: {},
    done: function() {},
    fills: {
      defaultFill: '#ABDDA4'
    },
    filters: {},
    geographyConfig: {
        dataUrl: null,
        hideAntarctica: true,
        hideHawaiiAndAlaska : false,
        borderWidth: 1,
        borderColor: '#FDFDFD',
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></div>';
        },
        popupOnHover: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2
    },
    projectionConfig: {
      rotation: [97, 0]
    },
    bubblesConfig: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        popupOnHover: true,
        radius: null,
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + data.name + '</strong></div>';
        },
        fillOpacity: 0.75,
        animate: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightFillOpacity: 0.85,
        exitDelay: 100,
        key: JSON.stringify
    },
    arcConfig: {
      strokeColor: '#DD1C77',
      strokeWidth: 1,
      arcSharpness: 1,
      animationSpeed: 600
    }
  };

  /*
    Getter for value. If not declared on datumValue, look up the chain into optionsValue
  */
  function val( datumValue, optionsValue, context ) {
    if ( typeof context === 'undefined' ) {
      context = optionsValue;
      optionsValues = undefined;
    }
    var value = typeof datumValue !== 'undefined' ? datumValue : optionsValue;

    if (typeof value === 'undefined') {
      return  null;
    }

    if ( typeof value === 'function' ) {
      var fnContext = [context];
      if ( context.geography ) {
        fnContext = [context.geography, context.data];
      }
      return value.apply(null, fnContext);
    }
    else {
      return value;
    }
  }

  function addContainer( element, height, width ) {
    this.svg = d3.select( element ).append('svg')
      .attr('width', width || element.offsetWidth)
      .attr('data-width', width || element.offsetWidth)
      .attr('class', 'datamap')
      .attr('height', height || element.offsetHeight)
      .style('overflow', 'hidden'); // IE10+ doesn't respect height/width when map is zoomed in

    if (this.options.responsive) {
      d3.select(this.options.element).style({'position': 'relative', 'padding-bottom': (this.options.aspectRatio*100) + '%'});
      d3.select(this.options.element).select('svg').style({'position': 'absolute', 'width': '100%', 'height': '100%'});
      d3.select(this.options.element).select('svg').select('g').selectAll('path').style('vector-effect', 'non-scaling-stroke');

    }

    return this.svg;
  }

  // setProjection takes the svg element and options
  function setProjection( element, options ) {
    var width = options.width || element.offsetWidth;
    var height = options.height || element.offsetHeight;
    var projection, path;
    var svg = this.svg;

    if ( options && typeof options.scope === 'undefined') {
      options.scope = 'world';
    }

    if ( options.scope === 'usa' ) {
      projection = d3.geo.albersUsa()
        .scale(width)
        .translate([width / 2, height / 2]);
    }
    else if ( options.scope === 'world' ) {
      projection = d3.geo[options.projection]()
        .scale((width + 1) / 2 / Math.PI)
        .translate([width / 2, height / (options.projection === "mercator" ? 1.45 : 1.8)]);
    }

    if ( options.projection === 'orthographic' ) {

      svg.append("defs").append("path")
        .datum({type: "Sphere"})
        .attr("id", "sphere")
        .attr("d", path);

      svg.append("use")
          .attr("class", "stroke")
          .attr("xlink:href", "#sphere");

      svg.append("use")
          .attr("class", "fill")
          .attr("xlink:href", "#sphere");
      projection.scale(250).clipAngle(90).rotate(options.projectionConfig.rotation)
    }

    path = d3.geo.path()
      .projection( projection );

    return {path: path, projection: projection};
  }

  function addStyleBlock() {
    if ( d3.select('.datamaps-style-block').empty() ) {
      d3.select('head').append('style').attr('class', 'datamaps-style-block')
      .html('.datamap path.datamaps-graticule { fill: none; stroke: #777; stroke-width: 0.5px; stroke-opacity: .5; pointer-events: none; } .datamap .labels {pointer-events: none;} .datamap path {stroke: #FFFFFF; stroke-width: 1px;} .datamaps-legend dt, .datamaps-legend dd { float: left; margin: 0 3px 0 0;} .datamaps-legend dd {width: 20px; margin-right: 6px; border-radius: 3px;} .datamaps-legend {padding-bottom: 20px; z-index: 1001; position: absolute; left: 4px; font-size: 12px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;} .datamaps-hoverover {display: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; } .hoverinfo {padding: 4px; border-radius: 1px; background-color: #FFF; box-shadow: 1px 1px 5px #CCC; font-size: 12px; border: 1px solid #CCC; } .hoverinfo hr {border:1px dotted #CCC; }');
    }
  }

  function drawSubunits( data ) {
    var fillData = this.options.fills,
        colorCodeData = this.options.data || {},
        geoConfig = this.options.geographyConfig;


    var subunits = this.svg.select('g.datamaps-subunits');
    if ( subunits.empty() ) {
      subunits = this.addLayer('datamaps-subunits', null, true);
    }

    var geoData = topojson.feature( data, data.objects[ this.options.scope ] ).features;
    if ( geoConfig.hideAntarctica ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "ATA";
      });
    }

    if ( geoConfig.hideHawaiiAndAlaska ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "HI" && feature.id !== 'AK';
      });
    }

    var geo = subunits.selectAll('path.datamaps-subunit').data( geoData );

    geo.enter()
      .append('path')
      .attr('d', this.path)
      .attr('class', function(d) {
        return 'datamaps-subunit ' + d.id;
      })
      .attr('data-info', function(d) {
        return JSON.stringify( colorCodeData[d.id]);
      })
      .style('fill', function(d) {
        //if fillKey - use that
        //otherwise check 'fill'
        //otherwise check 'defaultFill'
        var fillColor;

        var datum = colorCodeData[d.id];
        if ( datum && datum.fillKey ) {
          fillColor = fillData[ val(datum.fillKey, {data: colorCodeData[d.id], geography: d}) ];
        }

        if ( typeof fillColor === 'undefined' ) {
          fillColor = val(datum && datum.fillColor, fillData.defaultFill, {data: colorCodeData[d.id], geography: d});
        }

        return fillColor;
      })
      .style('stroke-width', geoConfig.borderWidth)
      .style('stroke', geoConfig.borderColor);
  }

  function handleGeographyConfig () {
    var hoverover;
    var svg = this.svg;
    var self = this;
    var options = this.options.geographyConfig;

    if ( options.highlightOnHover || options.popupOnHover ) {
      svg.selectAll('.datamaps-subunit')
        .on('mouseover', function(d) {
          var $this = d3.select(this);
          var datum = self.options.data[d.id] || {};
          if ( options.highlightOnHover ) {
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));

            //as per discussion on https://github.com/markmarkoh/datamaps/issues/19
            if ( ! /((MSIE)|(Trident))/.test(navigator.userAgent) ) {
             moveToFront.call(this);
            }
          }

          if ( options.popupOnHover ) {
            self.updatePopup($this, d, options, svg);
          }
        })
        .on('mouseout', function() {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }
          $this.on('mousemove', null);
          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        });
    }

    function moveToFront() {
      this.parentNode.appendChild(this);
    }
  }

  //plugin to add a simple map legend
  function addLegend(layer, data, options) {
    data = data || {};
    if ( !this.options.fills ) {
      return;
    }

    var html = '<dl>';
    var label = '';
    if ( data.legendTitle ) {
      html = '<h2>' + data.legendTitle + '</h2>' + html;
    }
    for ( var fillKey in this.options.fills ) {

      if ( fillKey === 'defaultFill') {
        if (! data.defaultFillName ) {
          continue;
        }
        label = data.defaultFillName;
      } else {
        if (data.labels && data.labels[fillKey]) {
          label = data.labels[fillKey];
        } else {
          label= fillKey + ': ';
        }
      }
      html += '<dt>' + label + '</dt>';
      html += '<dd style="background-color:' +  this.options.fills[fillKey] + '">&nbsp;</dd>';
    }
    html += '</dl>';

    var hoverover = d3.select( this.options.element ).append('div')
      .attr('class', 'datamaps-legend')
      .html(html);
  }

    function addGraticule ( layer, options ) {
      var graticule = d3.geo.graticule();
      this.svg.insert("path", '.datamaps-subunits')
        .datum(graticule)
        .attr("class", "datamaps-graticule")
        .attr("d", this.path);
  }

  function handleArcs (layer, data, options) {
    var self = this,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - arcs must be an array";
    }

    // For some reason arc options were put in an `options` object instead of the parent arc
    // I don't like this, so to match bubbles and other plugins I'm moving it
    // This is to keep backwards compatability
    for ( var i = 0; i < data.length; i++ ) {
      data[i] = defaults(data[i], data[i].options);
      delete data[i].options;
    }

    if ( typeof options === "undefined" ) {
      options = defaultOptions.arcConfig;
    }

    var arcs = layer.selectAll('path.datamaps-arc').data( data, JSON.stringify );

    var path = d3.geo.path()
        .projection(self.projection);

    arcs
      .enter()
        .append('svg:path')
        .attr('class', 'datamaps-arc')
        .style('stroke-linecap', 'round')
        .style('stroke', function(datum) {
          return val(datum.strokeColor, options.strokeColor, datum);
        })
        .style('fill', 'none')
        .style('stroke-width', function(datum) {
            return val(datum.strokeWidth, options.strokeWidth, datum);
        })
        .attr('d', function(datum) {
            var originXY = self.latLngToXY(val(datum.origin.latitude, datum), val(datum.origin.longitude, datum))
            var destXY = self.latLngToXY(val(datum.destination.latitude, datum), val(datum.destination.longitude, datum));
            var midXY = [ (originXY[0] + destXY[0]) / 2, (originXY[1] + destXY[1]) / 2];
            if (options.greatArc) {
                  // TODO: Move this to inside `if` clause when setting attr `d`
              var greatArc = d3.geo.greatArc()
                  .source(function(d) { return [val(d.origin.longitude, d), val(d.origin.latitude, d)]; })
                  .target(function(d) { return [val(d.destination.longitude, d), val(d.destination.latitude, d)]; });

              return path(greatArc(datum))
            }
            var sharpness = val(datum.arcSharpness, options.arcSharpness, datum);
            return "M" + originXY[0] + ',' + originXY[1] + "S" + (midXY[0] + (50 * sharpness)) + "," + (midXY[1] - (75 * sharpness)) + "," + destXY[0] + "," + destXY[1];
        })
        .transition()
          .delay(100)
          .style('fill', function(datum) {
            /*
              Thank you Jake Archibald, this is awesome.
              Source: http://jakearchibald.com/2013/animated-line-drawing-svg/
            */
            var length = this.getTotalLength();
            this.style.transition = this.style.WebkitTransition = 'none';
            this.style.strokeDasharray = length + ' ' + length;
            this.style.strokeDashoffset = length;
            this.getBoundingClientRect();
            this.style.transition = this.style.WebkitTransition = 'stroke-dashoffset ' + val(datum.animationSpeed, options.animationSpeed, datum) + 'ms ease-out';
            this.style.strokeDashoffset = '0';
            return 'none';
          })

    arcs.exit()
      .transition()
      .style('opacity', 0)
      .remove();
  }

  function handleLabels ( layer, options ) {
    var self = this;
    options = options || {};
    var labelStartCoodinates = this.projection([-67.707617, 42.722131]);
    this.svg.selectAll(".datamaps-subunit")
      .attr("data-foo", function(d) {
        var center = self.path.centroid(d);
        var xOffset = 7.5, yOffset = 5;

        if ( ["FL", "KY", "MI"].indexOf(d.id) > -1 ) xOffset = -2.5;
        if ( d.id === "NY" ) xOffset = -1;
        if ( d.id === "MI" ) yOffset = 18;
        if ( d.id === "LA" ) xOffset = 13;

        var x,y;

        x = center[0] - xOffset;
        y = center[1] + yOffset;

        var smallStateIndex = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"].indexOf(d.id);
        if ( smallStateIndex > -1) {
          var yStart = labelStartCoodinates[1];
          x = labelStartCoodinates[0];
          y = yStart + (smallStateIndex * (2+ (options.fontSize || 12)));
          layer.append("line")
            .attr("x1", x - 3)
            .attr("y1", y - 5)
            .attr("x2", center[0])
            .attr("y2", center[1])
            .style("stroke", options.labelColor || "#000")
            .style("stroke-width", options.lineWidth || 1)
        }

        layer.append("text")
          .attr("x", x)
          .attr("y", y)
          .style("font-size", (options.fontSize || 10) + 'px')
          .style("font-family", options.fontFamily || "Verdana")
          .style("fill", options.labelColor || "#000")
          .text( d.id );
        return "bar";
      });
  }


  function handleBubbles (layer, data, options ) {
    var self = this,
        fillData = this.options.fills,
        filterData = this.options.filters,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - bubbles must be an array";
    }

    var bubbles = layer.selectAll('circle.datamaps-bubble').data( data, options.key );

    bubbles
      .enter()
        .append('svg:circle')
        .attr('class', 'datamaps-bubble')
        .attr('cx', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[0];
        })
        .attr('cy', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[1];
        })
        .attr('r', function(datum) {
          // if animation enabled start with radius 0, otherwise use full size.
          return options.animate ? 0 : val(datum.radius, options.radius, datum);
        })
        .attr('data-info', function(d) {
          return JSON.stringify(d);
        })
        .attr('filter', function (datum) {
          var filterKey = filterData[ val(datum.filterKey, options.filterKey, datum) ];

          if (filterKey) {
            return filterKey;
          }
        })
        .style('stroke', function ( datum ) {
          return val(datum.borderColor, options.borderColor, datum);
        })
        .style('stroke-width', function ( datum ) {
          return val(datum.borderWidth, options.borderWidth, datum);
        })
        .style('fill-opacity', function ( datum ) {
          return val(datum.fillOpacity, options.fillOpacity, datum);
        })
        .style('fill', function ( datum ) {
          var fillColor = fillData[ val(datum.fillKey, options.fillKey, datum) ];
          return fillColor || fillData.defaultFill;
        })
        .on('mouseover', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //save all previous attributes for mouseout
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));
          }

          if (options.popupOnHover) {
            self.updatePopup($this, datum, options, svg);
          }
        })
        .on('mouseout', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }

          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        })

    bubbles.transition()
      .duration(400)
      .attr('r', function ( datum ) {
        return val(datum.radius, options.radius, datum);
      });

    bubbles.exit()
      .transition()
        .delay(options.exitDelay)
        .attr("r", 0)
        .remove();

    function datumHasCoords (datum) {
      return typeof datum !== 'undefined' && typeof datum.latitude !== 'undefined' && typeof datum.longitude !== 'undefined';
    }
  }

  //stolen from underscore.js
  function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  }
  /**************************************
             Public Functions
  ***************************************/

  function Datamap( options ) {

    if ( typeof d3 === 'undefined' || typeof topojson === 'undefined' ) {
      throw new Error('Include d3.js (v3.0.3 or greater) and topojson on this page before creating a new map');
   }
    //set options for global use
    this.options = defaults(options, defaultOptions);
    this.options.geographyConfig = defaults(options.geographyConfig, defaultOptions.geographyConfig);
    this.options.projectionConfig = defaults(options.projectionConfig, defaultOptions.projectionConfig);
    this.options.bubblesConfig = defaults(options.bubblesConfig, defaultOptions.bubblesConfig);
    this.options.arcConfig = defaults(options.arcConfig, defaultOptions.arcConfig);

    //add the SVG container
    if ( d3.select( this.options.element ).select('svg').length > 0 ) {
      addContainer.call(this, this.options.element, this.options.height, this.options.width );
    }

    /* Add core plugins to this instance */
    this.addPlugin('bubbles', handleBubbles);
    this.addPlugin('legend', addLegend);
    this.addPlugin('arc', handleArcs);
    this.addPlugin('labels', handleLabels);
    this.addPlugin('graticule', addGraticule);

    //append style block with basic hoverover styles
    if ( ! this.options.disableDefaultStyles ) {
      addStyleBlock();
    }

    return this.draw();
  }

  // resize map
  Datamap.prototype.resize = function () {

    var self = this;
    var options = self.options;

    if (options.responsive) {
      var newsize = options.element.clientWidth,
          oldsize = d3.select( options.element).select('svg').attr('data-width');

      d3.select(options.element).select('svg').selectAll('g').attr('transform', 'scale(' + (newsize / oldsize) + ')');
    }
  }

  // actually draw the features(states & countries)
  Datamap.prototype.draw = function() {
    //save off in a closure
    var self = this;
    var options = self.options;

    //set projections and paths based on scope
    var pathAndProjection = options.setProjection.apply(self, [options.element, options] );

    this.path = pathAndProjection.path;
    this.projection = pathAndProjection.projection;

    //if custom URL for topojson data, retrieve it and render
    if ( options.geographyConfig.dataUrl ) {
      d3.json( options.geographyConfig.dataUrl, function(error, results) {
        if ( error ) throw new Error(error);
        self.customTopo = results;
        draw( results );
      });
    }
    else {
      draw( this[options.scope + 'Topo'] || options.geographyConfig.dataJson);
    }

    return this;

      function draw (data) {
        // if fetching remote data, draw the map first then call `updateChoropleth`
        if ( self.options.dataUrl ) {
          //allow for csv or json data types
          d3[self.options.dataType](self.options.dataUrl, function(data) {
            //in the case of csv, transform data to object
            if ( self.options.dataType === 'csv' && (data && data.slice) ) {
              var tmpData = {};
              for(var i = 0; i < data.length; i++) {
                tmpData[data[i].id] = data[i];
              }
              data = tmpData;
            }
            Datamaps.prototype.updateChoropleth.call(self, data);
          });
        }
        drawSubunits.call(self, data);
        handleGeographyConfig.call(self);

        if ( self.options.geographyConfig.popupOnHover || self.options.bubblesConfig.popupOnHover) {
          hoverover = d3.select( self.options.element ).append('div')
            .attr('class', 'datamaps-hoverover')
            .style('z-index', 10001)
            .style('position', 'absolute');
        }

        //fire off finished callback
        self.options.done(self);
      }
  };
  /**************************************
                TopoJSON
  ***************************************/
  Datamap.prototype.worldTopo = '__WORLD__';
  Datamap.prototype.abwTopo = '__ABW__';
  Datamap.prototype.afgTopo = '__AFG__';
  Datamap.prototype.agoTopo = '__AGO__';
  Datamap.prototype.aiaTopo = '__AIA__';
  Datamap.prototype.albTopo = '__ALB__';
  Datamap.prototype.aldTopo = {"type":"Topology","objects":{"ald":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Finström"},"id":"AX.EC","arcs":[[0,1,2,3,4,5,6]]},{"type":"Polygon","properties":{"name":"Jomala"},"id":"AX.","arcs":[[7,8,9,-3,10]]},{"type":"MultiPolygon","properties":{"name":"Hammarland"},"id":"AX.","arcs":[[[-4,-10,11]],[[12]]]},{"type":"MultiPolygon","properties":{"name":"Eckerö"},"id":"AX.","arcs":[[[13]],[[14]],[[15]],[[16]]]},{"type":"MultiPolygon","properties":{"name":"Geta"},"id":"AX.","arcs":[[[17]],[[18,-6]]]},{"type":"MultiPolygon","properties":{"name":"Föglö"},"id":"AX.","arcs":[[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]]]},{"type":"MultiPolygon","properties":{"name":"Saltvik"},"id":"AX.","arcs":[[[26,27,-1,28]],[[29]]]},{"type":"Polygon","properties":{"name":"Sund"},"id":"AX.","arcs":[[-27,30]]},{"type":"Polygon","properties":{"name":"Mariehamn"},"id":"AX.","arcs":[[31,-8]]},{"type":"MultiPolygon","properties":{"name":"Lemland"},"id":"AX.","arcs":[[[32]],[[33]],[[34]]]},{"type":"Polygon","properties":{"name":"Lumparland"},"id":"AX.","arcs":[[35]]},{"type":"MultiPolygon","properties":{"name":"Vårdö"},"id":"AX.","arcs":[[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]]]},{"type":"MultiPolygon","properties":{"name":"Sottunga"},"id":"AX.","arcs":[[[47]],[[48]],[[49]],[[50]]]},{"type":"MultiPolygon","properties":{"name":"Kumlinge"},"id":"AX.","arcs":[[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]]]},{"type":"MultiPolygon","properties":{"name":"Brändö"},"id":"AX.","arcs":[[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]]]},{"type":"MultiPolygon","properties":{"name":"Kökar"},"id":"AX.","arcs":[[[74]],[[75]],[[76]]]}]}},"arcs":[[[3510,7241],[5,-238],[26,-338],[-9,-338],[44,-148],[89,-46]],[[3665,6133],[22,-245],[80,-271],[107,-225],[99,-109],[-55,-95],[-33,-111],[-9,-123],[17,-134],[-294,153],[-91,130],[33,72],[10,47],[-5,164],[-153,-26],[-74,-64],[15,-145],[70,-157],[79,-140]],[[3483,4854],[-149,-28],[-129,0],[-182,-85],[-86,0],[-112,-106]],[[2825,4635],[-72,280]],[[2753,4915],[43,74],[9,173],[-12,193],[-21,134],[101,-80],[92,-126],[39,386],[119,189],[27,189],[10,292],[36,179],[30,-202],[9,-102],[3,-125],[30,-52],[66,16],[67,58],[30,73],[-16,239],[-43,201],[-62,159],[-72,113],[-39,78]],[[3199,6974],[83,177],[59,246]],[[3341,7397],[51,-190],[118,34]],[[3609,3540],[-94,123],[-69,148],[-151,-134]],[[3295,3677],[-134,2],[-75,-66],[-17,-75],[-11,-76],[-54,-66],[-77,-28],[-75,11],[-48,66],[7,140],[-99,75],[-102,-50],[-87,-135],[-59,-173],[-87,379]],[[2377,3681],[94,88],[138,148],[130,84],[-9,339],[130,21],[-35,274]],[[3483,4854],[86,-98],[161,-84],[52,-97],[41,-98],[35,-43],[55,31],[43,72],[42,93],[52,87],[-63,-442],[-16,-212],[2,-196],[21,-47],[38,-32],[37,-51],[17,-105],[-32,-143],[-75,-1],[-142,97],[-228,-45]],[[2377,3681],[-210,606],[-88,344],[-38,404],[-32,175],[-65,73],[-12,103],[-123,567],[112,5],[91,-24],[48,-108],[-16,-251],[44,144],[35,156],[38,121],[54,51],[75,19],[216,170],[-43,60],[-28,68],[-48,154],[117,-46],[41,-48],[34,45],[16,7],[58,-52],[-89,-399],[-88,-304],[17,-118],[46,-98],[45,-119],[44,-340],[37,-97],[88,-34]],[[2172,7272],[-26,-43],[-70,41],[-49,70],[-3,54],[22,131],[32,10],[29,-47],[14,-38],[21,-36],[19,-60],[11,-82]],[[101,5039],[-32,-122],[-50,116],[-19,47],[33,22],[68,-63]],[[1925,5000],[19,-86],[13,-87],[7,-248],[-19,-114],[-43,-19],[-51,12],[-42,-24],[-81,133],[-130,305],[-101,128],[44,-234],[22,-219],[-21,-206],[-83,-191],[-111,-74],[-116,67],[-99,191],[-59,297],[-15,125],[-4,64],[24,54],[72,83],[40,103],[-2,138],[-10,152],[11,139],[29,67],[102,165],[42,85],[62,75],[84,0],[83,-50],[111,-142],[36,-90],[22,-117],[6,-148],[20,-104],[99,-146],[39,-84]],[[935,5814],[9,-36],[34,32],[41,71],[59,44],[86,5],[7,-24],[-31,-39],[-31,-20],[-3,-45],[72,-222],[-13,-44],[-32,15],[-47,-2],[-22,31],[-9,124],[-7,19],[-14,-48],[-11,-114],[-12,-45],[-22,-13],[-36,-18],[-12,29],[-4,78],[-15,68],[-23,-72],[-34,-18],[-23,-25],[-16,27],[0,100],[35,166],[4,102],[17,62],[40,-48],[16,-84],[-3,-56]],[[1520,7022],[-13,-185],[-29,16],[-86,239],[12,39],[11,48],[12,30],[52,45],[88,78],[68,12],[-13,-72],[-53,-98],[-49,-152]],[[2264,7435],[-57,0],[-28,39],[-31,17],[-11,74],[20,110],[25,38],[103,37],[25,62],[30,17],[34,-57],[-3,-70],[-28,-47],[-26,-164],[-53,-56]],[[3199,6974],[-21,70],[-25,8],[-52,-105],[-61,-249],[-42,-88],[-52,55],[-85,233],[-80,176],[-97,102],[-139,12],[88,76],[50,114],[37,135],[52,138],[116,165],[121,70],[128,0],[136,-47],[41,-184],[27,-258]],[[6323,2213],[-273,-191],[-178,9],[-156,-25],[-82,-41],[-14,-201],[-89,-125],[-129,67],[-14,251],[116,309],[212,292],[130,-34],[203,-118],[216,-57],[58,-136]],[[5967,2829],[-101,-86],[-22,64],[56,100],[2,50],[-2,34],[13,29],[128,-59],[4,-63],[-31,-69],[-47,0]],[[7089,3098],[24,-45],[5,-55],[18,-15],[43,25],[35,-8],[21,-62],[8,-36],[14,-22],[30,-16],[-15,-16],[-67,-18],[-14,-8],[42,-45],[9,-84],[-20,-100],[-56,-91],[-52,-110],[-55,-20],[-152,169],[-25,-33],[-35,-97],[-72,-61],[-86,17],[-62,88],[26,160],[144,334],[79,106],[75,21],[56,-9],[45,31],[37,0]],[[6239,2627],[-168,-53],[-69,96],[76,170],[116,204],[140,136],[77,23],[-65,-369],[-107,-207]],[[6731,2874],[-107,-91],[-164,68],[-9,222],[104,70],[192,32],[18,10],[-50,21],[11,47],[84,45],[48,-37],[-34,-94],[-54,-102],[-29,-121],[-10,-70]],[[5789,3289],[-41,-84],[-25,23],[-18,-21],[-49,-5],[-21,77],[31,80],[4,34],[22,55],[55,23],[33,-39],[14,-82],[-5,-61]],[[6850,3735],[58,-10],[59,28],[40,-9],[-2,-90],[-22,-80],[-349,88],[-90,65],[-14,44],[67,50],[156,19],[97,-105]],[[4731,6783],[-94,-245],[-104,-296],[-172,-148],[-181,-338],[-107,-345]],[[4073,5411],[-92,137],[-46,258],[71,232],[117,294],[24,234],[-212,47],[0,-95],[57,-176],[-50,-241],[-122,-130],[-155,162]],[[3510,7241],[122,35],[144,-69],[136,-141],[97,-170],[-47,278],[-27,100],[83,-24],[190,-133],[57,19],[61,53],[66,-72],[121,-221],[218,-113]],[[4360,7562],[-39,-19],[-28,13],[-13,33],[-44,40],[-16,52],[170,191],[50,-1],[24,-31],[-9,-102],[-44,-118],[-51,-58]],[[4731,6783],[75,-38],[79,-148],[-60,-361],[84,56],[31,37],[89,-92],[115,-65],[223,-39],[-196,-464],[-38,-180],[-154,-103],[75,-205],[43,-78],[-61,-40],[-52,-6],[-49,-21],[-53,-79],[-29,-88],[-48,-190],[-19,-48],[-71,-41],[-41,36],[-39,59],[-61,32],[-234,0],[-48,81],[11,189],[37,208],[38,139],[116,136],[280,28],[89,171],[-229,-6],[-207,-73],[-164,-222],[-97,-453],[-38,0],[17,333],[-72,163]],[[3609,3540],[-96,-101],[14,-190],[38,-226],[-54,-84],[-61,37],[19,137],[-97,432],[-77,132]],[[3395,75],[-33,-75],[-16,16],[-10,23],[-13,21],[26,47],[46,-32]],[[3700,2690],[64,-62],[49,10],[44,-37],[41,-73],[-10,-99],[-63,-64],[-59,9],[-45,39],[3,50],[14,44],[-8,41],[-46,33],[-1,32],[-106,65],[-6,57],[129,-45]],[[4372,3593],[163,-111],[187,12],[169,-308],[110,-410],[56,-290],[15,-130],[-76,-198],[-136,-205],[-71,-68],[50,297],[-70,81],[-111,-81],[-162,-56],[-101,105],[65,124],[26,155],[-97,160],[-146,0],[-112,154],[-187,43],[47,292],[195,125],[186,309]],[[5367,4245],[113,-285],[-70,-248],[-92,-243],[49,-270],[-64,-83],[-40,29],[-39,80],[-53,77],[-191,130],[-40,58],[-20,228],[37,225],[59,213],[40,192],[125,-414],[76,-162],[33,142],[-60,281],[14,95],[123,-45]],[[5576,4392],[-48,-74],[-45,12],[-40,89],[-57,53],[7,37],[57,27],[83,-52],[43,-92]],[[5716,4498],[-101,-18],[-21,50],[134,174],[35,34],[14,-26],[1,-98],[-62,-116]],[[6207,4496],[-136,-53],[-49,33],[-16,76],[25,52],[110,49],[15,37],[11,75],[22,45],[32,4],[22,-38],[2,-55],[8,-6],[26,-6],[5,-58],[-28,-103],[-49,-52]],[[5566,5048],[-37,-75],[-23,-23],[-73,38],[-44,-55],[-23,-108],[-56,-85],[-82,30],[-2,110],[105,144],[9,36],[47,65],[63,162],[86,108],[55,-22],[7,-110],[-3,-118],[-29,-97]],[[5943,6008],[177,-141],[95,86],[39,-46],[24,-58],[10,-77],[4,-103],[-274,-669],[-68,29],[0,71],[26,93],[4,90],[8,64],[0,153],[-28,107],[-167,-164],[-43,123],[9,209],[67,178],[117,55]],[[6628,6109],[-35,-42],[-35,1],[-8,65],[24,90],[19,30],[0,28],[-11,61],[4,51],[4,28],[21,25],[35,-26],[32,-46],[18,-48],[12,-54],[7,-62],[-35,-66],[-52,-35]],[[6085,6065],[-41,-26],[-60,82],[-18,114],[-2,55],[-14,25],[-18,54],[-62,109],[20,39],[75,45],[53,-24],[50,-60],[27,-201],[-15,-61],[-6,-83],[11,-68]],[[6094,6907],[-58,-52],[-38,3],[0,79],[9,85],[15,63],[25,11],[107,-39],[29,-42],[-30,-60],[-59,-48]],[[5878,7193],[52,-90],[26,15],[23,-5],[-8,-91],[-26,-90],[-46,-34],[-190,118],[-7,58],[10,51],[-3,67],[26,50],[143,-49]],[[5632,6914],[-27,-42],[-98,16],[-54,82],[27,135],[112,168],[59,29],[33,-55],[-38,-273],[-14,-60]],[[5322,8159],[-42,-113],[-32,21],[8,108],[39,63],[31,25],[8,-45],[-12,-59]],[[8446,3212],[-9,-23],[-19,6],[-34,-25],[-85,-26],[-18,53],[35,84],[45,61],[36,9],[42,-72],[-14,-9],[9,-10],[12,-27],[0,-21]],[[7910,3405],[9,-63],[-84,26],[-17,55],[14,46],[14,45],[30,3],[47,10],[22,6],[2,-71],[-29,-28],[-8,-29]],[[7649,3803],[-59,-14],[-89,93],[-97,213],[-17,175],[48,75],[53,27],[36,-22],[49,-66],[61,-120],[23,-80],[17,-55],[10,-132],[-35,-94]],[[7198,4487],[-198,-49],[-1,38],[26,39],[115,110],[60,-3],[30,-39],[7,-61],[-39,-35]],[[7794,5040],[-118,-71],[-91,65],[-37,80],[-4,157],[28,143],[87,37],[125,-154],[58,-124],[-48,-133]],[[7988,5346],[-40,-31],[-35,209],[14,228],[26,-96],[16,-120],[34,-48],[10,-57],[-8,-49],[-17,-36]],[[8534,5692],[-84,-33],[-71,10],[42,-180],[-160,91],[-53,344],[35,314],[101,-2],[57,-72],[173,-147],[40,-64],[-14,-167],[-66,-94]],[[9079,6607],[-33,-24],[-43,47],[-32,76],[-18,22],[-16,65],[-17,86],[11,48],[8,111],[27,45],[52,-40],[28,-74],[39,-319],[-6,-43]],[[8187,6793],[-211,-195],[-41,27],[-7,92],[2,47],[5,116],[15,69],[46,148],[19,47],[21,42],[24,81],[13,74],[40,24],[67,-20],[63,-62],[26,-127],[-14,-139],[-23,-126],[-45,-98]],[[7765,7384],[-10,-133],[-29,4],[-28,13],[14,13],[0,38],[8,42],[22,77],[23,-54]],[[9002,7363],[-17,-18],[-75,71],[8,68],[24,72],[3,38],[20,-25],[44,-74],[0,-63],[-7,-69]],[[8746,7013],[-13,-6],[-97,374],[0,89],[26,88],[25,49],[19,-45],[7,-39],[33,-190],[-2,-83],[-9,-49],[-2,-35],[2,-26],[9,-46],[2,-81]],[[8227,7618],[7,-53],[-32,9],[-46,58],[-29,38],[-27,66],[0,131],[39,80],[40,-33],[4,-136],[28,-123],[16,-37]],[[8563,8068],[32,-82],[17,-47],[-11,-112],[-13,11],[-9,35],[-16,9],[-12,27],[-38,63],[-16,71],[38,-9],[28,34]],[[7297,8013],[31,-176],[-25,-69],[-42,17],[-12,51],[-7,5],[-39,-6],[-16,37],[29,161],[28,41],[33,-4],[20,-57]],[[9474,5379],[-15,-114],[-34,9],[-5,41],[-3,63],[20,12],[37,-11]],[[9744,6522],[30,-121],[-34,-61],[-61,45],[-65,111],[23,30],[51,-14],[16,37],[40,-27]],[[9403,6435],[-55,-9],[-71,85],[-14,75],[-7,106],[15,102],[115,120],[19,-17],[21,-4],[15,-17],[-28,-119],[2,-179],[-6,-37],[17,-43],[-23,-63]],[[9983,6965],[-77,-74],[-80,91],[-31,60],[-47,153],[-15,90],[7,61],[39,12],[113,-172],[-3,-48],[6,-68],[41,-67],[43,-19],[4,-19]],[[9760,7808],[-65,-54],[-20,34],[-10,60],[-46,19],[-5,76],[-14,84],[40,88],[67,35],[73,-94],[23,-106],[-43,-142]],[[9504,8213],[-2,-51],[-63,-38],[0,-25],[4,-43],[-38,-57],[-3,-60],[-10,-51],[-61,79],[-42,142],[21,72],[45,-8],[53,50],[55,27],[41,-37]],[[9941,8531],[-56,-45],[-76,80],[-32,166],[29,105],[68,84],[46,5],[23,-9],[34,-63],[11,-168],[-47,-155]],[[9162,8805],[-22,-55],[3,-51],[32,-113],[7,-69],[-6,-67],[-15,-63],[-40,-41],[-62,57],[-34,86],[0,43],[22,14],[7,9],[-29,27],[-5,41],[8,40],[-22,95],[-23,42],[-1,49],[31,10],[79,-97],[16,46],[0,67],[-16,14],[-14,28],[-9,79],[20,55],[101,-31],[16,-43],[-44,-172]],[[9908,8981],[-112,-5],[-134,160],[-22,73],[25,54],[42,7],[43,-22],[32,-47],[14,-52],[24,-15],[55,-17],[57,-67],[-24,-69]],[[8825,9649],[-22,-140],[111,-44],[26,-35],[-62,-13],[-24,3],[-108,71],[-44,81],[5,65],[34,12],[30,-11],[30,35],[24,-24]],[[9993,9443],[6,-37],[-165,8],[-114,77],[-16,32],[-12,63],[34,72],[82,42],[104,-37],[57,-100],[4,-72],[20,-48]],[[9782,9932],[-68,-62],[-37,4],[-63,41],[13,46],[95,38],[59,-17],[1,-50]],[[8993,1025],[-44,-65],[-140,64],[-70,69],[-41,52],[-33,142],[49,119],[77,41],[73,5],[52,-91],[35,-177],[42,-159]],[[9424,1520],[-74,-31],[-80,14],[-1,-24],[84,-80],[40,-132],[-47,-72],[-286,198],[-77,100],[-29,74],[11,13],[26,55],[84,64],[248,-82],[62,-2],[35,-28],[4,-67]],[[8707,2558],[-26,-62],[-38,1],[-49,25],[-7,70],[85,47],[33,-38],[2,-43]]],"transform":{"scale":[0.00017724754245424933,0.00007234203230324061],"translate":[19.32626386800007,59.835069078000075]}};
  Datamap.prototype.andTopo = '__AND__';
  Datamap.prototype.areTopo = '__ARE__';
  Datamap.prototype.argTopo = '__ARG__';
  Datamap.prototype.armTopo = '__ARM__';
  Datamap.prototype.asmTopo = '__ASM__';
  Datamap.prototype.ataTopo = '__ATA__';
  Datamap.prototype.atcTopo = '__ATC__';
  Datamap.prototype.atfTopo = '__ATF__';
  Datamap.prototype.atgTopo = '__ATG__';
  Datamap.prototype.ausTopo = '__AUS__';
  Datamap.prototype.autTopo = '__AUT__';
  Datamap.prototype.azeTopo = '__AZE__';
  Datamap.prototype.bdiTopo = '__BDI__';
  Datamap.prototype.belTopo = '__BEL__';
  Datamap.prototype.benTopo = '__BEN__';
  Datamap.prototype.bfaTopo = '__BFA__';
  Datamap.prototype.bgdTopo = '__BGD__';
  Datamap.prototype.bgrTopo = '__BGR__';
  Datamap.prototype.bhrTopo = '__BHR__';
  Datamap.prototype.bhsTopo = '__BHS__';
  Datamap.prototype.bihTopo = '__BIH__';
  Datamap.prototype.bjnTopo = '__BJN__';
  Datamap.prototype.blmTopo = '__BLM__';
  Datamap.prototype.blrTopo = '__BLR__';
  Datamap.prototype.blzTopo = '__BLZ__';
  Datamap.prototype.bmuTopo = '__BMU__';
  Datamap.prototype.bolTopo = '__BOL__';
  Datamap.prototype.braTopo = '__BRA__';
  Datamap.prototype.brbTopo = '__BRB__';
  Datamap.prototype.brnTopo = '__BRN__';
  Datamap.prototype.btnTopo = '__BTN__';
  Datamap.prototype.norTopo = '__NOR__';
  Datamap.prototype.bwaTopo = '__BWA__';
  Datamap.prototype.cafTopo = '__CAF__';
  Datamap.prototype.canTopo = '__CAN__';
  Datamap.prototype.cheTopo = '__CHE__';
  Datamap.prototype.chlTopo = '__CHL__';
  Datamap.prototype.chnTopo = '__CHN__';
  Datamap.prototype.civTopo = '__CIV__';
  Datamap.prototype.clpTopo = '__CLP__';
  Datamap.prototype.cmrTopo = '__CMR__';
  Datamap.prototype.codTopo = '__COD__';
  Datamap.prototype.cogTopo = '__COG__';
  Datamap.prototype.cokTopo = '__COK__';
  Datamap.prototype.colTopo = '__COL__';
  Datamap.prototype.comTopo = '__COM__';
  Datamap.prototype.cpvTopo = '__CPV__';
  Datamap.prototype.criTopo = '__CRI__';
  Datamap.prototype.csiTopo = '__CSI__';
  Datamap.prototype.cubTopo = '__CUB__';
  Datamap.prototype.cuwTopo = '__CUW__';
  Datamap.prototype.cymTopo = '__CYM__';
  Datamap.prototype.cynTopo = '__CYN__';
  Datamap.prototype.cypTopo = '__CYP__';
  Datamap.prototype.czeTopo = '__CZE__';
  Datamap.prototype.deuTopo = '__DEU__';
  Datamap.prototype.djiTopo = '__DJI__';
  Datamap.prototype.dmaTopo = '__DMA__';
  Datamap.prototype.dnkTopo = '__DNK__';
  Datamap.prototype.domTopo = '__DOM__';
  Datamap.prototype.dzaTopo = '__DZA__';
  Datamap.prototype.ecuTopo = '__ECU__';
  Datamap.prototype.egyTopo = '__EGY__';
  Datamap.prototype.eriTopo = '__ERI__';
  Datamap.prototype.esbTopo = '__ESB__';
  Datamap.prototype.espTopo = '__ESP__';
  Datamap.prototype.estTopo = '__EST__';
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = '__FRA__';
  Datamap.prototype.froTopo = '__FRO__';
  Datamap.prototype.fsmTopo = '__FSM__';
  Datamap.prototype.gabTopo = '__GAB__';
  Datamap.prototype.psxTopo = '__PSX__';
  Datamap.prototype.gbrTopo = '__GBR__';
  Datamap.prototype.geoTopo = '__GEO__';
  Datamap.prototype.ggyTopo = '__GGY__';
  Datamap.prototype.ghaTopo = '__GHA__';
  Datamap.prototype.gibTopo = '__GIB__';
  Datamap.prototype.ginTopo = '__GIN__';
  Datamap.prototype.gmbTopo = '__GMB__';
  Datamap.prototype.gnbTopo = '__GNB__';
  Datamap.prototype.gnqTopo = '__GNQ__';
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = '__IRN__';
  Datamap.prototype.irqTopo = '__IRQ__';
  Datamap.prototype.islTopo = '__ISL__';
  Datamap.prototype.isrTopo = '__ISR__';
  Datamap.prototype.itaTopo = '__ITA__';
  Datamap.prototype.jamTopo = '__JAM__';
  Datamap.prototype.jeyTopo = '__JEY__';
  Datamap.prototype.jorTopo = '__JOR__';
  Datamap.prototype.jpnTopo = '__JPN__';
  Datamap.prototype.kabTopo = '__KAB__';
  Datamap.prototype.kasTopo = '__KAS__';
  Datamap.prototype.kazTopo = '__KAZ__';
  Datamap.prototype.kenTopo = '__KEN__';
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = '__LBY__';
  Datamap.prototype.lcaTopo = '__LCA__';
  Datamap.prototype.lieTopo = '__LIE__';
  Datamap.prototype.lkaTopo = '__LKA__';
  Datamap.prototype.lsoTopo = '__LSO__';
  Datamap.prototype.ltuTopo = '__LTU__';
  Datamap.prototype.luxTopo = '__LUX__';
  Datamap.prototype.lvaTopo = '__LVA__';
  Datamap.prototype.macTopo = '__MAC__';
  Datamap.prototype.mafTopo = '__MAF__';
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = '__PRT__';
  Datamap.prototype.pryTopo = '__PRY__';
  Datamap.prototype.pyfTopo = '__PYF__';
  Datamap.prototype.qatTopo = '__QAT__';
  Datamap.prototype.rouTopo = '__ROU__';
  Datamap.prototype.rusTopo = '__RUS__';
  Datamap.prototype.rwaTopo = '__RWA__';
  Datamap.prototype.sahTopo = '__SAH__';
  Datamap.prototype.sauTopo = '__SAU__';
  Datamap.prototype.scrTopo = '__SCR__';
  Datamap.prototype.sdnTopo = '__SDN__';
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = '__SEN__';
  Datamap.prototype.serTopo = '__SER__';
  Datamap.prototype.sgpTopo = '__SGP__';
  Datamap.prototype.sgsTopo = '__SGS__';
  Datamap.prototype.shnTopo = '__SHN__';
  Datamap.prototype.slbTopo = '__SLB__';
  Datamap.prototype.sleTopo = '__SLE__';
  Datamap.prototype.slvTopo = '__SLV__';
  Datamap.prototype.smrTopo = '__SMR__';
  Datamap.prototype.solTopo = '__SOL__';
  Datamap.prototype.somTopo = '__SOM__';
  Datamap.prototype.spmTopo = '__SPM__';
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = '__SYR__';
  Datamap.prototype.tcaTopo = '__TCA__';
  Datamap.prototype.tcdTopo = '__TCD__';
  Datamap.prototype.tgoTopo = '__TGO__';
  Datamap.prototype.thaTopo = '__THA__';
  Datamap.prototype.tjkTopo = '__TJK__';
  Datamap.prototype.tkmTopo = '__TKM__';
  Datamap.prototype.tlsTopo = '__TLS__';
  Datamap.prototype.tonTopo = '__TON__';
  Datamap.prototype.ttoTopo = '__TTO__';
  Datamap.prototype.tunTopo = '__TUN__';
  Datamap.prototype.turTopo = '__TUR__';
  Datamap.prototype.tuvTopo = '__TUV__';
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = '__UKR__';
  Datamap.prototype.umiTopo = '__UMI__';
  Datamap.prototype.uryTopo = '__URY__';
  Datamap.prototype.usaTopo = '__USA__';
  Datamap.prototype.usgTopo = '__USG__';
  Datamap.prototype.uzbTopo = '__UZB__';
  Datamap.prototype.vatTopo = '__VAT__';
  Datamap.prototype.vctTopo = '__VCT__';
  Datamap.prototype.venTopo = '__VEN__';
  Datamap.prototype.vgbTopo = '__VGB__';
  Datamap.prototype.virTopo = '__VIR__';
  Datamap.prototype.vnmTopo = '__VNM__';
  Datamap.prototype.vutTopo = '__VUT__';
  Datamap.prototype.wlfTopo = '__WLF__';
  Datamap.prototype.wsbTopo = '__WSB__';
  Datamap.prototype.wsmTopo = '__WSM__';
  Datamap.prototype.yemTopo = '__YEM__';
  Datamap.prototype.zafTopo = '__ZAF__';
  Datamap.prototype.zmbTopo = '__ZMB__';
  Datamap.prototype.zweTopo = '__ZWE__';

  /**************************************
                Utilities
  ***************************************/

  //convert lat/lng coords to X / Y coords
  Datamap.prototype.latLngToXY = function(lat, lng) {
     return this.projection([lng, lat]);
  };

  //add <g> layer to root SVG
  Datamap.prototype.addLayer = function( className, id, first ) {
    var layer;
    if ( first ) {
      layer = this.svg.insert('g', ':first-child')
    }
    else {
      layer = this.svg.append('g')
    }
    return layer.attr('id', id || '')
      .attr('class', className || '');
  };

  Datamap.prototype.updateChoropleth = function(data) {
    var svg = this.svg;
    for ( var subunit in data ) {
      if ( data.hasOwnProperty(subunit) ) {
        var color;
        var subunitData = data[subunit]
        if ( ! subunit ) {
          continue;
        }
        else if ( typeof subunitData === "string" ) {
          color = subunitData;
        }
        else if ( typeof subunitData.color === "string" ) {
          color = subunitData.color;
        }
        else {
          color = this.options.fills[ subunitData.fillKey ];
        }
        //if it's an object, overriding the previous data
        if ( subunitData === Object(subunitData) ) {
          this.options.data[subunit] = defaults(subunitData, this.options.data[subunit] || {});
          var geo = this.svg.select('.' + subunit).attr('data-info', JSON.stringify(this.options.data[subunit]));
        }
        svg
          .selectAll('.' + subunit)
          .transition()
            .style('fill', color);
      }
    }
  };

  Datamap.prototype.updatePopup = function (element, d, options) {
    var self = this;
    element.on('mousemove', null);
    element.on('mousemove', function() {
      var position = d3.mouse(self.options.element);
      d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover')
        .style('top', ( (position[1] + 30)) + "px")
        .html(function() {
          var data = JSON.parse(element.attr('data-info'));
          try {
            return options.popupTemplate(d, data);
          } catch (e) {
            return "";
          }
        })
        .style('left', ( position[0]) + "px");
    });

    d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover').style('display', 'block');
  };

  Datamap.prototype.addPlugin = function( name, pluginFn ) {
    var self = this;
    if ( typeof Datamap.prototype[name] === "undefined" ) {
      Datamap.prototype[name] = function(data, options, callback, createNewLayer) {
        var layer;
        if ( typeof createNewLayer === "undefined" ) {
          createNewLayer = false;
        }

        if ( typeof options === 'function' ) {
          callback = options;
          options = undefined;
        }

        options = defaults(options || {}, self.options[name + 'Config']);

        //add a single layer, reuse the old layer
        if ( !createNewLayer && this.options[name + 'Layer'] ) {
          layer = this.options[name + 'Layer'];
          options = options || this.options[name + 'Options'];
        }
        else {
          layer = this.addLayer(name);
          this.options[name + 'Layer'] = layer;
          this.options[name + 'Options'] = options;
        }
        pluginFn.apply(this, [layer, data, options]);
        if ( callback ) {
          callback(layer);
        }
      };
    }
  };

  // expose library
  if (typeof exports === 'object') {
    d3 = require('d3');
    topojson = require('topojson');
    module.exports = Datamap;
  }
  else if ( typeof define === "function" && define.amd ) {
    define( "datamaps", ["require", "d3", "topojson"], function(require) {
      d3 = require('d3');
      topojson = require('topojson');

      return Datamap;
    });
  }
  else {
    window.Datamap = window.Datamaps = Datamap;
  }

  if ( window.jQuery ) {
    window.jQuery.fn.datamaps = function(options, callback) {
      options = options || {};
      options.element = this[0];
      var datamap = new Datamap(options);
      if ( typeof callback === "function" ) {
        callback(datamap, options);
      }
      return this;
    };
  }
})();
