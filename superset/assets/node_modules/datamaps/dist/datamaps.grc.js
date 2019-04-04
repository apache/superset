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
  Datamap.prototype.grcTopo = {"type":"Topology","objects":{"grc":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Ionioi Nisoi"},"id":"GR.II","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]]]},{"type":"MultiPolygon","properties":{"name":"Attiki"},"id":"GR.AT","arcs":[[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21,22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28,29,30,31]]]},{"type":"MultiPolygon","properties":{"name":"Peloponnisos"},"id":"GR.PP","arcs":[[[32]],[[33]],[[34]],[[35]],[[-29,36,-22,37,38,39]]]},{"type":"MultiPolygon","properties":{"name":"Dytiki Ellada"},"id":"GR.GW","arcs":[[[-39,40]],[[41,42,43]]]},{"type":"Polygon","properties":{"name":"Dytiki Makedonia"},"id":"GR.MW","arcs":[[44,45,46,47]]},{"type":"MultiPolygon","properties":{"name":"Thessalia"},"id":"GR.TS","arcs":[[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55,56,57,-46,58]]]},{"type":"Polygon","properties":{"name":"Ipeiros"},"id":"GR.EP","arcs":[[-58,-43,59,-47]]},{"type":"MultiPolygon","properties":{"name":"Voreio Aigaio"},"id":"GR.AN","arcs":[[[60]],[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]]]},{"type":"MultiPolygon","properties":{"name":"Stereá Elláda"},"id":"GR.GC","arcs":[[[70]],[[71]],[[72]],[[73]],[[74,-31,75,-44,-57]]]},{"type":"MultiPolygon","properties":{"name":"Kriti"},"id":"GR.CR","arcs":[[[76]],[[77]],[[78]],[[79]],[[80]]]},{"type":"MultiPolygon","properties":{"name":"Kentriki Makedonia"},"id":"GR.MC","arcs":[[[81]],[[82,83,84,85,-59,-45,86]]]},{"type":"Polygon","properties":{"name":"Ayion Oros"},"id":"GR.MA","arcs":[[-85,87]]},{"type":"MultiPolygon","properties":{"name":"Anatoliki Makedonia kai Thraki"},"id":"GR.MT","arcs":[[[88]],[[89]],[[-83,90]]]},{"type":"MultiPolygon","properties":{"name":"Notio Aigaio"},"id":"GR.AS","arcs":[[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[120]],[[121]],[[122]],[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]]]}]}},"arcs":[[[1549,4383],[28,-17],[36,9],[46,-19],[41,-32],[17,-31],[19,-40],[78,-51],[11,-44],[-15,19],[-33,17],[-38,11],[-30,3],[-17,-8],[-10,-13],[-8,-12],[-7,-6],[-15,-7],[0,-17],[7,-17],[4,-8],[-2,-19],[-5,-9],[-13,-3],[-23,0],[-8,7],[-35,44],[-56,46],[-26,29],[-2,23],[-25,22],[-43,60],[-26,16],[8,17],[-5,24],[6,10],[-9,9],[46,67],[29,27],[26,-6],[1,-4],[0,-4],[5,-6],[-1,-3],[24,-45],[8,-29],[12,-10]],[[1345,5275],[61,-176],[2,-12],[-1,-22],[-7,-11],[-11,-10],[-13,-16],[9,-13],[27,-51],[14,-7],[16,13],[15,19],[12,10],[-2,-5],[-3,-10],[-2,-6],[21,-5],[7,-14],[2,-20],[8,-20],[48,-43],[12,-38],[40,-57],[9,-22],[3,-24],[-4,-24],[-11,-24],[-6,-1],[-29,7],[-11,-2],[-12,-7],[-11,-2],[-17,5],[-15,14],[-27,32],[-32,19],[-43,13],[-39,-7],[-17,-36],[-21,17],[-42,13],[-15,19],[-4,13],[-2,27],[-2,10],[-18,33],[-5,16],[14,-4],[19,-19],[13,-7],[0,11],[-18,17],[-11,22],[-30,78],[-13,22],[-12,4],[-8,-25],[0,-23],[9,-48],[-1,-28],[-11,-25],[-15,-11],[-15,-7],[-14,-16],[-7,0],[-7,25],[-32,18],[-7,26],[4,12],[9,15],[7,14],[-2,13],[-4,12],[2,11],[7,8],[7,4],[16,18],[14,38],[6,47],[2,45],[7,-21],[1,-9],[8,0],[15,29],[9,-11],[9,-26],[14,-21],[9,12],[4,-9],[4,-15],[10,-8],[11,5],[20,21],[26,14],[10,24],[1,29],[-10,26],[23,-10],[-13,48],[-2,11],[2,19],[4,16],[1,13],[-7,12],[0,9],[38,0]],[[1461,5291],[-7,-21],[-8,-14],[20,2],[12,-6],[10,-8],[12,-8],[-7,-30],[-8,-25],[-23,-45],[8,-5],[11,-4],[13,-1],[14,2],[0,8],[-15,11],[22,0],[-7,10],[14,-4],[12,-7],[21,-18],[-5,0],[-18,0],[7,-40],[8,-14],[15,-6],[0,-10],[-31,-5],[-19,-6],[-15,4],[-21,26],[9,10],[-17,19],[-15,22],[-22,49],[-2,11],[-3,32],[-3,16],[-9,8],[-13,9],[-7,12],[5,21],[18,-12],[10,8],[12,33],[19,-6],[3,-18]],[[1724,5383],[-15,0],[0,11],[43,67],[10,2],[-24,-36],[-12,-24],[-2,-20]],[[1692,5434],[-9,-2],[-4,14],[3,16],[21,37],[17,20],[20,7],[27,7],[7,-5],[1,-15],[-12,-17],[-14,-11],[-17,-10],[-9,-4],[-9,-5],[-13,-14],[-9,-18]],[[1590,5559],[5,-3],[5,2],[3,-2],[-1,-4],[2,-1],[5,1],[0,-6],[-4,-7],[-6,-8],[-9,-10],[-29,-8],[-4,-17],[16,-12],[9,-10],[2,-4],[8,-6],[11,-14],[-15,7],[-40,37],[-16,38],[10,16],[18,4],[24,13],[6,-6]],[[1489,5576],[8,-3],[5,11],[6,16],[7,12],[2,-22],[-4,-78],[-5,-16],[-7,-2],[-8,18],[-8,0],[2,-6],[6,-23],[-5,3],[-12,7],[0,-11],[-2,-6],[-3,-5],[-2,-8],[-19,10],[-18,-4],[-9,-11],[8,-15],[0,-9],[-12,1],[-7,5],[-2,10],[5,13],[-22,4],[-13,29],[-19,-13],[-11,-15],[-12,-20],[-16,-35],[-7,0],[0,36],[20,139],[21,48],[5,29],[19,54],[11,6],[9,14],[15,30],[13,17],[21,18],[26,13],[2,-5],[2,-7],[14,-6],[17,-21],[5,-22],[1,-21],[7,-16],[-6,-17],[1,-14],[3,-12],[2,-11],[1,-12],[-1,-8],[-5,-8],[-26,-39],[-5,-12],[2,-10]],[[968,6248],[9,-12],[15,-11],[-13,-5],[-5,2],[-4,4],[-6,5],[-7,6],[-9,-1],[-5,11],[3,7],[12,5],[3,-4],[5,-5],[2,-2]],[[915,6326],[13,-33],[-23,0],[-15,4],[-11,9],[-23,29],[-11,20],[-3,19],[17,8],[17,-19],[20,-16],[19,-21]],[[179,7129],[-7,-5],[-9,4],[-5,10],[-4,7],[-7,9],[4,10],[20,-20],[8,-15]],[[620,7176],[6,-14],[8,0],[0,11],[7,0],[-2,-45],[-14,-26],[-23,-15],[-69,-29],[-12,-9],[-6,-17],[4,-18],[9,-14],[13,-6],[0,-11],[-16,0],[0,-8],[67,-34],[26,-6],[-4,-31],[-7,-7],[-20,8],[14,-30],[23,-151],[4,-9],[13,-8],[16,-6],[31,-7],[15,-6],[24,-18],[10,-3],[20,1],[17,6],[10,7],[9,-2],[11,-20],[5,-16],[10,-44],[14,-20],[0,-11],[-14,-9],[-10,9],[-28,8],[-26,19],[-18,8],[-20,5],[-18,1],[-10,6],[-29,26],[-11,7],[-19,2],[-16,0],[-13,4],[-5,7],[8,-2],[8,6],[6,13],[-39,13],[-15,7],[0,-4],[-1,-5],[0,-2],[-15,22],[-12,30],[-8,29],[-8,61],[-13,30],[-22,24],[-28,22],[-27,12],[-14,10],[-30,67],[-3,10],[-20,0],[-13,2],[-10,8],[-7,19],[3,34],[-6,10],[-21,-13],[0,23],[-4,16],[-9,9],[-17,0],[11,12],[29,41],[6,13],[10,2],[105,4],[33,7],[30,13],[30,18],[15,-5],[11,-8],[9,-9],[11,-8],[29,-10],[12,-6]],[[60,7283],[-26,-36],[-18,-5],[-7,3],[-7,7],[-2,14],[4,12],[10,5],[21,-5],[6,3],[9,3],[10,-1]],[[230,7302],[-9,-6],[-11,22],[10,13],[6,-3],[17,-10],[-3,-16],[-10,0]],[[4462,1462],[-8,0],[-7,14],[-28,30],[-9,16],[-7,17],[-11,31],[5,1],[2,-2],[0,-4],[0,-4],[21,-17],[22,-9],[17,-21],[3,-52]],[[4147,2002],[-3,-85],[-5,-2],[-17,2],[-20,5],[-14,-2],[-13,-14],[-3,21],[-12,9],[-31,10],[-1,5],[1,6],[0,6],[-4,2],[-16,-1],[-3,1],[-6,9],[-11,24],[-6,7],[9,81],[-1,33],[-8,34],[-7,16],[-4,13],[3,14],[35,62],[13,12],[14,-9],[45,-85],[17,-23],[74,-54],[19,-24],[11,-25],[-7,-6],[-17,0],[-19,-9],[-8,-14],[-5,-19]],[[5089,2911],[-5,-3],[-9,6],[0,11],[9,0],[3,-8],[2,-6]],[[4613,3015],[-4,-3],[-7,3],[-3,10],[0,3],[-3,2],[1,7],[-4,11],[7,-2],[4,-9],[6,-6],[3,-16]],[[4269,3502],[-12,-6],[-23,6],[-14,13],[-11,16],[-17,15],[8,9],[9,7],[10,3],[12,1],[6,-6],[19,-11],[9,-8],[4,-10],[3,-15],[-3,-14]],[[4704,3655],[-28,-5],[-20,5],[4,-29],[-14,-14],[-23,-5],[-25,-1],[-65,-19],[-25,0],[0,9],[101,69],[27,9],[51,1],[23,10],[38,0],[-18,-18],[-26,-12]],[[5149,3818],[-2,-2],[-7,2],[-9,5],[-12,20],[-21,14],[1,6],[12,-6],[13,-3],[16,-14],[3,-8],[4,-7],[2,-7]],[[4657,3890],[-28,-5],[-29,4],[-22,13],[0,9],[32,9],[12,10],[2,22],[5,0],[2,-2],[0,-4],[1,-4],[9,-15],[10,-9],[12,-5],[16,-2],[0,-9],[-22,-12]],[[4584,3748],[1,23],[-1,13],[-12,18],[-44,0],[-21,-12],[-57,15],[-20,-5],[-33,34],[-19,3],[-35,26],[-55,18],[-17,19],[-7,21],[7,38],[25,62],[1,6]],[[4297,4027],[3,-1],[46,-36],[8,11],[42,-42],[5,-2],[5,-1],[10,-4],[22,-20],[12,-7],[16,-3],[26,18],[-1,38],[-21,38],[-32,14],[0,10],[19,16],[21,9],[58,5],[11,-17],[-5,-39],[-15,-40],[-19,-22],[11,-13],[13,-8],[13,-6],[17,-3],[0,-11],[-22,-8],[-8,-1],[0,-9],[8,0],[9,-5],[29,-5],[26,-18],[22,-7],[53,-45],[-6,-7],[-2,-3],[2,-3],[6,-7],[0,-10],[-23,-12],[-66,-23],[-6,0]],[[5160,4076],[-12,0],[-6,5],[3,16],[12,0],[5,0],[7,-8],[0,-12],[-9,-1]],[[5335,4083],[-2,-3],[-5,8],[-1,13],[30,120],[13,15],[6,-1],[3,-10],[4,-9],[2,-8],[-3,-11],[0,-5],[-5,-6],[-8,-6],[-4,-12],[-2,-13],[-7,-14],[0,-3],[-9,-25],[-4,-6],[-5,-13],[-2,-5],[-1,-6]],[[4644,4136],[-12,-7],[-8,9],[-6,4],[-16,6],[0,10],[13,9],[-1,13],[-10,13],[-14,6],[-14,9],[-8,20],[-3,20],[1,10],[136,9],[19,-9],[-7,-16],[-13,-18],[1,-16],[-16,-12],[-3,-16],[1,-16],[-5,-16],[-9,-6],[-26,-6]],[[4947,4269],[4,-9],[-4,-8],[-7,-2],[-4,3],[-1,5],[-1,2],[1,1],[5,-1],[0,3],[-2,5],[9,1]],[[4686,4564],[1,-8],[2,-10],[7,-8],[7,-5],[-2,-2],[1,-8],[31,0],[-39,-18],[5,-16],[-24,-21],[-4,-22],[-7,0],[-13,10],[-10,-8],[-12,-15],[-16,-8],[-17,2],[-35,11],[-14,8],[-7,10],[0,9],[7,14],[16,16],[19,10],[32,-11],[15,14],[12,21],[6,15],[-13,-1],[-10,-7],[-9,-9],[-10,-4],[-9,3],[-21,8],[-13,0],[40,20],[-15,8],[-17,12],[13,2],[12,-1],[12,-4],[10,-7],[2,10],[3,3],[-5,6],[8,7],[10,4],[10,1],[26,-4],[13,-7],[8,-9],[-6,-11]],[[4266,4506],[-1,4],[-3,8],[-16,41],[-35,66],[-39,52],[0,1]],[[4172,4678],[28,4],[81,24],[19,22],[19,5],[11,8],[-7,17],[-18,17],[-21,6],[0,7],[0,13],[14,1],[26,7],[14,2],[0,10],[-11,2]],[[4327,4823],[5,1],[-3,11],[-49,16],[63,-1],[39,-7],[15,17],[8,66],[15,17],[22,12],[42,12],[18,-11],[11,-26],[-11,-17],[-4,-20],[17,-15],[20,-3],[20,4],[18,-11],[44,-63],[17,-11],[39,-7],[17,-15],[19,-4],[41,28],[30,34],[10,137],[24,39],[38,36],[64,20],[31,15],[4,7]],[[4951,5084],[17,3],[26,-16],[13,-3],[108,-46],[24,-4],[20,-7],[18,-16],[27,-37],[54,-43],[9,-10],[4,-9],[21,-9],[5,-12],[-3,-11],[-3,-11],[2,-11],[12,-11],[-12,-4],[-6,-12],[-4,-15],[-2,-19],[-7,20],[-17,-2],[-55,-30],[1,-30],[17,-62],[5,-27],[10,-20],[11,-15],[5,-12],[-3,-13],[-15,-31],[-5,-15],[0,-12],[3,-14],[1,-16],[-4,-18],[12,1],[13,-4],[10,-10],[4,-15],[-5,-7],[-34,-13],[8,-10],[10,-7],[12,-3],[16,0],[-7,-11],[6,-1],[17,-8],[-7,-12],[-2,-10],[3,-9],[6,-8],[-6,-3],[-5,-4],[-3,-5],[-2,-9],[27,-16],[9,-14],[3,-24],[-1,-31],[-5,-16],[-26,-27],[16,-9],[0,-11],[-16,0],[0,-9],[7,-1],[2,-5],[-2,-6],[2,-9],[-2,4],[0,4],[-2,1],[-5,-9],[15,-14],[-10,-16],[-19,-18],[-16,-21],[-13,9],[-43,19],[-18,3],[-19,7],[-8,18],[0,54],[-7,0],[-16,-9],[-11,27],[-12,60],[-4,-3],[-11,-7],[-8,24],[-18,24],[-21,15],[-16,-3],[-5,4],[-4,3],[-3,4],[-4,8],[-7,0],[-6,-30],[-12,0],[-12,5],[-8,-14],[-2,10],[-1,7],[-3,4],[-11,-1],[8,17],[-5,16],[-25,27],[-3,27],[-47,70],[-4,21],[-19,9],[-19,-4],[-19,-9],[-20,-6],[-1,7],[1,3],[10,5],[4,4],[1,9],[-17,-7],[-10,9],[-8,12],[-15,7],[-16,0],[-14,3],[-11,6],[-9,11],[40,37],[10,21],[-8,26],[-10,11],[-8,0],[-7,-3],[-9,-3],[-43,0],[-12,-3],[-7,-7],[-6,-6],[-6,-3],[-27,-2],[-12,-3],[-11,-6],[-43,-39],[-19,-10],[38,-10],[-23,-9],[-89,9],[-116,-10],[-43,-22],[-33,-26]],[[4069,2395],[5,-8],[-1,-9],[-3,-9],[-9,9],[-4,2],[-5,13],[-5,2],[-16,-1],[-6,-4],[-6,-10],[-10,-2],[-8,7],[0,10],[5,11],[7,7],[3,0],[4,3],[5,13],[7,8],[11,7],[9,1],[7,-5],[7,-12],[3,-21],[-2,-6],[2,-6]],[[2707,2747],[-1,-30],[-7,9],[-4,3],[-2,5],[-2,12],[-15,-11],[6,42],[4,15],[5,3],[18,-9],[2,-16],[-4,-23]],[[2639,2857],[5,-3],[8,1],[0,-9],[-5,-3],[-5,-5],[-5,-3],[0,-15],[-7,-13],[-9,-14],[-7,-17],[1,51],[5,22],[9,15],[6,-3],[4,-4]],[[2453,3209],[-7,-12],[-1,8],[3,11],[-6,3],[-7,14],[7,3],[11,7],[6,-15],[-4,-6],[1,-5],[0,-6],[-3,-2]],[[4266,4506],[-20,-15],[-54,-27],[-48,20],[-10,-5],[-9,1],[-10,3],[-12,1],[-4,-7],[0,-17],[-2,-17],[-10,-7],[-7,-14],[5,-28],[15,-22],[22,5],[20,-11],[27,-3],[26,3],[19,11],[37,-36],[20,-15],[21,-9],[-5,-14],[-2,-14],[2,-12],[5,-10],[-16,-3],[-21,-13],[-25,-4],[-3,-5],[-1,-9],[-4,-15],[28,-21],[16,-8],[18,-1],[-11,-33],[-2,-22],[3,-22],[10,-31],[-16,0],[3,-32],[5,-12],[21,-9]],[[4584,3748],[-133,-7],[-20,3],[2,-5],[0,-5],[2,-4],[3,-6],[-41,6],[-15,-2],[2,-14],[-38,-9],[-1,-14],[8,-7],[12,-1],[11,2],[-7,-11],[0,-9],[9,-1],[21,-9],[-17,-9],[-21,-2],[-42,2],[-23,-5],[-1,-12],[10,-19],[11,-23],[-24,-5],[-16,0],[-14,5],[-17,9],[0,10],[23,0],[0,10],[-13,4],[-16,-3],[-14,1],[-11,17],[24,-10],[-6,14],[-8,10],[-25,16],[-9,-9],[-11,0],[-11,6],[0,3],[-3,46],[3,17],[12,-9],[13,-7],[11,10],[9,21],[1,21],[25,-15],[6,-5],[0,9],[-5,13],[-2,9],[0,13],[-3,9],[-8,4],[-8,2],[-8,5],[-16,9],[-39,-11],[-18,7],[15,10],[-15,29],[-29,-17],[-11,-9],[-7,-13],[-16,52],[-11,19],[-19,18],[-5,2],[-13,-2],[-6,0],[-4,5],[-2,6],[-1,6],[0,3],[-17,7],[-10,2],[-12,0],[14,-4],[5,-5],[4,-11],[-22,10],[-20,-2],[-18,-11],[-17,-15],[-8,8],[-31,21],[2,5],[6,15],[-15,6],[-13,11],[-7,12],[4,10],[-12,18],[-11,12],[-25,-11],[-20,-12],[-14,-21],[-4,-36],[3,-7],[10,-18],[3,-8],[-2,-10],[-5,-17],[0,-8],[4,-16],[6,-8],[6,-7],[6,-9],[1,-7],[-1,-28],[3,-4],[13,-11],[0,-15],[-8,-19],[1,-15],[59,-72],[10,-6],[-8,-21],[16,0],[0,-9],[-8,0],[0,-10],[12,-11],[27,-50],[8,-26],[38,-71],[4,-4],[9,-14],[6,-15],[-7,-7],[-6,-9],[-3,-18],[-3,-38],[9,-18],[22,-5],[23,3],[16,6],[0,-7],[2,-4],[3,-3],[3,-6],[-8,-5],[1,-1],[7,-4],[-8,-11],[19,-7],[9,-12],[-3,-7],[-17,8],[10,-26],[31,-46],[-2,-17],[9,-24],[6,-26],[-6,1],[-12,-1],[-6,0],[3,-7],[9,-15],[4,-7],[2,5],[1,1],[1,0],[4,3],[4,-13],[1,-12],[-1,-12],[-4,-12],[11,-19],[23,-58],[8,-12],[-3,-12],[15,-25],[31,-32],[7,-16],[3,-16],[-5,-13],[-12,-4],[0,-9],[12,-1],[8,-2],[17,-8],[-4,-11],[-13,-10],[-5,-9],[-1,-8],[0,-4],[1,-5],[0,-7],[-6,-16],[-15,1],[-16,10],[-11,10],[-9,-16],[-14,-15],[-6,-15],[15,-13],[-3,-5],[-3,-10],[-2,-5],[31,0],[-28,-26],[1,-37],[17,-38],[22,-37],[12,-25],[4,-5],[23,-10],[13,-10],[21,-10],[4,-7],[3,-7],[5,-5],[11,-1],[-11,-8],[-5,-2],[0,-9],[7,-8],[1,-8],[-5,-7],[-10,-7],[19,-29],[34,-22],[25,-23],[-9,-34],[-39,20],[-11,-16],[-14,-2],[-50,13],[-11,15],[-8,17],[-14,12],[0,9],[7,19],[-8,23],[-16,20],[-17,8],[-49,-11],[-22,-1],[-10,16],[-5,24],[-26,56],[-8,14],[-13,13],[-49,36],[16,18],[-5,17],[-47,44],[-6,2],[-5,-11],[-15,-19],[-5,7],[-1,13],[6,34],[-3,22],[-10,31],[-8,52],[-16,25],[-24,16],[-32,6],[-58,1],[-71,-8],[-51,-30],[2,-61],[-37,-27],[-15,-21],[-9,-32],[17,0],[11,-10],[4,-17],[-1,-22],[-8,0],[-2,10],[-4,11],[-7,7],[-10,1],[-10,-7],[-6,-14],[-1,-12],[5,-6],[18,-16],[-5,-30],[-15,-14],[-9,31],[-17,-10],[-7,-15],[0,-85],[3,-33],[7,-27],[21,-57],[-4,-8],[4,-12],[-14,-11],[-5,-15],[3,-17],[9,-16],[0,-10],[-11,1],[-2,-4],[-1,-8],[-2,-9],[-12,16],[-4,25],[-2,26],[-6,22],[-16,14],[-39,16],[-14,20],[-8,0],[-11,-13],[-11,3],[-11,11],[-9,13],[-11,21],[1,16],[7,16],[7,20],[18,-5],[5,17],[-4,24],[-12,15],[6,7],[10,21],[-23,0],[2,19],[-2,22],[4,17],[19,2],[0,10],[-22,8],[2,25],[20,47],[-33,-6],[-22,35],[-17,45],[-21,25],[2,28],[-18,37],[-79,111],[-24,13],[-28,-22],[-30,23],[-12,15],[-5,21],[2,0],[6,8],[5,12],[3,15],[1,16],[5,28],[2,39],[-2,11],[-76,17],[-43,3],[-20,-6],[-43,-27],[-42,-13],[-13,-14],[-7,-20],[-11,-137],[-6,-18],[0,-13],[5,-17],[7,-12],[3,-13],[-7,-17],[19,-19],[12,-8],[16,-3],[0,-9],[-16,-2],[-13,-6],[-7,-9],[4,-12],[-7,-13],[-47,-45],[-6,-7],[-7,-5],[-10,0],[-19,41],[-4,3],[-35,74],[-20,-1],[-17,-4],[-29,-14],[-13,14],[-27,11],[-7,14],[-7,0],[-10,-6],[-6,11],[-6,18],[-9,16],[4,14],[-1,12],[-3,14],[0,20],[3,13],[15,25],[5,12],[1,25],[-8,21],[-17,10],[-23,-7],[11,5],[4,5],[1,9],[-10,1],[-6,-4],[-6,-16],[-8,51],[-29,37],[-34,36],[-23,45],[-10,57],[-3,58],[8,51],[20,41],[71,58],[31,33],[15,47],[-5,58],[-11,33]],[[2598,3697],[18,8],[76,-16],[40,9],[37,-10],[22,12],[40,53],[-8,21],[7,18],[29,35],[18,16],[25,-19],[21,8],[10,18],[-32,41],[-104,84],[-36,13],[-21,-4],[-19,3],[-1,157],[-24,71],[6,58],[65,108],[41,9],[9,-41],[40,-14],[36,-26],[76,-36],[20,1],[29,34],[21,9],[39,-3],[5,-20],[18,-7],[21,8],[30,35],[63,25],[8,22],[-8,21],[-17,18],[3,39],[11,18],[4,23],[-4,24],[7,19],[86,37],[22,16],[11,18],[7,18],[0,20],[32,73],[-27,48],[6,40],[4,18]],[[3360,4827],[7,-7],[35,-14],[11,-10],[12,-5],[12,5],[9,2],[88,-20],[124,-66],[67,-24],[10,-11],[10,-3],[91,-81],[20,-35],[7,-4],[21,-7],[35,-31],[17,-11],[17,-3],[18,3],[27,10],[9,0],[9,-1],[9,0],[8,5],[22,35],[3,8],[-11,16],[-17,17],[-13,8],[-17,6],[-28,23],[-21,2],[4,4],[4,2],[-38,2],[24,21],[11,7],[15,3],[15,6],[25,26],[10,7],[31,-2],[55,-24],[23,7],[33,-16],[9,1]],[[2598,3697],[-8,24],[-76,149],[-43,66],[-22,24],[-97,70],[-23,12],[-13,13],[-22,29],[-11,11],[-67,20],[-22,-6],[-6,-39],[-7,0],[-2,14],[0,14],[-2,13],[-11,9],[14,29],[4,24],[-3,24],[-19,66],[-12,19],[-16,12],[-49,27],[-119,36],[-10,9],[-6,17],[5,22],[-6,11],[30,99],[8,0],[27,-25],[49,24],[50,44],[29,35],[16,-5],[13,9],[13,14],[12,12],[0,11],[-4,2],[-1,2],[0,1],[-3,3],[-11,-4],[-11,-8],[-9,-8],[-7,-8],[50,79],[3,9],[40,64],[5,15],[2,19],[3,86],[-2,24],[12,-14],[15,-26],[12,-10],[-1,17],[-3,14],[-5,11],[6,-10],[16,-8],[20,-3],[24,-1],[17,-6],[56,-43],[89,-20],[22,4],[23,11],[36,25],[30,37],[46,93],[25,37],[86,55],[10,11],[75,-16],[24,1],[11,2],[10,6],[11,-10],[14,-9],[17,-7],[17,-2],[14,-6],[7,-12],[5,-17],[8,-15],[12,-11],[34,-16],[12,-3],[9,2],[13,6],[5,1],[10,-10],[8,-7],[9,-3],[7,-7],[12,-37],[8,-15],[10,-5],[41,-14],[3,-3],[4,-7],[7,-7],[9,-3],[35,0],[49,-12],[13,-8],[21,10],[18,-12],[11,-11]],[[2789,5151],[-5,11],[-7,5],[-10,-3],[-56,-48],[-8,-16],[-4,-27],[-10,-8],[-22,14],[-30,29],[-66,0],[-18,-5],[-17,-9],[-15,-5],[-16,9],[-72,-54],[-13,-26],[-7,0],[-11,10],[-15,3],[-15,1],[-6,1],[-8,10],[-46,25],[19,5],[18,-10],[17,-15],[15,-10],[0,11],[-5,6],[-3,5],[2,6],[6,11],[-10,8],[-5,2],[0,11],[4,2],[11,8],[-22,0],[7,20],[-10,-6],[-10,-2],[-9,2],[-9,6],[-6,-6],[-5,-2],[-12,-3],[7,28],[-14,15],[-23,6],[-20,1],[-9,13],[-11,86],[-24,29],[-13,10],[-5,2],[-5,-1],[-11,-1],[4,-12],[46,-77],[-16,0],[3,-5],[1,-1],[1,-1],[4,-3],[-5,-15],[-2,-16],[-4,-13],[-9,-5],[-11,-3],[-24,-12],[-8,-6],[3,-5],[1,-1],[5,-2],[-9,-11],[-15,10],[-9,-5],[-4,-9],[2,-5],[5,-5],[-8,-11],[-17,-15],[-12,-8],[-8,-2],[-22,1],[-9,6],[-9,8],[-8,2],[-10,-16],[6,-5],[7,-4],[8,-1],[-5,-2],[-14,-4],[-9,-8],[0,-16],[-22,2],[-8,15],[-3,18],[-6,14],[-13,5],[-35,1],[-14,4],[13,6],[10,8],[4,10],[-3,17],[-12,-7],[-4,-4],[10,22],[6,8],[-4,-10],[12,-6],[13,9],[9,12],[8,15],[-20,16],[-9,-1],[-9,-15],[-13,6],[-9,11],[-6,14],[-3,18],[3,3],[1,0],[1,1],[2,7],[11,-15],[13,-7],[11,4],[4,18],[-15,-11],[5,19],[-11,27],[6,13],[0,11],[-11,0],[-8,2],[-12,7],[10,6],[5,2],[8,2],[-5,3],[-6,5],[-5,2],[11,24],[3,11],[-2,9],[-11,6],[-8,-6],[-9,-9],[-11,-5],[-4,-6],[-12,-10],[-13,-6],[-6,6],[-2,13],[-11,21],[-2,16],[8,59],[0,31],[-23,26],[-18,54],[-10,13],[-44,0],[-15,6],[-14,13],[-8,18],[-27,116],[-11,23],[-15,12],[-17,-5],[-17,-17],[-13,-21],[-8,-16],[-9,16],[-6,-3],[-7,-7],[-9,2],[-12,-10],[-5,6],[-2,13],[-4,11],[-39,31],[0,9],[9,19],[5,26],[9,24],[20,10],[24,-1],[13,1],[6,5],[-4,9],[-9,8],[-9,6],[-24,12],[-10,21],[-2,26],[4,22],[14,27],[6,-10],[7,-24],[18,-12],[22,-8],[21,11],[16,21],[12,25],[7,0],[4,-12],[1,-7],[-1,-6],[-4,-5],[2,-2],[4,-3],[0,-5],[-6,-9],[23,-1],[19,3],[14,11],[5,27],[8,0],[11,-15],[11,-1],[14,5],[18,0],[15,-6],[11,-7],[12,-5],[21,-3],[2,-9],[-3,-20],[-2,-20],[10,-10],[15,-3],[15,-10],[28,-26],[1,13],[3,7],[5,5],[7,5],[0,9],[-9,19],[12,9],[21,-1],[18,-11],[27,-31],[0,-4],[7,-4],[6,-3],[6,4],[4,13],[-9,9],[-4,6],[-3,22],[-4,1],[-5,-1],[-5,4],[-14,25],[-2,15],[8,19],[-6,11],[3,13],[9,8],[9,-4],[-1,34],[-27,37],[-57,57],[-8,-9],[-4,-9],[0,-10],[5,-10],[-16,6],[-5,-2]],[[1897,6090],[-2,16],[12,38],[18,17],[22,8],[141,3],[20,5],[44,21],[60,50],[26,8]],[[2238,6256],[0,-48],[29,-40],[9,-21],[-7,-18],[1,-20],[-29,-55],[4,-20],[113,-69],[8,-25],[-6,-38],[4,-21],[18,-14],[20,-3],[17,-15],[62,-13],[37,-18],[1,-20],[-66,-33],[-19,-17],[-7,-22],[0,-20],[17,-42],[17,-18],[61,-41],[37,-18],[40,-2],[61,10],[13,-22],[-4,-19],[25,4],[41,33],[-1,39],[7,19],[59,-5],[44,20],[18,17],[48,20],[2,-12],[43,-26],[1,-21],[-19,-36],[6,-41],[-15,-37],[5,-44],[-15,-17],[0,-20],[34,-37],[-19,-40],[5,-44],[-11,-18],[-22,-12],[-42,-9],[-46,-40],[-23,-44],[3,-28],[-8,-24]],[[2683,8805],[8,-50],[38,-18],[17,-18],[-3,-20],[-20,-16],[-22,-9],[-42,-9],[-41,2],[-8,-18],[18,-19],[17,-66],[13,-21],[39,-14],[1,-20],[-28,-63],[20,-7],[20,1],[47,-15],[21,0],[18,-10],[25,0],[-27,-63],[1,-40],[30,-40],[-15,-37],[1,-20],[18,-15],[25,-47],[17,-19],[42,-18],[37,-26],[0,-20],[19,-10],[63,9],[8,-21],[-3,-19],[5,-20],[38,-42],[5,-40],[12,-22],[53,-24],[-18,-33],[-3,-43],[-16,-17],[-44,-21],[-8,-22],[3,-28]],[[3064,7717],[-26,-32],[-10,-38],[-34,-53],[-55,-55],[-10,-38],[-24,-40],[-44,-24],[-54,-51],[-23,-16],[37,-22],[8,-21],[-3,-19],[9,-41],[-3,-19],[-15,-14],[-59,10],[-84,-19],[-40,3],[-113,29],[-167,22],[-43,-17],[-23,-17],[-27,-35],[-22,-13],[-47,-16],[-21,-1],[-14,14]],[[2157,7194],[0,20],[-75,42],[-40,2],[-63,-14],[-43,-17],[-19,7],[-22,42],[-15,81],[-36,33],[30,59],[3,43],[-18,14],[-44,-21],[-30,40],[-15,61],[-18,15],[29,51],[3,23],[-14,61],[-31,64],[-48,58],[-22,66],[-16,22],[-43,-9],[-15,-18],[-22,-13],[-21,-1],[-14,11],[-3,5]],[[1535,7921],[17,43],[13,22],[5,12],[3,18],[0,15],[-5,39],[2,14],[10,10],[23,5],[10,6],[10,15],[4,13],[6,12],[15,10],[30,1],[26,-12],[25,-6],[28,19],[11,15],[4,7],[3,8],[-1,18],[7,13],[12,8],[15,4],[7,14],[11,9],[10,5],[8,9],[6,14],[2,11],[0,12],[2,17],[12,50],[4,27],[-1,28],[-8,25],[-11,20],[-30,36],[-33,30],[-4,10],[-3,12],[-4,11],[-11,9],[20,22],[6,31],[-2,68],[166,6],[80,24],[30,-2],[41,-8],[17,-4],[39,0],[38,8],[18,10],[41,40],[27,11],[27,1],[86,-12],[5,0],[49,-44],[32,-6],[10,7],[26,25],[12,9],[6,1],[16,-1],[6,2],[4,8],[3,18],[2,6],[32,14],[58,-13],[23,5]],[[5343,6145],[3,-5],[3,1],[5,-4],[0,-7],[0,-6],[-12,-5],[-8,0],[-6,-5],[-2,-1],[2,8],[5,6],[6,7],[-9,10],[-4,23],[5,10],[6,4],[10,1],[0,-6],[-3,-4],[4,-7],[-4,-17],[-1,-3]],[[4665,6291],[-9,-28],[-18,14],[-16,-16],[-17,-37],[-8,2],[-10,12],[-9,6],[-12,4],[-12,2],[-12,-1],[-10,-5],[4,26],[13,9],[15,3],[6,6],[5,15],[13,17],[15,14],[14,8],[18,-11],[19,-17],[11,-23]],[[4765,6334],[3,-1],[5,1],[6,-1],[27,-29],[31,-26],[35,-20],[38,-14],[-4,-21],[21,-4],[31,1],[22,-7],[0,-9],[-36,-40],[-22,-15],[-27,-4],[-11,4],[-17,13],[-30,5],[-9,7],[1,10],[12,10],[0,10],[-11,7],[-36,35],[-7,12],[-4,19],[-35,56],[16,9],[1,-8]],[[5097,6267],[-36,-26],[-35,3],[16,21],[15,12],[14,16],[18,54],[57,90],[20,14],[-2,-5],[0,-6],[-2,-5],[-4,-5],[25,-4],[-6,-30],[-19,-32],[-15,-11],[-17,-45],[-29,-41]],[[5292,6543],[1,-11],[5,5],[8,5],[10,-5],[5,-5],[-1,-23],[-13,-36],[-21,-11],[-11,12],[1,10],[5,3],[-4,6],[-11,7],[-5,10],[4,16],[7,15],[8,13],[10,3],[2,-14]],[[5587,6543],[-11,-32],[-7,3],[-2,2],[2,17],[3,15],[6,17],[9,-6],[0,-16]],[[5415,6587],[-28,-31],[0,5],[-3,3],[-9,4],[2,9],[9,12],[2,10],[0,4],[2,8],[2,8],[6,4],[6,8],[5,19],[4,-5],[8,-43],[-3,-10],[-3,-5]],[[3758,7382],[1,-2],[14,-52],[9,-18],[11,-15],[43,-36],[25,-14],[16,-16],[29,-37],[11,-19],[9,-25],[7,-29],[3,-30],[5,-23],[34,-83],[26,-85],[16,-27],[16,-16],[58,-38],[58,-23],[43,-34],[4,-3],[5,-6],[13,-44],[14,-18],[96,-109],[14,-29],[54,-52],[24,-78],[56,-110],[2,-18],[-12,-8],[-36,-33],[-22,-8],[-43,-6],[-22,-7],[-17,-7],[6,-4],[5,-3],[5,-3],[8,-1],[0,-9],[-10,-3],[-9,-5],[-6,-6],[-5,-6],[-14,5],[-25,-2],[-26,-7],[-17,-10],[-18,-9],[-26,1],[-46,12],[11,21],[13,18],[-6,20],[15,13],[37,17],[0,-18],[-15,-61],[81,44],[12,16],[-8,14],[6,4],[11,0],[6,-4],[4,-6],[8,8],[8,16],[4,17],[-6,15],[-29,49],[-12,14],[5,24],[-12,26],[-20,23],[-19,18],[-22,15],[-20,7],[-87,7],[-1,5],[1,7],[-2,7],[-6,9],[-11,23],[-6,6],[-9,2],[-30,-2],[-26,7],[-6,-2],[8,-13],[0,-10],[-11,-12],[-4,-17],[3,-17],[12,-13],[-26,-7],[-45,-4],[-42,-11],[-18,-23],[-3,-56],[3,-17],[31,-90],[7,0],[9,15],[14,15],[-4,15],[6,1],[9,-10],[5,-16],[8,10],[10,-24],[4,-28],[7,-27],[18,-20],[-1,7],[2,2],[2,-1],[4,2],[-4,10],[-3,10],[28,-19],[14,-24],[10,-26],[18,-21],[-7,-18],[1,-4],[6,-7],[-36,-21],[-9,-14],[6,-23],[58,34],[31,10],[34,4],[0,-9],[-9,-11],[-37,-20],[-10,-9],[-5,-11],[-8,-29],[-5,-10],[-8,-11],[-4,-4]],[[4082,5981],[-3,1],[-7,4],[-25,10],[-44,-20],[-65,-4],[-34,33],[-18,7],[-41,-4],[-61,18],[-21,-1],[-71,48],[-23,8],[-86,-9],[-44,3],[-18,11],[-8,21],[-5,64],[7,34],[-74,-7],[-18,15],[-8,64],[-18,15],[-39,26],[-80,29],[-55,33],[-100,-114],[-34,-81],[-24,-20],[-41,-9],[-23,-12],[-30,-35],[-48,-24],[-41,-9],[-20,3],[-5,21],[8,18],[-6,40],[-16,23],[-38,14],[-39,30],[-20,-1],[-64,-45],[-21,-9],[-20,3],[-17,15],[-9,21],[10,38],[-8,21],[-37,21],[-6,60],[-8,21],[-18,15],[-96,-24],[-23,-17],[-7,-18],[-19,-17],[-35,29],[-21,-5],[-41,-29],[-53,-55],[-15,7]],[[2238,6256],[-29,43],[-4,25],[58,113],[-17,42],[-27,32],[-21,-5],[-59,9],[-39,29],[-16,50],[-54,44],[-8,24],[4,23],[-8,25],[-17,22],[3,20],[15,17],[-9,41],[6,38],[-13,22],[-19,7],[-16,22],[-2,40],[-13,45],[15,17],[22,13],[44,-3],[18,-14],[21,1],[-2,39],[-18,86],[7,19],[11,21],[23,13],[11,18],[21,9],[31,-9]],[[3064,7717],[9,-22],[11,18],[23,13],[59,-14],[-4,-19],[-11,-18],[4,-20],[-4,-23],[9,-22],[19,-7],[24,20],[23,36],[19,17],[48,16],[37,-22],[8,-21],[-3,-63],[13,-42],[34,-37],[76,-52],[25,-43],[35,-34],[42,-15],[90,25],[20,-3],[17,-15],[60,9],[11,3]],[[1897,6090],[-6,-2],[-20,-23],[24,-18],[-63,8],[0,10],[-14,4],[-13,9],[-10,9],[-5,3],[-14,-7],[-10,6],[-8,13],[-3,13],[2,0],[4,7],[10,2],[0,10],[-9,0],[-11,-7],[-12,0],[-13,6],[-9,12],[-8,0],[-7,-15],[-20,-11],[-4,-9],[5,-14],[12,-3],[6,-7],[-47,1],[17,8],[-2,10],[-1,14],[-3,9],[-10,-4],[0,6],[-1,3],[0,3],[1,2],[0,7],[-10,1],[-6,-2],[-3,-4],[-4,-6],[14,32],[-5,24],[-13,9],[-12,-15],[-7,10],[-5,-10],[-6,-8],[-9,-6],[-12,-5],[0,-11],[17,-4],[-5,-12],[0,-16],[-4,-17],[-8,-11],[-9,-6],[-8,-8],[-5,-15],[-16,11],[1,-15],[1,-6],[5,-1],[9,1],[52,-43],[22,-10],[7,-11],[3,-10],[-4,-4],[-9,2],[-21,12],[-33,11],[-7,-1],[-10,-5],[-1,-6],[-11,-17],[-13,-11],[-7,10],[-3,14],[-8,9],[-8,8],[-4,8],[-1,9],[-3,4],[-2,4],[-1,3],[2,10],[6,6],[5,4],[2,4],[-11,49],[-22,34],[-30,25],[-37,21],[-35,28],[-89,111],[-33,23],[-10,12],[4,13],[-6,13],[-3,17],[2,17],[7,12],[0,11],[-14,-6],[-12,-2],[-8,5],[-5,13],[-17,-10],[-16,1],[-15,8],[-14,12],[-31,-14],[-46,24],[-36,42],[-3,45],[-15,15],[-9,18],[-12,14],[-26,3],[0,10],[8,0],[0,9],[-9,12],[-13,22],[-9,6],[20,7],[23,-1],[16,4],[-4,20],[-11,11],[-44,29],[0,9],[20,-1],[14,-4],[11,1],[10,14],[0,10],[-12,8],[-20,9],[-15,1],[0,-18],[-10,9],[-13,8],[-13,2],[13,11],[-21,5],[-20,3],[-18,-2],[-18,-6],[9,12],[4,13],[2,16],[0,18],[8,-9],[8,0],[7,8],[8,10],[1,5],[-1,19],[0,7],[2,1],[11,7],[3,1],[-8,29],[-18,13],[-20,6],[-8,7],[-4,6],[-18,15],[-6,2],[-13,4],[-9,7],[-9,10],[-50,11],[-25,10],[-14,8],[-6,-1],[-5,1],[18,12],[38,-13],[45,-14],[52,-27],[32,-29],[23,-10],[18,4],[4,8],[-1,10],[2,12],[8,9],[9,3],[10,0],[10,-3],[10,-6],[3,32],[17,16],[21,12],[16,19],[3,15],[-3,8],[-6,6],[-5,13],[-2,4],[-8,11],[-3,4],[2,5],[7,17],[1,8],[-3,11],[-7,6],[-3,6],[8,11],[10,4],[11,-2],[1,-1],[42,-16],[20,-12],[19,-2],[20,20],[9,29],[-4,25],[-52,85],[-27,26],[-6,9],[-17,87],[-6,11],[14,5],[56,1],[19,4],[5,26],[9,26],[13,23],[15,17],[22,9],[37,-4],[18,10],[20,5],[60,-8],[28,2],[43,20],[28,13],[8,6],[5,10],[17,47],[1,6],[-5,27],[0,7],[-4,16],[0,9],[6,8],[16,5],[6,5],[13,34],[0,30],[-2,29],[5,33],[9,14],[12,8],[13,6],[8,8],[4,8]],[[7831,4065],[-99,-91],[-19,-9],[-97,-14],[-22,-9],[-12,-9],[-22,-22],[-13,-9],[-10,-3],[-8,0],[-9,2],[-15,1],[-44,-12],[-16,4],[-5,28],[8,19],[37,38],[9,16],[7,21],[18,24],[20,19],[16,11],[28,2],[65,-10],[23,8],[23,-8],[34,10],[30,18],[30,34],[37,11],[55,5],[-20,-39],[-29,-36]],[[8549,4241],[13,-13],[4,16],[-7,13],[-11,13],[-10,17],[19,-6],[13,0],[11,6],[11,11],[1,-18],[31,-9],[52,-4],[-32,-15],[-6,-4],[-2,-12],[5,-10],[7,-12],[6,-15],[12,9],[8,-7],[1,-15],[-6,-17],[-27,9],[-41,-9],[-103,-41],[-10,-7],[-12,-12],[-7,-10],[-2,-7],[-4,-6],[-11,-6],[-9,-2],[-72,2],[-11,3],[-5,9],[-2,12],[-5,11],[-18,29],[-11,11],[-27,7],[-12,14],[-9,3],[-10,-2],[-18,-6],[-30,-5],[-18,-7],[-14,-13],[-7,-17],[-8,0],[0,11],[-7,0],[-12,-14],[-10,15],[-7,24],[-3,18],[-1,35],[4,17],[13,13],[19,6],[20,3],[16,7],[6,18],[10,11],[128,31],[39,0],[41,-7],[15,-10],[30,-25],[39,-10],[43,-31]],[[7802,5303],[-3,-2],[-8,3],[-5,5],[0,7],[-2,4],[-2,10],[4,5],[11,-12],[5,-12],[0,-8]],[[7711,5362],[3,-1],[7,2],[11,-2],[12,-10],[25,-9],[5,0],[2,-3],[0,-7],[-3,-4],[-6,-1],[-11,-11],[-5,3],[1,7],[-1,0],[-6,-4],[-7,0],[-6,4],[-14,3],[-12,6],[-4,-1],[-4,2],[-2,9],[-16,23],[0,6],[21,-2],[5,-2],[5,-8]],[[6933,5360],[-5,-5],[-4,1],[-9,1],[-7,-2],[-8,4],[2,5],[9,17],[5,8],[11,-1],[6,-9],[-2,-14],[2,-5]],[[7546,5433],[48,-59],[2,7],[2,6],[4,5],[7,2],[1,6],[-2,3],[-2,0],[-4,1],[17,6],[14,-4],[13,-13],[10,-19],[-14,-17],[-2,-29],[-6,-25],[-25,-8],[9,-13],[5,-4],[9,-3],[-7,-9],[20,0],[1,-10],[-14,-20],[-3,-22],[0,-18],[12,-109],[15,-59],[-30,-4],[-27,-22],[-12,-33],[11,-35],[0,-21],[-27,-15],[-54,-18],[-9,-15],[-7,-32],[-7,-12],[-12,-3],[-23,10],[-16,3],[-12,9],[-25,33],[-4,2],[-5,-1],[-11,11],[-11,17],[-5,17],[-5,-3],[-13,-3],[-5,-3],[1,10],[-2,20],[1,9],[-19,-12],[-8,9],[2,20],[10,23],[11,9],[14,6],[21,4],[6,5],[13,15],[28,-2],[6,2],[7,17],[1,18],[5,15],[19,9],[-6,16],[2,36],[-4,18],[-2,-6],[0,-1],[-2,0],[-4,-3],[-6,11],[-6,8],[-9,7],[-10,4],[6,13],[-1,19],[-5,21],[-8,16],[-14,14],[-12,4],[-15,3],[-20,8],[-16,14],[-37,46],[-9,19],[-2,22],[6,16],[8,16],[4,21],[165,34],[23,-3],[55,-17],[2,-10]],[[7007,5474],[8,-11],[30,-29],[1,-7],[-2,-2],[-3,0],[-4,-1],[-9,-52],[-2,-8],[-16,3],[-12,4],[-10,1],[-12,-8],[-4,13],[2,10],[3,8],[-1,9],[-5,7],[-13,13],[-5,10],[-14,11],[-6,8],[4,10],[7,4],[7,-3],[6,-6],[3,-5],[6,10],[9,7],[9,1],[7,-8],[7,0],[0,11],[9,0]],[[7936,6496],[-36,-55],[3,-8],[47,-46],[39,-16],[9,-7],[5,-6],[38,-58],[15,-13],[24,-14],[-14,-10],[4,-12],[8,-11],[11,-11],[0,-15],[4,-9],[7,-3],[12,2],[-2,-29],[15,-33],[21,-26],[16,-11],[0,-13],[-2,-25],[-14,-16],[-34,14],[-18,-10],[-14,6],[-11,14],[-12,11],[9,9],[-11,7],[-1,7],[2,8],[1,7],[2,5],[6,16],[1,9],[-13,11],[-3,5],[-8,21],[-18,6],[-39,-3],[-20,-11],[18,-25],[44,-34],[41,-60],[21,-17],[0,-11],[-3,-6],[-1,0],[1,-2],[3,-12],[-29,-13],[-36,-9],[-74,-7],[-19,3],[-36,13],[-41,6],[-15,7],[-28,20],[-28,13],[-67,14],[-58,3],[-11,4],[-11,10],[-34,50],[-13,11],[-18,4],[0,9],[6,3],[10,8],[8,2],[4,-1],[5,-1],[5,0],[43,9],[5,5],[18,29],[12,10],[13,2],[13,0],[13,4],[30,29],[34,25],[1,5],[12,6],[-4,14],[-12,14],[-11,6],[-36,9],[-14,1],[-24,-3],[-19,-5],[-16,-10],[-15,-17],[-17,-40],[-3,0],[-51,-72],[-16,-15],[-21,-6],[-24,3],[-96,35],[-16,10],[-16,13],[-11,5],[-15,2],[-20,9],[-39,40],[-22,11],[0,10],[13,5],[4,13],[2,17],[4,15],[-5,1],[-3,2],[-3,3],[-4,3],[9,6],[4,6],[2,9],[0,14],[4,10],[9,6],[11,4],[7,4],[32,30],[7,11],[8,0],[14,-30],[36,3],[42,11],[31,-5],[4,8],[5,6],[4,7],[2,9],[7,-14],[1,-6],[8,0],[14,20],[23,10],[48,9],[30,10],[11,17],[-2,26],[-8,37],[202,6],[22,-6],[-8,-32],[21,-14],[30,-8],[20,-16],[-7,-14]],[[6333,6707],[-7,0],[-13,69],[3,33],[24,18],[-3,11],[2,6],[7,2],[11,1],[39,-27],[-8,-36],[-55,-77]],[[6836,7508],[0,-9],[5,0],[1,-2],[0,-4],[4,-13],[2,-14],[3,-7],[-27,-15],[-28,-21],[-18,-28],[4,-36],[-16,1],[-12,-4],[-10,-7],[-8,-9],[15,-9],[8,-1],[-18,-9],[-13,-13],[-1,-14],[17,-13],[-14,-15],[6,-16],[14,-15],[9,-13],[1,-10],[-1,-2],[-5,0],[-10,-8],[-2,-10],[-1,-15],[-4,-8],[-12,9],[-7,3],[-33,11],[-9,6],[-2,14],[0,13],[-4,6],[-19,7],[-19,30],[-20,3],[26,18],[14,13],[7,13],[-6,21],[-12,14],[-15,8],[-14,1],[-47,-38],[11,0],[8,-2],[7,-3],[6,-6],[-20,-3],[-15,-14],[-11,-20],[-8,-21],[9,4],[3,2],[3,4],[13,-16],[14,-23],[7,-22],[-7,-9],[-25,1],[-20,4],[-36,15],[26,40],[5,5],[-6,15],[-13,-5],[-13,-14],[-7,-12],[-8,0],[0,11],[-2,7],[-3,4],[-2,8],[-66,-20],[-12,-10],[-7,0],[4,9],[4,8],[5,6],[10,7],[-6,2],[-9,6],[-8,2],[2,13],[-2,6],[7,6],[7,4],[0,11],[-7,0],[0,9],[5,1],[3,3],[8,6],[-9,0],[10,21],[-5,13],[-11,10],[-8,16],[-1,20],[2,19],[-3,14],[-14,6],[0,9],[40,3],[72,17],[11,-3],[8,-7],[4,-6],[4,-4],[18,3],[60,17],[25,-9],[15,-17],[13,-21],[17,-22],[-2,-11],[24,10],[31,17],[16,14],[0,12],[24,35],[14,12],[4,-1],[31,1],[10,2],[32,17],[-10,-14],[-5,-5]],[[5528,4570],[-15,-9],[-12,4],[-16,-5],[-13,7],[-1,8],[17,36],[13,10],[10,-2],[14,-14],[9,-15],[-6,-20]],[[5635,5804],[-1,-10],[-5,2],[-3,-4],[-6,-4],[-2,-3],[-8,5],[-9,4],[2,10],[6,9],[3,4],[4,1],[7,-6],[9,-5],[3,-3]],[[5862,5868],[5,-14],[7,-7],[18,-9],[47,-33],[24,-21],[15,-25],[2,-4],[3,-3],[2,-6],[1,-11],[-1,-12],[-3,-2],[-5,1],[-6,-3],[-7,-10],[-8,-8],[-8,-2],[-9,11],[-8,0],[-11,-9],[-13,5],[-11,14],[-4,15],[-7,-2],[-14,-6],[-13,-13],[-4,-23],[-39,49],[47,19],[-11,42],[-8,10],[-12,-12],[-7,0],[-4,16],[-9,5],[-13,-3],[-14,-8],[0,16],[-25,11],[-6,22],[-4,-3],[-3,-7],[-9,13],[-10,7],[-10,-1],[-10,-9],[-2,14],[4,13],[8,9],[10,4],[9,7],[0,16],[-6,26],[1,21],[4,19],[11,13],[23,6],[78,-53],[15,-17],[2,-14],[-4,-35],[2,-19]],[[4585,5887],[9,-19],[0,-15],[13,-27],[21,-26],[50,-21],[49,-43],[29,-6],[0,-11],[-3,-11],[3,-6],[7,1],[8,7],[14,-14],[33,-7],[15,-9],[12,8],[12,-8],[22,15],[22,-5],[18,-18],[7,-26],[10,-17],[23,-16],[44,-21],[51,-16],[54,-5],[25,-5],[22,-9],[22,1],[19,23],[25,-12],[26,0],[26,3],[24,-1],[71,-25],[22,-13],[-12,-4],[-11,-9],[-10,-12],[-6,-15],[0,-24],[6,-14],[101,-85],[17,-25],[-28,-22],[-20,-48],[-5,-49],[22,-31],[0,-8],[-21,-7],[4,-13],[25,-31],[3,-17],[0,-22],[2,-20],[26,-34],[3,-14],[5,-7],[6,-5],[2,-4],[-1,-25],[1,-13],[6,-10],[-11,-19],[-3,-6],[8,-19],[15,-17],[30,-24],[39,-20],[4,-9],[3,-13],[5,-11],[8,-6],[39,8],[15,-1],[32,-24],[45,-4],[19,-8],[22,11],[102,18],[-9,-72],[1,-36],[16,-31],[-9,-20],[-12,-64],[-10,-24],[-17,-14],[-23,-13],[-25,-9],[-24,-4],[-13,4],[-4,8],[-2,18],[-26,43],[-5,2],[-16,13],[-30,-13],[-19,-22],[18,-13],[0,-10],[-17,-15],[-17,2],[-17,13],[-21,23],[-5,9],[-8,18],[-7,11],[-8,9],[1,8],[14,11],[-13,32],[-11,10],[-15,-2],[-7,23],[-19,13],[-23,3],[-20,-10],[-15,10],[-6,-2],[-10,-8],[1,7],[0,2],[3,1],[4,1],[0,38],[-9,8],[-19,-3],[-3,10],[5,11],[21,21],[5,13],[-2,18],[-17,20],[-10,37],[-14,12],[-18,5],[-16,-4],[7,-20],[-25,6],[5,27],[20,30],[16,16],[-11,19],[-9,0],[-8,-10],[-11,-9],[-2,-4],[1,-7],[-2,-6],[-8,-3],[-10,3],[-1,7],[4,7],[3,3],[0,11],[-16,0],[23,49],[-23,13],[-24,10],[-28,6],[-33,1],[27,9],[12,7],[8,14],[-9,13],[-2,13],[1,9],[1,3],[-11,25],[-8,10],[-4,-9],[-65,5],[-78,-10],[-22,3],[-39,14],[-16,3],[-22,-3],[-34,-8],[-17,1],[-78,20],[-17,-2],[-36,-10],[-16,2],[-12,14],[-27,65],[-4,-5],[-4,-5],[-6,-2],[-9,2],[11,21],[22,24],[14,23],[-8,20],[0,11],[8,0],[0,9],[-24,42],[-16,20],[-18,8],[-50,7],[-24,10],[-15,12],[-4,11],[-1,26],[-4,12],[-26,21],[-4,5],[-4,4],[-8,2],[-8,7],[-3,16],[-5,11],[-10,9],[-35,21],[-28,14],[-31,34],[-11,5],[-7,6],[-11,28],[-6,6],[-26,14],[-110,83],[-39,21],[-27,9],[-15,2],[-19,-2],[-34,-7],[-16,1],[-15,12],[-22,29],[-9,4],[-15,1],[-19,4],[-17,7],[-16,5],[-14,-6],[0,-10],[15,-1],[16,-6],[9,-12],[-2,-21],[-10,-8],[-18,-6],[-124,-11],[-26,-15],[-1,16],[2,17],[4,13],[7,5],[9,5],[26,19],[11,5],[26,6],[51,28],[34,8],[33,18],[27,10],[4,4],[5,19],[3,6],[13,4],[23,1],[10,6],[8,12],[4,13],[0,13],[-4,10],[17,6],[21,20],[11,5],[70,0],[24,8],[59,34],[29,6],[12,-6],[16,-20],[7,-4],[15,-2],[16,-5],[16,-10],[11,-12],[-8,-28],[12,-21],[22,-14],[24,-5],[0,-15],[19,-66]],[[4082,5981],[-5,-6],[-9,-7],[-6,-2],[-17,3],[-8,-1],[-8,-7],[-6,-3],[-9,-1],[5,-15],[2,-6],[-16,-1],[-23,-14],[-11,-3],[-13,3],[-15,6],[-15,4],[-15,-3],[-6,-11],[-6,-33],[-8,-7],[-28,-1],[-9,-5],[-5,-13],[-16,0],[-26,-6],[-25,-2],[-11,13],[-5,12],[-12,-4],[-21,-13],[-10,3],[-19,13],[-6,3],[-2,4],[-39,29],[-10,-2],[-20,-15],[-7,-6],[-9,-7],[-13,-3],[-11,0],[-9,-3],[-7,-6],[-8,-10],[-4,4],[-11,6],[0,-39],[54,9],[0,-9],[-22,-14],[11,-17],[22,-7],[12,18],[8,0],[-8,-20],[17,1],[14,4],[13,2],[10,-7],[55,28],[14,1],[27,-44],[24,-30],[13,-7],[12,-14],[10,-4],[9,1],[22,8],[11,2],[15,-5],[18,-11],[17,-16],[8,-18],[23,24],[12,6],[19,0],[12,-6],[22,-19],[17,-5],[63,0],[29,-12],[20,-27],[35,-113],[16,-16],[21,-2],[11,4],[14,14],[12,6],[14,-2],[16,2],[15,19],[-22,14],[-10,4],[22,10],[20,-5],[37,-23],[18,-7],[38,-5],[21,-8],[17,-14],[12,-18],[5,-20],[-3,-18],[-14,-14],[-16,-8],[-15,-14],[-9,-33],[11,17],[14,1],[13,-10],[12,-13],[12,-11],[30,-7],[16,-7],[0,-10],[-10,-4],[-25,0],[-11,-5],[-10,-11],[-3,-9],[7,-7],[17,-3],[77,4],[114,-20],[14,11],[12,20],[28,-16],[38,-39],[-23,-15],[-8,-4],[0,-10],[14,-4],[12,-6],[4,-9],[-7,-11],[0,-10],[35,-17],[54,-83],[42,-29],[17,-1],[47,8]],[[4327,4823],[-79,10],[-17,7],[23,20],[-30,32],[-15,3],[-36,-35],[-12,-4],[-39,4],[0,10],[22,0],[-14,22],[-16,12],[-17,5],[-66,8],[-20,-5],[-13,-22],[15,5],[17,-1],[14,-8],[7,-16],[-19,0],[-34,7],[-15,-7],[-16,70],[-7,0],[-9,-21],[-1,7],[-4,7],[-2,7],[-20,-7],[-41,-5],[-17,-9],[-46,30],[10,15],[20,18],[9,17],[-21,9],[-43,12],[-26,19],[-19,6],[-7,4],[-6,7],[-18,31],[11,25],[-16,30],[-27,12],[-22,-26],[20,-3],[1,-12],[-10,-7],[-15,6],[-13,4],[-13,-11],[-10,-17],[-5,-11],[0,-9],[6,-3],[3,-3],[4,-2],[9,-2],[0,-9],[-9,-6],[-1,-3],[2,-4],[1,-8],[-14,-14],[-13,-4],[-16,5],[-19,13],[0,4],[-13,25],[-2,1],[-4,8],[-3,4],[2,3],[12,4],[-15,32],[-54,68],[-10,22],[-6,7],[-5,3],[-12,4],[-53,33],[2,-15],[5,-26],[1,-14],[-31,-24],[-8,-10],[8,-12],[6,-5],[4,0],[6,7],[4,-13],[-3,-11],[-7,-9],[-10,-6],[8,-10],[-6,-12],[-17,-1],[-22,8],[-29,5],[-42,-5],[-7,8],[-14,8],[-16,3],[-10,-4],[-7,0],[-14,3],[-18,-10],[-15,-20],[-7,-23],[-10,10],[-6,19],[-7,11],[-11,4],[-10,-2],[-5,2],[2,15],[-17,12],[-36,11],[-58,26],[-22,1],[-21,-10],[-27,27],[-33,1],[-33,-12],[-46,-34],[-10,-2],[-17,-1],[-9,5],[-6,10]],[[5367,10],[0,-10],[-30,2],[-26,14],[-44,33],[0,9],[13,0],[10,5],[8,7],[7,8],[14,1],[14,-2],[26,-8],[0,-11],[-7,-13],[-1,-15],[5,-13],[11,-7]],[[7169,93],[0,-6],[-3,-4],[-5,0],[-8,-5],[-9,-5],[-10,-1],[-12,5],[-7,2],[-5,7],[2,5],[7,5],[13,-3],[22,-3],[13,6],[2,-3]],[[7630,167],[-9,-12],[-2,10],[-5,2],[-5,7],[1,10],[5,7],[8,-2],[15,-4],[2,-14],[-10,-4]],[[6613,897],[-1,-13],[-2,-1],[-4,5],[-7,1],[-13,8],[-4,-5],[-4,0],[-4,5],[-20,6],[-3,4],[2,5],[9,8],[6,3],[8,1],[2,3],[5,6],[11,2],[9,-7],[18,-13],[-8,-18]],[[5103,1027],[31,-10],[17,7],[64,-8],[28,1],[12,4],[10,6],[7,10],[2,15],[5,12],[12,4],[29,-2],[-13,51],[37,17],[51,-6],[26,-17],[23,-63],[-3,-11],[-6,-4],[-9,-19],[-5,-7],[-11,-6],[-11,-2],[-24,-1],[-44,10],[-25,1],[-16,-11],[5,-13],[20,-13],[21,-10],[33,-11],[37,-27],[19,-6],[20,4],[20,10],[19,12],[15,13],[13,-66],[2,-27],[-2,-52],[2,-12],[8,-7],[23,-2],[11,-6],[42,-16],[99,31],[41,-11],[24,14],[92,18],[30,10],[71,38],[23,8],[25,5],[25,1],[112,-21],[23,-13],[11,8],[19,10],[32,12],[70,-30],[6,9],[5,3],[2,5],[2,13],[54,-14],[12,-17],[20,3],[7,-2],[1,-9],[-2,-8],[-4,-8],[-2,-9],[9,-36],[25,-16],[33,-3],[53,4],[32,7],[17,-1],[4,-3],[6,-7],[7,-6],[11,-3],[34,0],[62,10],[28,-9],[17,-1],[17,10],[8,-10],[8,10],[21,-20],[15,-23],[20,-19],[32,-8],[32,5],[177,69],[24,5],[13,-3],[23,-13],[18,-3],[66,0],[-8,-20],[-13,-16],[-26,-24],[8,-9],[-7,-13],[-1,-12],[5,-9],[11,-6],[-2,25],[6,11],[9,-2],[9,-14],[-6,-10],[0,-5],[6,-5],[-6,-11],[-6,5],[-4,1],[-5,-4],[-9,-11],[3,-13],[-9,-16],[-8,-22],[6,-29],[-14,-12],[2,-12],[7,-14],[5,-16],[4,-29],[12,-3],[16,3],[19,-10],[14,-12],[14,-4],[26,1],[14,9],[19,41],[13,9],[10,1],[6,1],[11,9],[14,25],[2,4],[13,4],[37,2],[42,10],[8,3],[35,24],[11,11],[8,5],[11,3],[7,-1],[6,0],[7,9],[7,0],[16,-14],[43,-12],[-12,-14],[24,-14],[28,3],[28,13],[21,18],[-6,2],[0,2],[-2,5],[31,31],[22,31],[24,23],[39,5],[-8,19],[12,-1],[4,1],[-3,5],[-3,10],[-2,5],[31,0],[-10,-26],[-17,-18],[-19,-15],[-17,-20],[21,-75],[17,-33],[25,18],[-11,-22],[-18,-23],[-12,-23],[10,-21],[-8,-26],[-10,-26],[-12,-23],[-13,-18],[-5,-12],[-12,-35],[-6,-7],[-13,-3],[-11,-6],[-10,-6],[-66,-31],[-16,-4],[-31,0],[-2,4],[-16,19],[-8,6],[-27,5],[-23,-3],[-20,0],[-20,14],[-10,9],[-10,3],[-9,-3],[-10,-9],[-8,-3],[-41,8],[-48,-10],[-83,-31],[-234,11],[-71,-24],[-17,-11],[-19,-7],[-103,14],[-76,-4],[-22,-6],[-27,-3],[-11,-6],[-16,-12],[-64,-26],[-18,-4],[-64,6],[-25,-6],[-7,-5],[-9,-12],[-8,-3],[-11,0],[-8,4],[-6,4],[-9,2],[-20,-2],[-16,-4],[-30,-13],[-18,8],[-22,2],[-276,-10],[0,9],[15,13],[4,16],[-4,55],[2,17],[7,28],[-1,21],[-4,14],[-6,20],[-8,17],[-9,8],[-6,3],[-6,6],[-7,7],[-12,3],[-100,2],[-28,6],[-16,11],[-7,0],[-11,-4],[-12,12],[-24,31],[-15,12],[-21,11],[-22,5],[-19,-8],[-68,36],[-2,14],[0,9],[-123,-12],[-85,12],[-5,4],[-5,7],[-4,7],[-2,3],[-7,-1],[-6,-3],[-5,-5],[-5,-2],[-81,0],[-20,10],[-10,0],[-5,-15],[-4,2],[-31,-7],[-20,10],[-32,42],[-18,9],[-96,-3],[-48,7],[-37,24],[-10,-8],[-7,-3],[-6,-1],[-8,3],[-20,-17],[-79,3],[-32,-16],[-16,17],[-66,-4],[-27,7],[-5,8],[2,13],[-4,9],[-9,4],[-15,2],[-7,3],[-9,10],[-7,11],[-9,11],[-14,8],[8,10],[-5,1],[-2,0],[-1,2],[0,6],[16,9],[7,2],[8,0],[1,4],[0,3],[1,2],[6,0],[-7,11],[-6,11],[-1,12],[6,16],[-8,26],[12,33],[18,32],[9,23],[-2,9],[-6,9],[-5,6],[-2,0],[1,10],[11,36],[8,13],[1,11],[-14,10],[0,9],[5,7],[2,3],[-2,3],[-5,7],[17,37],[3,17],[-4,16],[22,39],[5,14],[4,-29],[0,-59],[7,-25],[6,-15],[5,-3],[9,-2],[8,-2],[1,-6],[-1,-6],[3,-5],[10,-5],[10,-4],[27,-2],[22,5],[18,14],[10,25],[3,35],[-6,28],[-10,26],[-4,22],[12,14],[-11,26],[-3,20],[6,18],[12,20],[17,17],[9,0],[11,-11],[22,-11],[0,-11],[-13,-15],[1,-18],[12,-46],[-2,-37],[2,-11],[23,-45],[20,-14],[95,-11]],[[5124,7941],[4,-4],[11,-3],[10,-6],[-1,-6],[-5,-1],[-23,10],[-4,6],[-4,2],[-4,-1],[-21,8],[-4,7],[7,8],[18,8],[7,-2],[7,-10],[2,-16]],[[4791,9461],[0,-3],[-7,-30],[17,-62],[96,-45],[0,-20],[-12,-17],[-7,-39],[8,-21],[53,-45],[68,-80],[58,-42],[59,-14],[35,-34],[21,20],[21,4],[21,-4],[21,-16],[25,-44],[53,-45],[26,-13],[-8,-18],[13,-42],[-4,-20],[-12,-17],[0,-20],[-16,-17],[-64,-48],[-24,-35],[-59,-49],[-23,-12],[-97,-21],[-3,-9],[0,-1]],[[5050,8602],[-14,3],[-37,-5],[-62,-25],[-26,-16],[-23,-20],[-16,-24],[-6,-37],[10,-31],[20,-22],[26,-8],[16,-11],[19,-26],[16,-31],[7,-26],[7,-2],[39,-33],[15,-5],[18,-2],[17,2],[13,5],[7,-15],[22,-21],[1,-13],[-9,-6],[-78,-10],[-17,-17],[-5,-28],[9,-38],[46,-69],[12,-10],[35,-17],[7,-7],[43,-10],[11,-5],[13,6],[31,4],[2,2]],[[5219,8034],[2,-4],[-1,-37],[1,-24],[-1,-19],[-4,-14]],[[5216,7936],[-9,6],[-41,42],[-23,18],[-16,6],[-42,-6],[-42,11],[-17,-1],[-57,-28],[-26,-5],[-33,14],[-3,-8],[-8,-13],[-4,1],[-20,-27],[-7,-25],[3,-23],[18,-46],[5,-9],[8,-9],[39,-25],[7,-23],[16,-18],[16,-10],[8,2],[77,-36],[14,6],[19,-8],[18,-14],[15,-17],[16,-12],[45,-15],[12,-18],[-1,-12],[-14,-14],[0,-14],[6,-8],[21,-15],[4,-11],[-4,-12],[-8,-2],[-8,0],[-4,-5],[3,-17],[8,-7],[10,2],[11,7],[-1,-14],[1,-10],[3,-8],[5,-7],[-30,-25],[-5,-13],[12,-12],[0,-10],[-22,-1],[-11,-9],[4,-9],[20,-1],[0,-11],[-58,-1],[-22,5],[3,17],[0,10],[-8,0],[-9,-7],[-8,2],[-3,9],[5,16],[-40,22],[-7,3],[-5,15],[-13,11],[-15,4],[-8,-7],[-1,-7],[4,-12],[-42,68],[-5,16],[7,24],[2,15],[-5,6],[-12,5],[-7,11],[-4,14],[-5,10],[-100,132],[-38,26],[-21,6],[-94,7],[-63,36],[-51,14],[-46,-2],[-37,-23],[-28,-49],[-3,-28],[9,-25],[11,-23],[6,-27],[3,-9],[9,-4],[23,-2],[10,-3],[6,-7],[11,-19],[60,-85],[34,-36],[117,-63],[76,-18],[3,-9],[0,-12],[4,-15],[10,-17],[14,-12],[17,-8],[24,-2],[16,-5],[-9,-10],[-21,-11],[-21,-5],[-98,16],[-164,69],[-27,5],[-84,-14],[-13,-6],[6,16],[14,28],[3,16],[-3,12],[-17,23],[-3,9],[-9,35],[-20,25],[-21,20],[-12,23],[15,47],[6,55],[-7,51],[-22,36],[-45,25],[-25,10],[-42,9],[-19,12],[-19,8],[-19,-5],[-59,43],[-11,1],[-12,11],[-27,6],[-26,10],[-21,37],[-53,40],[-22,10],[-19,3],[-44,-3],[10,23],[-9,23],[-33,43],[3,1],[3,0],[2,1],[0,7],[-41,46],[-11,23],[25,10],[72,5],[39,7],[17,13],[7,13],[14,10],[9,15],[-7,26],[-28,17],[-7,3],[-5,4],[2,10],[7,16],[-18,37],[-26,20],[-31,4],[-33,-12],[8,-27],[-3,-22],[-9,-17],[-11,-13],[-18,-9],[-11,-8],[1,-3],[-23,0],[-10,3],[-9,8],[-23,-15],[-14,-18],[-4,-22],[9,-25],[-7,0],[-8,10],[0,-21],[-7,0],[0,11],[-9,0],[-4,-17],[-9,1],[-12,9],[-13,7],[-1,7],[-17,-1],[-18,-15],[-1,-17],[21,-12],[-10,-2],[-7,-3],[-4,-8],[-2,-13],[-4,-8],[-11,3],[-16,10],[-27,-1],[-14,-5],[-13,-14],[16,-14],[12,-21],[5,-22],[-2,-21],[13,-13],[11,-16],[13,-15],[21,-6],[3,-15],[-15,-33],[-30,-51],[-35,-99],[1,-17],[-43,-92],[-4,-32],[9,-24],[12,-24],[6,-33],[-5,-33],[3,-15],[13,-7],[5,-7],[15,-41],[59,-50],[10,-5],[6,-6],[27,-9],[6,-5],[3,-5],[10,1],[3,-6],[-2,-27],[1,-5]],[[2683,8805],[10,2],[14,14],[4,17],[0,15],[2,12],[11,14],[43,29],[15,27],[40,37],[16,23],[2,11],[0,4],[1,24],[5,14],[9,10],[18,13],[11,7],[34,18],[72,21],[5,4],[12,12],[5,3],[8,-3],[3,-7],[2,-7],[3,-4],[37,-20],[9,-3],[24,8],[40,36],[26,12],[25,2],[9,-1],[13,-2],[43,-13],[34,-4],[11,-3],[3,-6],[1,-19],[3,-5],[7,-1],[9,6],[22,1],[28,5],[14,-1],[10,-5],[24,-15],[13,-5],[34,-1],[18,2],[16,4],[21,6],[18,0],[37,-5],[25,1],[17,7],[4,1],[20,16],[19,24],[3,12],[-1,13],[3,10],[18,5],[13,-3],[1,-2],[5,-7],[5,-11],[9,-11],[20,-18],[15,-7],[12,9],[13,29],[11,56],[4,114],[2,5],[10,40],[12,11],[22,18],[17,3],[33,6],[103,-8],[224,-33],[47,5],[26,7],[12,7],[10,10],[6,14],[2,26],[3,11],[17,15],[25,16],[26,11],[20,1],[21,-14],[11,-17],[12,-11],[24,3],[20,11],[34,24],[22,7],[111,-4],[74,-37],[38,-1],[14,9]],[[5219,8034],[9,7],[-1,14],[-6,18],[-17,28],[9,10],[-9,10],[23,2],[20,-25],[27,-57],[14,-16],[23,-22],[26,-12],[22,11],[12,-7],[34,-11],[12,-2],[8,-7],[13,-32],[6,-10],[34,-1],[37,-40],[61,-88],[71,-70],[12,-39],[-37,-29],[-48,-11],[-21,5],[-9,21],[-7,26],[-16,15],[-20,10],[-18,13],[-30,44],[-21,45],[-27,38],[-46,21],[-91,17],[-32,13],[-20,13]],[[7101,8178],[19,-18],[10,-20],[-8,-19],[6,-22],[-15,-14],[-105,-36],[-25,3],[-39,22],[-75,58],[-16,19],[-10,19],[21,0],[66,37],[30,11],[33,-1],[91,-26],[17,-13]],[[6097,8369],[-2,-11],[-8,-1],[-20,12],[-4,-6],[-9,-10],[-19,-8],[-38,-7],[-13,-5],[-28,-25],[-17,-10],[-5,13],[-8,11],[-18,16],[-3,1],[-10,-2],[-3,1],[0,4],[1,12],[-1,4],[-16,14],[-7,5],[-31,7],[-25,1],[-16,12],[-5,40],[7,37],[17,37],[38,54],[85,69],[37,-17],[46,-6],[18,-6],[5,-9],[3,-14],[6,-12],[13,-5],[12,-3],[10,-7],[8,-10],[5,-10],[-24,-1],[-7,-16],[8,-17],[23,-5],[0,-29],[-20,-6],[-4,-20],[8,-44],[8,-16],[3,-12]],[[4791,9461],[3,2],[28,27],[22,8],[38,0],[37,-8],[18,5],[26,41],[17,7],[20,-1],[23,3],[24,6],[18,8],[31,27],[9,-1],[53,-37],[16,1],[19,18],[6,4],[7,1],[5,4],[4,10],[25,-16],[13,-2],[13,6],[7,11],[1,12],[-4,32],[-2,46],[33,15],[45,-4],[33,-10],[9,-6],[5,-9],[5,-6],[8,0],[4,5],[5,23],[4,9],[17,14],[1,1],[19,11],[22,9],[19,2],[18,-19],[22,-14],[2,-13],[-3,-12],[2,-8],[10,-3],[8,2],[8,4],[9,2],[31,-4],[10,1],[38,11],[17,2],[24,-4],[17,4],[23,31],[24,6],[33,12],[23,-21],[14,-37],[4,-40],[3,-12],[5,-7],[6,-5],[6,-9],[4,-4],[11,-7],[4,-4],[1,-8],[-3,-16],[1,-5],[18,-15],[15,-4],[39,1],[-6,-15],[26,0],[22,-3],[20,-9],[22,-19],[39,-48],[24,-21],[23,-1],[9,21],[-3,25],[4,19],[44,3],[23,8],[11,2],[16,-1],[34,-21],[184,-75],[19,3],[6,0],[3,-3],[9,-15],[4,-5],[42,-19],[5,-2],[22,-17],[48,-64],[22,-13],[26,-4],[26,2],[190,59],[28,5],[12,-1],[9,-3],[9,0],[11,4],[10,12],[7,16],[9,13],[15,5],[100,-6],[11,-4],[23,-14],[11,-3],[13,2],[8,5],[8,8],[14,10],[12,4],[39,3],[43,27],[11,5],[25,-10],[33,-35],[22,-9],[16,4],[28,14],[16,0],[15,-3],[13,1],[25,12],[30,20],[15,7],[96,21],[9,-2],[7,4],[13,20],[17,36],[13,36],[6,9],[7,2],[6,4],[2,11],[-4,9],[-16,14],[-4,7],[-12,25],[2,10],[13,13],[4,18],[2,16],[-2,17],[-5,19],[-7,7],[-17,3],[-7,5],[-2,9],[2,23],[-1,11],[-10,37],[-7,12],[-9,11],[-13,6],[-16,3],[-16,7],[-9,12],[-5,7],[-5,17],[-3,21],[1,20],[6,18],[8,9],[7,2],[8,0],[8,4],[31,23],[30,8],[62,2],[24,23],[17,-1],[9,-6],[30,-33],[14,-11],[24,-7],[44,4],[29,3],[20,-6],[31,-28],[43,-10],[20,-8],[18,-5],[-4,-21],[-10,-18],[64,-46],[52,-26],[11,-11],[21,31],[0,-11],[1,-10],[3,-10],[4,-8],[-5,-17],[4,-38],[-7,-14],[12,-21],[6,-25],[5,-53],[19,-71],[5,-29],[0,-30],[-6,-31],[-10,-24],[-15,-14],[-21,-2],[-24,6],[-21,12],[-12,14],[-57,-59],[-12,-2],[-5,-4],[-3,-7],[-6,-7],[-32,-19],[-30,-26],[-19,-10],[-71,-7],[-13,-11],[18,-25],[-12,-32],[-5,-27],[3,-26],[14,-25],[-22,-32],[0,-12],[17,-4],[8,-7],[-19,-37],[3,-21],[16,-33],[10,-15],[30,-14],[1,-17],[-8,-17],[-10,-7],[-17,-2],[-10,-6],[-3,-9],[4,-13],[11,-15],[11,-5],[4,-5],[-12,-14],[-16,-12],[-32,-15],[-13,-14],[3,-6],[7,-10],[0,-9],[-15,-4],[-9,1],[-8,5],[-6,6],[-4,8],[-7,0],[-9,-28],[-7,-13],[-8,-9],[-7,0],[-2,6],[-5,14],[0,-15],[-1,-8],[-5,-3],[-10,-3],[-1,-7],[1,-2],[3,0],[4,-2],[-11,-5],[-3,-5],[-1,-9],[8,-16],[-61,-51],[-17,-26],[-10,-39],[-25,-29],[-35,-16],[-42,4],[3,6],[-12,22],[-3,29],[-7,26],[-24,11],[0,10],[16,0],[20,3],[18,5],[8,7],[-8,14],[-17,3],[-18,-5],[-12,-7],[-4,10],[-3,11],[-8,0],[0,-11],[4,-8],[4,-13],[-8,0],[-18,20],[-35,21],[-37,11],[-25,-12],[-19,5],[-61,2],[-13,8],[-13,2],[-80,-7],[-46,10],[-50,17],[-48,8],[-42,-15],[-10,2],[-23,5],[-24,13],[-16,15],[-18,11],[-56,12],[-20,1],[-41,18],[-48,33],[-46,15],[-38,-36],[-8,0],[0,7],[-88,15],[-24,13],[-14,11],[-10,2],[-5,4],[2,17],[5,12],[9,10],[12,6],[13,2],[-21,14],[-15,7],[-92,-1],[-20,-5],[0,-24],[-23,-21],[-14,-8],[-17,-1],[9,-27],[-11,-11],[-20,-2],[-20,0],[-15,-4],[-37,-21],[-18,-4],[-32,-23],[-34,-44],[-36,-30],[-41,17],[-42,-18],[-22,-2],[-21,10],[5,4],[1,1],[2,5],[-39,21],[-24,-22],[-7,-9],[-7,0],[-10,23],[-12,20],[-15,19],[5,18],[-16,7],[-12,11],[-8,16],[-2,20],[-55,10],[-15,5],[-10,-9],[-13,-1],[-13,-5],[-10,-15],[-24,10],[-31,-3],[-27,-14],[-22,-32],[-50,-40],[-17,-9],[14,-11],[8,-14],[-1,-11],[-24,-6],[-4,-5],[-1,-8],[5,-10],[6,-4],[19,2],[10,-3],[-146,-84],[-114,-65],[-42,-10],[-49,3],[-49,13],[-127,65],[-22,6]],[[8600,879],[8,-30],[0,-9],[-17,-1],[-27,-5],[-11,-5],[-14,-9],[-10,-10],[-11,-7],[-14,-3],[-10,-5],[-20,-20],[-13,-5],[-14,6],[-12,14],[-6,14],[4,6],[11,6],[20,27],[8,6],[4,5],[7,20],[4,5],[10,-2],[12,-7],[6,-1],[41,17],[17,3],[30,8],[10,1],[2,-9],[-7,-6],[-8,-4]],[[8858,1433],[-15,-27],[-4,-19],[0,-34],[2,-13],[5,-14],[1,-12],[-7,-11],[-13,-14],[-13,-17],[-6,-22],[-5,-13],[-11,-14],[-10,-17],[-5,-25],[0,-22],[2,-10],[29,-23],[27,-52],[8,-8],[6,-5],[-5,-10],[-8,-10],[-5,-4],[0,-10],[-1,0],[2,-1],[7,-9],[24,-24],[5,-15],[-6,-30],[-29,7],[-29,-12],[-22,-27],[-5,-37],[2,4],[2,4],[4,3],[8,-1],[-6,-12],[-9,-11],[-11,-10],[-13,-7],[7,24],[-8,8],[-16,2],[-14,6],[-11,13],[-7,16],[1,14],[17,7],[0,9],[-8,0],[0,9],[19,6],[1,15],[-12,39],[1,21],[3,12],[1,11],[-5,15],[-9,8],[-30,19],[-8,13],[2,19],[8,20],[11,15],[6,6],[27,17],[9,36],[5,37],[30,36],[8,42],[1,43],[-6,25],[0,10],[16,11],[7,0],[0,-11],[8,0],[6,8],[17,22],[10,8],[8,2],[7,-3],[6,-7],[-4,-19]],[[9293,2025],[-5,-4],[-8,0],[-22,-6],[-16,4],[-21,1],[-21,-6],[-15,7],[-1,20],[10,14],[8,2],[17,3],[19,2],[58,-4],[2,-7],[0,-14],[-5,-12]],[[9413,2101],[-1,-8],[-17,-28],[-6,1],[-4,8],[0,5],[5,5],[2,8],[-4,3],[-10,-6],[-6,1],[4,12],[7,10],[7,5],[13,3],[7,-4],[3,-8],[0,-7]],[[7308,2233],[-9,-20],[-10,3],[-11,10],[-12,7],[-18,-4],[-14,-6],[-14,-4],[-30,6],[-5,0],[-3,1],[-8,10],[-5,10],[-2,10],[6,5],[16,6],[10,12],[10,8],[40,-17],[37,-34],[22,-3]],[[9999,2332],[-16,-21],[12,-65],[-23,-13],[-5,-9],[-7,-50],[-9,-16],[-25,-31],[-5,-18],[-2,-40],[-6,-18],[-10,-7],[-7,-10],[-14,-44],[-6,-14],[-3,1],[-20,0],[-8,-1],[-3,-6],[-2,-10],[-4,-10],[-11,-4],[-27,-70],[10,-7],[9,-6],[9,-3],[11,-2],[-3,-12],[-4,-10],[-7,-9],[-9,-10],[5,-6],[11,-23],[-59,19],[-23,1],[-27,-10],[-51,-33],[-18,-20],[-45,-77],[-33,-45],[-40,-39],[-53,-34],[-47,33],[-7,3],[-3,10],[-20,44],[14,21],[33,101],[7,36],[-4,32],[-11,17],[-16,12],[-27,33],[-2,7],[7,11],[-1,7],[-11,8],[-7,-1],[-6,0],[-8,12],[19,8],[43,32],[27,10],[10,8],[-5,11],[10,9],[2,7],[0,10],[3,13],[7,18],[8,13],[10,23],[6,6],[33,10],[5,5],[9,13],[37,40],[9,16],[10,11],[67,24],[126,70],[17,13],[37,19],[74,-5],[34,45],[9,1],[10,-9],[10,-16],[0,-9]],[[6895,2253],[-11,-29],[-16,-22],[-21,-9],[-23,3],[-52,16],[-21,11],[13,7],[27,-1],[14,4],[11,9],[11,22],[9,8],[-8,38],[-5,14],[-10,8],[0,9],[6,18],[-17,10],[-43,12],[0,10],[5,3],[5,4],[5,2],[41,-13],[38,-29],[31,-38],[13,-38],[-2,-29]],[[9016,2389],[15,-40],[17,-8],[-11,-26],[14,-15],[24,-2],[20,13],[4,-4],[1,-5],[2,-10],[-7,-15],[-12,-13],[-14,-7],[-13,4],[-6,-7],[-10,7],[-14,-2],[-14,17],[-9,24],[6,21],[-15,9],[-13,-4],[-10,-11],[-8,-13],[-8,0],[-6,12],[-14,11],[-3,11],[1,29],[2,14],[4,12],[11,-23],[17,6],[18,17],[16,9],[15,-11]],[[8797,2517],[-15,-1],[-24,4],[-12,10],[-4,15],[13,29],[33,21],[22,1],[10,-13],[12,-28],[-9,-27],[-26,-11]],[[7990,2569],[7,-20],[-7,-8],[-5,-1],[-6,5],[-6,13],[-17,-15],[-15,-6],[-33,2],[-15,-5],[-12,-13],[-16,-32],[-1,-19],[2,-18],[-9,-9],[-27,-3],[-19,8],[-21,39],[-19,11],[3,11],[2,4],[4,5],[-10,17],[-4,21],[6,12],[16,-10],[16,11],[19,-13],[19,-18],[15,-9],[10,5],[11,20],[6,4],[13,-2],[10,-3],[9,0],[11,5],[-15,9],[-6,13],[4,13],[1,4],[-12,4],[-10,8],[-9,8],[0,11],[35,-2],[42,-26],[33,-31]],[[9528,2608],[-8,-20],[10,4],[5,0],[8,-15],[39,31],[2,-5],[1,-1],[1,-1],[3,-3],[-6,-5],[-4,-6],[-2,-6],[-3,-4],[8,6],[3,-2],[0,-8],[-3,-15],[0,-17],[3,-12],[4,-11],[-10,-7],[-5,-2],[5,-3],[5,-4],[3,-6],[2,-7],[-25,-16],[-13,-3],[-16,0],[0,9],[6,3],[10,10],[7,6],[-49,18],[-15,10],[18,13],[-54,0],[7,13],[13,15],[10,15],[1,16],[5,0],[3,2],[7,8],[0,-10],[19,25],[27,15],[22,3],[2,-13],[-32,-10],[-14,-10]],[[6302,2577],[0,-9],[-29,2],[-17,7],[-31,31],[-18,13],[-18,7],[-16,13],[-10,27],[24,1],[7,-1],[90,-59],[18,-32]],[[6489,2660],[-41,-34],[-29,2],[42,89],[13,4],[23,21],[11,4],[44,-1],[-3,-4],[0,-6],[1,-8],[-61,-67]],[[5723,2795],[27,-9],[43,24],[23,6],[15,-21],[-4,-15],[4,-79],[-10,-10],[-22,-11],[-38,-12],[-135,-4],[-43,-17],[-4,21],[9,31],[-5,18],[5,4],[5,8],[6,6],[-11,9],[-5,2],[11,12],[9,25],[11,12],[5,-7],[8,-8],[8,-8],[10,-6],[15,3],[14,-41],[22,-11],[38,0],[12,7],[-3,15],[-11,17],[-9,10],[-16,-9],[-11,9],[-9,17],[-11,12],[0,10],[13,15],[14,-9],[20,-16]],[[5958,2791],[-16,-5],[-17,15],[-24,34],[15,20],[19,-1],[6,-2],[-2,-6],[16,-9],[11,-12],[2,-15],[-10,-19]],[[6794,2758],[11,-23],[-14,-2],[-8,-10],[-1,-14],[7,-13],[0,-9],[-25,-36],[-40,21],[-73,74],[2,3],[2,1],[1,2],[3,4],[-10,-1],[-22,1],[6,13],[6,20],[3,18],[-3,8],[50,40],[14,-19],[19,-35],[14,-15],[20,-11],[20,-7],[18,-10]],[[5869,2917],[7,-3],[7,2],[9,7],[2,-4],[0,-2],[1,-2],[6,-1],[0,-10],[-9,-10],[-31,-58],[-19,-3],[-19,6],[-8,11],[-3,17],[-6,10],[-4,10],[6,17],[9,10],[15,9],[16,5],[14,-5],[7,-6]],[[6860,2898],[-27,-4],[-13,15],[8,16],[19,20],[27,19],[9,0],[-9,-11],[6,-1],[3,-4],[-1,-36],[-22,-14]],[[8815,2880],[-69,-75],[-23,-3],[-29,4],[-26,9],[-14,11],[-63,-31],[-18,-19],[11,-30],[-16,-5],[-7,-15],[1,-20],[7,-19],[-20,4],[-20,16],[-16,20],[-6,14],[3,50],[7,21],[13,-7],[5,8],[13,14],[5,8],[6,-5],[25,-15],[15,16],[9,13],[15,30],[39,35],[7,10],[116,74],[115,19],[17,5],[12,-23],[56,-14],[16,-27],[-36,-21],[-123,-36],[-27,-16]],[[7103,2976],[-21,0],[-26,5],[-26,2],[6,14],[12,7],[14,7],[14,12],[11,-6],[28,-24],[-12,-17]],[[7555,3003],[1,-7],[-2,-1],[-3,0],[-4,-2],[-19,9],[-21,-5],[-18,-6],[-11,2],[-17,-17],[-48,-36],[-16,-7],[-14,-12],[-32,-54],[-15,-12],[-92,-32],[-49,-4],[-18,36],[16,-9],[8,14],[15,12],[17,3],[13,-11],[8,0],[8,8],[10,2],[25,0],[4,5],[16,35],[-13,-7],[-7,8],[-2,12],[2,6],[13,2],[130,68],[0,9],[-7,4],[-4,3],[-4,2],[-9,2],[0,10],[31,9],[13,8],[10,12],[8,0],[15,-20],[18,-17],[22,-14],[22,-8]],[[8784,3088],[5,-12],[-7,-16],[7,-13],[9,-9],[-9,1],[-9,4],[-4,0],[-6,-3],[-16,-1],[-4,3],[-3,7],[-24,27],[0,7],[8,6],[20,2],[4,-2],[5,-4],[3,-2],[8,8],[13,-3]],[[6424,3098],[10,-16],[-16,3],[-22,21],[-19,28],[-5,28],[11,20],[20,18],[22,11],[17,0],[-21,-76],[-11,-24],[8,-6],[6,-7]],[[5955,3221],[26,-23],[11,-6],[9,9],[8,0],[13,-22],[41,-49],[14,-42],[1,-11],[-3,-6],[-16,-8],[-4,-6],[-39,-45],[-16,27],[-20,41],[-11,39],[9,22],[0,10],[-12,10],[-14,24],[-13,5],[1,7],[1,5],[6,9],[-4,1],[-3,0],[-1,2],[0,7],[16,0]],[[8715,3238],[5,-4],[3,0],[-3,-6],[-6,-1],[-5,0],[-9,1],[-6,3],[-6,2],[1,7],[6,3],[10,-2],[10,-3]],[[8569,3211],[11,-19],[15,-9],[12,-10],[1,-22],[9,12],[10,5],[10,0],[9,-6],[4,-17],[-8,-26],[4,-17],[-5,-9],[-2,-5],[-1,-6],[8,0],[0,10],[8,0],[-9,-21],[-18,0],[-35,11],[-5,-9],[-3,-13],[-3,-11],[-8,-6],[-11,3],[-9,5],[-7,1],[-8,-9],[-8,14],[-9,11],[-10,6],[-11,-2],[10,19],[5,6],[7,5],[-6,22],[5,17],[10,16],[7,13],[2,3],[5,8],[3,9],[-2,11],[-10,8],[-9,-2],[-8,-4],[-4,-2],[-9,9],[-5,8],[-10,22],[-8,10],[-8,2],[-4,7],[5,21],[13,-18],[95,-41],[0,-10],[-15,0]],[[7278,3329],[10,-15],[5,-5],[-6,-11],[-9,-8],[-11,0],[-13,9],[-2,-6],[-1,-1],[-1,0],[-4,-4],[-22,41],[19,-1],[14,5],[28,16],[-3,-11],[-4,-9]],[[6659,3329],[-19,-49],[-1,-21],[20,-9],[0,-10],[-16,0],[0,-11],[16,0],[0,-8],[-13,-4],[-6,-9],[-5,-13],[-8,-14],[-8,-10],[-14,-13],[-31,-24],[-18,-5],[-41,2],[-10,5],[-25,21],[-11,5],[-10,7],[0,16],[11,56],[14,17],[35,22],[-8,5],[-7,2],[-8,-2],[16,25],[32,27],[36,21],[32,11],[-16,-25],[9,-10],[30,-5],[16,20],[-3,5],[-5,15],[16,1],[15,-1],[-2,-11],[-4,-11],[-4,-10],[-5,-8]],[[8394,3431],[6,-2],[4,1],[5,-2],[4,-2],[8,-3],[9,-3],[4,-8],[-8,-15],[-2,-13],[11,-5],[12,-8],[6,-18],[2,-10],[7,-7],[10,-18],[0,-15],[-8,-3],[-5,0],[0,-6],[-6,-2],[-9,-2],[-13,2],[-14,9],[0,11],[12,8],[4,10],[-10,1],[-15,-10],[-14,2],[-8,14],[4,12],[3,12],[-12,8],[-12,5],[-8,10],[-14,11],[-4,19],[13,12],[16,-1],[3,3],[0,9],[9,2],[10,-8]],[[7014,3294],[-2,-27],[-11,-59],[-3,-32],[-32,-71],[-5,-5],[-8,-2],[-16,-6],[-40,-40],[-13,-5],[-21,-6],[-12,-8],[-3,9],[-4,2],[-8,8],[-5,11],[-7,29],[-4,10],[-7,9],[-31,20],[5,8],[1,8],[-4,9],[-6,10],[-6,11],[-1,12],[2,9],[1,3],[-17,35],[-13,17],[-15,8],[0,9],[6,6],[5,3],[5,-2],[6,-7],[11,9],[43,50],[73,54],[7,9],[17,31],[8,4],[22,2],[5,4],[8,6],[19,-9],[27,-22],[13,-26],[7,-26],[3,-62]],[[5762,3447],[15,-9],[7,0],[6,8],[5,1],[7,-3],[6,-6],[7,-20],[3,-26],[-1,-28],[-2,-26],[-7,20],[-8,0],[0,-17],[-4,-14],[-8,-10],[-11,-8],[-3,4],[-1,2],[-1,2],[-3,3],[-1,6],[2,2],[3,-1],[4,2],[-10,6],[-10,2],[-9,-2],[-10,-6],[-2,14],[-3,5],[-4,-2],[-6,-8],[-10,6],[-8,0],[-8,-6],[-6,-9],[-4,17],[3,3],[10,9],[-8,8],[0,7],[5,7],[10,8],[-4,11],[2,4],[10,5],[-8,9],[36,25],[19,5]],[[8715,3546],[-10,-4],[-12,9],[1,18],[-1,3],[6,14],[18,-4],[-13,-17],[6,-4],[3,-3],[6,-6],[-4,-6]],[[8306,3612],[5,-4],[6,-12],[21,-7],[11,4],[8,2],[5,-6],[4,-12],[-3,-8],[2,-2],[0,-2],[-1,-3],[-4,-2],[-3,-10],[-5,-5],[-3,6],[-3,4],[-5,0],[-4,-5],[-5,5],[-2,10],[-2,8],[3,-1],[4,1],[-7,6],[-7,-3],[-16,-2],[-4,8],[-10,0],[-8,3],[-4,8],[-1,3],[-3,3],[-3,4],[1,4],[4,6],[8,-5],[2,1],[0,1],[-5,6],[2,7],[11,-1],[11,-10]],[[8113,3690],[14,-6],[11,-8],[7,-8],[2,-5],[6,-9],[2,-14],[-6,-3],[-6,6],[-7,4],[-4,1],[-5,2],[-10,1],[-9,-8],[-5,-11],[-1,-6],[-5,-4],[-6,-1],[5,-10],[13,-16],[3,-49],[-12,-5],[-12,9],[1,9],[-3,7],[-13,5],[-5,13],[6,35],[4,9],[1,10],[-3,13],[-2,19],[3,17],[10,1],[12,-1],[14,3]],[[8291,3728],[3,-3],[6,0],[2,-3],[1,-4],[1,-5],[3,-2],[13,-8],[8,-11],[-8,-5],[-9,-17],[-4,9],[1,11],[-1,0],[-2,0],[-3,-2],[-3,5],[-4,6],[-5,9],[-6,1],[-4,8],[-2,8],[-6,6],[5,5],[3,9],[3,0],[-2,-10],[10,-7]],[[8523,3837],[46,-6],[1,3],[6,2],[8,-3],[11,-10],[2,-3],[5,-3],[7,-8],[-1,-8],[-5,-1],[-12,11],[-4,1],[-7,-14],[-9,-4],[-7,5],[-1,4],[-3,2],[-4,-6],[-1,-7],[-2,-2],[-9,5],[-7,12],[-1,10],[-6,8],[-7,4],[-6,5],[6,3]],[[5744,3766],[15,-21],[-6,-31],[-16,5],[-12,-16],[-7,-25],[-3,-23],[-16,-16],[-20,-22],[-26,-14],[-24,-7],[10,51],[10,24],[19,14],[0,9],[-5,3],[-5,5],[-5,3],[0,9],[9,15],[-2,15],[-12,7],[-19,-7],[8,38],[24,27],[27,21],[19,22],[8,0],[0,-20],[-3,-12],[-8,-20],[-4,-7],[44,-27]],[[6736,3883],[33,-59],[5,3],[4,29],[11,6],[35,-10],[5,-3],[6,-7],[8,-7],[22,-7],[3,-10],[-3,-12],[-6,-13],[-17,-7],[-21,0],[-18,-6],[-6,-27],[-8,0],[-14,2],[-86,-11],[3,11],[-1,5],[-1,2],[-1,6],[3,11],[5,3],[6,0],[2,1],[6,34],[-4,12],[-18,3],[7,22],[13,10],[15,6],[12,13]],[[6302,3729],[-8,-6],[-68,-37],[-17,-12],[0,14],[1,11],[3,8],[4,7],[0,10],[-7,0],[-24,0],[3,13],[5,11],[7,9],[8,7],[-4,2],[-11,7],[21,5],[13,19],[5,25],[0,20],[-7,32],[-1,12],[11,1],[27,-4],[11,-12],[10,-21],[8,-21],[3,-16],[-3,-10],[-11,-14],[-2,-11],[3,-4],[7,-4],[8,-7],[5,-10],[3,-15],[-3,-9]],[[7980,4009],[7,-23],[0,-7],[-7,-13],[-5,-2],[-6,2],[-5,2],[0,7],[-2,5],[-6,3],[-13,2],[-11,-6],[-5,2],[-9,0],[1,4],[10,11],[13,5],[5,0],[16,17],[5,1],[6,-2],[6,-8]],[[6051,4009],[-26,-3],[-52,10],[-14,9],[20,4],[18,8],[12,14],[13,9],[19,1],[10,-8],[-2,-18],[-2,-8],[4,-18]],[[8071,4011],[-10,-8],[-7,-11],[-4,-3],[-5,0],[-6,-3],[-4,-6],[-1,-9],[3,-12],[6,-6],[1,-5],[4,-6],[0,-18],[-4,-9],[-5,-4],[-3,0],[-4,5],[-6,11],[-3,2],[-3,8],[0,11],[-8,8],[1,7],[-4,2],[-2,2],[-1,3],[0,25],[2,6],[1,5],[-3,13],[1,3],[4,1],[8,-3],[3,-7],[1,-8],[4,-10],[6,-1],[6,14],[4,0],[5,1],[3,4],[-1,27],[-3,10],[-9,2],[-6,3],[0,15],[2,8],[8,10],[9,4],[9,-4],[5,-5],[5,-8],[0,-9],[-3,-8],[0,-5],[4,-4],[5,0],[4,-3],[2,-7],[-4,-14],[-7,-14]],[[6437,4088],[5,-8],[18,13],[21,-3],[20,-13],[10,-17],[18,21],[31,-6],[34,-17],[26,-8],[-8,-10],[10,-3],[6,-9],[4,-13],[3,-14],[-27,-39],[-9,-37],[-12,-7],[-52,9],[-32,20],[-19,5],[-11,6],[-14,26],[-13,6],[-12,6],[-38,44],[-43,21],[-13,9],[-7,11],[-8,18],[-3,17],[4,13],[14,4],[63,-4],[5,-2],[11,-7],[0,-11],[-9,0],[0,-10],[12,-1],[8,-4],[7,-6]],[[5637,4140],[32,-44],[-8,-45],[-29,-43],[-33,-37],[-32,-45],[-22,-18],[-20,9],[0,20],[5,72],[-1,12],[-1,27],[13,33],[18,22],[17,-4],[8,10],[7,11],[-12,-1],[-3,1],[0,9],[11,7],[11,4],[9,-2],[7,-9],[8,0],[0,9],[4,1],[5,-1],[6,2]],[[6172,4469],[30,-13],[89,0],[11,-13],[-5,-29],[-18,-48],[47,-39],[-8,-7],[-3,-2],[-5,-1],[1,-19],[-7,-12],[-8,-10],[-1,-9],[8,-9],[18,8],[12,-8],[3,-21],[-10,-26],[-16,-25],[-15,-17],[2,-6],[5,-23],[-7,0],[-9,14],[-26,20],[-12,14],[-21,60],[-6,10],[-17,2],[-13,6],[-12,11],[-12,16],[-18,35],[-13,10],[-19,-11],[-6,40],[-21,26],[-25,21],[-17,22],[-8,0],[-8,-14],[-10,-4],[-4,7],[7,21],[-10,11],[-16,26],[-13,12],[13,4],[1,7],[-4,10],[-3,13],[4,14],[9,9],[63,35],[24,5],[17,-9],[-2,-15],[3,-9],[7,-4],[11,-1],[12,-5],[10,-10],[5,-11],[-4,-5],[-1,-6],[9,-33],[3,-9],[9,-6]]],"transform":{"scale":[0.0008860993521352077,0.0006936160733073309],"translate":[19.379649285000113,34.81500885600012]}};
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
