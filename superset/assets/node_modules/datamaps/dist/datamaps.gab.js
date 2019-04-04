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
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = '__FRA__';
  Datamap.prototype.froTopo = '__FRO__';
  Datamap.prototype.fsmTopo = '__FSM__';
  Datamap.prototype.gabTopo = {"type":"Topology","objects":{"gab":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Estuaire"},"id":"GA.ES","arcs":[[[0]],[[1,2,3,4]]]},{"type":"Polygon","properties":{"name":"Ogooué-Ivindo"},"id":"GA.OI","arcs":[[5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Wouleu-Ntem"},"id":"GA.WN","arcs":[[-9,10,-2,11]]},{"type":"Polygon","properties":{"name":"Moyen-Ogooué"},"id":"GA.MO","arcs":[[-11,-8,12,13,-3]]},{"type":"Polygon","properties":{"name":"Ngounié"},"id":"GA.NG","arcs":[[14,15,16,17,-13]]},{"type":"Polygon","properties":{"name":"Nyanga"},"id":"GA.NY","arcs":[[18,19,-17]]},{"type":"MultiPolygon","properties":{"name":"Ogooué-Maritime"},"id":"GA.OM","arcs":[[[20]],[[-14,-18,-20,21,-4]]]},{"type":"Polygon","properties":{"name":"Haut-Ogooué"},"id":"GA.HO","arcs":[[22,23,-6]]},{"type":"Polygon","properties":{"name":"Ogooué-Lolo"},"id":"GA.OL","arcs":[[-24,24,-15,-7]]}]}},"arcs":[[[1186,7582],[-7,-4],[-5,5],[12,-1]],[[2963,7890],[-10,-227],[-26,-80],[-20,-32],[-25,-62],[-7,-31],[2,-23],[27,-33],[9,-15],[8,-15],[14,-46],[9,-15],[14,-3],[25,4],[898,288],[15,0],[8,-4],[16,-63],[6,-35],[-4,-111],[-4,-20],[-17,-44],[-8,-37],[-4,-11],[-4,-7],[-26,-19],[-8,-9],[-2,-4],[-3,-4],[-19,-65],[-6,-13],[-13,-19],[-8,-8],[-6,-10],[-3,-8],[-6,-18],[-2,-6],[-21,-32],[-7,-16],[-36,-118],[-5,-42],[-3,-13],[-3,-7],[-5,-7],[-6,-5],[-9,-7],[-4,-9],[-4,-16],[13,-53],[1,-19],[-1,-8],[-2,-8],[-9,-20],[-12,-14],[-7,-5],[-3,-4],[-11,-14],[-11,-9]],[[3638,6659],[-32,5],[-7,1],[-7,-2],[-52,-23],[-26,-4],[-11,0],[-69,-8],[-24,1],[-11,-4],[-4,-6],[-2,-15],[1,-22],[-4,-12],[-6,-10],[-6,-7],[-30,-25],[-4,-5],[-6,-10],[-2,-4],[-1,-5],[1,-13],[1,-7],[4,-11],[15,-30],[1,-13],[-8,-15],[-47,-22],[-15,-10],[-18,-21],[-35,-33],[-29,-15],[-20,-22],[0,-4],[7,-17],[6,-32],[2,-15],[-2,-7],[-6,-6],[-8,-3],[-14,-4],[-12,-6],[-4,-8],[-1,-9],[0,-8],[-8,-8],[-208,-151],[-21,-12],[-31,-12],[-124,-68],[-20,-16],[-58,-66],[-37,-30],[-209,-122],[-157,-60],[-30,-2],[-9,10],[-4,14],[-3,31],[-7,16],[-11,47],[-8,15],[-13,13],[-15,9],[-16,5],[-33,3],[-16,5],[-17,8],[-18,4],[-17,-3],[-17,-16],[-14,-16],[-22,-20],[-29,-20],[-53,-27],[-29,-3],[-20,5],[-35,28],[-16,3],[-29,-17],[-43,-20],[-17,-3],[-52,-2],[-17,-4],[-70,-25],[-67,-31],[-17,-5],[-14,-7],[-9,-13],[24,-205],[-10,-39]],[[1507,5366],[-79,89],[-55,35],[-58,26],[-16,3],[-33,3],[-22,13],[-26,23],[-89,111],[-15,31],[-38,134],[-24,21]],[[1052,5855],[-1,110],[13,33],[39,72],[8,32],[2,17],[8,35],[1,19],[-4,15],[-20,40],[2,20],[6,19],[9,18],[13,15],[9,15],[-3,14],[-8,12],[-4,13],[-2,34],[-61,302],[-20,52],[6,14],[9,43],[3,8],[8,5],[55,45],[18,5],[17,-11],[15,-32],[7,-39],[-4,-32],[-16,-60],[3,-18],[8,-18],[1,-13],[-18,-5],[-9,-7],[-3,-16],[1,-18],[5,-15],[15,13],[9,14],[11,12],[19,5],[57,0],[8,-6],[9,-20],[45,-41],[16,-31],[6,-61],[11,-9],[14,-8],[12,0],[6,17],[-10,69],[2,28],[18,29],[86,-22],[21,-11],[10,-17],[14,-56],[11,-15],[8,11],[49,45],[15,11],[26,-2],[16,-9],[17,-33],[86,13],[63,-59],[53,-77],[56,-42],[-63,107],[-25,30],[-5,27],[34,14],[45,-2],[27,-23],[21,12],[32,39],[18,17],[61,35],[22,7],[27,0],[51,-17],[28,-6],[25,2],[70,21],[0,12],[-87,-2],[-34,9],[-33,26],[-27,-16],[-32,-15],[-34,-10],[-133,-7],[-22,-8],[-78,25],[-22,13],[-26,22],[-14,8],[-54,-2],[-19,8],[-82,57],[-60,33],[-25,23],[-10,32],[-11,0],[-10,-19],[-10,-6],[-22,4],[-14,-4],[-38,-16],[-12,-2],[-14,18],[-10,57],[-19,12],[-24,23],[-83,176],[-22,30],[-47,50],[-33,14],[-30,-2],[-27,1],[-23,25],[-1,24],[7,88],[12,19],[37,4],[39,7],[19,8],[36,18],[17,7],[23,3],[15,-4],[15,-6],[24,-3],[14,3],[23,15],[32,12],[27,16],[31,12],[32,-3],[29,-26],[12,-37],[-6,-33],[-29,-15],[-75,15],[-36,-4],[-24,-32],[40,11],[50,-3],[41,-21],[10,-42],[21,6],[15,11],[9,17],[2,21],[21,-26],[3,-47],[-9,-45],[-15,-24],[17,-46],[13,-14],[30,-6],[-8,26],[1,32],[8,29],[15,12],[11,14],[18,69],[14,26],[-24,31],[-6,33],[6,78],[-17,190],[-61,150],[-5,38],[-8,26],[-14,16],[-10,19],[8,32],[22,34],[23,16],[25,5],[31,0],[30,8],[17,19],[12,22],[17,16],[31,5],[100,-2],[28,-8],[23,-35],[15,-68],[16,-34],[14,27],[6,20],[52,-6],[26,-9],[29,-18],[45,-48],[28,-20],[30,-12],[31,-5],[28,6],[20,18],[6,21],[0,48],[9,23],[34,4],[50,6],[188,-1],[477,-1]],[[8946,6142],[-128,41],[-84,57],[-38,21],[-34,13],[-345,69],[-26,2],[-66,-3],[-324,12]],[[7901,6354],[-34,0],[-15,3],[-18,7],[-17,10],[-19,6],[-45,-1],[-21,3],[-20,7],[-17,11],[-66,30],[-11,12],[-8,14],[-32,97],[-3,32],[-8,13],[-28,18],[-24,23],[-15,5],[-51,-7],[-15,0],[-14,3],[-10,3],[-15,6],[-33,18],[-27,20],[-14,4],[-50,-42],[-20,-10],[-24,-4],[-20,3],[-53,14],[-42,6],[-32,-2],[-20,5],[-16,12],[-9,14],[-13,15],[-14,11],[-15,13],[-17,9],[-23,4],[-112,-51],[-17,-3],[-17,2],[-16,9],[-15,13],[-13,14],[-11,8],[-10,-5],[-260,-1080],[-271,-127],[-1271,-434]],[[4940,5085],[-52,101],[-6,16],[-27,129],[-26,51],[-21,29],[-15,15],[-64,50],[-14,15],[-10,17],[-27,82],[-4,25],[2,40],[-2,25],[-5,22],[-9,16],[-89,124],[-9,16],[-6,15],[-3,16],[1,38],[5,46],[-7,72],[-14,54],[-6,12],[-11,10],[-16,5],[-16,2],[-15,4],[-9,8],[-6,8],[-6,13],[0,14],[4,16],[29,50],[15,50],[14,16],[44,29],[25,22],[242,117],[30,5],[19,7],[24,19],[21,13],[33,25],[10,17],[6,22],[-3,22],[9,52]],[[4975,6657],[-175,171],[-9,14],[2,10],[14,12],[1239,780],[13,12],[7,14],[9,45],[-1,5],[-2,4],[-3,5],[-1,6],[1,8],[5,17],[0,10],[-5,58],[1,33],[7,25],[1,2],[1,2],[49,59],[14,21],[19,38],[3,8],[3,8],[5,9],[27,28],[5,6],[32,60],[22,20],[6,8],[2,5],[2,21],[2,6],[2,6],[4,6],[20,22],[3,5],[2,6],[3,16],[1,13],[1430,-19]],[[7735,8242],[18,-2],[35,5],[59,-4],[36,6],[32,13],[32,36],[31,5],[29,7],[11,28],[14,12],[34,9],[37,4],[27,-3],[60,-19],[53,-10],[52,0],[58,10],[22,15],[39,49],[62,22],[22,18],[25,14],[34,3],[16,0],[16,1],[32,5],[11,5],[21,15],[11,4],[9,-2],[20,-8],[5,-2],[19,6],[6,4],[21,38],[16,41],[1,8],[25,5],[325,-28],[30,-6],[31,-17],[26,-23],[27,-18],[36,-2],[62,22],[31,7],[34,-3],[68,-17],[15,-10],[11,-10],[13,-9],[21,-4],[2,-8],[3,-9],[15,-9],[19,-8],[19,-13],[10,-18],[26,-100],[4,-41],[-1,-121],[14,-41],[27,-33],[82,-35],[24,-33],[27,-82],[19,-37],[24,-35],[29,-32],[32,-27],[42,-19],[13,-13],[-3,-22],[-16,-15],[-21,-11],[-13,-13],[6,-20],[12,-74],[-59,-66],[-80,-63],[-50,-67],[-5,-82],[-11,-34],[-128,-102],[-6,-9],[-10,-6],[-23,-8],[-87,-5],[-97,10],[-85,-10],[-52,-68],[19,-33],[11,-33],[-7,-33],[-32,-34],[-127,-65],[-37,-36],[-61,-127],[-59,-81],[-8,-38],[9,-40],[17,-50],[8,-39],[7,-115],[11,-11],[21,-1],[20,-3],[14,-20],[-3,-16],[-24,-30],[-8,-16],[4,-23],[9,-18],[1,-17],[-18,-20],[-17,-16],[-22,-26]],[[4975,6657],[-1337,2]],[[2963,7890],[39,0],[516,-2],[390,-1],[126,0],[516,-2],[-3,419],[-2,418],[-3,335],[0,84],[-3,418],[0,128],[-14,62],[11,16],[7,19],[3,20],[0,20],[3,26],[11,18],[13,17],[11,22],[-3,22],[-8,20],[3,15],[460,16],[45,14],[22,5],[24,-2],[17,-9],[35,-27],[88,-27],[27,-3],[58,8],[151,-5],[132,11],[131,-7],[101,7],[31,-1],[70,-11],[75,-3],[34,6],[66,21],[34,5],[18,4],[36,18],[16,2],[22,-8],[56,-32],[31,-5],[95,20],[67,-5],[96,-29],[30,-8],[40,8],[27,-19],[41,-14],[233,-32],[35,6],[24,14],[20,15],[22,9],[29,-8],[40,-16],[34,-7],[14,20],[25,-10],[21,-1],[20,6],[18,16],[52,-18],[29,-4],[19,5],[24,10],[28,-6],[48,-19],[73,8],[17,7],[34,31],[20,13],[15,5],[53,-2],[48,-9],[24,-17],[11,-4],[16,-1],[25,10],[12,3],[19,-8],[27,-18],[26,-21],[16,-19],[7,-23],[-7,-48],[1,-40],[0,-96],[-6,-51],[-17,-38],[-62,-32],[-10,-7],[-31,-32],[-9,-6],[-16,-5],[-1,-14],[10,-30],[-3,-16],[-9,-11],[-12,-10],[-11,-13],[-12,-18],[-12,-25],[-20,-6],[-7,-7],[22,-28],[14,-29],[9,-12],[7,-19],[-3,-26],[-17,-58],[-14,-24],[-17,-22],[-22,-11],[13,-28],[-5,-28],[-12,-30],[-7,-33],[11,-73],[-6,-39],[-29,-31],[28,-47],[32,-40],[11,11],[20,-14],[12,-18],[2,-22],[-10,-23],[35,-17],[31,-77],[28,-16],[-2,-13],[2,-76],[-1,-13],[1,-12],[6,-11],[14,-19],[-4,-9],[-10,-5],[-16,-32],[-25,-16],[-29,-9],[-24,-3],[-14,-11],[-6,-22],[-13,-20],[-33,-3],[18,-14],[20,-8],[17,-10],[5,-22]],[[4940,5085],[-150,6],[-56,8],[-102,33],[-100,44],[-264,189],[-23,5],[-21,-1],[-69,-14],[-309,-17],[-35,-8],[-18,-7],[-15,-11],[-23,-26],[-14,-8],[-16,4],[-37,24],[-17,0],[-16,-9],[-21,-27],[-16,-12],[-23,-6],[-19,4],[-15,12],[-9,14],[-15,16],[-18,7],[-25,3],[-19,-2],[-17,-7],[-13,-10],[-19,-8],[-41,9],[-10,-8],[2,-12],[21,-31],[5,-14],[-5,-14],[-12,-10],[-15,-11],[-14,-14],[-49,-69],[-17,-16],[-19,-16],[-88,-49],[-16,-13],[-11,-15],[-15,-50],[-6,-31],[-1,-16],[5,-31],[-5,-15],[-69,-111],[-8,-8],[-14,-8],[-64,-28],[-8,-6],[-3,-5],[0,-8],[7,-12],[9,-12],[4,-15],[-3,-15],[-9,-16],[-23,-30],[-15,-14],[-9,-14],[-4,-15],[-1,-16],[-4,-14],[-9,-12],[-18,-7],[-8,-13],[-4,-14],[-6,-15],[-13,-13],[-19,17],[-20,10],[-102,2],[-40,8],[-28,2],[-43,-2],[-26,-7],[-23,-9],[-52,-30],[-148,-142]],[[2362,4283],[-28,13],[-80,12],[-10,3],[-14,5],[-16,9],[-106,91],[-15,17],[-2,15],[4,15],[45,78],[12,32],[3,17],[0,17],[-3,16],[-28,63],[-2,8],[1,11],[12,29],[1,15],[-7,19],[-13,21],[-60,45],[-22,10],[-17,4],[-33,-2],[-65,4],[-15,2],[-10,1],[-47,-4],[-17,1],[-16,5],[-14,12],[-10,17],[-18,17],[-7,3],[-16,12],[-22,13],[-37,15],[-70,88],[-113,334]],[[4940,5085],[-33,-47],[-46,-49],[-14,-21],[-8,-19],[-11,-92],[1,-16],[7,-27],[4,-39],[4,-17],[7,-16],[9,-15],[34,-33],[4,-5],[5,-9],[11,-31],[4,-21],[4,-32],[-3,-27],[-7,-30],[5,-28],[12,-14],[17,-6],[34,-8],[18,-1],[17,5],[34,14],[51,11],[119,69],[18,6],[16,4],[17,-2],[5,-5],[1,-8],[-3,-14],[-2,-26],[5,-34],[16,-48],[9,-17],[62,-79],[27,-27],[84,-55],[62,-56],[15,-9],[66,-27],[15,-8],[35,-33],[61,-70],[10,-17],[2,-9],[0,-31],[4,-18],[24,-75],[6,-59],[-4,-39],[-4,-13],[-2,-4],[-8,-14],[-10,-12],[-13,-10],[-5,-6],[-4,-7],[-3,-9],[0,-15],[5,-19],[16,-36],[18,-14],[18,-9],[16,-6],[16,-11],[115,-144],[22,-23],[107,-83],[17,-9],[212,-68],[17,-1],[121,10],[18,0],[15,-4],[13,-5],[8,-24],[-6,-34]],[[6469,3255],[-21,20],[-19,4],[-7,-21],[15,-173],[15,-64],[35,-51],[67,-29],[-7,-27],[-31,-45],[-12,-25],[-4,-23],[13,-66],[-12,-46],[-23,-55],[-13,-52],[20,-35],[-684,-136],[-54,6],[-52,33],[-59,67],[-31,22],[-18,9],[-54,-24],[-72,-22],[-63,-11],[-38,-15],[-58,-50],[-29,-15],[-28,2],[-32,15],[-58,43],[-13,14],[-7,13],[-11,13],[-23,11],[-88,24],[-63,2],[-4,-1],[-14,-31],[37,-93],[7,-35],[-13,-89],[1,-28],[13,-33],[44,-65],[16,-36],[9,-41],[0,-33],[-8,-33],[-16,-40],[-126,-190],[-3,-12]],[[4893,1808],[0,1],[-121,144],[-138,131],[-136,102],[-99,105],[-33,27],[-9,14],[-32,111],[-8,16],[-14,14],[-143,81],[-14,13],[-9,15],[-5,15],[-4,17],[-5,15],[-9,16],[-13,15],[-17,13],[-20,9],[-25,7],[-745,-90]],[[3294,2599],[-70,102],[-25,27],[-8,4],[-7,6],[-6,7],[-47,63],[-11,23],[-32,110],[-3,8],[-6,6],[-32,21],[-15,16],[-9,17],[-6,23],[0,18],[3,17],[21,52],[3,16],[-5,16],[-18,11],[-35,11],[-36,28],[-72,36],[-16,1],[-17,-9],[-15,-11],[-17,-8],[-18,-3],[-18,0],[-122,28],[-34,0],[-18,8],[-19,16],[-18,9],[-40,25],[-54,13],[-55,28],[-86,26],[-35,5],[-57,1],[-15,2],[-16,6],[-16,11],[-16,15],[-57,64],[-10,16],[-21,50],[-10,16],[-23,31],[-25,24],[-2,13],[16,16],[14,11],[10,14],[1,16],[4,17],[17,19],[17,10],[17,4],[17,1],[16,2],[15,7],[14,21],[15,33],[11,50],[2,28],[-1,22],[-19,83],[-4,31],[1,31],[6,17],[10,19],[121,107],[25,46],[9,64]],[[4893,1808],[-17,-61],[9,-38],[29,5],[70,45],[49,14],[35,-10],[28,-29],[59,-81],[131,-129],[26,-36],[0,-35],[-43,-24],[-40,-4],[-23,2],[-18,-10],[-23,-40],[-9,-28],[-1,-110],[-3,-10],[3,-6],[15,-13],[13,-10],[98,-37],[36,-21],[70,-53],[62,-27],[82,-21],[67,-29],[18,-51],[-23,-35],[-75,-51],[-23,-39],[-98,-215],[-5,-37],[17,-33],[36,-20],[40,-12],[33,-17],[13,-33],[-14,-36],[-30,-34],[-38,-26],[-30,-11],[-4,-1],[-32,1],[-99,26],[-35,4],[-94,-12],[-37,12],[-29,29],[-137,205],[-64,45],[-86,12],[-48,-30],[-32,-49],[-38,-46],[-66,-20],[-71,-14],[-55,-31],[-52,-39],[-59,-36],[-44,-35],[-29,-51],[-114,-286],[-27,-46],[-34,20],[-42,25],[-84,81],[-27,104],[-16,28],[-11,29],[-7,31],[-2,37],[-36,37],[-58,39],[-211,166],[-278,178],[-14,72],[2,24],[10,28],[7,36],[-7,31],[-17,30],[-25,18],[-38,21],[-49,36],[-30,12],[-6,32],[-65,66],[-23,25],[-32,32],[-47,46],[-182,142],[-220,158],[-88,67],[-223,150],[-103,82],[-29,20]],[[2182,1903],[64,16],[2,1],[510,138],[34,0],[17,6],[16,24],[7,19],[14,67],[6,17],[13,17],[17,17],[31,18],[22,7],[19,5],[11,7],[1,12],[-3,12],[-24,35],[-5,16],[4,17],[11,19],[21,26],[19,40],[58,47],[247,113]],[[561,5082],[-25,-11],[-24,2],[-27,17],[-15,21],[0,20],[5,21],[0,25],[-8,14],[-24,23],[-6,18],[0,18],[4,12],[20,24],[19,17],[38,22],[15,17],[9,-16],[0,-13],[-7,-10],[-15,-5],[0,-12],[62,-12],[14,-55],[-6,-68],[1,-50],[-30,-19]],[[2182,1903],[-103,72],[-305,350],[-37,61],[31,-22],[49,-48],[37,-18],[40,-4],[24,14],[21,25],[33,31],[-4,-22],[-9,-18],[-4,-17],[5,-20],[9,3],[7,4],[5,7],[4,8],[-1,-29],[6,-30],[14,-17],[27,10],[61,-20],[10,-7],[4,-1],[25,-36],[7,-35],[11,0],[4,16],[6,7],[10,-1],[16,-10],[2,6],[0,3],[2,1],[8,1],[5,-58],[6,-19],[12,12],[14,7],[16,4],[17,-1],[-6,-23],[7,-5],[15,6],[19,12],[14,12],[13,30],[10,12],[25,9],[37,5],[36,1],[19,-4],[46,4],[15,8],[10,20],[-33,18],[-13,5],[3,29],[-33,16],[-42,15],[-23,27],[-12,0],[12,-28],[23,-82],[-24,3],[-13,12],[-9,13],[-7,5],[-14,7],[-19,30],[-14,7],[-13,2],[-21,7],[-13,2],[-7,-4],[1,-9],[2,-11],[-2,-8],[-11,-12],[-11,-15],[-9,-16],[-5,-13],[-24,10],[-22,13],[7,16],[-10,33],[3,16],[16,8],[20,-1],[17,1],[6,14],[-20,16],[-45,13],[-47,8],[-30,-3],[-39,73],[-3,13],[-18,11],[-8,0],[-4,-16],[-6,-1],[-25,-13],[-3,-2],[-44,8],[-41,-28],[-39,-35],[-41,-10],[-16,8],[-16,15],[-11,18],[-5,19],[4,5],[20,17],[6,4],[10,5],[-14,10],[-19,8],[-7,0],[-3,13],[3,13],[0,10],[-11,7],[-14,2],[-12,-1],[-7,-5],[-3,-11],[22,-38],[5,-24],[-15,-20],[-28,11],[-72,80],[-30,18],[16,-23],[38,-42],[16,-23],[-39,24],[-46,41],[-39,47],[-18,42],[0,8],[-13,37],[-10,145],[-13,23],[-171,156],[-46,25],[-52,57],[-25,18],[5,7],[7,16],[-37,9],[-21,28],[-24,61],[-72,65],[-12,17],[-8,2],[-16,14],[-15,15],[-2,7],[-18,8],[4,16],[13,10],[7,-6],[13,-29],[31,-23],[40,-12],[35,4],[-4,-7],[-2,-1],[-3,0],[-4,-4],[22,-9],[13,9],[13,34],[10,0],[13,-34],[-10,-3],[-7,-5],[-5,-7],[-1,-11],[6,-10],[11,7],[9,12],[-3,7],[89,0],[48,-11],[24,-27],[-5,-32],[-38,-29],[21,-21],[11,-9],[10,-3],[37,-3],[10,-2],[4,-10],[0,-28],[2,-12],[36,-21],[1,-8],[8,-19],[9,-13],[5,12],[6,8],[24,9],[5,5],[-4,28],[-12,32],[-14,23],[-17,-1],[-18,20],[-43,27],[-9,19],[20,28],[16,10],[-2,11],[-56,89],[-32,31],[-18,-16],[-26,14],[-9,8],[-6,-15],[0,-15],[6,-35],[-32,24],[-44,74],[-30,12],[-13,-11],[-8,-19],[-5,-18],[-4,-8],[-16,-5],[-10,-13],[-4,-17],[1,-19],[-12,11],[-14,8],[-15,3],[-19,0],[20,32],[-4,18],[-39,27],[-38,-23],[-25,8],[-15,32],[-5,47],[2,19],[7,28],[2,13],[0,66],[-3,18],[-15,35],[-5,19],[2,49],[-2,16],[-29,66],[-40,51],[-95,91],[-216,280],[-16,28],[-18,39],[-15,35],[-8,34],[23,-43],[18,-48],[21,-27],[33,-35],[27,3],[27,-11],[21,-19],[18,-51],[40,-39],[10,-31],[10,-16],[55,-62],[23,-14],[10,-11],[83,-61],[15,-8],[51,-14],[16,-198],[10,-25],[21,9],[5,16],[-16,22],[5,12],[15,6],[13,-6],[9,-14],[4,-14],[26,28],[40,21],[46,14],[42,3],[-10,-25],[-2,-27],[10,-23],[25,-13],[13,54],[-1,26],[-12,19],[54,7],[143,-18],[52,11],[-71,25],[-28,19],[-20,32],[-16,60],[-2,35],[7,26],[-14,4],[-34,18],[-7,1],[-22,-1],[-13,-4],[0,-10],[7,-24],[-3,-17],[-6,-8],[-7,-5],[-43,-53],[-39,-27],[-47,-13],[-56,-4],[-12,-2],[-11,-3],[-11,-1],[-13,6],[-10,12],[-2,26],[-12,23],[-1,15],[1,29],[-7,8],[-16,4],[-16,2],[-9,2],[-3,25],[14,17],[25,10],[30,3],[14,9],[3,22],[-7,23],[-16,12],[0,10],[16,4],[41,4],[14,4],[13,16],[8,30],[27,47],[-5,27],[-32,56],[10,9],[1,8],[-6,7],[-16,8],[-1,-31],[12,-84],[-4,-17],[-13,-16],[-17,-12],[-19,-4],[-15,5],[-15,22],[-11,5],[-28,-8],[-17,-23],[-14,-23],[-18,-11],[-82,-14],[-29,3],[-19,21],[-6,34],[3,31],[5,13],[-4,2],[-12,11],[-6,10],[-8,-3],[-10,-6],[-17,-7],[-3,-6],[-8,-4],[-22,3],[-25,13],[-61,43],[-26,9],[-21,11],[-15,26],[-4,33],[12,29],[-6,6],[-3,4],[-4,11],[34,22],[-9,37],[-29,38],[-32,24],[21,-49],[-10,-43],[-6,-14],[-11,1],[-5,18],[-13,97],[-29,71],[-171,203],[45,-39],[25,-11],[25,8],[-24,9],[10,22],[14,18],[14,12],[9,3],[-20,8],[-51,-32],[-30,7],[-11,26],[-11,39],[-13,28],[-17,-11],[-13,0],[-15,57],[-9,20],[-26,41],[-45,95],[-37,59],[-23,84],[-53,63],[-40,118],[23,33],[13,-11],[-15,-31],[19,-14],[55,-10],[-7,-14],[-2,-10],[3,-8],[6,-11],[37,1],[26,-39],[15,-54],[7,-67],[10,-23],[17,-19],[24,-8],[13,-11],[4,-23],[8,-22],[28,-8],[-15,27],[2,27],[8,28],[5,32],[10,23],[23,1],[30,-6],[30,-1],[0,11],[-17,7],[-17,13],[-12,16],[0,19],[13,11],[17,-2],[41,-18],[17,-22],[13,-28],[5,-24],[14,-32],[62,-54],[20,-28],[0,-32],[-12,-57],[12,-22],[11,0],[8,30],[4,97],[9,30],[42,42],[9,26],[-2,22],[-2,9],[2,6],[13,12],[10,6],[28,9],[10,6],[4,17],[-3,17],[2,14],[20,8],[24,-43],[-4,37],[-20,26],[-14,26],[14,42],[102,84],[31,58],[154,157],[43,62],[25,66],[-1,97]],[[8946,6142],[-78,-96],[-18,-40],[-2,-45],[80,-88],[10,-7],[11,2],[23,7],[8,8],[4,11],[7,11],[13,4],[62,-7],[16,-6],[14,-10],[13,-16],[63,15],[69,-10],[63,-28],[45,-41],[29,-54],[21,-64],[12,-66],[3,-60],[29,14],[29,9],[29,1],[32,-12],[28,-6],[26,8],[27,12],[30,4],[48,-13],[65,-27],[58,-34],[38,-47],[69,-44],[21,-21],[41,-77],[15,-48],[-12,-52],[-70,-140],[-9,-39],[0,-40],[12,-40],[7,-49],[-20,-34],[-30,-31],[-27,-39],[-9,-37],[-8,-69],[-18,-34],[-1,-23],[49,-125],[19,-35],[6,-18],[-2,-14],[-9,-28],[0,-13],[12,-20],[7,-6],[30,-27],[13,-21],[3,-14],[-2,-50],[-7,-36],[-6,-15],[-10,-17],[-12,-13],[-14,-10],[-12,-12],[-5,-17],[10,-31],[25,-24],[61,-37],[10,-33],[-13,-19],[-22,-13],[-20,-18],[-6,-15],[-3,-38],[-21,-46],[22,-21],[20,-29],[0,-24],[-56,-10],[-11,-14],[-7,-18],[-12,-16],[-16,-12],[-16,-7],[-36,-12],[-15,-12],[11,-12],[34,-17],[21,-65],[29,-9],[36,-5],[13,-11],[-40,-23],[-21,-21],[-11,-35],[-5,-127],[-11,-41],[-1,-13],[13,-70],[-12,-22],[-46,-23],[-4,-2],[-200,-72],[-13,-12],[-8,-12],[-4,-14],[1,-18],[-10,-15],[2,-10],[8,-8],[15,-10],[8,-13],[-2,-16],[-11,-32],[-10,-84],[-8,-23],[-12,-11],[-29,-9],[-10,-8],[-2,-16],[11,-28],[0,-12],[-23,-23],[-59,-20],[-24,-17],[6,-55],[130,-102],[13,-51],[-7,4],[-83,-17],[-17,-8],[-15,-9],[-33,-26],[-14,-14],[-8,-16],[0,-42],[-12,-14],[-16,-12],[-15,-14],[-10,-29],[-8,-20],[-11,-12],[-15,-3],[-17,7],[-27,14],[-17,2],[-11,-2],[-79,-23],[-13,0],[-12,9],[-5,30],[-16,10],[-16,0],[-17,-7],[-30,-16],[-36,-7],[-42,2],[-39,12],[-28,23],[2,8],[1,61],[13,14],[35,17],[25,48],[20,12],[8,10],[-24,30],[-18,12],[-18,8],[-13,12],[-6,44],[-12,16],[-31,29],[-21,30],[-39,74],[-16,66],[-15,34],[-21,30],[-24,21],[-18,12],[-5,2],[-4,-9],[-36,-49],[-18,-32],[-5,-18],[-3,-31],[-6,-17],[-14,-18],[-131,-118],[-11,-16],[-5,-34],[-8,-14],[-17,-11],[-41,-12],[-21,-10],[-17,-14],[-25,-29],[-15,-14],[-56,-35],[-17,-16],[-9,-15],[-5,-15],[-8,-13],[-18,-10],[-9,3],[-14,20],[-11,2],[-25,-7],[-9,1],[-37,5],[-33,-7],[-31,3],[-300,103],[-17,4],[-20,-3],[-33,-18],[-19,-3],[-36,8],[-111,47],[-43,7],[-22,-6],[-31,-29],[-20,-19],[-23,-1],[-5,10],[9,15],[19,15],[8,11],[7,13],[5,14],[1,14],[4,16],[9,13],[15,14],[-5,18],[-8,2],[-10,0],[-13,12],[-4,13],[-9,43],[-16,18],[-32,49],[-15,14],[-42,-20],[-25,-1],[-7,28],[-1,17],[-7,11],[-23,21],[-4,10],[3,10],[8,12],[3,8],[7,10],[1,10],[-33,7],[-4,9],[2,9],[0,8],[3,0],[-7,37],[-7,9],[-27,25],[-10,12],[-16,33],[-37,116],[-20,39],[-29,19],[-73,22],[-8,5]],[[6970,3269],[3,11],[24,58],[12,44],[25,49],[-1,15],[-6,32],[4,16],[127,244],[30,35],[10,14],[6,15],[14,17],[11,19],[7,19],[4,46],[5,15],[16,22],[15,16],[17,10],[15,13],[12,17],[9,28],[18,14],[51,25],[13,2],[9,0],[14,-2],[14,0],[17,5],[17,10],[17,13],[15,16],[24,30],[14,13],[17,9],[30,11],[10,11],[29,47],[18,15],[18,10],[17,5],[13,19],[7,32],[1,66],[-6,60],[-17,60],[0,11],[14,11],[126,-56],[30,-24],[14,4],[10,9],[279,315],[215,295],[2,26],[-11,38],[-429,782],[-17,14],[-17,7],[-17,3],[-16,6],[-14,11],[-9,20],[-4,18],[-3,34],[-16,65],[-9,13],[-11,11],[-6,11],[11,19],[42,55],[44,79],[4,82]],[[6970,3269],[-114,76],[-73,28],[-85,-2],[-18,-6],[-85,-53],[-10,-9],[-9,-10],[-10,-20],[-3,-14],[-2,-18],[-7,-16],[-22,-11],[-31,9],[-32,32]]],"transform":{"scale":[0.0005804003665366528,0.0006259977203623492],"translate":[8.695567254000139,-3.936856189903011]}};
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
