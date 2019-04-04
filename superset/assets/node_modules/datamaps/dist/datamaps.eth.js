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
  Datamap.prototype.ethTopo = {"type":"Topology","objects":{"eth":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Amhara"},"id":"ET.AM","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Tigray"},"id":"ET.TI","arcs":[[5,-5,6]]},{"type":"Polygon","properties":{"name":"Afar"},"id":"ET.AF","arcs":[[7,8,-1,-6,9]]},{"type":"Polygon","properties":{"name":"Southern Nations, Nationalities and Peoples"},"id":"ET.SN","arcs":[[10,11,12]]},{"type":"Polygon","properties":{"name":"Gambela Peoples"},"id":"ET.GA","arcs":[[-12,13,14]]},{"type":"Polygon","properties":{"name":"Oromiya"},"id":"ET.AA","arcs":[[-9,15,16,17,18,-13,-15,19,20,-2],[21],[22],[23],[24],[25]]},{"type":"MultiPolygon","properties":{"name":"Benshangul-Gumaz"},"id":"ET.BE","arcs":[[[-25]],[[-24]],[[-22]],[[-21,26,-3]]]},{"type":"Polygon","properties":{"name":"Addis Ababa"},"id":"ET.AA","arcs":[[-23]]},{"type":"Polygon","properties":{"name":"Somali"},"id":"ET.SO","arcs":[[-18,27,-16,-8,28]]},{"type":"Polygon","properties":{"name":"Dire Dawa"},"id":"ET.DD","arcs":[[-17,-28]]},{"type":"Polygon","properties":{"name":"Harari People"},"id":"ET.HA","arcs":[[-26]]}]}},"arcs":[[[4529,7773],[-11,-41],[-1,-9],[0,-9],[1,-12],[4,-26],[17,-45],[6,-23],[0,-13],[-2,-11],[1,-10],[12,-24],[5,-12],[2,-12],[1,-14],[0,-25],[1,-12],[3,-13],[5,-11],[3,-7],[5,-8],[16,-12],[2,-4],[-6,-84],[1,-24],[4,-18],[24,-55],[12,-18],[14,-15],[14,-9],[4,-3],[2,-6],[4,-19],[4,-44],[7,-20],[28,-60],[6,-20],[6,-48],[0,-26],[-2,-25],[21,-29],[12,-14],[10,-18],[27,-63],[7,-22],[4,-24],[2,-41],[3,-30],[0,-16],[-2,-16],[-5,-12],[-38,-74],[17,-23],[7,-24],[-1,-23],[-7,-23],[-19,-44],[-6,-19],[0,-19],[8,-23],[21,-33],[4,-11],[0,-19],[-7,-43],[0,-21],[15,-63],[1,-5],[0,-6],[-3,-17],[-7,-19],[-4,-17],[-7,-111],[-2,-15],[-12,-41],[-3,-24],[2,-22],[4,-23],[2,-24],[-1,-17],[-5,-5],[-10,1],[-15,5],[-14,3],[-17,1],[-15,-5],[-11,-11],[-7,-22],[1,-18],[8,-16],[15,-14],[20,-15],[14,-13],[6,-19],[-1,-33],[-5,-19],[-19,-34],[-6,-17],[-18,-30],[0,-12],[3,-10],[5,-9],[3,-11],[-9,-24],[-26,0],[-56,20],[-27,-9],[2,-35],[24,-82],[2,-45],[-4,-44],[-13,-39],[-24,-32],[-14,-13],[-10,-13],[-2,-14],[10,-15],[7,-3],[18,-6],[9,-6],[23,-24],[0,-41],[-18,-40],[-23,-38],[-15,-35]],[[4550,4997],[-30,-31],[2,-177],[-7,-25],[-20,-17],[-69,-32],[-23,-17],[-32,-30],[-14,-4],[-17,12],[-24,47],[-20,10],[-10,-5],[-34,-44],[-15,-2],[-12,4],[-8,8],[-5,9],[-17,48],[-1,14],[2,17],[-3,50],[58,120],[8,29],[-2,26],[-14,13],[-35,9],[-14,15],[-9,29],[-6,32],[-2,24],[4,8],[11,1],[16,-1],[58,5],[8,5],[33,31],[17,4],[23,-11],[1,1],[-39,52],[-4,8],[2,21],[-14,10],[-19,5],[-16,-1],[-24,6],[-22,37],[-24,55],[-32,61],[-77,44],[-122,32],[-42,27],[-22,35],[-12,39],[-5,42],[-1,44],[-1,6],[-13,23],[-7,9],[-7,7],[-5,4],[-43,21],[-13,16],[-1,26],[27,-7],[25,7],[44,31],[9,12],[28,175],[1,32],[-12,13],[-77,17],[-156,-10],[-6,-7],[-4,-8],[-17,-94],[-5,-10],[-6,-7],[-6,-3],[-3,-5],[0,-12],[5,-18],[0,-9],[-1,-10],[-9,-17],[-15,-9],[-17,-4],[-16,1],[-17,5],[-7,1],[-7,-2],[-18,-9],[-19,-5],[-5,-5],[-2,-3],[-5,-17],[-1,-2],[-17,-22],[-6,-4],[-6,-4],[-40,-14],[-94,-57],[-31,-28],[-7,-4],[-12,-1],[-6,-1],[-5,-4],[-4,-5],[-6,-11],[-6,-8],[-47,-34],[-6,-2],[-5,1],[-6,2],[-6,1],[-10,-3],[-18,-13],[-11,0],[-62,60],[-11,15],[-3,11],[-16,23],[-13,24],[-9,9],[-64,37],[-23,9],[-23,3],[-10,-5],[-3,-11],[-2,-12],[-7,-10],[-7,-2],[-6,5],[-4,7],[-4,8],[-2,10],[0,19],[-1,10],[-6,9],[-10,6],[-12,4],[-8,0],[-8,-2],[-4,0],[-5,1],[-6,5],[-16,21],[-9,29],[8,27],[10,24],[-2,24],[-10,6],[-45,1],[-13,5],[-13,10],[-19,20]],[[2706,6011],[-96,24],[-27,13],[-14,4],[-31,2],[-7,2],[-6,5],[-5,5],[-3,6],[-4,4],[-6,0],[-16,-6],[-6,0],[-76,9],[-31,-1],[-13,6],[-9,17],[-1,15],[1,16],[0,15],[-7,12],[-7,4],[-8,-1],[-32,-21],[-16,2],[-16,13],[-15,22],[-13,28],[-10,37],[-5,48],[43,128],[-9,15],[-15,0],[-13,-6],[-9,-11],[-6,-18],[-2,-1],[-1,16],[-1,24],[2,26],[17,49],[0,12],[1,14],[9,18],[11,18],[11,14],[34,34],[19,26],[16,38],[-20,55],[3,10],[5,16],[-1,18],[-4,18],[-1,15],[6,20],[12,21],[11,26],[1,34],[-40,53],[-11,9],[-16,18],[5,18],[14,17],[8,14],[-2,7],[-38,77],[-23,29],[-8,16],[-3,78],[4,58],[-5,9],[-16,-7],[-25,-23],[-27,-30],[-28,-38],[-12,-10],[-14,-3],[-13,8],[-10,40],[-5,44],[-7,20],[-16,25],[-23,50],[-3,5],[-29,30],[-8,12],[-8,23],[-6,10],[-17,12],[-3,4],[-11,4],[-18,0],[-17,3],[-7,12],[-2,5],[-6,1],[-21,0],[-27,3],[-5,-4],[-18,-57],[-10,-19],[-85,-85],[-16,-22],[-14,-14],[-14,-3],[-18,2],[-19,-4],[-38,-15],[-14,0],[-16,10],[-17,19],[-18,25],[-26,78],[-17,19]],[[1507,7453],[0,4],[2,8],[6,8],[25,19],[13,19],[5,20],[7,48],[12,38],[5,10],[7,7],[14,10],[7,7],[6,12],[2,11],[2,24],[7,25],[125,268],[6,9],[6,3],[13,1],[6,3],[6,10],[3,9],[1,9],[4,22],[0,5],[3,2],[9,6],[1,0],[17,8],[201,37],[6,0],[8,-2],[4,-2],[4,-4],[6,-4],[18,-7],[11,6],[5,17],[14,97],[-1,21],[-2,13],[-16,34],[-1,20],[8,15],[10,12],[6,13],[0,8],[-2,7],[-6,14],[-1,17],[65,286],[99,183],[6,25],[2,49],[3,17],[28,88]],[[2302,9038],[9,-9],[47,-132],[9,-14],[11,0],[88,-29],[13,-6],[74,-88],[37,-29],[16,-24],[12,-6],[78,-14],[14,-1],[10,8],[7,10],[37,25],[4,2],[15,4],[21,3],[17,-5],[19,-11],[18,-15],[11,-16],[6,-7],[9,-3],[116,-4],[19,5],[93,56],[10,10],[10,14],[6,16],[16,61],[16,15],[26,0],[74,-23],[89,-56],[22,-5],[9,4],[13,9],[13,11],[7,10],[10,15],[24,-2],[34,-7],[39,-2],[66,12],[13,8],[11,14],[6,14],[7,13],[11,6],[8,-2],[6,-10],[5,-15],[3,-19],[-20,-60],[4,-4],[56,19],[15,8],[11,3],[13,1],[48,-6],[1,-6],[9,-27],[5,-37],[4,-16],[11,-6],[17,-10],[149,-189],[17,-27],[4,-28],[-1,-16],[2,-21],[3,-20],[5,-13],[9,-7],[11,-3],[34,1],[73,17],[13,-7],[6,-17],[2,-27],[5,-28],[8,-31],[6,-38],[-1,-49],[-49,-115],[-4,-29],[5,-30],[28,-88],[7,-96],[3,-20],[6,-23],[10,-22],[12,-12],[6,-2],[49,3],[1,3],[2,19],[20,7],[84,-4],[6,-14],[2,-18],[-1,-19],[-4,-13],[1,-3],[60,46],[7,2],[48,4],[23,4],[22,8]],[[4676,9629],[-5,-3],[-6,-5],[1,-8],[1,-11],[-1,-23],[-1,-3],[-4,-11],[-5,-8],[-2,-2],[-2,-1],[-18,-3],[-50,7],[-27,10],[-11,2],[-47,-12],[-21,-15],[-18,-19],[-5,-9],[0,-7],[16,-10],[41,4],[10,-12],[-2,-11],[-30,-42],[-17,-45],[-3,-15],[5,-6],[9,0],[12,0],[11,-4],[10,-8],[-22,-31],[-3,-7],[5,-16],[9,-1],[11,6],[8,2],[8,-9],[5,-16],[2,-18],[1,-15],[-3,-32],[0,-12],[4,-10],[10,-10],[2,-7],[2,-6],[0,-5],[1,-51],[-13,-81],[-3,-38],[6,-31],[9,-31],[6,-43],[-4,-38],[-19,-15],[-25,15],[-6,-11],[-16,-67],[1,-22],[11,-35],[2,-22],[-2,-21],[-14,-88],[2,-12],[4,-14],[2,-3],[10,-14],[4,-4],[7,-4],[2,-2],[4,-10],[10,-66],[4,-9],[8,-12],[1,-5],[-4,-15],[-7,-15],[-9,-11],[-8,-2],[3,-41],[-1,-17],[-3,-25],[0,-19],[-2,-10],[-4,-14],[1,-4],[20,-21],[10,-7],[15,-2],[13,-5],[11,-14],[17,-34],[4,-29],[-3,-41],[-8,-40],[-10,-25],[-23,-31],[-14,-33],[-8,-36],[-3,-43],[2,-15],[10,-27],[2,-18],[-1,-20],[-1,-20],[-6,-17],[-12,-14]],[[2302,9038],[12,38],[-2,43],[-12,44],[-3,21],[-1,22],[3,19],[60,237],[13,0],[5,17],[8,9],[12,3],[14,1],[9,2],[21,13],[13,3],[30,0],[6,2],[11,8],[6,2],[46,0],[21,-4],[44,-16],[22,-4],[4,-3],[12,-21],[5,-5],[5,-4],[6,-2],[7,-1],[4,2],[10,10],[5,0],[12,-1],[5,1],[9,7],[7,11],[5,14],[2,19],[0,21],[2,17],[6,18],[10,18],[19,19],[23,6],[49,-1],[15,7],[9,1],[16,-17],[13,-10],[25,-46],[10,-13],[3,-7],[1,-13],[0,-20],[1,-9],[10,-8],[27,-28],[3,-5],[5,-17],[3,-22],[4,-9],[9,-5],[7,-1],[6,-4],[6,-7],[2,-8],[0,-23],[4,-14],[6,-11],[12,-9],[8,9],[24,74],[38,117],[42,127],[43,131],[44,133],[27,83],[11,-13],[8,-15],[13,-32],[3,-3],[7,-1],[2,-3],[0,-3],[0,-10],[0,-2],[3,-7],[1,-5],[3,-5],[8,-1],[6,-6],[2,-7],[0,-8],[4,-8],[6,-6],[72,-38],[12,-3],[38,9],[16,-2],[10,-5],[7,-11],[4,-13],[1,-4],[4,-24],[3,-8],[6,-8],[8,-5],[7,-7],[4,-11],[7,-34],[5,-15],[8,-13],[10,-10],[36,-25],[6,-6],[4,-19],[4,-8],[8,-8],[5,-1],[6,2],[33,0],[51,8],[25,8],[41,27],[13,0],[12,-6],[12,-1],[13,1],[12,4],[40,21],[30,4],[12,11],[22,25],[28,17],[14,11],[9,16],[2,16],[-1,16],[1,14],[9,11],[1,-3],[24,-3],[19,-6],[6,-3],[15,-12],[13,-16],[12,-18],[9,-18],[19,-73],[14,-32],[17,0],[14,30],[9,11],[17,3],[36,-8],[13,1],[54,20],[28,17],[12,20],[5,17],[11,0],[14,-9],[10,-11],[13,-21],[4,-5],[4,-3],[34,-13],[18,-2],[31,7],[8,2],[21,0],[20,-8],[18,-15],[35,-39],[10,-6],[13,-2],[13,4],[21,22],[12,4],[13,-3]],[[5855,6610],[-7,-4],[-12,-9],[-12,-7],[-20,-2],[-266,2],[-14,-6],[-14,-18],[-5,-22],[-2,-23],[-5,-23],[-18,-40],[-52,-65],[-23,-36],[-6,-18],[-1,-16],[3,-36],[0,-24],[-96,-474],[1,-22],[5,-22],[11,-13],[30,-15],[6,-12],[-10,-19],[-84,-95],[-37,-53],[-59,-118],[-10,-33],[-12,-63],[-6,-61]],[[5140,5263],[-17,-23],[-19,-13],[-21,-7],[-55,-11],[-22,-13],[-20,-21],[-22,-28],[-17,-29],[-46,-95],[-9,-15],[-42,-53],[-5,-13],[-2,-14],[-1,-19],[-8,-27],[-14,-17],[-18,-15],[-22,-2],[-24,-55],[-13,-17],[-41,-37],[-8,4],[-4,19],[16,58],[0,38],[-12,17],[-22,5],[-29,1],[2,17],[-3,10],[-6,7],[-6,10],[-3,16],[-5,38],[-5,14],[-14,10],[-18,0],[-35,-6]],[[4676,9629],[16,-3],[9,0],[33,12],[12,1],[60,-19],[29,-15],[26,-20],[51,-60],[46,-54],[38,-25],[71,-44],[19,-7],[60,-11],[46,-22],[40,-37],[70,-101],[70,-102],[52,-117],[47,-107],[21,-25],[90,-74],[115,-95],[70,-73],[51,-54],[26,-34],[23,-38],[21,-45],[52,-144],[35,-62],[52,-43],[38,-20],[37,-27],[32,-35],[43,-95],[55,-95],[32,-43],[-41,-69],[-20,-57],[-89,-156],[-10,-32],[-5,-10],[-16,-10],[-7,-11],[-27,-64],[-55,-101],[-26,-46],[-7,-10],[-10,-9],[-9,-6],[-7,-3],[-6,-5],[-4,-12],[-6,-11],[-27,-15],[-9,-9],[-11,-27],[-9,-66],[-20,-79],[1,-48],[17,-100],[8,-95],[-2,-167],[-4,-38],[-12,-24],[4,-6]],[[2441,896],[-4,1],[-10,8],[-6,1],[-104,-3],[-124,-3],[-9,2],[-12,7],[-6,3],[-7,0],[-23,-4],[-98,-2],[-2,0],[-16,5],[-14,12],[-26,30],[-12,10],[-4,12],[0,15],[2,17],[-1,17],[-8,20],[-2,15],[-91,127],[-16,36],[-6,42],[3,182],[4,12],[25,42],[6,17],[-1,18],[-6,21],[-13,33],[-2,17],[5,20],[18,34],[-4,8],[-36,19],[-44,35],[-17,6],[-12,-4],[-12,-7],[-16,-5],[-16,6],[-29,30],[-15,12],[-12,4],[-14,2],[-14,0],[-12,-3],[-15,-12],[-27,-39],[-15,-14],[-16,-3],[-12,8],[-10,14],[-22,45],[-3,8],[1,11],[5,9],[5,9],[4,10],[-2,11],[-5,17],[-26,27],[-53,41],[-30,29],[-7,16],[-6,51],[-9,23],[-54,100],[-7,19],[-1,12],[1,9],[2,10],[2,12],[-3,10],[-10,16],[-4,9],[0,10],[3,10],[7,19],[-1,10],[-6,46],[-5,17],[-12,19],[-12,15],[-11,16],[-13,43],[-24,53],[-3,18],[0,51],[-5,22],[-26,60],[-6,17],[-5,51],[-15,49],[-7,35],[-7,36],[-4,4],[-8,12],[-4,16],[-4,9],[-45,39],[-12,6],[-14,2],[-29,1],[-11,3],[-8,8],[-5,36],[0,4],[-3,9],[-1,5],[1,1],[6,5],[2,3],[-1,17],[-3,15],[-4,13],[-6,12],[-43,39],[-95,29],[-2,4],[-4,2],[-5,4],[-3,15],[-3,6],[-28,26],[-6,11],[-5,5],[-5,2],[-5,9],[-2,19],[0,10]],[[804,3219],[15,8],[20,-14],[19,-22],[16,-15],[17,-2],[17,6],[32,17],[25,7],[26,0],[25,-8],[20,-17],[18,-18],[19,-12],[21,-5],[22,1],[21,5],[16,8],[13,14],[17,19],[19,18],[19,11],[21,6],[23,1],[41,-2],[17,6],[9,21],[13,-6],[15,5],[15,11],[9,15],[12,-15],[17,-12],[17,-10],[16,-6],[16,1],[29,17],[16,4],[38,-10],[16,3],[5,21],[-2,7],[-6,16],[-2,9],[1,9],[2,18],[0,9],[2,13],[8,22],[0,12],[0,12],[1,12],[13,60],[2,18],[-5,18],[-11,14],[-46,32],[-7,11],[7,26],[-6,16]],[[1517,3604],[-13,77],[-1,42],[9,25],[12,11],[17,31],[27,23],[3,17],[0,19],[8,18],[4,2],[12,0],[7,2],[16,14],[4,4],[11,10],[10,1],[11,-2],[14,6],[29,-1],[7,-20],[4,-17],[7,-14],[18,-10],[14,0],[15,8],[26,22],[8,6],[14,6],[21,5],[5,2],[10,10],[14,15],[12,18],[4,15],[-4,13],[-10,13],[-23,21],[-12,17],[0,16],[15,30],[10,14],[14,6],[16,0],[16,-2],[15,-4],[8,-9],[6,-14],[18,-81],[0,-21],[-4,-20],[-9,-16],[-19,-31],[1,-17],[12,-16],[41,-33],[23,-13],[10,-8],[8,-12],[16,-43],[15,-31],[1,-13],[-4,-24],[-1,-23],[4,-17],[12,-10],[52,-9],[26,-21],[25,-24],[29,-20],[40,-19],[15,-3],[5,-2],[12,-11],[9,-6],[25,-9],[6,-1],[29,1],[13,-3],[14,-6],[52,-29],[13,0],[115,-99],[29,-16],[30,-11],[31,-4],[24,2],[48,12],[54,-4],[21,4],[20,14],[43,44],[67,40],[22,18],[8,-4],[2,4],[9,27],[2,40],[4,17],[4,6],[18,92],[-1,11],[-16,67],[-5,33],[1,89],[1,16],[4,16],[13,31],[3,15],[-5,25],[-24,34],[0,24],[41,15],[21,4],[17,-10],[14,-36],[10,-9],[13,-3],[14,4],[18,7],[2,10],[0,13],[-4,16],[-11,27],[-3,17],[1,63],[8,75],[-1,10],[-6,5],[-50,16],[-10,6],[-11,10],[-5,6],[-2,5],[-4,15],[-3,8],[3,25],[11,38],[8,16],[11,15],[14,9],[15,-1],[13,-15],[8,-23],[10,-18],[14,1],[45,-7],[13,-10],[9,0],[10,4],[15,1],[45,-13],[17,1],[126,41],[91,14],[37,12],[14,-4],[11,-10],[10,-13],[3,-5],[2,-6],[4,-19],[3,-36],[10,-33],[24,-5],[28,12],[20,21],[6,15],[8,56],[2,7],[3,7],[10,18],[14,20],[4,3],[13,5],[15,4],[14,-1],[11,-13],[42,-26],[9,-17],[5,-19],[2,-20],[-7,-43],[3,-15],[9,-12],[15,-13],[-11,-59],[0,-20],[2,-21],[0,-20],[-7,-18],[-17,24],[-7,14],[-6,14],[-12,70],[-6,17],[-39,-16],[5,-19],[20,-37],[5,-21],[2,-13],[7,-30],[10,-66],[-2,-10],[-6,-16],[-9,-35],[-22,-47],[-29,-47],[-15,-35],[-24,-31],[-6,-16],[-5,-17],[-11,-33],[-2,-15],[-2,-41],[7,-66],[0,-21],[-6,-12],[-12,-7],[-14,-6],[-17,-10],[-9,-10],[-5,-14],[-5,-20],[-8,-18],[-18,-28],[-6,-18],[-7,-36],[-7,-11],[-91,-75],[-19,-21],[-10,-27],[-4,-30],[-2,-33],[3,-16],[11,-16],[18,-12],[24,-8],[61,18],[11,11],[27,41],[5,13],[14,26],[17,-7],[21,-17],[26,-6],[19,-7],[21,-18],[23,-11],[22,12],[18,4],[21,-22],[20,-41],[15,-50],[-19,-132],[2,-30],[5,-10],[11,-11],[12,-10],[23,-10],[87,-58],[11,-3],[32,-3],[17,-6],[11,-11],[7,-12],[26,-22],[49,-59],[11,-16],[4,-16],[4,-39],[16,-78],[0,-40],[-7,-19],[-10,-16],[-7,-17],[1,-20],[11,-38],[7,-17],[9,-15],[-65,-11],[-29,3],[-32,36],[0,6],[-5,20],[-12,26],[-20,45],[-15,25],[-4,8],[-50,30],[-6,8],[-7,16],[-2,6],[-24,-4],[-18,1],[-4,1],[-51,19],[-27,7],[-27,1],[-33,-7],[-24,-17],[-13,-30],[-4,-43],[8,-74],[-2,-26],[-7,-13],[-12,-9],[-15,-14],[-8,-16],[-9,-36],[-22,-53],[-8,-16],[-12,-13],[-2,-6],[4,-10],[18,-23],[39,-29],[7,-10],[-2,-10],[-49,-41],[-13,-3],[-15,-1],[-14,-4],[-15,3],[-13,22],[-81,187],[-3,18],[0,24],[6,19],[10,1],[14,-10],[15,-3],[14,7],[11,19],[2,22],[-13,33],[2,18],[10,32],[8,13],[43,21],[17,32],[-1,36],[-25,29],[-12,3],[-13,0],[-13,-4],[-14,-5],[-8,2],[-17,25],[-13,16],[-28,21],[-7,4],[-12,9],[-10,15],[-10,12],[-15,2],[-16,-7],[-9,-1],[-21,1],[-4,3],[-15,16],[-12,0],[-11,-14],[-31,-57],[-13,-37],[2,-36],[22,-35],[13,-32],[-3,-46],[-11,-45],[-13,-33],[-18,-34],[-7,-18],[-1,-21],[8,-64],[-2,-23],[5,-12],[15,-6],[22,-6],[67,-36],[14,-10],[6,-14],[4,-22],[13,-37],[7,-41],[7,-18],[11,-14],[15,-7],[13,-11],[4,-20],[-2,-22],[-10,-14],[-42,-28],[-33,-8],[-11,-10],[-5,-16],[11,-60],[0,-45],[-7,-45],[-12,-38],[-9,-20],[-4,-17],[-1,-18],[3,-42],[-1,-19],[-4,-18],[-10,-11],[-16,-1],[-14,11],[-12,14],[-12,10],[-32,11],[-32,17],[-15,5],[-14,-4],[-12,-11],[-7,-16],[-10,-11],[-15,-10],[-30,-14],[-66,-45],[-35,-18],[-35,-3],[-16,8],[-27,21],[-18,6],[-20,2],[-10,0],[-64,-12],[-16,0],[-50,10],[-17,-2],[-15,-12],[-20,-31],[-14,-37],[-31,-130],[0,-19],[4,-22],[15,-43],[4,-23],[-4,-50],[-17,-45],[-49,-81],[-31,-64],[-13,-35],[-9,-35],[-2,-6],[-4,-5],[-13,-11],[-23,-11],[-8,-9]],[[804,3219],[0,27],[-3,18],[-6,15],[-9,8],[-11,-7],[-13,-4],[-13,12],[-18,30],[-30,31],[-5,3],[-1,4],[-1,82],[-4,29],[-12,24],[-83,110],[-19,15],[-7,2],[-14,2],[-7,2],[-34,33],[-21,38],[-9,13],[-6,4],[-21,8],[-18,16],[-7,2],[-43,-5],[-15,5],[-7,7],[-9,16],[-6,7],[-7,5],[-12,4],[-6,6],[-12,6],[-17,-1],[-29,-8],[-6,-4],[-16,-14],[-9,0],[-37,12],[-12,14],[-10,16],[-10,12],[-6,2],[-22,4],[-19,10],[-5,2],[-22,-7],[-4,-2],[-4,-7],[-8,2],[-15,8],[-18,3],[-5,3],[-2,5],[-2,8],[-3,7],[-12,9],[-5,14],[-17,58],[3,9],[8,13],[1,1],[3,8],[3,5],[3,6],[3,18],[4,9],[8,15],[38,50],[4,8],[3,9],[1,7],[3,5],[20,4],[12,7],[8,9],[5,12],[2,17],[-2,5],[-9,8],[-2,5],[0,12],[1,9],[3,8],[5,10],[6,5],[6,3],[5,5],[1,11],[-9,5],[-6,4],[-5,10],[-5,7],[-5,8],[-2,10],[2,7],[5,16],[2,11],[-1,3],[-6,6],[-2,2],[1,5],[3,6],[1,4],[0,15],[1,6],[3,6],[9,6],[10,3],[5,6],[-2,5],[0,3],[19,22],[11,2],[73,-21],[6,3],[9,9],[5,4],[6,0],[8,-2],[45,7],[7,4],[0,3],[-4,7],[14,1],[11,-9],[10,-10],[10,-6],[13,3],[9,7],[10,5],[14,-3],[21,-22],[13,-30],[16,-24],[30,-5],[7,1],[3,1],[28,31],[7,6],[11,6],[11,4],[23,4],[37,0],[13,4],[13,11],[66,77],[14,20],[9,20],[2,19]],[[745,4529],[17,-11],[12,-16],[8,-7],[8,2],[31,31],[16,6],[18,-2],[20,-11],[34,-30],[58,-73],[33,-33],[67,-44],[19,-21],[24,-45],[14,-19],[20,-11],[40,-11],[12,-12],[11,-27],[13,-23],[18,-9],[20,0],[49,9],[38,2],[36,-5],[20,-20],[-5,-12],[-17,-11],[-33,-14],[-41,-29],[-30,-17],[-6,-11],[6,-10],[33,-13],[3,-9],[-3,-11],[-42,-78],[-11,-36],[0,-41],[14,-37],[21,-27],[24,-24],[23,-28],[6,-19],[4,-41],[6,-18],[10,-11],[67,-30],[9,-11],[-5,-15],[-10,-10],[-10,-16],[-4,-15],[12,-7],[21,-1],[9,-2],[16,-9],[4,2],[4,4],[7,6],[13,9],[13,13],[9,15],[-1,19]],[[5140,5263],[4,3],[2,1],[3,0],[5,-1],[37,0],[33,8],[31,0],[31,-24],[7,-17],[-9,-12],[-17,-6],[-17,-1],[-30,8],[-12,-2],[-2,-17],[4,-22],[6,-18],[10,-13],[15,-6],[14,1],[17,4],[29,14],[21,17],[7,5],[7,2],[8,0],[7,1],[6,5],[12,14],[13,11],[14,10],[32,15],[16,9],[14,12],[14,14],[18,25],[7,6],[26,8],[29,-1],[55,-14],[51,-24],[14,-1],[12,8],[24,26],[13,9],[16,5],[17,2],[15,-3],[8,-12],[10,-17],[14,-9],[17,-2],[17,5]],[[5835,5289],[21,12],[19,-1],[19,-4],[21,5],[8,1],[19,-8],[9,-3],[8,1],[7,3],[38,21],[18,0],[40,-26],[11,19],[19,19],[17,20],[3,21],[-13,27],[-3,11],[4,7],[9,8],[20,15],[16,7],[34,4],[11,7],[10,13],[25,27],[13,9]],[[6238,5504],[27,-11],[8,-37],[-4,-85],[21,-5],[24,-32],[22,-40],[43,-111],[1,-8],[1,-20],[2,-13],[23,-83],[7,-17],[12,-16],[3,-7],[-1,-23],[1,-15],[12,-35],[41,-84],[46,-66],[14,-16],[29,-28],[12,-15],[6,-35],[-22,-81],[7,-39],[34,-46],[8,-17],[4,-21],[1,-24],[0,-24],[-6,-42],[-1,-24],[-4,-20],[-12,-11],[-59,-20],[-14,-10],[-17,-33],[-27,-127],[-24,-35],[-22,6],[-20,31],[-16,41],[-12,46],[-20,145],[-20,37],[-38,21],[-80,19],[-9,11],[-26,63],[-44,-16],[-63,-69],[-28,-37],[-26,-43],[-5,-21],[4,-51],[-1,-23],[-8,-23],[-37,-68],[-14,-43],[-6,-48],[-9,-211],[2,-22],[6,-21],[12,-26],[3,-38],[-11,-48],[-31,-89],[-9,-36],[-2,-17],[1,-19],[6,-47],[5,-26],[7,-13],[204,-104],[4,-7],[9,-54],[-3,-42],[-10,-39],[-13,-27],[-2,-7],[-1,-10],[1,-19],[-2,-11],[-3,-10],[-9,-18],[-8,-27],[-1,0],[-3,-4],[-4,-5],[-4,-7],[2,-10],[-22,-16],[-7,-13],[-3,-22],[-1,-5],[-7,-16],[-1,-9],[2,-19],[-1,-9],[-6,-11],[7,-16],[-6,-20],[-19,-36],[-11,-61],[-7,-16],[-9,-17],[-2,-7],[-3,-8],[-5,-10],[-17,-23],[-5,-4],[-14,-10],[-15,-8],[-16,-5],[-16,-1],[-10,29],[-26,-3],[-29,-22],[-19,-26],[-22,-58],[-11,-16],[-25,-22],[-10,-13],[-8,-19],[-108,144],[-14,13],[-15,11],[-16,7],[-34,6],[-83,58],[-31,28],[-32,19],[-33,-2],[-16,-13],[-14,-17],[-33,-57],[-39,-50],[-10,-18],[-27,-61],[-4,-20],[5,-42],[-2,-36],[4,-20],[6,-20],[3,-18],[1,-22],[-1,-23],[-2,-22],[-4,-21],[-5,-45],[9,-166],[-1,-70],[1,-25],[5,-23],[24,-74],[-49,-47],[-97,-70],[-105,-124],[-12,-7],[-17,-4],[-5,-4],[-6,-3],[-31,0],[-50,-15],[-27,-3],[-21,-6],[-17,1],[-6,-1],[-33,-16],[-15,-2],[-48,12],[-24,13],[-19,14],[-10,0],[-14,-14],[-63,-119],[-41,-137],[-25,-65],[-14,-71],[-20,-71],[-13,-95],[-2,-52],[-4,-23],[-104,-316],[-25,-40],[-5,-12],[-14,-76],[-21,-74],[-3,-18],[1,-18],[9,-36],[-19,-54],[-92,-203],[-21,-37],[-26,-22],[-57,-31],[-54,-39],[4,-7],[-7,-9]],[[4070,100],[-9,5],[-6,2],[-39,-10],[-10,0],[-10,4],[-11,2],[-28,-7],[-18,0],[-49,18],[-66,23],[-12,9],[-11,13],[-18,31],[0,-5],[0,-13],[0,-5],[-39,3],[-4,3],[-1,5],[-1,3],[-9,-5],[-4,-1],[-9,2],[-9,3],[-2,5],[-2,7],[-5,8],[-13,14],[-3,2],[-7,-4],[-1,-7],[0,-8],[0,-5],[-34,-19],[-38,-4],[-71,10],[-71,11],[-21,-3],[-21,-6],[-8,1],[-15,18],[-20,8],[-9,6],[-10,16],[-17,35],[-12,17],[-21,17],[-66,56],[-64,53],[-69,58],[-61,51],[-54,46],[-76,63],[-65,55],[-65,55],[-36,30],[-4,1],[-4,0],[-4,1],[-2,5],[-3,19],[-3,9],[-4,7],[-5,2],[-14,-1],[-4,4],[-11,23],[-6,7],[-28,8],[-47,31],[-40,14],[-128,-1],[-2,1]],[[745,4529],[3,22],[-9,252],[-10,252]],[[729,5055],[31,-1],[125,-14],[19,3],[12,11],[10,16],[7,15],[6,16],[5,20],[26,151],[13,161],[17,13],[15,0],[25,6],[12,-3],[15,-14],[31,-35],[17,-12],[21,4],[75,104],[26,62],[39,157],[-6,14],[-9,13],[-7,20],[4,8],[85,-8],[11,-5],[4,-9],[-2,-22],[1,-21],[8,-14],[17,-1],[52,10],[22,-2],[31,-5],[13,-1],[13,-3],[14,-9],[25,-25],[134,-173],[91,-143],[33,-43],[28,5],[9,0],[9,-16],[14,-37],[1,-11],[0,-48],[6,-11],[9,-6],[8,-1],[19,2],[26,-3],[13,1],[7,-3],[5,-12],[5,-16],[24,-55],[7,-11],[8,-1],[21,3],[10,-16],[10,-55],[15,-8],[97,165],[19,70],[8,62],[-4,48],[-20,26],[-11,9],[-45,69],[-21,23],[1,4],[13,13],[6,15],[-1,17],[-7,21],[-4,18],[4,82],[-6,153],[8,1],[12,-11],[13,0],[13,7],[27,19],[59,55],[22,33],[36,74],[10,16],[24,34],[13,12],[13,8],[42,5],[4,-3],[-23,-85],[-2,-10],[3,-5],[12,-5],[11,-6],[12,-4],[14,3],[15,39],[8,9],[59,38],[12,0],[29,-23],[36,-20],[14,-14],[70,-27],[12,-2],[8,6],[7,12],[7,16],[4,17],[9,30]],[[2283,5172],[2,0],[2,19],[9,5],[22,-5],[-15,40],[-2,19],[7,17],[27,15],[5,7],[0,10],[-3,7],[-22,21],[-12,4],[-12,-3],[-13,-12],[-9,-12],[-3,-13],[-7,-33],[15,-69],[8,-17],[1,0]],[[3870,4941],[-3,3],[-4,12],[-4,4],[-8,-1],[-26,-8],[-9,-4],[-11,-12],[-11,-20],[-10,-24],[-5,-18],[1,-3],[5,-8],[-1,-6],[2,-6],[5,-7],[3,-8],[4,-19],[2,-7],[5,-8],[7,-8],[4,-3],[4,0],[6,-3],[8,-8],[6,-8],[12,-21],[8,-8],[14,-9],[13,-3],[7,14],[5,17],[9,2],[9,-2],[9,7],[0,13],[-10,32],[-2,16],[14,-6],[7,-1],[7,0],[-1,10],[2,10],[3,9],[2,12],[-1,17],[-4,15],[-16,49],[-14,2],[-17,-1],[-6,3],[-2,13],[-14,-17],[-4,-3]],[[2161,4847],[-8,-4],[-9,0],[-8,5],[-8,10],[-5,10],[0,4],[4,4],[6,9],[-3,2],[-1,1],[-2,3],[-11,3],[-9,4],[-9,1],[-7,-4],[-12,2],[-28,10],[-10,-1],[-5,-9],[-1,-14],[0,-16],[-1,-13],[-4,-9],[-12,-17],[-4,-11],[0,-11],[3,-21],[0,-11],[-1,-2],[-1,-1],[-2,-3],[3,-10],[5,-7],[6,-5],[7,-3],[2,5],[3,1],[13,0],[3,0],[7,2],[3,1],[3,-3],[5,-7],[2,-2],[14,0],[10,8],[16,22],[7,-13],[16,-17],[7,-11],[1,-7],[-1,-6],[0,-7],[4,-9],[5,-4],[5,-3],[13,-2],[-2,10],[-3,8],[-7,16],[9,6],[0,11],[-6,12],[-10,5],[-2,19],[1,26],[4,26],[5,17]],[[2193,4817],[12,3],[8,3],[8,4],[6,6],[5,9],[-10,7],[-13,19],[-8,6],[-29,-20],[-4,-6],[-1,-5],[1,-5],[4,-5],[10,-7],[5,-6],[6,-3]],[[6182,5212],[-15,-2],[-15,-10],[-15,-7],[-18,6],[-12,10],[-11,2],[-14,-21],[-21,-45],[-6,-23],[-4,-26],[2,-19],[10,-3],[14,4],[13,0],[6,-4],[10,-12],[5,-4],[9,1],[9,6],[10,4],[8,-3],[19,-21],[10,-4],[12,8],[5,17],[-4,16],[-7,15],[-4,17],[2,11],[8,18],[1,10],[0,10],[3,22],[0,8],[-10,19]],[[729,5055],[-8,217],[-2,67],[20,130],[83,301],[39,47],[15,29],[1,10],[-2,21],[0,10],[2,5],[6,8],[3,5],[5,37],[0,40],[-33,191],[-3,36],[5,31],[58,105],[26,65],[10,18],[12,13],[80,71],[11,6],[8,-4],[81,-92],[20,-16],[9,-10],[4,-13],[-3,-27],[1,-12],[7,-4],[5,7],[9,27],[9,9],[11,2],[8,-3],[7,1],[9,14],[4,16],[0,10],[3,11],[12,15],[36,35],[11,21],[5,30],[-4,13],[-19,19],[-7,11],[1,9],[44,167],[2,27],[-8,18],[-12,17],[-6,23],[2,19],[84,239],[2,17],[-1,17],[-14,35],[-5,18],[1,36],[-5,33],[0,17],[5,21],[7,21],[9,20],[11,17],[25,22],[15,7],[45,22],[20,29],[1,9],[1,15]],[[6238,5504],[-26,37],[-32,15],[-34,-5],[-31,-26],[-78,-101],[-12,-3],[-18,9],[-51,36],[-18,6],[-17,-5],[-32,-27],[-13,1],[-24,-7],[-15,-48],[-5,-59],[3,-38]],[[5855,6610],[5,-9],[16,-8],[79,-20],[2,-5],[2,-5],[4,-4],[6,-1],[3,3],[3,4],[5,3],[38,2],[18,6],[21,27],[18,7],[36,6],[35,-11],[12,0],[9,3],[24,14],[6,1],[12,-1],[6,1],[21,9],[15,-3],[11,-4],[10,-1],[14,9],[44,37],[61,24],[25,2],[5,1],[47,-15],[16,0],[13,-7],[17,-47],[11,-12],[15,-4],[28,-4],[16,-6],[9,-2],[10,5],[7,10],[6,7],[11,-4],[-9,-19],[-6,-35],[-5,-15],[-12,-12],[-28,-15],[-10,-14],[-5,-18],[-3,-14],[-4,-13],[-10,-15],[-24,-24],[-8,-14],[-7,-22],[-6,-35],[-5,-17],[-8,-15],[-13,-9],[-13,-5],[-9,-9],[1,-18],[13,-39],[18,-36],[37,-47],[10,-17],[8,-23],[8,-80],[13,-56],[18,-53],[18,-27],[64,-54],[15,-21],[12,-25],[9,-29],[5,-29],[13,-40],[19,-24],[24,-13],[30,-7],[25,-14],[13,-28],[19,-139],[10,-34],[14,-21],[18,-6],[6,-4],[6,-8],[6,-19],[5,-10],[6,-7],[14,-12],[6,-8],[15,-39],[4,-16],[2,-29],[3,-16],[8,-14],[35,-27],[51,-40],[13,-1],[16,8],[11,1],[9,-7],[51,-61],[60,-70],[85,-100],[46,-55],[27,-20],[53,-23],[59,-25],[59,-26],[58,-25],[59,-25],[59,-25],[59,-25],[59,-26],[58,-25],[59,-25],[59,-25],[59,-25],[59,-26],[58,-25],[59,-25],[59,-25],[59,-25],[56,-25],[56,-24],[56,-25],[56,-24],[56,-25],[56,-24],[56,-25],[56,-24],[56,-25],[56,-24],[56,-25],[56,-24],[56,-25],[56,-24],[56,-25],[56,-24],[42,-19],[39,-25],[59,0],[95,0],[104,0],[105,0],[87,0],[122,0],[95,0],[-32,-41],[-33,-41],[-32,-41],[-33,-40],[-32,-41],[-33,-41],[-32,-41],[-32,-41],[-33,-40],[-6,-8],[-26,-33],[-33,-41],[-32,-41],[-32,-41],[-33,-41],[-32,-41],[-33,-40],[-32,-41],[-33,-41],[-32,-41],[-32,-41],[-33,-41],[-32,-40],[-33,-41],[-32,-41],[-33,-41],[-32,-41],[-32,-41],[-33,-40],[-13,-17],[-30,-38],[-30,-38],[-14,-17],[-14,-18],[-28,-36],[-41,-54],[-41,-55],[-40,-54],[-41,-55],[-41,-54],[-41,-55],[-40,-54],[-41,-54],[-72,-103],[-71,-102],[-72,-102],[-63,-91],[-8,-11],[-72,-102],[-71,-102],[-72,-102],[-71,-102],[-38,-55],[-1,0],[-52,-74],[-20,-11],[-36,3],[-34,3],[-35,2],[-35,3],[-34,3],[-35,2],[-1,0],[-33,3],[-35,2],[-34,3],[-35,3],[-35,2],[-34,3],[-35,3],[-34,2],[-35,3],[-34,2],[-35,3],[-40,3],[-25,-8],[-58,-26],[-20,-6],[-66,-20],[-50,-15],[-75,-23],[-46,-28],[-75,-47],[-76,-47],[-76,-47],[-56,-60],[-50,-53],[-5,-9],[-5,-9],[-8,-30],[-12,-60],[-10,-29],[-20,-28],[-1,-1],[-25,-22],[-28,-14],[-47,-11],[-100,-22],[-103,-23],[-78,-17],[-51,-1],[-57,-1],[-22,-7],[-23,-15],[-38,-39],[-47,-38],[-12,-14],[-4,-17],[0,-26],[-3,-11],[-9,-10],[-9,-17],[-33,-24],[-30,7],[-29,21],[-32,13],[-28,-21],[-10,-3],[-9,3],[-18,9],[-10,1],[-54,-17],[-18,-1],[-33,-13],[-75,-5],[-68,-5],[-35,5],[-32,17],[-30,30],[-43,78],[-17,21],[-11,9],[-32,14],[-12,8],[-7,9],[-11,27],[-16,24],[-41,36],[-14,25],[-42,-36],[-56,-28],[-70,-35],[-86,-43],[-4,-5],[-4,-14],[-4,-4],[-52,-24],[-68,-31],[-2,0],[-2,0],[-2,2],[-6,1],[-1,-4],[1,-5],[-3,-5],[-31,-20],[-64,-41],[-58,-36],[-57,-36],[-13,-21],[-13,-46],[-19,-64],[-11,-27],[-13,-22],[-52,-62],[-44,-53],[-17,-27],[-15,-58],[-11,-23],[-21,-1],[-11,9],[-5,12],[-3,12],[-6,9],[-21,9],[-83,4],[6,16],[-3,9],[-9,0],[-4,-3],[-26,-19],[-25,-1],[-26,7],[-60,36]]],"transform":{"scale":[0.0014990868390839117,0.0011477346465646535],"translate":[32.98979984500011,3.403333435000093]}};
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
