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
  Datamap.prototype.bolTopo = {"type":"Topology","objects":{"bol":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Cochabamba"},"id":"BO.CB","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Chuquisaca"},"id":"BO.CQ","arcs":[[-2,6,7,8,9]]},{"type":"Polygon","properties":{"name":"El Beni"},"id":"BO.EB","arcs":[[10,-6,11,12,13]]},{"type":"Polygon","properties":{"name":"La Paz"},"id":"BO.LP","arcs":[[-12,-5,14,15,16]]},{"type":"Polygon","properties":{"name":"Oruro"},"id":"BO.OR","arcs":[[-4,17,18,-15]]},{"type":"Polygon","properties":{"name":"Pando"},"id":"BO.PA","arcs":[[-13,-17,19]]},{"type":"Polygon","properties":{"name":"Potosí"},"id":"BO.PO","arcs":[[-10,20,21,-18,-3]]},{"type":"Polygon","properties":{"name":"Santa Cruz"},"id":"BO.SC","arcs":[[-7,-1,-11,22]]},{"type":"Polygon","properties":{"name":"Tarija"},"id":"BO.TR","arcs":[[23,-21,-9]]}]}},"arcs":[[[4105,5331],[-6,-17],[-9,-1],[-23,0],[19,-16],[5,-8],[-1,-13],[-12,5],[-11,4],[-11,-1],[-11,-8],[14,-9],[11,-12],[9,-14],[6,-16],[0,-10],[-2,-5],[-3,-4],[-1,-5],[0,-26],[3,-16],[16,-19],[4,-12],[-4,-11],[-6,-13],[-3,-14],[7,-16],[-7,-15],[1,-14],[2,-13],[-2,-15],[-18,-21],[-2,-9],[20,-1],[-15,-21],[-2,-7],[2,-7],[8,-9],[2,-7],[-2,-11],[-25,-53],[-2,-2],[0,-2],[-5,-21],[-7,-7],[-19,-11],[-8,-8],[-7,-11],[-5,-12],[-2,-12],[3,-11],[6,-6],[8,-2],[6,-3],[2,-8],[-2,-5],[-29,-44],[-5,-17],[-10,-14],[0,-9],[4,-8],[12,-13],[5,-7],[2,-7],[1,-14],[18,-61],[12,-18],[77,-74],[20,-9],[18,-5],[8,-4],[8,-5],[52,-49],[12,-9],[48,-25],[22,-6],[8,-4],[27,-19],[70,-71],[38,-27],[5,-5],[3,-6],[8,-19],[7,-12],[3,-14],[-4,-14],[-6,-14],[-13,-1],[-15,-2],[-10,2],[-7,0],[-18,-4],[-8,0],[-16,1],[-7,0],[-10,-3],[-30,-18],[-7,-6],[-3,-9],[-1,-7],[1,-18],[-2,-7],[-3,-7],[-130,-171],[-17,-18],[-67,-60],[-19,-14],[-11,-12],[-6,-21],[4,-14],[5,-8],[37,-34],[11,-15],[27,-46],[16,-37],[12,-12],[7,-5],[10,-6],[6,-6],[7,-8],[11,-19],[17,-19],[13,-20],[8,-30],[13,-20],[11,-7],[4,-3],[2,-5],[0,-8],[-1,-6],[-2,-5],[0,-4],[1,-3],[10,-8],[2,-5],[-1,-11],[1,-6],[2,-7],[6,-9],[4,-5],[4,-3],[3,-1],[15,-4],[9,-4],[12,-9],[14,-12],[7,-5],[19,-8],[4,-3],[3,-2],[2,-3],[1,-1],[1,-3],[1,-5],[-2,-30],[0,-8],[1,-6],[6,-12],[0,-4],[-4,-6],[-21,-21],[-14,-23]],[[4365,3208],[-8,7],[-4,5],[-8,19],[-4,5],[-18,6],[-18,-6],[-56,-40],[-10,-3],[-13,-2],[-42,0],[-11,1],[-8,5],[-12,15],[-8,6],[-15,11],[-8,7],[-11,22],[-2,4],[-10,3],[-7,7],[-10,16],[-14,9],[-40,0],[-17,5],[-5,6],[-9,13],[-6,6],[-16,3],[-18,-2],[-59,-15],[-45,-18],[-30,-19],[-19,-15],[-8,-9],[-6,-10],[-6,-22],[-5,-11],[-9,-8],[-11,0],[-12,3],[-37,23],[-15,6],[-14,1],[-32,-5],[-14,2],[-11,11],[-2,15],[0,21],[-3,18],[-9,7],[-9,3],[-9,7],[-8,9],[-5,7],[-5,26],[-9,2],[-9,-2],[-8,0],[-3,8],[-1,6],[-2,8]],[[3542,3385],[-2,7],[-3,2],[-8,2],[-29,14],[-7,8],[-4,2],[-5,2],[-12,2],[-5,1],[-25,24],[-36,54],[-29,21],[-14,6],[-15,10],[-12,11],[-9,22],[-9,13],[-20,21],[-29,16],[-15,10],[-6,13],[-51,39],[-49,24],[-15,20],[-17,0],[-55,-12],[-7,2],[-5,19],[-6,7],[-8,5],[-9,2],[-10,7],[-12,16],[-10,19],[-4,15],[-17,0],[-9,2],[-9,2],[-28,2],[-33,-2],[-22,-4],[-11,-3],[-66,-42],[-18,-12],[-47,-34],[-9,-5],[-8,-1],[-9,0],[-42,6],[-49,-1],[-32,3],[-6,1],[-8,1],[-19,-1],[-55,-10]],[[2493,3711],[-46,97],[-62,85],[-43,48],[-14,13],[-134,90]],[[2194,4044],[105,50],[10,7],[6,6],[-2,11],[-5,7],[-8,6],[-5,8],[-3,8],[16,29],[-12,40],[-7,7],[-6,10],[-4,8],[0,10],[3,23],[-12,55],[-5,12],[-6,9],[-11,14],[-12,12],[-9,12],[-38,14],[-12,10],[-4,14],[2,15],[7,16],[4,7],[14,16],[3,9],[1,7],[-2,14],[1,16],[6,13],[16,26],[16,21],[20,9],[49,5],[19,6],[22,10],[19,14],[11,15],[2,12],[0,13],[-6,35],[-1,10],[1,57],[-7,21],[-25,39],[-9,20],[-1,19],[11,39],[4,93],[-5,11],[-18,20],[-6,10],[-4,3],[-26,8],[-1,5],[2,12],[-2,16],[-9,13],[-24,24],[-12,19],[-15,17],[-3,5],[-1,8],[8,56],[0,19],[-3,18],[0,8],[2,9],[7,10],[6,7],[5,8],[1,12],[-1,5],[-3,3],[-4,1],[-3,3],[-2,2],[25,24],[30,34],[68,52]],[[2362,5445],[230,-206],[9,-14],[12,-33],[10,-22],[4,-8],[48,-56],[134,-128],[17,-13],[81,-47],[41,-18],[64,-19],[86,-16],[41,-2],[26,2],[286,74],[79,34],[11,13],[12,21],[45,122],[0,24],[2,10],[26,49],[39,61],[25,15],[312,33],[81,16],[11,-6],[11,0]],[[4365,3208],[9,-8],[8,-9],[3,-9],[-1,-10],[-2,-11],[0,-13],[3,-9],[12,-20],[4,-10],[6,-20],[6,-9],[17,-13],[17,-8],[16,-9],[12,-17],[2,-10],[1,-11],[3,-10],[6,-8],[10,-5],[12,-2],[24,-2],[12,-3],[8,-7],[6,-9],[10,-8],[6,-1],[5,-1],[6,-2],[5,-6],[34,-104],[2,-9],[4,-8],[7,-6],[13,-4],[15,-1],[15,1],[12,3],[11,5],[7,7],[6,8],[4,11],[8,55],[9,16],[10,6],[10,0],[22,-6],[17,0],[51,5],[8,-12],[-20,-126],[-2,-46],[35,-523],[3,-8],[11,-20],[1,-3],[35,-305],[10,-33],[19,-1],[51,-1],[37,-7],[9,0],[7,2],[4,2],[5,4],[14,18],[6,6],[6,4],[9,2],[16,2],[7,3],[4,2],[11,7],[5,6],[10,13],[5,5],[7,3],[11,-7],[11,-15],[25,-52],[7,-10],[7,-3],[7,-2],[881,3]],[[6110,1835],[-17,-22],[-30,-40],[-7,-20],[1,-69],[1,-66],[1,-73],[1,-110]],[[6060,1435],[-1309,1],[-76,2],[-17,0],[0,2],[-17,13],[-5,8],[2,8],[6,8],[-6,2],[-10,-1],[-4,-2],[-24,1],[-7,4],[-3,14],[-7,5],[-16,3],[-18,0],[-12,-3],[-10,-1],[-11,6],[-10,10],[-6,2],[-6,-13],[-1,-4],[-1,-7],[-1,-19],[5,-45],[0,-4],[-2,-4],[-3,-5],[-6,-7],[-1,-4],[-1,-4],[-1,-4],[-3,-6],[-1,-4],[4,-11],[1,-5],[-1,-15],[-1,-4],[-2,-4],[-2,-4],[-2,-3],[-3,-4],[-5,-4],[-4,-2],[-4,-2],[-6,-1],[-7,0],[-21,6],[-11,1],[-49,-4],[-15,2],[-30,12],[-30,21],[-7,5],[-4,1],[-11,2],[-5,0],[-16,-2],[-25,-5],[-7,-1],[-6,1],[-4,2],[-3,3],[-3,2],[-3,3],[-19,39],[-2,4],[-16,15],[-4,5],[-5,5],[-4,2],[-15,8],[-3,2],[-3,4],[-4,11],[-2,3],[-3,3],[-4,1],[-5,0],[-10,0],[-5,1],[-4,2],[-11,5],[-4,1],[-5,1],[-6,-1],[-6,-4],[-8,-10],[-7,-12],[-12,-16],[-5,-11],[-2,-9],[1,-10],[0,-4],[-1,-4],[-7,-11],[-1,-4],[-2,-9],[-3,-5],[-6,-4],[-14,-6],[-15,-4],[-10,-3],[-4,0],[-3,2],[-3,3],[-3,3],[-4,2],[-12,5],[-4,2],[-3,3],[-2,3],[-2,3],[-2,2],[-3,3],[-4,2],[-4,2],[-9,3],[-4,2],[-1,3],[-1,5],[-2,3],[-2,3],[-4,3],[-4,1],[-5,1],[-10,-1],[-5,0],[-4,2],[-4,2],[-6,5],[-3,2],[-5,0],[-5,-1],[-7,-2],[-5,-1],[-3,1],[-3,2],[-5,5],[0,1],[-6,0],[-5,-1],[-4,0],[-2,0],[-1,0],[-26,28],[-6,5],[-4,1],[-5,0],[-5,-1],[-11,-4],[-5,0],[-4,0],[-14,4],[-5,2],[-7,4],[-3,2],[-5,0],[-5,-2],[-5,-5],[-3,-5],[-1,-5],[-11,-138],[-14,-42],[-1,-8],[0,-30],[2,-16],[-23,-151],[-3,-44]],[[3632,1030],[-68,44],[-115,108],[-14,28],[-1,4],[-1,19],[8,79],[0,5],[-3,7],[-2,9],[0,10],[2,16],[35,105],[5,95],[21,31],[7,14],[9,43],[4,11],[63,130],[-58,200],[-2,16],[-1,27],[1,7],[9,25],[3,7],[5,7],[5,6],[22,27],[4,12],[-5,13],[0,4],[0,16],[3,5],[4,2],[9,3],[4,1],[3,3],[14,12],[16,11],[3,1],[16,5],[25,4],[18,4],[84,6],[14,3],[155,76],[64,59],[27,34],[8,10],[-6,16],[-18,30],[-70,80],[-8,14],[-4,14],[-1,15],[2,16],[4,13],[2,6],[-1,7],[-3,4],[-5,6],[-6,5],[-2,0],[-4,16],[-9,17],[-13,15],[-14,10],[-22,5],[-25,-2],[-63,-18],[-18,0],[-3,2],[-2,3],[-3,1],[-6,-3],[-17,-5],[-20,6],[-50,25],[-13,9],[-13,6],[-37,7],[-13,8],[-12,10],[-40,24],[-10,9],[-18,24],[-22,14],[-11,10],[-5,9],[-3,20],[-4,9],[-5,7],[-5,4],[-26,15],[-13,20],[-16,37],[0,3],[0,1],[1,4],[2,2],[2,4],[13,21],[21,29],[6,6],[10,8],[2,4],[1,4],[-1,3],[-2,9],[-1,10],[-1,4],[-2,5],[-2,3],[-2,4],[-7,6],[-7,5],[-1,2],[-3,4],[-1,8],[0,7],[2,4],[2,2],[29,23],[13,7],[5,4],[6,6],[8,13],[3,9],[2,8],[-2,7],[-2,5],[-3,4],[-4,2],[-5,2],[-5,1],[-4,1],[-5,0],[-35,-7],[-17,-6],[-89,-39],[-4,-1],[-4,0],[-4,0],[-6,3],[-2,4],[-1,6],[1,4],[2,4],[3,4],[4,3],[19,15],[6,6],[4,7],[0,4],[-17,82],[-2,31],[6,36],[-1,8],[-3,6],[-8,5],[-18,8],[-6,3],[-5,4],[-8,8],[-3,5],[-1,4],[0,7],[-5,27],[2,7],[3,3],[4,3],[5,1],[4,1],[4,-2],[2,-2],[2,-6],[2,-3],[3,-2],[10,-1],[5,-1],[4,-3],[4,-2],[6,-1],[24,1],[6,-1],[4,-2],[4,-2],[2,-3],[2,-3],[2,-4],[3,-4],[3,-3],[5,-2],[5,0],[5,1],[23,10],[5,2],[4,0],[2,0],[2,-1],[6,-3],[62,-18],[19,-8],[13,-1],[26,5]],[[6616,7104],[-438,-229],[-725,-375],[-457,-237],[-283,-74],[-39,-16],[19,-72],[0,-88],[5,-39],[-1,-21],[-3,-14],[-5,-11],[-4,-19],[9,-36],[6,-12],[26,-37],[30,-75],[86,-120],[8,-7],[8,-5],[20,-7],[11,-6],[10,-12],[5,-10],[4,-37],[6,-10],[38,-35],[10,-6],[9,-2],[9,0],[9,-4],[24,-19],[9,-4],[27,-11],[6,-3],[7,-7],[8,-10],[10,-18],[18,-20],[4,-7],[2,-8],[1,-19],[1,-11],[5,-15],[8,-10],[21,-21],[8,-5],[9,-4],[30,-6],[8,-3],[8,-4],[-2,-2],[-17,-1],[-1079,51]],[[2362,5445],[-34,31],[-164,138],[-17,27],[-8,7],[-5,3],[-17,7],[-11,5],[-9,9],[-6,8],[-3,8],[-1,8],[0,8],[6,31],[0,10],[-2,10],[-52,94],[-23,30],[-19,20],[-11,9],[-7,11],[-15,28],[-9,9],[-10,7],[-9,1],[-10,0],[-20,-2],[-10,1],[-9,2],[-8,4],[-12,9],[-12,6],[-12,14],[-10,28],[-3,15],[-1,12],[3,16],[4,15],[4,29],[-1,31],[-4,16],[-7,12],[-40,33],[-16,20],[-22,47],[-4,6],[2,6],[5,7],[6,6],[13,11],[5,6],[8,15],[0,15],[-5,14],[-9,14],[-18,16],[-4,8],[-1,4],[1,10],[-2,4],[-2,3],[-5,4],[-2,3],[-12,28],[-4,15],[-2,14],[3,14],[9,7],[27,10],[10,11],[4,12],[-2,13],[-8,25],[3,45],[-8,59],[-1,9],[-11,34],[0,12],[22,90],[7,11],[7,9],[8,12],[2,15],[-11,20],[1,15],[9,30],[8,16],[10,9],[14,8],[9,10],[16,24],[34,39],[7,13],[1,15],[-15,19],[-13,70],[-1,26],[13,25],[35,49],[12,12],[29,20],[67,71],[3,7],[3,15],[4,7],[6,5],[15,7],[7,5],[32,53],[14,12],[16,3],[14,-2],[11,3],[40,87],[45,174],[2,20],[-4,15],[-12,33],[22,27],[10,15],[0,12],[-6,12],[-2,10],[-1,46],[2,15],[6,14]],[[2244,7955],[13,16],[6,14],[-3,13],[-6,13],[-3,14],[6,17],[11,16],[8,17],[-2,18],[-6,19],[2,17],[12,34],[4,32],[-5,38],[-11,37],[-18,28],[-12,13],[-5,3],[-3,0],[-4,-3],[-6,-1],[-5,1],[-7,13],[-4,19],[3,15],[14,3],[15,-2],[15,4],[13,8],[11,10],[9,17],[-4,11],[-10,9],[-9,11],[0,15],[11,6],[16,1],[14,-2],[16,1],[11,9],[9,13],[12,10],[14,3],[28,0],[13,5],[12,14],[1,18],[-6,37],[5,14],[20,21],[2,14],[-2,19],[1,19],[8,14],[19,7],[75,5],[55,-6],[22,6],[44,25],[57,6],[25,5],[4,16],[3,16],[44,9],[10,15],[-6,10],[-9,7],[-6,10],[3,17],[8,12],[29,34],[6,14],[0,13],[-7,28],[2,17],[11,3],[14,-4],[14,-1],[19,15],[4,25],[1,27],[9,23],[7,10],[13,-7],[13,6],[10,14],[9,31],[11,17],[7,15],[-7,13],[-8,1],[-17,-6],[-9,-1],[-6,4],[-4,5],[-1,5],[27,7],[33,25],[19,7],[31,-5],[36,-11],[29,-1],[11,21],[-4,14],[-10,14],[-13,10],[-15,4],[-8,6],[5,15],[12,14],[10,6],[9,-4],[11,-11],[10,-11],[4,-8],[10,-3],[22,4],[35,12],[19,13],[8,13],[1,15],[0,19],[-4,17],[-6,15],[2,12],[20,6],[17,-3],[17,-6],[18,-3],[18,9],[16,14],[16,10],[71,32],[6,6],[6,15],[12,17],[15,14],[12,8],[13,5],[43,6],[1,0]],[[3501,9460],[1,-6],[2,-2],[3,-3],[-19,-32],[-12,-11],[-20,-3],[0,-5],[9,-14],[2,-5],[-1,-4],[-3,-7],[-1,-4],[0,-7],[2,-7],[3,-7],[3,-3],[3,-8],[-6,-37],[0,-12],[14,-14],[15,-8],[11,-11],[5,-21],[-1,-14],[-6,-28],[-12,-35],[4,-10],[32,-8],[15,-9],[12,-12],[7,-11],[5,-65],[2,-4],[5,-4],[4,-6],[0,-9],[-3,-7],[-5,-4],[-7,-4],[-7,-6],[-13,-18],[0,-13],[4,-13],[3,-16],[-6,-13],[-32,-23],[-12,-13],[-3,-18],[11,-12],[13,-9],[7,-10],[-5,-12],[-10,-6],[-8,-8],[1,-19],[10,-14],[17,-11],[16,-8],[7,-5],[-3,-9],[-14,-16],[-6,-8],[0,-8],[1,-6],[27,-65],[23,-22],[28,8],[20,-10],[9,-7],[5,-10],[0,-7],[-6,-14],[0,-10],[4,-10],[4,-2],[5,0],[10,-4],[18,-11],[5,-6],[-19,-6],[-2,-7],[3,-19],[-1,-7],[-8,-12],[-1,-7],[0,-27],[5,-11],[11,-11],[15,-10],[10,-3],[7,7],[4,37],[4,10],[5,6],[11,3],[3,-7],[-3,-17],[12,-11],[15,-5],[13,-7],[7,-25],[11,-17],[4,-8],[1,-7],[-2,-16],[1,-7],[4,-16],[4,-7],[9,-4],[2,0],[9,-3],[5,-8],[1,-10],[-3,-7],[-12,-15],[-1,-13],[6,-12],[9,-9],[12,-6],[13,-3],[35,-2],[17,-3],[17,-5],[17,-3],[19,6],[10,-4],[15,-3],[13,-5],[6,-11],[4,-15],[10,-15],[26,-25],[-6,-10],[4,-9],[9,-4],[10,3],[2,6],[3,20],[3,4],[13,2],[3,-4],[4,-13],[0,-6],[-5,-10],[-1,-5],[3,-4],[7,-6],[1,-3],[9,-7],[20,-11],[39,-16],[10,-1],[21,0],[5,-1],[14,-10],[17,-8],[1,3],[0,1],[1,1],[12,-1],[4,-1],[13,-11],[3,-6],[1,-8],[-1,-17],[-4,-17],[-15,-30],[2,-13],[6,-3],[18,-6],[7,-4],[7,-7],[10,-16],[6,-8],[11,-10],[13,-9],[15,-7],[19,-2],[34,5],[12,-3],[8,-23],[8,-2],[8,2],[4,1],[5,3],[10,9],[7,3],[18,1],[14,-3],[12,-7],[23,-22],[8,-3],[8,7],[13,16],[12,-13],[49,-1],[18,-22],[15,2],[26,8],[11,-3],[8,-6],[9,-6],[14,0],[10,8],[6,6],[4,8],[28,31],[0,4],[14,2],[26,7],[11,2],[117,-16],[3,-2],[44,-21],[35,-26],[13,-6],[18,-2],[10,0],[10,-2],[8,-3],[8,-5],[6,-9],[2,-7],[0,-8],[3,-7],[7,-5],[7,-2],[6,-4],[3,-8],[3,-5],[31,-21],[18,-4],[10,-4],[24,-16],[10,-4],[58,0],[9,2],[3,6],[8,6],[17,12],[4,0],[9,-1],[4,1],[4,3],[4,8],[4,4],[22,9],[2,1],[10,-1],[16,-7],[25,-6],[8,-10],[6,-27],[4,-5],[5,-4],[3,-4],[-6,-9],[-1,-4],[1,-5],[2,-3],[18,-14],[9,-10],[4,-7],[3,-17],[6,-14],[9,-12],[11,-6],[9,-3],[7,-1],[7,2],[7,4],[8,3],[4,-5],[3,-8],[43,-50],[2,-5],[4,-4],[9,-1],[8,0],[7,-2],[3,-4],[2,-6],[4,-13],[10,-10],[15,-9],[16,-8],[1,15],[9,5],[13,-1],[16,2],[11,6],[8,7],[10,1],[16,-9],[8,-6],[5,-6],[3,-7],[2,-18],[3,-3],[71,-28],[51,1],[17,-2],[11,-8],[23,-24],[2,-3],[1,-8],[2,-1],[12,0],[3,0],[14,-8],[6,-3],[38,-4],[11,2],[9,7],[17,-6],[14,3],[12,5],[30,8],[9,0],[8,-2],[22,-13],[2,17],[8,-2],[18,-20],[9,-3],[7,2],[5,-1],[2,-11],[0,-51],[2,-13],[9,-10],[17,-12],[36,-36],[12,-5],[1,-4],[12,-17],[5,-3],[18,-8],[14,-8],[40,-35],[8,-6],[16,-7],[7,-6],[3,-6],[17,-50],[9,-8],[18,-2],[17,3],[16,5],[16,2],[16,-6],[16,9],[19,6],[20,5],[58,4],[3,0]],[[2194,4044],[-19,16],[-3,3],[-20,20],[-14,18],[-10,21],[-6,8],[-5,7],[-7,6],[-12,9],[-5,2],[-6,2],[-10,2],[-8,0],[-7,0],[-107,-27],[-18,-6],[-96,-51],[-100,-63],[-20,-14],[-136,-75],[-15,-10],[-3,-4],[-1,-6],[1,-10],[2,-7],[3,-5],[7,-11],[5,-10],[1,-4],[0,-5],[0,-5],[-3,-7],[-2,-6],[-4,-8],[-6,-5],[-18,-10],[-11,-2],[-10,1],[-4,1],[-5,1],[-161,108],[-18,7],[-27,9],[-65,29],[-25,7],[-128,4],[-98,-6],[-27,-7],[-52,-20],[-8,-5],[-46,-34],[-72,-82],[-29,-23],[-70,-47],[-41,-20],[-108,-26],[-60,-26],[-8,-3]],[[479,3675],[-8,12],[-10,0],[-13,-5],[-17,-1],[-14,4],[-13,5],[-25,14],[-19,4],[-6,2],[-6,5],[-17,17],[-12,-3],[-10,-7],[-11,1],[-12,18],[-8,28],[0,56],[-6,27],[-20,35],[-29,29],[-67,52],[-17,23],[-8,28],[-3,59],[0,1],[2,54],[-3,27],[-9,22],[-12,14],[-16,15],[-33,23],[-13,4],[-42,5],[-2,0],[14,19],[13,42],[9,17],[3,1],[15,2],[5,1],[44,36],[25,15],[23,8],[23,4],[22,8],[17,18],[4,12],[-4,4],[-5,3],[-3,4],[2,7],[6,5],[35,19],[9,10],[22,42],[83,79],[12,16],[15,41],[8,10],[13,8],[29,2],[15,4],[48,22],[14,9],[13,15],[10,12],[-22,27],[-4,13],[2,24],[-1,44],[2,15],[7,13],[22,24],[27,12],[92,33],[19,26],[-9,20],[-19,12],[-42,15],[-34,33],[-18,10],[-23,-7],[-27,7],[-9,1],[-9,-3],[-16,-11],[-9,-3],[-21,0],[-19,6],[-18,10],[-15,11],[-29,32],[-18,42],[-35,78],[-35,77],[-35,78],[-35,78],[-10,23],[-4,23],[7,22],[53,72],[4,15],[3,15],[4,15],[10,13],[9,4],[22,7],[6,4],[0,6],[-9,23],[5,12],[13,15],[16,13],[27,9],[11,29],[16,1],[19,-1],[13,9],[2,14],[-20,17],[-20,26],[-13,11],[-49,33],[-13,12],[-47,65],[-14,11],[-18,15],[-5,13],[4,14],[13,29],[2,6],[-4,61],[2,13],[7,11],[18,10],[46,11],[13,7],[11,22],[5,97],[11,14],[16,2],[19,-4],[18,0],[4,8],[-2,35],[3,13],[5,4],[14,3],[5,3],[33,33],[16,11],[53,26],[16,14],[-3,15],[-12,15],[-6,14],[-1,29],[1,15],[5,13],[21,13],[27,6],[56,7],[15,15],[-3,27],[-21,50],[-5,26],[-5,12],[-8,11],[-44,26],[-11,14],[-5,24],[0,28],[-3,25],[-14,20],[-11,29],[-1,10],[3,12],[4,9],[0,9],[-9,11],[-44,32],[-17,22],[11,17],[11,1],[25,-4],[9,2],[8,8],[0,9],[-2,9],[2,11],[7,8],[17,17],[7,10],[7,18],[5,19],[-3,17],[10,148],[-12,59],[-2,31],[6,89],[-1,11],[-10,75],[-1,32],[5,17],[26,18],[8,19],[10,14],[18,-2],[11,21],[12,16],[17,10],[68,17],[6,6],[19,34],[-8,8],[-27,7],[-7,7],[1,13],[7,11],[12,8],[24,12],[12,10],[9,11],[7,11],[5,15],[5,7],[8,4],[-4,7]],[[801,7871],[9,-2],[27,-1],[8,1],[5,3],[10,10],[3,2],[16,41],[10,11],[19,3],[14,-6],[12,-8],[14,-5],[17,2],[10,7],[15,22],[38,86],[18,23],[97,47],[21,21],[6,25],[6,55],[13,21],[26,11],[61,7],[22,10],[17,-1],[21,4],[19,6],[14,9],[12,17],[7,20],[-1,4],[15,-4],[842,-357]],[[2493,3711],[-7,-14],[-8,-7],[-9,-6],[-10,-4],[-56,-16],[-6,-12],[-5,-70],[1,-17],[3,-10],[5,-8],[7,-6],[8,-5],[28,-11],[10,-2],[10,1],[22,3],[21,0],[9,-1],[17,-6],[8,-1],[17,0],[19,-5],[-19,-19],[-23,-13],[-37,-16],[-21,-12],[-17,-8],[-9,-7],[-3,-5],[-1,-5],[2,-25],[0,-12],[-2,-9],[-8,-34],[-1,-9],[1,-9],[1,-3],[0,-1],[11,-14],[28,-55],[7,-9],[5,-5],[9,-7],[69,-47],[24,-14],[72,-23],[52,-4],[42,-15],[13,-8],[9,-9],[5,-8],[36,-101],[2,-4],[32,-53],[40,-48],[61,-61],[15,-25],[-1,-7],[-4,-7],[-8,-5],[-10,-4],[-24,-4],[-100,-7],[-173,-11],[-19,-6],[-34,-17],[-99,-79],[-59,-40],[-33,-16],[-170,-67],[-250,-95],[-255,-96],[-111,-33],[-43,1],[-76,13],[-374,109],[-232,74],[-4,1]],[[893,2521],[37,48],[18,22],[11,11],[33,12],[7,5],[-6,15],[-15,15],[-16,14],[-88,56],[-29,9],[-23,13],[-29,44],[-18,18],[-78,60],[-26,16],[-39,11],[-11,7],[-9,11],[-19,39],[-15,24],[-10,10],[-13,8],[24,29],[7,14],[0,17],[-3,7],[-45,85],[0,1],[-1,0],[1,1],[6,10],[1,10],[-2,10],[-5,10],[-20,30],[-7,38],[1,39],[6,36],[0,17],[-6,16],[-30,44],[-3,12],[2,42],[-1,6],[-12,32],[-1,7],[0,8],[-3,18],[-8,12],[-26,23],[-11,36],[24,22],[30,21],[6,33]],[[801,7871],[-21,32],[-85,137],[-86,137],[-85,137],[-86,137],[-85,137],[-86,137],[-85,137],[-86,137],[-3,5],[-3,4],[-2,5],[-3,5],[-3,4],[-3,5],[-3,5],[-3,4],[61,-2],[32,3],[56,12],[27,-3],[27,-7],[30,-5],[46,2],[64,-7],[31,-6],[28,2],[13,-2],[61,-24],[3,-1],[8,0],[3,1],[20,1],[39,-10],[19,-2],[21,4],[22,8],[22,4],[25,-6],[14,-7],[-14,-17],[-9,-19],[-5,-19],[4,-31],[2,-7],[7,-4],[14,0],[117,21],[23,11],[42,28],[35,10],[14,2],[14,0],[14,-2],[12,3],[26,22],[15,7],[38,4],[15,5],[16,11],[16,15],[14,16],[11,16],[21,45],[12,14],[46,45],[29,50],[12,12],[19,12],[25,11],[14,4],[13,2],[24,-4],[97,4],[13,-1],[11,-3],[16,-9],[32,-23],[16,-5],[28,6],[13,22],[8,27],[9,23],[9,8],[25,19],[10,11],[16,24],[10,10],[12,10],[16,5],[29,13],[34,10],[17,10],[14,12],[11,14],[4,9],[0,6],[2,5],[9,7],[8,2],[36,1],[10,1],[8,3],[7,5],[1,7],[-5,16],[1,7],[12,6],[19,2],[34,1],[15,-2],[32,-7],[14,0],[10,5],[6,8],[5,9],[6,6],[8,3],[17,1],[9,1],[38,19],[132,124],[108,76],[16,8],[67,23],[8,5],[4,6],[2,9],[3,7],[5,6],[9,3],[97,16],[50,-4],[16,2],[16,5],[34,18],[14,5],[80,11],[15,5],[25,15],[15,5],[45,5],[3,-2],[3,-3],[4,-3],[4,0],[4,2],[6,9],[3,3],[13,2],[4,-1],[10,-3],[22,-12],[11,-2],[15,3],[37,21],[15,4],[15,1],[11,-2],[34,-7],[10,0],[9,5],[14,13],[2,-6],[3,-6],[5,-6],[4,-3],[8,1],[3,7],[0,8],[1,5],[6,15],[5,4],[5,-10],[2,-8],[2,-5],[4,-4],[8,-3],[31,12],[13,0],[-4,-17],[-2,-9],[3,-3],[7,1],[6,-1],[2,1],[9,3],[4,0],[5,-2],[7,-8],[5,-3],[24,-15],[12,-6],[15,-3],[10,1],[4,3],[1,5],[5,6],[1,2],[0,8],[2,3],[4,2],[10,1],[3,2],[10,9],[8,11],[3,7],[4,12],[5,7],[37,28],[11,12],[8,1],[21,0],[15,-5],[23,-18],[12,-24],[1,-2],[12,-34],[8,-8],[11,-9],[10,-10],[4,-12],[-3,-18],[-18,-30],[-7,-17],[-3,-30],[4,-32],[7,-28],[15,-40],[3,-16],[2,-33],[2,-7],[8,-18],[2,-8],[-3,-7],[-14,-19],[-8,-38],[-10,-17],[-31,-14],[-11,-14],[-9,-17],[-4,-14]],[[3632,1030],[0,-24],[-1,-7],[-2,-10],[-14,-32],[-11,-17],[-11,-11],[-3,-2],[-3,-5],[-2,-7],[-2,-22],[-3,-7],[-5,-5],[-7,-7],[-6,-11],[-7,-35],[8,-4],[3,-2],[5,-3],[3,-4],[4,-5],[5,-6],[9,-7],[6,-5],[13,-18],[21,-35],[10,-12],[6,-5],[3,-3],[9,-23],[21,-89],[2,-2],[-15,-1]],[[3668,604],[-218,-2],[-44,4],[-57,7],[-7,0],[-4,-3],[-4,-4],[-6,-2],[-114,-11],[-25,6],[-24,15],[-105,107],[-18,8],[-75,12],[-5,4],[-9,37],[-26,23],[-35,16],[-69,19],[-15,-4],[-39,-125],[-8,-70],[-3,-11],[-5,-10],[-2,0],[-4,1],[-10,-1],[-7,-3],[-6,-7],[-5,-7],[-4,-7],[-20,-13],[-108,-27],[-96,-23],[-3,-4],[-2,-5],[-3,-5],[-4,-1],[-13,4],[-16,2],[-9,2],[-9,1],[-11,-4],[-19,-14],[-11,-15],[-6,-18],[-10,-56],[-5,-17],[-11,-12],[-2,-6],[5,-22],[-1,-8],[-9,-5],[-92,-25],[-22,-10],[-16,-15],[-8,-10],[-11,-6],[-12,-3],[-19,1],[-14,0],[7,-70],[-2,-17],[-9,-11],[-62,-42],[-24,-25],[-42,-60],[-259,-48],[-30,-5],[-57,-4],[-127,6],[-26,8],[-7,5],[-17,24],[-4,0],[-32,5],[-9,11],[-3,20],[0,58],[27,113],[-1,15],[-25,42],[-7,38],[-7,16],[-31,50],[-6,15],[0,15],[14,47],[-1,15],[-7,18],[-23,29],[-3,8],[3,7],[10,13],[3,7],[-3,16],[-10,18],[-14,16],[-17,10],[-39,33],[-20,16],[-8,9],[-3,11],[-9,124],[-17,58],[-51,81],[-7,26],[4,184],[-11,33],[-171,246],[-13,11],[-18,4],[-35,-2],[-11,2],[-18,9],[-19,10],[-14,32],[-1,98],[7,17],[12,16],[56,42],[1,14],[-24,17],[-22,8],[-38,22],[-84,35],[-18,12],[-18,16],[-17,21],[-13,23],[-2,23],[9,20],[18,13],[47,14],[-33,51],[-9,25],[1,29],[4,22],[-2,8],[-27,5],[-25,14],[-3,14],[14,13],[101,27],[25,2],[12,-2],[8,-2],[8,1],[7,7],[4,8],[7,26],[1,15],[16,35],[3,11],[-1,5],[-3,4],[-4,11],[-1,22],[-1,5],[-6,11],[-8,5],[-25,9],[-14,9],[-26,24],[-40,27],[-5,9],[1,14],[11,15],[34,27],[15,14],[44,58]],[[6616,7104],[5,-1],[22,-19],[8,-4],[39,-7],[37,3],[35,12],[56,26],[12,-1],[13,-5],[29,-4],[17,-10],[10,-3],[9,0],[18,5],[54,-2],[8,4],[5,16],[12,7],[35,4],[3,3],[10,6],[11,2],[5,-8],[0,-30],[15,-16],[37,-5],[39,-3],[27,-5],[15,-13],[6,-4],[57,-22],[62,-44],[60,-42],[28,-14],[19,-4],[6,-2],[3,-3],[4,-9],[4,-4],[7,-3],[62,-14],[15,-7],[6,-14],[1,-21],[5,-21],[7,-19],[9,-16],[6,-7],[18,-13],[2,-5],[-4,-7],[5,-5],[8,-3],[5,-3],[2,-7],[-1,-4],[-7,-15],[-10,-35],[-9,-16],[-14,-12],[-20,-5],[-6,-4],[-4,-10],[-3,-17],[-1,-17],[2,-10],[11,-17],[0,-20],[-3,-20],[1,-21],[9,-14],[44,-33],[7,-12],[12,-48],[27,-54],[5,-31],[-26,-8],[14,-24],[40,-25],[10,-17],[2,-46],[4,-62],[3,-62],[3,-62],[3,-62],[3,-49],[-4,-9],[-94,-1],[-158,-2],[43,-33],[57,-61],[88,-95],[76,-81],[11,-17],[7,-18],[11,-112],[14,-153],[11,-112],[6,-81],[6,-86],[15,-33],[26,-6],[57,-2],[156,-5],[156,-5],[156,-5],[156,-5],[156,-5],[156,-5],[156,-5],[156,-5],[59,-2],[19,2],[17,8],[6,7],[11,19],[6,3],[35,0],[9,-7],[4,-74],[-4,-10],[-19,-14],[-1,-14],[17,-27],[-11,-28],[-82,-83],[-13,-23],[-7,-25],[3,-33],[17,-57],[3,-30],[-2,-5],[-7,-13],[-2,-8],[0,-8],[8,-38],[14,-23],[6,-14],[4,-53],[5,-11],[8,-13],[4,-17],[1,-68],[5,-28],[15,-23],[30,-15],[26,-3],[8,-2],[9,-4],[14,-11],[8,-5],[7,-2],[13,-2],[7,-3],[10,-11],[13,-25],[13,-9],[11,-2],[9,-1],[9,-3],[11,-6],[22,-22],[9,-6],[29,-11],[10,-4],[36,-27],[23,-9],[31,-6],[31,-2],[24,6],[19,3],[14,-2],[18,-7],[11,-10],[9,-17],[2,-19],[-1,-18],[1,-12],[0,-29],[2,-14],[6,-14],[9,-10],[10,-9],[12,-7],[13,-5],[-7,-24],[3,-8],[15,-17],[12,-18],[-2,-14],[-26,-2],[77,-117],[42,-92],[28,-46],[33,-17],[16,0],[14,-2],[7,-7],[-1,-16],[-56,-1],[-15,-3],[-11,-9],[-13,-37],[-39,-108],[-38,-108],[-39,-108],[-38,-108],[-10,-26],[33,-2],[9,-7],[3,-15],[5,-45],[5,-32],[-46,-4],[-14,-8],[-19,-34],[-25,-47],[-56,-103],[-57,-103],[-25,-46],[0,-1],[-10,-18],[-22,-42],[-22,-41],[-10,-19],[-29,-53],[6,-21],[62,-50],[66,-52],[83,-66],[-8,-10],[-9,-12],[-12,-11],[-19,-8],[-20,5],[-13,1],[-6,-4],[-2,-6],[-6,-6],[-8,-4],[-10,-2],[-20,-7],[-26,-33],[-21,-7],[-6,-3],[-9,-13],[-5,-4],[-10,-5],[-35,-11],[-1,20],[12,40],[2,15],[-1,32],[2,17],[-3,24],[-14,43],[-1,24],[2,25],[-3,11],[-9,9],[-32,17],[-76,42],[-77,41],[-76,42],[-76,41],[-77,41],[-76,42],[-77,41],[-76,42],[-42,22],[-23,15],[-25,15],[-16,3],[-66,0],[-155,-2],[-154,-2],[-154,-2],[-155,-1],[-67,-1],[-124,-24],[-277,-52],[-277,-53],[-278,-52],[-277,-53],[-18,-2],[-38,-5],[-39,-6],[-18,-2],[-73,-10],[-13,-4],[-6,-9],[-16,-38],[-23,-55],[-23,-56],[-23,-55],[-23,-56],[-11,-19],[-10,-20],[-5,-9],[-6,-10],[-10,-20],[-14,-18],[-14,-18],[-13,-18],[-14,-18],[-37,-46],[-36,-46],[-37,-46],[-36,-46],[-18,-22]],[[6060,1435],[-3,-50],[-26,-78],[-27,-78],[-29,-85],[-30,-88],[-28,-80],[-38,-109],[-30,-86],[-36,-103],[-21,-67],[-23,-72],[-19,-38],[-7,3],[-2,5],[-2,7],[-3,7],[-10,8],[-35,22],[-39,16],[-11,11],[-6,13],[0,24],[-6,9],[2,7],[0,7],[-5,29],[-2,7],[-12,2],[-35,6],[-122,-6],[-258,1],[-258,2],[-31,-5],[-13,-6],[-38,-29],[-10,3],[-33,26],[-17,6],[-76,5],[-22,-4],[-12,-4],[-3,-2],[0,-5],[-8,-17],[-3,-15],[-3,-6],[-6,-5],[-7,-3],[-5,-1],[-5,-3],[-7,-12],[-12,-43],[-26,-56],[-6,-8],[-17,-8],[-6,-5],[-61,-137],[-19,-25],[-43,-34],[-12,-18],[-35,-114],[-1,-54],[-7,-15],[-19,-58],[1,-10],[-15,6],[-3,36],[-10,10],[6,18],[-3,21],[-11,17],[-17,7],[-9,6],[-22,40],[-8,6],[-8,2],[-5,4],[-2,12],[1,8],[4,15],[1,8],[3,8],[7,7],[6,7],[1,11],[-46,39],[-11,14],[-5,17],[-3,5],[-15,8],[-5,6],[1,7],[6,15],[-1,8],[-11,9],[-17,10],[-11,13],[8,18],[11,11],[5,10],[0,12],[-7,16],[-7,9],[-22,23],[-8,5],[-16,3],[-19,8],[-15,10],[-18,2],[-6,2],[-7,-1],[-15,-6],[-8,-1],[-32,7],[-57,28],[-154,31],[-140,-2]]],"transform":{"scale":[0.0012202051708170777,0.0013218757991799153],"translate":[-69.6664922699999,-22.897257587999945]}};
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
