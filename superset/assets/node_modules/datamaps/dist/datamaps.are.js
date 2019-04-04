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
  Datamap.prototype.aldTopo = '__ALD__';
  Datamap.prototype.andTopo = '__AND__';
  Datamap.prototype.areTopo = {"type":"Topology","objects":{"are":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Ras Al Khaymah"},"id":"AE.RK","arcs":[[[0,1,2,3,4,5,6,7,8,9]],[[10,11,12,13]]]},{"type":"Polygon","properties":{"name":"Umm Al Qaywayn"},"id":"AE.UQ","arcs":[[14,15,-13]]},{"type":"MultiPolygon","properties":{"name":"Fujayrah"},"id":"AE.FU","arcs":[[[16,17,-4,18]],[[19,20,21,-2,22,23,24]],[[25,26,-10,27,28,29,-11,30]]]},{"type":"Polygon","properties":{"name":"Neutral Zone"},"id":"AE.","arcs":[[31,-17,32,-21,33]]},{"type":"MultiPolygon","properties":{"name":"Ajman"},"id":"AE.AJ","arcs":[[[34,-29]],[[35,36]]]},{"type":"Polygon","properties":{"name":"Neutral Zone"},"id":"AE.","arcs":[[-7,37,38]]},{"type":"MultiPolygon","properties":{"name":"Sharjah"},"id":"AE.SH","arcs":[[[-19,-3,-22,-33]],[[-34,-20,39]],[[40]],[[41,-26,42,-24]],[[-12,-30,-35,-28,-9,43,44,45,46,-37,47,-15]]]},{"type":"MultiPolygon","properties":{"name":"Abu Dhabi"},"id":"AE.AZ","arcs":[[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58]],[[-45,59,60]],[[61]],[[62]]]},{"type":"MultiPolygon","properties":{"name":"Dubay"},"id":"AE.DU","arcs":[[[-38,-6,63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]],[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[120]],[[121]],[[122]],[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]],[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[151]],[[152]],[[153]],[[154]],[[155]],[[156]],[[157]],[[158]],[[159]],[[160]],[[161]],[[162]],[[163]],[[164]],[[165]],[[166]],[[167]],[[168]],[[169]],[[170]],[[171]],[[172]],[[173]],[[174]],[[175]],[[176]],[[177]],[[178]],[[179]],[[180]],[[181]],[[182]],[[183]],[[184]],[[185]],[[186]],[[187]],[[188]],[[189]],[[190]],[[191]],[[192]],[[193]],[[194]],[[195]],[[196]],[[197]],[[198]],[[199]],[[200]],[[201]],[[202]],[[203]],[[204]],[[205]],[[206]],[[207]],[[208]],[[209]],[[210]],[[211]],[[212]],[[213]],[[214]],[[215]],[[216]],[[217]],[[218]],[[219]],[[220]],[[221]],[[222]],[[223]],[[224]],[[225]],[[226]],[[227]],[[228]],[[229]],[[230]],[[231]],[[232]],[[233]],[[234]],[[235]],[[236]],[[237]],[[238]],[[239]],[[240]],[[241]],[[242]],[[243]],[[244]],[[245]],[[246]],[[247]],[[248]],[[249]],[[250]],[[251]],[[252]],[[253]],[[254]],[[255]],[[256]],[[257]],[[258]],[[259]],[[260]],[[261]],[[262]],[[263]],[[264]],[[265]],[[266]],[[267]],[[268]],[[269]],[[270]],[[271]],[[272]],[[273]],[[274]],[[275]],[[276]],[[277]],[[278]],[[279]],[[280]],[[-61,281,-46]]]}]}},"arcs":[[[9687,7792],[5,-47],[6,-29],[13,-24],[-20,-30],[-56,-35],[-5,-72],[2,-11]],[[9632,7544],[-26,-13],[-59,-7],[-12,-12],[-2,-19],[11,-61],[2,-32],[-1,-32],[-24,-184],[-2,-34],[3,-26],[5,-23],[7,-18],[9,-41]],[[9543,7042],[-24,-17],[-2,-14],[1,-20],[41,-84],[28,-80],[8,-36],[1,-23],[-7,-18],[-7,-28],[-4,-59],[11,-32],[17,-22],[20,-9],[102,-17]],[[9728,6583],[35,-34],[9,-31],[1,-1]],[[9773,6517],[-69,-86],[-37,-23],[-78,-12],[-31,-18]],[[9558,6378],[-1,0],[-135,-11]],[[9422,6367],[-114,133],[-53,47]],[[9255,6547],[-18,128],[-23,86],[-57,45],[-5,1]],[[9152,6807],[2,28],[-13,62],[-35,88],[-8,29],[-3,44],[0,35],[5,38],[45,141],[13,24],[0,12],[-8,21],[-10,20],[-27,37],[-8,15],[-2,14],[-1,14],[19,40],[30,30],[22,41]],[[9173,7540],[78,-7],[32,-12],[25,0],[18,6],[20,9],[20,-1],[62,-16],[22,4],[13,8],[6,13],[5,8],[12,10],[6,9],[4,12],[0,15],[-2,16],[3,19],[9,21],[33,29],[15,17],[11,15],[10,24],[1,3],[-1,3],[-2,2],[-2,1],[-28,-2],[-8,1],[-6,1],[-7,4],[-4,5],[-10,17],[-8,5],[-11,1],[-14,-3],[-6,7],[2,13],[28,38],[16,15],[17,8],[8,-1],[67,-23],[6,-5],[2,-6],[-2,-9],[-3,-9],[0,-9],[2,-7],[17,-10],[58,13]],[[9519,8792],[-28,-24],[-87,-30],[-28,-2],[-18,3],[-13,6],[-10,-4],[-11,-9],[-25,-25],[-51,-69],[-23,-17],[-18,-6],[-13,0],[-16,4],[-22,-4],[-17,-17],[-7,-19],[-1,-22],[11,-60],[0,-22],[17,-94],[5,-47],[2,-12],[5,-8],[8,-5],[20,-5],[6,-2],[14,-8],[7,-2],[64,8],[44,-3],[14,4],[11,8],[28,26],[0,1],[2,1],[4,2],[8,2],[10,-1],[6,-2],[2,-2],[1,0],[0,-1],[9,-12],[28,-46],[6,-17],[5,-24],[-5,-25],[-13,-26],[-50,-71],[-6,-11],[-1,-7],[3,-6],[2,-3],[3,-6],[2,-6],[2,-9],[4,-9],[7,-7],[12,-4],[13,0],[17,5],[15,-8],[9,-18],[4,-60],[-7,-22],[-9,-9],[-12,1],[-11,-5],[-15,-23],[-13,-14],[-16,-12],[-18,-4],[-22,4],[-102,38],[-13,10],[-11,15],[-8,17],[-8,13],[-16,16]],[[9205,7990],[-45,25],[-13,-2],[-16,-12],[-7,-27],[-9,-66],[-28,-77],[-34,63]],[[9053,7894],[-44,69],[-55,64],[-2,24],[8,22],[10,23],[1,29],[-14,26],[-78,107],[-14,36],[-6,28],[-1,10],[1,28],[-4,46],[-8,61],[-56,233],[-11,23],[-16,10],[-20,7],[-16,3],[-51,59],[-2,3]],[[8675,8805],[28,50],[23,22],[18,3],[27,11],[23,15],[10,20],[9,7],[62,21],[74,76],[113,181],[57,61],[-13,-26],[-13,-60],[-21,-50],[8,-17],[15,-5],[8,9],[5,43],[19,82],[5,55],[13,24],[87,105],[18,30],[16,33],[13,42],[8,53],[-14,0],[-7,-27],[-13,-22],[-16,-18],[-19,-10],[54,114],[45,123],[37,184],[9,25],[48,5],[106,35],[23,-4],[33,-111],[10,-59],[-4,-53],[-14,-86],[-9,-260],[-14,-42],[-40,-71],[-10,-43],[9,-49],[49,-82],[9,-36],[-14,-38],[-27,-26],[-23,-30],[-1,-50],[10,-129],[11,-35],[4,-3]],[[9053,7894],[-38,1],[-6,-7],[-3,-10],[10,-36],[4,-25],[3,-25],[-2,-22],[-6,-17],[-12,-11],[-15,-8],[-30,-12],[-24,-15],[-16,-8],[-28,-8],[-30,-2],[-26,3],[-20,9],[-13,15],[-17,30],[-21,62],[-14,76],[-16,34],[-26,38],[-96,108],[-40,35],[-146,75],[-25,21],[-62,68],[-136,107],[-6,3],[-1,0]],[[8195,8373],[11,36],[9,49],[23,58],[32,47],[35,17],[-18,-47],[-22,-39],[-14,-36],[13,-38],[32,-16],[41,9],[45,17],[44,10],[13,23],[32,113],[19,42],[55,75],[33,32],[72,35],[25,45]],[[9775,6638],[64,-15],[16,9],[0,1]],[[9855,6633],[-1,-20],[-11,-29],[-59,-53],[-11,-14]],[[9728,6583],[13,59],[34,-4]],[[9955,7085],[-12,3],[-110,32],[-18,0],[-20,-5],[-1,-13],[4,-11],[7,-15],[7,-20],[5,-24],[3,-41],[4,-18],[7,-15],[6,-11],[2,-20],[-2,-26],[-8,-38],[-12,-22],[-12,-14],[-17,-80]],[[9788,6747],[-24,-36]],[[9764,6711],[-35,110],[-148,201],[-13,12],[-25,8]],[[9632,7544],[1,-17],[26,-16],[33,-12],[34,19],[61,55],[24,26],[48,22],[58,38],[10,80]],[[9927,7739],[15,26],[53,51],[3,2]],[[9998,7818],[1,-23],[-2,-33],[-9,-56],[-6,-87],[-20,-126],[-7,-408]],[[9960,8113],[-9,-6],[-84,-97],[-78,-59],[-21,-24],[-12,-31],[-6,-29],[-6,-21]],[[9744,7846],[-57,-54]],[[9173,7540],[6,61],[0,16],[-24,87]],[[9155,7704],[53,56],[9,30],[-2,11],[-3,10],[-4,8],[-5,6],[-7,5],[-29,18]],[[9167,7848],[38,142]],[[9519,8792],[8,-6],[49,-11],[18,-19],[21,-58],[15,-22],[32,-11],[34,7],[86,32],[44,-33],[48,-24],[34,-9],[17,-34],[46,-195],[-13,-267],[2,-29]],[[9859,6685],[-4,-52]],[[9775,6638],[-8,46],[-3,27]],[[9788,6747],[31,-47],[27,-14],[12,-1],[1,0]],[[9155,7704],[-26,71],[1,17],[4,19],[9,14],[8,9],[16,14]],[[8007,8030],[30,52],[13,0],[9,-35],[12,-2],[12,22],[9,35],[15,-20],[28,108],[12,30]],[[8147,8220],[1,-1],[1,-1],[25,-22],[33,-9],[21,-12],[31,-26],[24,-12],[125,-28],[21,-11],[9,-14],[-27,-97],[-19,-42],[-12,-13],[-14,-3],[-175,12],[-73,20],[-63,28],[-47,40],[-1,0],[0,1]],[[9422,6367],[-49,-141],[-13,-57],[2,-40],[-1,-22],[0,-1]],[[9361,6106],[-30,5],[-63,65],[-61,199],[-78,89],[-15,43],[7,37],[36,14],[29,-9],[27,-18],[50,-45],[-8,61]],[[9955,7085],[-1,-32],[44,-229],[-112,-16],[-10,-13],[-11,-16],[-6,-94]],[[9790,7627],[-41,-18],[-8,77],[12,15],[18,1],[30,-27],[-11,-48]],[[9927,7739],[-82,21],[-39,76],[-62,10]],[[9960,8113],[7,-78],[-3,-22],[-16,-36],[2,-26],[21,-47],[9,-29],[10,-19],[7,-22],[1,-16]],[[9152,6807],[-84,16],[-80,-26],[-72,-59],[-9,-10],[-59,-69],[-63,-101],[-22,-90],[18,-222],[0,-55],[-9,-108],[4,-53],[11,-31]],[[8787,5999],[-21,-6],[-85,-1],[-162,53]],[[8519,6045],[11,33],[4,23],[4,31],[2,38],[0,49],[-11,91],[-24,121],[-7,86],[0,68],[-2,21],[-8,37],[-24,82],[-36,94],[-16,66],[1,3],[0,1],[12,31],[7,12],[10,14],[26,29],[12,16],[8,19],[4,17],[-1,19],[-60,317],[-25,60],[-33,44],[-148,127],[-16,23],[-16,19],[-16,15],[-68,49],[-17,20],[-22,42],[-13,14],[-19,-5],[-69,-32],[-59,-4],[-106,37],[-4,4]],[[7800,7776],[30,42],[18,10],[32,-2],[-10,36],[2,35],[12,29],[24,18],[21,-23],[42,46],[36,63]],[[8147,8220],[8,17],[22,25],[-25,17],[13,36],[26,46],[4,12]],[[932,4631],[-21,-28],[-7,8],[-14,8],[-7,8],[9,21],[0,30],[12,46],[25,14],[18,-34],[-1,-11],[-4,-9],[4,-12],[-14,-41]],[[4764,4672],[53,-43],[8,-6],[71,-19],[15,-8],[43,-22],[21,-82],[-28,-66],[-64,-29],[-74,4],[-62,32],[5,27],[-17,37],[-24,9],[-22,-55],[16,-18],[-57,-47],[-68,-17],[-69,10],[-62,32],[-35,26],[-1,0],[-20,9],[-57,5],[-36,6],[-24,11],[-1,22],[33,42],[23,18],[3,2],[0,1],[51,24],[22,14],[39,45],[12,10],[15,12],[9,4],[24,10],[20,-1],[30,-16],[5,-2],[10,-3],[14,8],[50,52],[57,31],[23,17],[18,31],[11,-36],[-2,-9],[-9,-15],[21,-44],[10,-13]],[[5461,4725],[-16,-75],[-21,52],[-45,25],[-52,19],[-45,33],[-23,75],[29,61],[45,24],[10,-12],[18,-20],[53,-75],[25,-36],[22,-71]],[[5563,4812],[-18,-6],[-23,1],[-12,9],[-36,53],[-26,24],[-19,11],[-8,19],[11,45],[15,27],[25,22],[29,12],[30,-1],[18,-49],[21,-41],[46,-69],[-14,-24],[-19,-20],[-20,-13]],[[2159,4769],[-35,-43],[-27,37],[-23,49],[-25,69],[5,58],[34,49],[26,48],[50,37],[48,-19],[23,-46],[11,-75],[-4,-45],[-45,-75],[-38,-44]],[[5745,5046],[1,-39],[-22,-84],[-34,-22],[-57,126],[-5,20],[15,4],[23,-8],[20,-16],[9,-6],[3,13],[-6,16],[-31,29],[-6,27],[27,4],[43,-38],[20,-26]],[[3860,4944],[-82,-48],[-39,-32],[-49,-8],[-30,-28],[0,-32],[-18,-43],[-30,46],[-29,3],[-38,26],[-21,-43],[-79,15],[-29,6],[-44,-12],[-8,-3],[-5,0],[-5,16],[1,16],[6,21],[8,18],[6,8],[78,-22],[21,7],[53,30],[11,12],[11,11],[68,35],[39,22],[18,0],[20,-46],[21,-14],[18,12],[5,31],[-3,31],[-13,29],[78,147],[37,33],[2,-17],[9,-29],[3,-15],[48,-35],[1,0],[-14,-112],[-26,-36]],[[6026,5223],[-29,-12],[-55,12],[-99,42],[-99,39],[0,46],[84,100],[29,56],[14,0],[-14,-61],[0,-1],[15,-52],[37,-37],[77,-51],[38,-48],[2,-33]],[[1572,5384],[-25,-15],[-30,21],[-11,18],[-10,8],[-13,15],[-2,39],[18,32],[16,34],[23,18],[47,-40],[14,-70],[-27,-60]],[[345,5728],[8,-25],[-3,-18],[-1,-9],[-9,-25],[-6,-22],[-10,11],[-3,39],[5,18],[-7,-5],[-1,10],[-1,12],[-1,-4],[-3,0],[-3,1],[0,-5],[-2,-1],[2,-11],[-12,14],[-2,28],[16,16],[9,-1],[24,-23]],[[3144,6522],[-8,-59],[-13,16],[-3,14],[-17,28],[-11,37],[6,21],[38,-7],[8,-50]],[[8787,5999],[31,-88],[7,-56],[-58,-68],[-13,-97],[-30,-40],[-21,-41],[3,-61],[26,-122],[-5,-157],[7,-44],[13,-20],[42,-36],[16,-25],[4,-25],[-7,-140],[-13,-42],[-81,-183],[-16,-51],[3,-44],[25,-16],[130,-36],[35,-3],[116,61],[62,-34],[33,-103],[25,-123],[77,-177],[-23,-46],[-132,-42],[-242,-126],[-38,6],[-54,54],[-38,-8],[-34,-17],[-32,-1],[-67,15],[-69,2],[-59,-14],[-57,-30],[-61,-42],[-40,-29],[-89,-43],[-89,-21],[-8,-42],[18,-53],[35,-40],[75,-58],[33,-63],[10,-84],[6,-219],[-8,-39],[-97,-184],[-19,-49],[-69,-359],[-29,-56],[-77,-109],[-39,-75],[-24,-96],[-43,-289],[-46,-177],[-198,-446],[-64,-278],[-7,-86],[13,-422],[-23,-423],[-138,-232],[-31,-7],[-284,49],[-289,49],[-289,50],[-289,49],[-288,50],[-289,49],[-289,50],[-288,49],[-290,50],[-288,49],[-289,50],[-289,49],[-289,50],[-288,49],[-289,50],[-289,49],[-289,50],[-334,57],[-51,22],[-41,46],[-112,184],[-108,180],[-108,180],[-109,179],[-108,180],[-108,179],[-108,180],[-109,179],[-108,180],[-108,179],[-109,180],[-108,179],[-108,180],[-109,179],[-108,180],[-108,180],[-109,179],[-118,196],[-31,68],[-11,75],[4,186],[1,75],[-13,111],[44,82],[2,128],[-36,103],[41,60],[18,-49],[44,-83],[9,-57],[0,-167],[13,-102],[30,-24],[29,41],[20,131],[15,-35],[20,-90],[14,-30],[10,-7],[19,-3],[17,6],[11,14],[3,14],[-8,6],[40,124],[38,37],[43,-82],[6,-63],[-21,-185],[3,-67],[25,-143],[3,-31],[-3,-98],[5,-31],[19,-59],[4,-28],[22,-52],[49,-16],[101,-3],[24,-10],[19,-14],[36,-44],[18,-17],[16,0],[6,13],[-12,23],[-4,32],[45,8],[118,-9],[15,6],[14,-6],[26,-31],[64,-39],[18,1],[87,20],[37,-12],[21,15],[20,-15],[33,19],[35,3],[38,-3],[37,2],[35,16],[79,63],[35,7],[66,1],[28,10],[24,26],[25,33],[28,29],[29,13],[35,8],[40,22],[33,29],[14,31],[12,33],[63,34],[31,32],[27,35],[36,35],[37,27],[28,10],[23,22],[6,49],[1,53],[6,35],[40,29],[38,-17],[32,-40],[75,-131],[24,-11],[8,8],[7,15],[18,10],[47,-2],[85,-32],[45,-7],[26,5],[45,28],[22,8],[24,-1],[18,-6],[15,-9],[15,-6],[177,-19],[19,5],[74,36],[10,11],[3,16],[3,12],[13,1],[10,-9],[8,-13],[6,-12],[4,-6],[61,-64],[38,-24],[83,47],[43,-21],[39,-27],[35,10],[-29,21],[-8,28],[-1,33],[-6,37],[48,12],[54,-31],[50,-52],[34,-48],[29,-60],[16,-16],[115,-8],[266,69],[18,0],[19,-15],[28,-41],[22,-19],[29,-9],[31,2],[24,16],[38,-37],[22,-16],[19,-6],[9,-11],[26,-53],[15,-17],[17,-4],[24,0],[23,5],[35,24],[21,-7],[20,-13],[17,-5],[64,39],[14,13],[17,12],[20,-5],[21,-11],[20,-7],[253,-2],[52,8],[22,25],[128,88],[131,27],[41,28],[44,10],[55,34],[63,11],[22,8],[27,22],[37,38],[35,46],[14,43],[21,22],[136,50],[111,104],[18,4],[17,36],[40,-3],[84,-44],[16,33],[77,76],[39,70],[82,209],[-12,72],[7,34],[33,22],[-19,17],[-9,3],[0,21],[32,-3],[51,-31],[30,-7],[-13,36],[-35,50],[-7,35],[31,-19],[33,-13],[30,-17],[19,-31],[13,0],[-6,77],[-39,24],[-55,3],[-56,15],[-121,104],[-49,15],[0,18],[25,9],[26,21],[21,32],[3,-19],[8,-24],[16,-19],[-5,29],[7,26],[27,45],[14,0],[16,-80],[41,-78],[51,-49],[49,10],[-13,8],[-31,33],[24,-2],[45,-18],[18,-2],[7,11],[18,40],[10,9],[78,199],[-34,19],[-16,26],[8,23],[35,9],[22,18],[6,39],[12,41],[38,23],[0,18],[-18,17],[-9,29],[-6,37],[-9,37],[11,21],[-15,12],[-16,21],[5,47],[20,27],[81,70],[10,19],[10,27],[12,17],[64,-38],[3,-4],[31,9],[30,26],[10,38],[-28,46],[226,168],[101,93],[63,74],[42,36],[51,21]],[[7110,6789],[5,2],[9,4],[8,3],[5,2],[19,-29],[256,-935],[21,-56],[25,-42],[41,-16],[43,-7],[440,23],[57,16],[63,29],[140,103],[229,119],[48,40]],[[2732,7323],[4,-46],[-11,11],[-13,9],[-3,54],[23,-28]],[[5528,7592],[18,-101],[-26,17],[-27,0],[-34,51],[28,51],[41,-18]],[[9558,6378],[-34,-108],[-45,-69],[-12,-50],[-19,-30],[-40,-14],[-44,-2],[-3,1]],[[7256,7011],[6,-23],[-40,-33],[-10,18],[19,17],[-16,-16],[7,-9],[36,36],[-3,8],[-20,-16],[21,18]],[[7429,7143],[-1,-1],[0,2],[-1,2],[-1,0],[-1,2],[0,2],[0,2],[4,3],[3,5],[2,3],[1,2],[1,1],[0,-2],[0,-2],[-1,-2],[-3,-4],[-3,-6],[0,-2],[0,-2],[0,-3]],[[7389,7159],[6,-1],[5,0],[6,1],[7,2],[1,0],[2,-1],[1,-2],[1,-2],[1,0],[1,1],[0,1],[0,2],[0,1],[0,1],[0,-1],[1,-1],[0,-1],[0,-2],[0,-1],[-2,-1],[-7,-2],[-7,-1],[-8,-1],[-7,1],[-5,1],[-3,2],[-4,3],[-3,4],[0,1],[0,5],[2,-2],[1,0],[2,0],[2,-2],[4,-3],[3,-2]],[[7462,7202],[0,-2],[-1,1],[-1,-1],[-1,-3],[0,-2],[-1,0],[0,2],[-1,0],[-1,-2],[0,-1],[-1,-1],[-1,0],[-1,0],[1,1],[2,3],[2,4],[2,4],[1,2],[0,2],[2,0],[2,0],[2,-1],[2,-1],[0,-1],[-2,0],[-1,-1],[-1,-1],[-1,0],[-1,-1],[-2,-1],[1,0]],[[7410,7225],[-1,-4],[0,-1],[1,-1],[0,1],[2,5],[3,7],[4,5],[6,7],[7,5],[3,3],[3,1],[2,0],[0,-2],[0,-2],[-2,-1],[-5,-2],[-7,-5],[-6,-7],[-3,-6],[-5,-9],[0,-1],[0,-1],[1,1],[5,6],[5,7],[6,5],[5,3],[8,4],[1,-1],[1,-2],[0,-1],[-2,-1],[-6,-2],[-5,-3],[-6,-5],[-6,-5],[-4,-7],[-1,-1],[0,-1],[1,0],[1,1],[4,5],[6,4],[7,3],[7,2],[2,1],[2,0],[1,-1],[0,-2],[-1,-1],[-4,0],[-6,-2],[-7,-3],[-6,-5],[-3,-3],[-1,-1],[0,-1],[2,1],[3,3],[6,3],[4,1],[11,0],[1,-1],[0,-2],[-1,-1],[-1,0],[-9,0],[-5,0],[-6,-3],[-2,-2],[0,-1],[2,-2],[1,0],[2,0],[1,0],[1,-1],[1,-2],[1,0],[1,1],[0,2],[3,4],[1,-1],[1,-3],[0,-4],[-2,-2],[1,-1],[4,-4],[2,-1],[1,1],[1,1],[1,2],[1,0],[1,1],[0,1],[0,1],[3,-3],[-1,-1],[-1,0],[-1,0],[0,-1],[0,-1],[-1,-1],[-1,-1],[0,-1],[0,-2],[5,-5],[5,-6],[2,-4],[0,-2],[-1,-2],[-3,-5],[-2,-1],[-1,0],[-2,1],[-1,1],[-13,14],[-5,4],[-1,0],[-2,0],[-2,0],[-1,0],[-2,0],[-1,1],[0,2],[3,6],[0,2],[-1,2],[-1,1],[-1,2],[-1,2],[1,1],[0,2],[-1,1],[0,-2],[-1,-5],[-1,-9],[0,-7],[1,-5],[1,-5],[0,-1],[-1,-2],[-2,1],[-1,5],[-1,7],[1,13],[0,6],[1,4],[-1,0],[-2,-5],[-2,-9],[-1,-7],[0,-6],[1,-8],[-1,-2],[-1,-1],[-1,0],[-1,2],[0,6],[0,11],[4,13],[2,5],[1,2],[0,1],[0,1],[-1,-1],[-2,-2],[-3,-6],[-4,-9],[-2,-6],[-1,-7],[-1,-7],[0,-2],[0,-2],[-2,0],[0,1],[0,1],[0,8],[2,8],[1,5],[3,7],[4,9],[3,3],[0,1],[1,1],[-1,1],[0,-1],[-2,-1],[-7,-9],[-5,-8],[-2,-5],[-2,-7],[-1,-4],[0,-5],[-1,-3],[-1,0],[-1,1],[0,3],[0,3],[1,6],[2,8],[3,6],[4,7],[9,9],[1,1],[0,1],[0,1],[-1,0],[0,-1],[-5,-3],[-6,-5],[-5,-7],[-4,-6],[-3,-6],[-2,-5],[-1,-1],[-2,0],[-1,1],[0,3],[1,3],[4,6],[5,7],[6,7],[7,6],[4,2],[0,1],[-1,0],[-4,-2],[-5,-2],[-6,-3],[-5,-6],[-4,-4],[-1,-1],[-2,0],[0,3],[2,3],[8,6],[7,5],[6,2],[2,1],[0,1],[-1,1],[-1,0],[-5,0],[-5,-2],[-4,-1],[-4,-3],[-1,1],[0,2],[2,2],[5,2],[5,1],[5,0],[0,2],[-1,1],[-2,0],[-2,0],[-5,-1],[-2,1],[-1,1],[0,2],[1,1],[3,0],[1,1],[0,1],[-1,1],[0,1],[0,2],[1,2],[1,0],[1,-1],[1,0],[1,0],[1,1],[-1,5],[1,1],[2,0],[0,-2],[0,-4],[0,-3],[1,-1],[1,-3],[1,-2],[1,0],[0,1],[0,3],[0,7],[0,9],[1,2],[1,0],[1,-1],[-1,-10],[0,-15],[1,-2],[1,0],[0,3],[1,8],[1,7],[2,7],[4,8],[1,2],[1,0],[2,-1],[1,-2],[-2,-2],[-4,-8],[-3,-7],[-1,-6],[-1,-9],[0,-2],[0,-1],[1,0],[1,1],[0,2],[1,4],[2,6],[2,6],[4,7],[5,8],[3,4],[3,1],[1,-1],[0,-2],[-1,-2],[-4,-3],[-4,-6],[-3,-5],[-5,-9],[-2,-8]],[[7458,7214],[-2,-1],[-2,0],[-1,1],[1,1],[1,-1],[1,-1],[0,1],[1,1],[1,1],[0,1],[-3,1],[-1,1],[0,11],[1,8],[-1,6],[-3,7],[-4,7],[-2,3],[0,1],[3,3],[1,-1],[5,-10],[4,-9],[1,-12],[0,-9],[-1,-8],[0,-2]],[[7436,7275],[7,-4],[2,-2],[0,-1],[-2,-4],[-1,0],[-4,4],[-5,2],[-5,1],[-9,1],[-6,0],[-3,-2],[-3,-2],[-3,-4],[-2,-1],[-2,0],[-2,0],[-2,-1],[-3,-4],[-7,-6],[-5,-10],[-6,-9],[-3,-6],[-2,-8],[-3,-8],[0,-9],[1,-8],[1,-9],[2,-6],[0,-1],[0,-1],[1,-2],[1,-2],[-1,-3],[-1,-3],[-3,4],[-3,6],[-1,5],[-2,9],[0,14],[0,10],[2,9],[4,9],[3,6],[6,12],[4,5],[4,5],[6,6],[5,4],[8,5],[5,2],[5,0],[8,1],[6,-1],[4,-1],[4,-2]],[[7445,7406],[3,-1],[4,1],[13,1],[6,-1],[5,1],[4,2],[2,3],[1,3],[0,5],[0,2],[0,3],[2,0],[0,-5],[0,-2],[-1,-3],[-2,-5],[-1,-1],[-4,-3],[-6,-1],[-6,0],[-12,0],[-4,-1],[-4,0],[-5,1],[-3,3],[-9,4],[-3,2],[-3,3],[-3,8],[-2,5],[-1,1],[1,1],[3,-6],[3,-8],[2,-3],[3,-1],[9,-5],[3,-2],[5,-1]],[[7498,7437],[-1,0],[-3,0],[0,2],[2,1],[2,-2],[0,-1]],[[7499,7417],[-4,-3],[-1,0],[-3,0],[-1,-1],[-1,0],[-1,1],[5,4],[2,0],[3,1],[5,3],[7,5],[3,2],[2,1],[2,1],[3,3],[2,2],[0,2],[2,2],[1,0],[1,-2],[-1,-2],[-2,-1],[-2,-2],[-4,-4],[-3,-2],[-4,-2],[-6,-4],[-5,-4]],[[7511,7435],[0,-1],[-3,0],[0,1],[1,3],[3,2],[2,-1],[0,-2],[0,-2],[-3,0]],[[7499,7442],[-1,-2],[-2,1],[-1,0],[1,1],[1,1],[2,-1]],[[7492,7440],[0,-1],[-2,0],[0,1],[-1,1],[2,2],[1,-1],[0,-2]],[[7490,7443],[-1,0],[-1,0],[-1,1],[-1,2],[1,2],[2,-1],[1,-3],[0,-1]],[[7506,7430],[-2,-1],[-1,1],[-1,2],[1,4],[1,3],[1,3],[-1,3],[1,3],[3,0],[4,-2],[1,-2],[0,-2],[-4,0],[-3,-2],[-1,-5],[1,-3],[0,-2]],[[7494,7445],[-1,-1],[-1,0],[-1,2],[0,1],[2,1],[1,-1],[0,-2]],[[7500,7446],[-1,-2],[-2,1],[0,1],[1,2],[2,1],[1,-1],[-1,-2]],[[7486,7448],[-1,0],[-2,0],[-1,2],[0,2],[1,1],[2,-1],[1,-2],[0,-2]],[[7453,7452],[-2,-1],[-2,1],[0,2],[1,0],[1,0],[1,1],[1,0],[0,-2],[0,-1]],[[7491,7449],[-1,0],[-1,1],[-1,2],[-2,2],[0,1],[1,0],[3,-2],[1,-3],[0,-1]],[[7459,7453],[-3,0],[-1,1],[0,2],[3,0],[1,-1],[0,-2]],[[7445,7452],[-1,0],[-2,0],[-2,2],[-2,1],[0,1],[1,1],[1,0],[3,-2],[2,-1],[0,-1],[0,-1]],[[7478,7452],[-2,0],[-1,1],[1,2],[1,3],[1,0],[1,-2],[0,-1],[-1,-3]],[[7491,7456],[-1,-1],[-1,0],[-1,2],[1,1],[2,0],[0,-2]],[[7438,7456],[-1,-1],[-2,1],[-2,1],[-1,1],[0,2],[1,0],[2,-1],[2,-1],[1,-2]],[[7473,7456],[-1,-1],[-1,0],[-1,2],[0,1],[1,2],[2,1],[1,-1],[0,-2],[-1,-2]],[[7484,7458],[-2,0],[-1,0],[1,2],[1,2],[2,0],[2,0],[0,-2],[-1,-1],[-1,-1],[-1,0]],[[7444,7461],[1,-1],[1,-1],[1,-1],[0,-1],[-3,1],[0,1],[-1,1],[-2,0],[0,2],[1,1],[1,0],[1,-2]],[[7438,7461],[0,2],[1,0],[0,-1],[-1,-1]],[[7452,7461],[-1,-2],[-2,1],[-1,1],[-1,2],[0,1],[2,1],[2,-2],[1,-2]],[[7479,7460],[-1,0],[-2,1],[-1,2],[0,2],[2,1],[2,-1],[0,-2],[1,-2],[-1,-1]],[[7432,7465],[-1,-1],[-1,0],[-2,1],[0,2],[2,1],[1,-1],[1,-2]],[[7483,7465],[-2,-1],[-1,0],[0,1],[1,2],[1,1],[1,-1],[1,-1],[-1,-1]],[[7490,7463],[0,-2],[-1,0],[-1,2],[0,2],[-1,2],[1,1],[2,-2],[0,-3]],[[7436,7463],[-1,0],[-1,1],[0,2],[1,1],[1,2],[2,0],[-1,-2],[-1,-1],[0,-3]],[[7470,7462],[-2,0],[-1,1],[0,2],[2,3],[1,1],[1,-3],[0,-1],[-1,-3]],[[7444,7467],[-1,-1],[-3,1],[0,2],[0,1],[2,1],[1,-1],[1,-1],[0,-2]],[[7464,7467],[0,-1],[-1,1],[0,1],[2,3],[1,-1],[0,-2],[-2,-1]],[[7474,7467],[-1,0],[-1,1],[0,2],[0,1],[2,0],[2,0],[0,-2],[0,-2],[-2,0]],[[7452,7467],[-1,0],[-1,0],[-2,2],[-1,0],[-1,1],[0,1],[0,1],[2,1],[1,-1],[1,-1],[1,-1],[1,-1],[0,-2]],[[7434,7470],[-1,-1],[-1,0],[-1,1],[0,1],[1,2],[1,0],[1,-3]],[[7470,7471],[-2,0],[0,2],[1,1],[1,0],[1,-1],[-1,-2]],[[7479,7470],[-1,0],[0,1],[0,1],[2,2],[2,0],[0,-1],[0,-1],[-1,-2],[-2,0]],[[7440,7472],[-2,-1],[0,1],[-2,1],[1,3],[1,1],[1,-1],[0,-2],[1,-2]],[[7486,7471],[-1,0],[-2,3],[0,2],[0,1],[2,0],[1,-2],[1,-3],[-1,-1]],[[7443,7474],[-2,1],[0,1],[0,1],[1,1],[1,-1],[1,-1],[0,-2],[-1,0]],[[7455,7470],[-1,0],[-1,1],[0,2],[1,1],[0,1],[-1,1],[0,1],[1,2],[1,0],[1,-1],[0,-1],[-1,-2],[0,-1],[1,0],[0,-3],[-1,-1]],[[7447,7476],[-1,0],[-1,1],[0,2],[1,0],[1,0],[1,-1],[0,-2],[-1,0]],[[7430,7475],[-2,0],[0,2],[0,2],[2,2],[1,0],[1,-3],[-1,-3],[-1,0]],[[7435,7476],[-1,-1],[-1,1],[0,1],[1,2],[1,2],[2,0],[1,0],[-1,-3],[-2,-2]],[[7455,7481],[-1,0],[-2,0],[0,2],[1,0],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]],[[7449,7479],[-1,0],[0,1],[-1,2],[1,2],[0,1],[1,-2],[0,-2],[0,-2]],[[7432,7483],[-1,0],[-3,2],[-1,2],[1,1],[3,-1],[1,-2],[0,-2]],[[7445,7484],[-1,-1],[-1,1],[-1,1],[0,2],[3,1],[1,-2],[-1,-2]],[[7436,7488],[0,-1],[2,0],[1,-1],[-1,-1],[0,-1],[-1,-1],[-1,1],[-1,1],[-2,3],[0,2],[2,0],[1,-2]],[[7457,7488],[-1,-1],[-1,1],[-1,1],[0,1],[1,0],[2,0],[1,-1],[-1,-1]],[[7490,7487],[-2,-2],[-1,1],[0,3],[2,1],[1,0],[1,-2],[-1,-1]],[[7451,7491],[1,-1],[0,-2],[-3,1],[0,2],[-1,0],[-1,0],[0,1],[3,1],[1,-2]],[[7507,7489],[2,-1],[2,0],[1,-1],[0,-2],[-3,0],[-2,1],[-1,2],[-2,0],[0,1],[0,2],[2,3],[1,-1],[1,-2],[-1,-2]],[[7439,7490],[-1,0],[0,1],[1,2],[2,1],[2,0],[0,-1],[0,-1],[-1,0],[-2,0],[-1,-2]],[[7502,7491],[-2,0],[-2,0],[-1,1],[0,2],[3,-1],[2,0],[0,-2]],[[7515,7489],[-1,0],[-1,0],[-1,2],[0,1],[0,2],[2,0],[1,-3],[0,-2]],[[7517,7485],[-1,0],[-1,1],[1,3],[1,1],[-1,1],[0,2],[0,1],[1,0],[0,-2],[1,-3],[1,-1],[0,-2],[-2,-1]],[[7429,7491],[0,-2],[-2,2],[-2,2],[1,2],[1,0],[2,-2],[0,-2]],[[7485,7492],[-1,0],[-1,2],[0,1],[2,0],[2,0],[1,-2],[-1,-1],[-2,0]],[[7494,7492],[-2,0],[-2,1],[2,1],[1,1],[2,0],[1,-1],[-2,-2]],[[7441,7496],[0,-1],[-1,0],[-1,2],[1,2],[1,0],[1,-1],[-1,-2]],[[7516,7497],[-2,-2],[-1,1],[-1,2],[1,1],[2,0],[1,-2]],[[7436,7494],[-2,0],[-1,0],[-1,2],[0,1],[0,2],[4,1],[1,-1],[0,-2],[-1,0],[0,-1],[0,-2]],[[7510,7494],[-1,0],[-2,2],[1,3],[1,1],[2,-1],[0,-2],[-1,-2],[0,-1]],[[7431,7498],[-2,-2],[-1,1],[-1,1],[0,2],[2,0],[1,-1],[1,-1]],[[7481,7493],[-2,0],[-1,2],[0,3],[1,3],[1,0],[0,-4],[1,-2],[0,-2]],[[7506,7498],[-2,-1],[-1,1],[-1,2],[1,2],[1,0],[2,0],[1,-1],[-1,-3]],[[7488,7502],[1,-1],[3,0],[0,-1],[0,-2],[-1,-1],[-1,0],[-1,2],[-2,0],[-1,0],[-1,1],[0,2],[3,0]],[[7501,7500],[-2,-1],[-1,2],[1,1],[0,2],[1,1],[2,-1],[0,-2],[-1,-2]],[[7510,7505],[0,-3],[-1,0],[-2,2],[0,2],[1,1],[1,-1],[1,-1]],[[7516,7502],[-1,-1],[-2,1],[-1,1],[0,2],[1,1],[1,1],[2,-3],[0,-2]],[[7483,7502],[-1,-1],[-1,3],[-1,2],[3,1],[1,0],[0,-2],[1,-1],[0,-2],[-1,0],[-1,0]],[[7540,7494],[-2,0],[0,1],[1,2],[1,2],[1,3],[2,4],[3,1],[0,-1],[0,-3],[-3,-2],[-2,-4],[-1,-3]],[[7496,7503],[-1,-2],[0,1],[-2,2],[-1,2],[1,2],[1,0],[2,-3],[0,-2]],[[7453,7503],[-2,0],[-2,0],[0,2],[0,3],[1,1],[2,-1],[0,-2],[1,-3]],[[7447,7504],[-2,0],[-1,2],[-1,2],[1,1],[1,0],[1,-1],[1,-3],[0,-1]],[[7476,7506],[-2,-2],[-2,2],[0,3],[3,1],[2,-2],[-1,-2]],[[7521,7503],[-1,0],[-3,4],[0,2],[1,1],[1,0],[3,-6],[0,-1],[-1,0]],[[7491,7508],[0,-2],[-1,0],[-1,3],[0,2],[2,0],[0,-3]],[[7504,7507],[-1,-1],[-2,1],[-1,2],[1,2],[1,1],[1,-2],[1,-3]],[[7428,7507],[0,5],[2,0],[0,-2],[0,-1],[-2,-2]],[[7507,7511],[0,-2],[-2,0],[-1,2],[1,1],[1,0],[1,-1]],[[7496,7508],[-1,0],[0,1],[-1,1],[1,3],[1,-1],[1,-3],[-1,-1]],[[7440,7509],[-1,0],[-1,1],[0,3],[1,0],[1,-1],[0,-2],[0,-1]],[[7467,7512],[0,-2],[-2,0],[-1,3],[0,1],[2,0],[1,-2]],[[7425,7509],[-1,0],[0,2],[0,2],[1,1],[1,1],[1,-1],[0,-2],[0,-1],[0,-1],[-2,-1]],[[7443,7511],[-1,0],[-2,3],[-1,0],[0,2],[1,1],[2,-2],[1,-3],[0,-1]],[[7450,7511],[-1,0],[-1,1],[-1,3],[1,2],[1,-1],[1,-2],[0,-2],[0,-1]],[[7504,7513],[-3,0],[-1,1],[-1,2],[2,1],[3,0],[1,-2],[-1,-2]],[[7436,7512],[-3,0],[-1,0],[0,3],[2,1],[2,1],[0,-3],[0,-2]],[[7489,7513],[-1,0],[0,1],[0,2],[1,1],[2,0],[0,-1],[-1,-2],[-1,-1]],[[7477,7512],[-2,0],[-2,0],[-1,1],[0,1],[0,2],[3,1],[1,-1],[1,-2],[0,-2]],[[7481,7512],[-2,-2],[-1,3],[0,2],[1,2],[1,-1],[1,-2],[0,-2]],[[7494,7513],[-1,-1],[-1,0],[-1,2],[2,2],[1,1],[1,-2],[-1,-2]],[[7539,7518],[2,-2],[3,0],[1,-1],[1,-2],[-1,-1],[-2,0],[-1,-2],[-2,-3],[0,-6],[-3,-5],[-6,-4],[-1,-3],[0,-4],[-2,-6],[0,-6],[1,-4],[1,-3],[-1,-1],[-1,-1],[-1,1],[-1,2],[-1,5],[0,4],[1,3],[1,4],[0,4],[1,4],[5,6],[3,3],[1,3],[1,4],[1,6],[0,1],[-1,-1],[0,-1],[-2,0],[0,3],[2,3],[1,0]],[[7444,7515],[-1,1],[-1,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1]],[[7469,7515],[-1,0],[-3,1],[-1,2],[0,1],[1,0],[4,0],[1,-1],[-1,-3]],[[7484,7516],[-2,0],[0,1],[0,2],[1,1],[1,-1],[0,-3]],[[7429,7517],[-1,-1],[-1,1],[0,2],[1,1],[1,0],[2,0],[0,-2],[-2,-1]],[[7509,7516],[-1,0],[-2,0],[0,2],[0,2],[1,1],[1,-1],[1,-2],[0,-2]],[[7518,7519],[-3,-1],[-1,1],[0,2],[1,1],[3,-1],[0,-1],[0,-1]],[[7481,7519],[-1,0],[-1,0],[0,2],[1,1],[1,0],[1,-2],[-1,-1]],[[7437,7519],[-1,0],[-2,1],[1,2],[1,1],[2,0],[0,-2],[0,-1],[-1,-1]],[[7473,7518],[-1,0],[0,4],[1,1],[1,-1],[0,-2],[0,-2],[-1,0]],[[7424,7475],[1,-1],[0,-2],[2,-1],[0,-1],[-2,-1],[-1,-1],[1,-2],[-2,-2],[-1,-1],[-1,-3],[1,-2],[0,-1],[1,-1],[-1,-1],[-1,0],[-2,-1],[-1,-2],[1,-2],[1,-2],[1,0],[2,0],[2,2],[2,1],[1,-2],[0,-4],[-3,-1],[-2,-1],[-2,1],[-2,0],[-1,-1],[-1,-1],[0,1],[-1,3],[0,3],[-2,1],[-3,0],[0,2],[0,1],[3,0],[0,1],[-2,1],[-1,0],[1,2],[2,-2],[1,1],[1,1],[0,5],[0,1],[-2,1],[0,3],[1,0],[2,-3],[3,3],[0,2],[1,2],[-2,3],[-2,0],[0,-1],[0,-1],[1,-2],[-1,-1],[-2,2],[-1,0],[-1,-3],[-2,1],[1,2],[0,3],[0,5],[1,6],[1,3],[-1,3],[-2,3],[0,3],[1,2],[1,4],[-1,3],[-1,3],[1,4],[1,2],[1,3],[0,3],[0,2],[2,0],[3,-1],[1,-1],[-1,-2],[-2,-3],[1,-3],[-2,-2],[0,-3],[1,-3],[4,-2],[2,-2],[-1,-1],[-3,-1],[-1,-1],[1,-4],[2,-3],[-1,-3],[-2,-3],[0,-3],[2,-3],[2,-3],[2,-1]],[[7441,7519],[-1,2],[1,2],[2,0],[0,-1],[0,-1],[-2,-2]],[[7450,7519],[-1,0],[-2,1],[-1,1],[0,2],[3,1],[1,-1],[2,-3],[-2,-1]],[[7521,7521],[-1,-1],[-1,1],[0,2],[1,1],[2,0],[0,-1],[-1,-2]],[[7498,7522],[-1,0],[0,1],[1,2],[0,-1],[1,0],[0,-2],[-1,0]],[[7478,7521],[-1,0],[-1,1],[1,2],[2,1],[0,-2],[-1,-2]],[[7492,7522],[-1,0],[-1,1],[0,2],[2,0],[0,-1],[0,-2]],[[7518,7523],[-1,0],[-1,1],[0,1],[1,0],[1,0],[1,-1],[-1,0],[0,-1]],[[7503,7522],[-1,-1],[-1,0],[0,1],[0,1],[1,1],[1,1],[2,1],[0,-2],[0,-1],[-2,-1]],[[7495,7521],[-1,0],[-1,0],[0,2],[1,2],[1,1],[1,0],[0,-2],[0,-1],[-1,-2]],[[7489,7523],[-1,-1],[-1,1],[0,3],[1,1],[1,-2],[0,-2]],[[7440,7524],[0,-1],[-1,1],[-1,1],[-1,1],[0,1],[2,0],[1,-1],[0,-2]],[[7431,7524],[-1,0],[-1,1],[0,2],[1,0],[1,-1],[1,-2],[-1,0]],[[7471,7523],[-1,0],[0,5],[1,1],[1,-1],[0,-2],[0,-2],[-1,-1]],[[7538,7458],[-7,-7],[6,8],[3,5],[2,3],[3,8],[6,9],[0,5],[1,5],[0,4],[1,3],[5,11],[2,5],[1,9],[0,3],[0,-3],[-1,-9],[-1,-5],[-6,-13],[-1,-5],[0,-5],[-1,-6],[-5,-9],[-3,-8],[-5,-8]],[[7428,7526],[-1,-1],[-1,1],[1,2],[0,2],[1,0],[1,-2],[-1,-2]],[[7434,7525],[-1,0],[-1,1],[0,3],[0,2],[2,0],[1,-1],[0,-3],[-1,-2]],[[7425,7527],[-2,-1],[-1,2],[1,3],[2,0],[1,0],[0,-2],[-1,-2]],[[7478,7526],[-2,0],[-1,2],[-2,1],[0,2],[2,0],[3,-3],[0,-1],[0,-1]],[[7486,7524],[-1,-1],[-2,2],[0,1],[-2,1],[0,2],[0,2],[2,1],[0,-1],[0,-1],[1,-2],[1,-1],[1,-1],[0,-2]],[[7494,7529],[-2,-1],[-1,0],[0,3],[1,1],[2,0],[0,-2],[0,-1]],[[7489,7529],[-1,0],[-1,0],[-1,1],[0,1],[2,2],[1,0],[1,-2],[-1,-2]],[[7505,7531],[0,-2],[-1,-2],[0,1],[-2,1],[-1,-1],[-1,-1],[-1,1],[-1,0],[0,1],[-1,-1],[-1,1],[-1,1],[1,2],[1,0],[1,-1],[0,-2],[1,0],[0,1],[0,2],[1,0],[1,-1],[1,-1],[0,1],[1,1],[1,1],[1,-2]],[[7445,7526],[-1,-1],[-1,1],[-3,3],[-2,1],[1,2],[1,1],[1,-1],[2,-1],[3,-1],[1,-1],[1,-2],[-1,0],[-2,-1]],[[7480,7536],[1,-2],[0,-1],[-1,0],[-3,2],[-3,0],[-1,1],[1,1],[4,0],[2,-1]],[[7439,7535],[-1,-2],[-1,-2],[-1,1],[-2,1],[-1,0],[-1,-1],[-2,-1],[-2,1],[0,1],[1,1],[3,0],[1,1],[1,2],[2,0],[2,-1],[1,-1]],[[7465,7529],[-1,0],[-2,4],[0,3],[2,1],[0,-1],[0,-2],[2,-2],[0,-3],[-1,0]],[[7486,7533],[-2,0],[-1,1],[1,3],[2,0],[1,-1],[0,-2],[-1,-1]],[[7516,7532],[-1,0],[-1,1],[0,1],[0,2],[0,1],[1,0],[1,-1],[0,-2],[0,-2]],[[7432,7536],[-3,0],[-1,1],[1,2],[2,0],[1,-1],[0,-2]],[[7496,7536],[-2,-1],[-2,0],[0,1],[0,1],[2,2],[1,0],[3,0],[0,-1],[0,-1],[0,-1],[-2,0]],[[7524,7536],[-2,0],[0,2],[1,2],[1,0],[1,0],[0,-3],[0,-1],[-1,0]],[[7423,7535],[0,-1],[-1,1],[-1,1],[0,3],[1,2],[3,0],[0,-1],[-1,0],[-1,-1],[1,-1],[0,-1],[0,-1],[-1,-1]],[[7490,7537],[-2,0],[0,1],[0,3],[2,1],[1,0],[0,-2],[0,-1],[-1,-2]],[[7513,7533],[0,-2],[-1,1],[-2,0],[-1,1],[-1,1],[-2,1],[0,3],[-1,2],[0,2],[1,0],[0,-2],[1,-2],[1,-1],[1,-1],[3,-1],[1,-2]],[[7504,7538],[-1,-2],[-2,0],[-1,2],[0,2],[1,2],[1,0],[2,-2],[0,-2]],[[7521,7540],[-1,-1],[-3,1],[-1,1],[1,1],[1,0],[2,0],[1,-2]],[[7512,7538],[-1,-2],[-1,1],[-1,2],[-1,0],[1,2],[1,2],[1,-1],[0,-1],[1,-3]],[[7482,7538],[-1,0],[-2,0],[-2,3],[1,2],[2,0],[2,-2],[0,-2],[0,-1]],[[7533,7544],[0,-2],[1,0],[0,1],[1,0],[0,-1],[0,-2],[-1,-4],[0,-1],[0,-1],[1,-1],[-1,-1],[-2,1],[-2,-1],[0,2],[1,4],[0,4],[1,2],[1,0]],[[7469,7543],[-2,0],[0,1],[0,1],[2,0],[1,-1],[0,-1],[-1,0]],[[7434,7541],[-1,0],[-1,1],[0,1],[1,2],[1,0],[1,0],[1,-2],[-2,-2]],[[7471,7531],[-1,0],[-1,0],[-1,3],[-1,2],[1,2],[1,2],[1,1],[1,2],[0,1],[0,1],[1,0],[1,0],[1,0],[2,-1],[-1,-2],[0,-2],[-2,0],[-1,-2],[0,-2],[0,-2],[0,-1],[0,-1],[-1,-1]],[[7496,7543],[-1,-1],[-1,0],[-1,2],[0,2],[1,1],[2,-1],[0,-3]],[[7520,7545],[-1,-1],[-3,1],[0,1],[0,1],[1,0],[2,0],[1,-2]],[[7464,7544],[-1,-2],[-2,0],[0,3],[1,2],[2,0],[0,-3]],[[7486,7541],[-1,0],[0,1],[-2,2],[0,1],[-1,1],[0,1],[1,0],[1,0],[0,-2],[1,0],[1,-1],[1,-2],[-1,-1]],[[7501,7544],[-2,0],[-1,0],[0,3],[0,1],[2,0],[1,-1],[0,-3]],[[7490,7544],[-2,0],[0,4],[1,1],[1,-2],[0,-3]],[[7506,7545],[-2,-1],[-1,1],[0,1],[1,2],[2,2],[1,-1],[1,-2],[0,-2],[-2,0]],[[7513,7547],[-3,0],[0,1],[0,1],[2,1],[2,0],[1,0],[0,-1],[0,-2],[-2,0]],[[7480,7548],[-2,0],[-1,0],[-1,2],[0,2],[2,1],[1,-1],[2,-3],[-1,-1]],[[7502,7550],[-2,0],[-1,2],[0,1],[2,0],[1,-1],[0,-2]],[[7535,7551],[1,-1],[2,1],[1,0],[1,-1],[1,-2],[1,-1],[1,0],[1,0],[1,1],[2,1],[1,0],[1,-1],[2,-1],[2,0],[2,0],[0,-3],[-2,-2],[-2,-1],[0,1],[0,1],[1,1],[1,0],[0,2],[-1,0],[-1,-1],[-3,-2],[-2,-1],[-2,-1],[-3,1],[0,-2],[0,-5],[0,-3],[-1,-2],[0,-2],[-2,0],[0,1],[-1,0],[-1,0],[0,1],[2,3],[0,5],[0,3],[2,0],[1,1],[0,3],[-3,1],[-4,1],[-2,-1],[-2,0],[1,1],[1,2],[-1,1],[-2,0],[1,1],[2,0],[1,2],[2,0],[0,-2]],[[7486,7551],[-2,-2],[-1,1],[0,2],[1,2],[2,1],[1,0],[0,-2],[-1,-2]],[[7515,7553],[-1,-1],[-2,1],[0,1],[0,2],[1,0],[2,0],[0,-3]],[[7494,7552],[-2,-1],[-1,1],[0,2],[2,2],[1,0],[1,0],[1,-1],[-1,-2],[-1,-1]],[[7509,7553],[-2,-1],[-1,1],[0,1],[0,3],[1,0],[2,0],[1,0],[0,-2],[-1,-2]],[[7482,7554],[-1,-1],[-2,1],[0,2],[1,2],[2,-1],[1,-1],[-1,-2]],[[7500,7555],[-2,-1],[0,1],[0,1],[0,1],[3,0],[2,1],[1,-1],[-1,-1],[-2,-1],[-1,0]],[[7521,7554],[0,-2],[-2,0],[-1,1],[-1,2],[0,2],[1,1],[1,0],[1,-1],[1,-3]],[[7473,7548],[-2,0],[-1,2],[1,4],[1,3],[1,1],[3,0],[1,0],[1,0],[-1,-3],[-1,-1],[-1,-2],[-1,-3],[-1,-1]],[[7469,7557],[-1,0],[-1,0],[-1,1],[0,1],[0,1],[1,0],[2,-2],[0,-1]],[[7517,7560],[-1,-2],[-2,0],[-1,1],[0,1],[2,1],[2,-1]],[[7485,7561],[2,-1],[1,0],[1,0],[1,0],[0,-3],[-1,0],[-2,1],[-2,0],[-2,2],[0,1],[2,0]],[[7522,7560],[-1,-1],[-2,1],[-1,0],[0,1],[1,1],[2,0],[1,-2]],[[7540,7562],[2,-1],[3,0],[3,-1],[2,-3],[2,-2],[0,-3],[0,-1],[-1,0],[-3,2],[-4,3],[-1,0],[-6,-2],[-2,6],[0,1],[-1,1],[0,-2],[-2,-3],[-2,0],[-3,0],[-1,-1],[1,-3],[1,-1],[-1,-2],[-1,0],[-1,0],[-1,1],[0,3],[1,2],[1,1],[1,2],[2,0],[3,1],[0,1],[0,1],[-2,0],[-2,-1],[-1,0],[1,2],[2,1],[8,0],[2,-2]],[[7517,7564],[0,-2],[-3,1],[-1,0],[0,1],[4,0]],[[7504,7560],[-1,0],[-1,1],[0,1],[1,3],[1,0],[1,-1],[0,-3],[-1,-1]],[[7523,7564],[-1,0],[-1,1],[-1,0],[1,2],[2,0],[1,-2],[-1,-1]],[[7488,7566],[1,0],[2,0],[1,-1],[1,-1],[2,-2],[2,1],[1,0],[1,1],[2,4],[1,-1],[0,-2],[-2,-3],[-3,-2],[-2,0],[-4,3],[-3,2],[-3,1],[-1,0],[1,2],[2,0],[1,-2]],[[7480,7562],[-1,0],[0,1],[0,4],[0,1],[1,1],[1,0],[1,-1],[0,-2],[0,-2],[-2,-2]],[[7509,7561],[-1,0],[-1,0],[-1,3],[0,3],[0,1],[1,1],[2,-1],[1,-2],[0,-3],[-1,-2]],[[7548,7570],[2,-2],[2,0],[1,-4],[0,-3],[2,-2],[1,-3],[0,-1],[-1,0],[-2,2],[-1,2],[0,4],[-1,2],[-2,2],[-2,1],[-3,0],[-4,-1],[-1,0],[-1,-1],[-1,1],[1,1],[3,1],[4,1],[3,0]],[[7497,7567],[-1,0],[-1,0],[0,2],[1,1],[2,1],[1,-1],[0,-2],[-2,-1]],[[7477,7561],[-2,0],[-1,0],[0,2],[0,1],[0,2],[0,4],[3,2],[1,-1],[0,-1],[0,-2],[0,-4],[0,-1],[0,-1],[-1,-1]],[[7465,7561],[-2,0],[0,4],[0,5],[1,2],[1,-1],[1,-2],[-1,-2],[0,-2],[0,-3],[0,-1]],[[7514,7569],[-2,-1],[-1,1],[-1,1],[0,2],[2,1],[1,-2],[1,-2]],[[7507,7572],[-2,-2],[-3,0],[0,2],[2,1],[2,0],[2,0],[-1,-1]],[[7492,7572],[-1,-1],[-1,0],[-1,1],[0,2],[1,2],[1,0],[2,0],[0,-2],[-1,-1],[0,-1]],[[7498,7574],[0,-1],[-1,0],[-1,0],[-1,1],[0,2],[0,1],[2,0],[1,-2],[0,-1]],[[7486,7573],[-1,0],[-2,0],[-1,1],[0,1],[1,2],[2,0],[1,0],[1,0],[1,-1],[0,-2],[-1,-1],[-1,0]],[[7478,7575],[-1,0],[-2,0],[0,1],[1,1],[2,0],[0,-1],[0,-1]],[[7490,7578],[-1,0],[-1,1],[0,2],[2,0],[1,-1],[0,-2],[-1,0]],[[7499,7579],[-1,0],[-1,1],[1,1],[0,1],[2,-1],[1,-2],[-1,0],[-1,0]],[[7511,7580],[1,-3],[0,-1],[-1,0],[-1,0],[-1,2],[0,1],[-2,-1],[-1,-1],[-2,-1],[-2,0],[-1,1],[0,1],[2,1],[3,0],[1,2],[0,1],[1,1],[1,0],[2,-3]],[[7496,7581],[-1,0],[-1,0],[-2,1],[0,1],[1,0],[2,0],[1,-1],[0,-1]],[[7520,7575],[-2,-1],[0,1],[0,2],[-1,4],[-1,2],[1,1],[1,0],[1,-2],[1,-2],[0,-2],[0,-2],[0,-1]],[[7472,7577],[-2,-2],[-3,0],[0,3],[0,5],[1,1],[4,-1],[1,-2],[0,-2],[-1,-2]],[[7502,7584],[0,-2],[-1,1],[-2,0],[0,1],[0,1],[1,1],[1,-1],[1,-1]],[[7514,7585],[0,-2],[-1,0],[-1,2],[-2,1],[-1,1],[1,1],[3,-1],[1,-2]],[[7541,7586],[2,-1],[0,-2],[-1,0],[-1,1],[-2,1],[-1,0],[0,-1],[0,-1],[0,-1],[2,-2],[1,-2],[0,-1],[-2,0],[-3,5],[-3,4],[-1,1],[0,2],[1,0],[2,0],[3,0],[2,-1],[1,-2]],[[7477,7584],[-2,0],[-1,1],[-2,2],[0,2],[1,0],[2,-1],[2,-2],[0,-2]],[[7504,7586],[-1,0],[-2,1],[1,2],[1,0],[1,-1],[0,-2]],[[7487,7584],[0,-1],[-1,0],[-1,1],[-1,0],[-1,0],[-2,-1],[-1,-2],[-1,-2],[-1,0],[-1,1],[0,1],[0,1],[2,3],[0,1],[1,2],[1,2],[2,1],[1,-2],[2,-4],[1,-1]],[[7497,7587],[-1,-1],[-1,0],[-1,2],[0,1],[0,2],[2,0],[1,0],[1,-2],[-1,-2]],[[7515,7589],[-1,-1],[-2,1],[0,2],[2,1],[1,-1],[0,-1],[0,-1]],[[7508,7589],[-2,0],[-1,1],[0,2],[1,1],[3,0],[0,-1],[0,-2],[-1,-1]],[[7492,7584],[-1,-1],[-1,1],[-4,6],[0,2],[2,1],[1,2],[3,0],[1,-1],[0,-1],[-1,-2],[-2,-3],[0,-1],[0,-1],[2,-2]],[[7488,7594],[-2,-2],[-2,1],[0,1],[2,2],[1,0],[1,-2]],[[7500,7593],[-2,-1],[-2,1],[-1,1],[0,1],[0,1],[1,0],[2,0],[1,0],[1,-1],[0,-2]],[[7512,7593],[-1,0],[-1,1],[0,2],[1,1],[1,0],[2,-1],[0,-2],[-1,-1],[-1,0]],[[7411,7425],[0,-2],[-1,1],[-2,2],[-3,6],[-7,17],[-4,15],[-1,10],[1,9],[1,13],[2,9],[1,7],[2,12],[3,9],[3,8],[0,8],[2,5],[2,6],[3,7],[4,6],[1,5],[2,8],[1,9],[3,4],[1,3],[2,1],[2,1],[1,0],[0,-1],[-2,-2],[-3,-2],[-1,-3],[-3,-8],[-1,-6],[-1,-5],[-1,-4],[0,-2],[-4,-6],[-3,-6],[-2,-6],[-1,-5],[-2,-7],[-2,-9],[-4,-9],[-1,-11],[-1,-8],[-1,-9],[-2,-12],[-1,-10],[2,-9],[4,-15],[3,-9],[5,-10],[2,-4],[1,-1]],[[7560,7534],[-1,0],[0,1],[2,11],[0,6],[-1,9],[-1,8],[-3,8],[-2,9],[-2,5],[-4,6],[-5,5],[-5,6],[-1,1],[1,0],[6,-6],[4,-4],[5,-7],[2,-6],[2,-8],[3,-8],[1,-9],[1,-11],[0,-8],[-2,-7],[0,-1]],[[7514,7604],[-8,-7],[-2,2],[-1,2],[-2,0],[0,-1],[2,-3],[-1,0],[-1,0],[-2,2],[-1,-1],[-2,-1],[-2,0],[-2,1],[1,2],[2,2],[3,2],[5,1],[5,5],[2,0],[3,-1],[0,-2],[1,-1],[0,-2]],[[7490,7601],[-4,-1],[-2,0],[-1,1],[2,5],[2,5],[3,1],[0,2],[2,0],[3,0],[0,-3],[-2,-1],[-2,-1],[-1,-3],[0,-5]],[[7501,7633],[8,-2],[8,-2],[6,-2],[6,-3],[6,-3],[5,-3],[3,-1],[1,-1],[-1,-1],[-1,1],[-3,1],[-7,3],[-9,5],[-6,2],[-7,2],[-9,2],[-5,1],[-4,0],[-4,0],[-4,-2],[-6,-2],[-7,-4],[-8,-4],[-5,-3],[-4,-4],[-5,-5],[-6,-8],[-5,-5],[-5,-4],[-1,0],[0,1],[1,1],[4,3],[6,6],[6,7],[5,5],[4,5],[4,3],[8,4],[7,3],[7,3],[4,2],[4,0],[3,0],[6,-1]],[[7110,6789],[1,2],[-1,3],[-1,2],[-2,3],[-2,3],[-4,1],[-5,0],[-4,0],[-5,1],[-4,2],[-1,-2],[-1,-1],[0,-3],[3,-1],[4,-1],[5,-1],[0,2],[1,-1],[0,-1],[-1,-1],[0,-1],[-1,0],[0,1],[-5,1],[-4,1],[-5,2],[-10,4],[-5,3],[-10,9],[-5,5],[-1,0],[-1,1],[3,2],[0,-1],[0,-1],[4,-5],[11,-9],[5,-3],[9,-4],[1,0],[0,1],[0,3],[0,1],[-2,1],[-5,2],[-6,4],[-5,4],[-6,6],[-6,8],[-1,1],[0,1],[-1,3],[-2,4],[-3,-2],[-1,-1],[-1,0],[0,-25],[-1,1],[1,24],[0,1],[5,3],[1,1],[0,1],[-2,5],[-1,0],[0,-1],[-1,1],[-3,9],[-1,6],[-1,9],[0,9],[1,12],[2,10],[3,8],[4,11],[6,10],[6,9],[1,3],[3,9],[3,5],[7,8],[6,5],[7,2],[7,1],[9,0],[5,-2],[1,0],[-1,-6],[-2,-1],[-3,-1],[-2,-1],[-2,-3],[-3,-3],[-4,0],[-6,-4],[-5,-5],[-3,-3],[-2,-2],[-5,-2],[-3,-1],[-5,-4],[-5,-7],[-1,-1],[0,-1],[1,-1],[1,-3],[-1,-2],[-6,-9],[-3,-11],[-2,-9],[-1,-6],[0,-5],[0,-7],[1,-14],[1,-3],[2,-4],[0,-1],[1,1],[0,-1],[-3,-2],[-1,-1],[3,-5],[1,0],[3,2],[1,-1],[-3,-1],[3,-5],[4,-6],[3,-4],[9,-8],[5,-2],[7,-3],[9,-2],[7,-1],[0,2],[1,1],[0,-1],[0,-6],[0,-1],[2,-1],[4,-2],[2,-2],[1,0],[2,3],[1,0],[1,-1],[3,-5],[3,-4],[3,-1],[5,2],[3,1],[7,3],[5,5],[0,2],[0,3],[0,1],[-3,0],[-2,0],[0,4],[-4,8],[-17,41],[0,2],[2,2],[-1,4],[-3,-3],[-3,-6],[-3,-8],[-1,-6],[1,-14],[0,-6],[-3,-1],[0,1],[-1,11],[1,11],[2,9],[4,9],[1,3],[1,1],[-1,2],[-2,-1],[-5,-6],[-5,-12],[-1,-9],[-2,-9],[-1,-7],[-1,-1],[-1,0],[-1,3],[2,13],[4,12],[4,11],[5,5],[1,3],[1,1],[-1,2],[-2,-1],[-2,-2],[-8,-8],[-6,-9],[-3,-10],[-2,-8],[0,-4],[-1,-3],[-2,1],[-1,2],[3,13],[3,8],[5,9],[6,7],[5,5],[3,3],[1,1],[-1,2],[-2,-1],[-8,-4],[-5,-5],[-4,-5],[-5,-9],[-3,-7],[-2,-7],[-1,-4],[-2,0],[-1,0],[-1,4],[4,12],[5,9],[7,9],[4,4],[5,3],[7,2],[0,1],[0,3],[0,1],[-2,-1],[-7,-1],[-9,-5],[-5,-4],[-3,-4],[-5,-6],[-5,-8],[-1,-3],[-3,0],[-1,1],[0,2],[2,5],[4,6],[7,7],[8,7],[6,3],[8,2],[3,1],[1,0],[0,1],[-1,2],[0,1],[-5,0],[-5,-1],[-8,-2],[-7,-5],[-4,-3],[-6,-7],[-2,-2],[-2,0],[-1,1],[0,3],[3,4],[7,6],[9,5],[7,3],[7,0],[5,0],[0,2],[0,2],[-3,1],[-5,2],[-8,0],[-7,-1],[-6,-3],[-2,-2],[-2,0],[-1,2],[1,2],[12,5],[7,1],[6,0],[5,-2],[2,0],[0,2],[-1,2],[-5,1],[-7,3],[-7,1],[-4,0],[-1,1],[2,2],[4,0],[6,-1],[6,-1],[3,-1],[1,0],[0,1],[0,1],[-5,4],[-7,3],[-2,3],[1,2],[3,-1],[6,-5],[4,-2],[2,0],[1,19],[1,0],[1,-1],[-2,-18],[0,-2],[1,-1],[1,1],[0,2],[3,7],[2,7],[4,8],[3,0],[1,0],[0,-2],[-3,-3],[-3,-6],[-3,-14],[-1,-4],[1,-2],[1,1],[4,12],[4,6],[6,8],[5,4],[2,0],[1,-1],[-1,-2],[-3,-3],[-3,-4],[-5,-6],[-4,-7],[-2,-7],[-2,-4],[0,-2],[1,-1],[1,0],[5,9],[7,8],[10,8],[6,3],[6,1],[1,-1],[0,-3],[-3,-2],[-7,-1],[-7,-5],[-6,-5],[-4,-5],[-6,-10],[-1,-3],[1,-2],[1,1],[7,8],[8,8],[8,5],[10,2],[6,1],[2,0],[1,-2],[0,-2],[-1,-2],[-2,1],[-7,-1],[-7,-1],[-8,-5],[-9,-7],[-7,-8],[-1,-2],[1,-2],[2,0],[7,8],[8,4],[5,2],[9,0],[9,0],[6,-2],[2,-1],[0,-2],[0,-2],[-2,0],[-3,1],[-5,1],[-7,2],[-9,-1],[-5,-2],[-7,-4],[-7,-6],[-1,-1],[1,-1],[2,-1],[4,3],[8,3],[6,1],[6,0],[8,0],[5,-1],[4,-2],[2,-2],[0,-1],[0,-2],[-2,-1],[-6,2],[-8,3],[-5,1],[-4,0],[-6,-1],[-8,-3],[-3,-3],[-1,-1],[1,-1],[2,0],[6,1],[11,0],[8,-1],[5,-2],[7,-5],[1,-1],[0,-3],[-2,0],[-2,0],[-6,4],[-5,3],[-7,2],[-11,-1],[-4,0],[-2,-2],[0,-1],[2,0],[6,0],[4,-1],[5,-2],[8,-4],[5,-4],[3,-4],[1,-3],[-1,-1],[-2,-1],[-2,2],[-5,6],[-7,5],[-3,2],[-5,1],[-6,1],[-2,0],[-2,-2],[0,-1],[0,-3],[2,0],[2,1],[1,0],[4,-8],[17,-40],[1,-2],[3,-1],[0,-1],[0,-2],[-4,-3],[0,-1],[0,-1],[3,-3],[2,2],[2,2],[6,5],[4,3],[1,3],[-1,1],[0,7],[0,10],[1,3],[1,1],[1,1],[5,10],[-4,3],[1,1],[1,-1],[4,9],[3,9],[2,11],[1,12],[-1,12],[-2,7],[-3,6],[0,1],[3,2],[-3,6],[-3,-2],[0,1],[0,2],[-5,7],[-6,7],[-5,4],[-5,4],[-7,2],[-7,3],[-7,0],[-8,0],[-5,0],[-1,-2],[0,1],[1,11],[11,0],[11,-1],[9,-3],[11,-6],[5,-5],[10,-11],[5,-7],[0,-1],[-2,-2],[3,-6],[6,5],[1,0],[8,-8],[4,-4],[5,-4],[0,-1],[-1,1],[-4,4],[-4,3],[-8,8],[-1,0],[-3,-3],[2,-6],[2,-6],[1,-11],[1,-11],[-1,-8],[-1,-9],[-1,-3],[1,-1],[3,-1],[1,0],[1,7],[1,8],[1,10],[-1,16],[-2,0],[0,1],[2,2],[1,0],[0,-1],[0,-1],[0,-2],[0,-15],[0,-11],[-1,-8],[-2,-9],[-5,-16],[0,-1],[0,-1],[-3,0],[0,1],[1,0],[1,1],[5,14],[0,2],[-3,1],[-1,0],[-3,-9],[-5,-10],[-2,0],[-1,0],[-1,-1],[-3,-8],[0,-6],[0,-9],[0,-3],[1,-4],[-2,-2],[-4,-4],[8,7],[58,42],[-11,60],[69,18],[9,-10],[155,232],[212,343],[11,46],[-2,40],[40,45],[33,-6],[31,-57],[11,-39],[-9,-39],[-27,-53],[57,23],[11,51],[-16,64],[-41,98],[-6,23],[12,25],[32,44]]],"transform":{"scale":[0.0004814771842184252,0.0003454191448144847],"translate":[51.56934655000006,22.62094594300011]}};
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
