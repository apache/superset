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
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = {"type":"Topology","objects":{"guy":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Mahaica-Berbice"},"id":"GY.MA","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Potaro-Siparuni"},"id":"GY.PT","arcs":[[5,-2,6,7,8]]},{"type":"Polygon","properties":{"name":"Upper Takutu-Upper Essequibo"},"id":"GY.UT","arcs":[[9,10,-3,-6,11,12,13]]},{"type":"Polygon","properties":{"name":"Upper Demerara-Berbice"},"id":"GY.UD","arcs":[[-1,14,-7]]},{"type":"Polygon","properties":{"name":"Barima-Waini"},"id":"GY.BA","arcs":[[15,16,17]]},{"type":"Polygon","properties":{"name":"Pomeroon-Supenaam"},"id":"GY.PM","arcs":[[18,19,20,-12,-9,21,-17]]},{"type":"Polygon","properties":{"name":"East Berbice-Corentyne"},"id":"GY.EB","arcs":[[22,-10,23,24]]},{"type":"MultiPolygon","properties":{"name":"Demerara-Mahaica"},"id":"GY.DE","arcs":[[[25]],[[-14,26,-24]],[[27]],[[-20,28,29]],[[30]]]},{"type":"Polygon","properties":{"name":"Essequibo Islands-West Demerara"},"id":"GY.ES","arcs":[[-4,-11,-23,31]]},{"type":"Polygon","properties":{"name":"Cuyuni-Mazaruni"},"id":"GY.CU","arcs":[[-29,-19,-16,32]]}]}},"arcs":[[[5890,363],[-1,1],[0,1],[17,80],[17,31],[72,68],[88,59],[22,22],[103,161],[85,85],[74,94],[324,603],[139,180],[26,46],[9,26],[4,28],[1,40],[-22,175],[0,20],[4,19],[5,10],[32,40],[159,144],[7,10],[-7,26],[-128,201],[-214,205],[-22,41],[-12,39],[-5,37],[11,62],[-1,26],[-70,181],[1,31],[-6,30],[-11,20],[-65,89],[-190,187],[-16,22],[-16,29],[-63,175],[-4,23],[-1,18],[15,39],[2,19],[-2,11],[-82,188],[-124,114],[-30,39]],[[6015,4158],[8,29],[82,147],[36,90],[173,202],[22,51]],[[6336,4677],[341,5],[63,9],[36,13],[81,153],[30,85],[33,56],[51,47],[199,148],[100,175],[42,50],[66,58],[49,85],[32,38],[65,45],[12,21],[9,29],[17,130],[109,302],[37,62],[4,11],[-1,12],[-2,12],[-32,19],[-27,5],[-32,23],[-63,90]],[[7555,6360],[7,46],[-9,65],[-11,32],[-34,37],[24,16],[25,8],[18,3],[15,0],[9,-3],[9,-4],[15,-10],[12,-5],[11,-1],[11,2],[9,5],[10,8],[43,50],[10,21],[0,8],[-2,7],[-5,6],[-15,9],[-8,3],[-8,5],[-5,6],[-16,43],[-2,20],[5,18],[8,9],[11,8],[10,4],[11,3],[23,3],[12,0],[69,8],[30,6],[21,8],[10,8],[4,8],[-1,8],[-11,29],[8,25],[11,15],[-3,10]],[[7886,6907],[4,12],[3,15],[0,23],[26,19],[20,8],[8,5],[9,1],[40,-2],[42,-10],[34,-11],[41,-13],[64,-25],[25,-10],[70,-31],[83,-40],[168,-113],[42,-41],[39,-49],[18,-55],[7,-34],[7,-16],[10,-14],[5,-11],[2,-15],[-30,28],[-15,9],[36,-48],[12,-19],[1,-30],[3,-22],[6,-48],[-34,-48],[-9,-25],[-15,-23],[-9,-16],[-1,-28],[-21,-33],[-5,-32],[48,-52],[-4,-73],[-24,-43],[-25,-27],[-23,-31],[-103,-99],[0,-9],[-19,-28],[-6,-22],[-3,-29],[-8,-32],[-21,-21],[-99,-67],[-16,-14],[-7,-15],[8,-13],[18,0],[29,8],[21,-3],[13,0],[6,-3],[3,-95],[4,-11],[10,-7],[18,-4],[18,2],[13,6],[5,9],[-20,16],[-11,13],[4,13],[17,7],[23,1],[20,-4],[9,-9],[2,-2],[14,-23],[67,-55],[16,-27],[-10,-19],[-25,-16],[-32,-12],[-32,-9],[-11,27],[-17,14],[-26,5],[-36,1],[-23,-8],[-13,-19],[-14,-39],[-30,-45],[-7,-16],[-2,-18],[9,-15],[74,-44],[-20,-8],[-17,1],[-16,4],[-18,3],[-28,-3],[-18,-5],[-15,-5],[-22,-6],[-51,-9],[-161,-11],[-34,-7],[-27,-2],[-13,5],[-31,20],[-11,4],[-52,-2],[-47,-5],[-89,-22],[-80,24],[-77,-3],[-68,-23],[-55,-35],[-30,-38],[-24,-13],[-50,-4],[-25,3],[-20,7],[-19,3],[-26,-4],[-15,-9],[-42,-46],[-27,-23],[-37,-27],[-33,-31],[-14,-45],[16,-19],[34,-11],[33,-15],[27,-56],[55,-47],[17,-24],[-3,-25],[-16,-24],[-37,-35],[-32,-69],[-34,-38],[-38,-61],[-15,-44],[-19,-18],[-23,-18],[-20,-20],[-8,-25],[6,-22],[11,-20],[6,-23],[-5,-34],[-13,-27],[-22,-23],[-177,-120],[-29,-29],[-3,-28],[25,-59],[27,-115],[20,-48],[49,-41],[134,-70],[33,-26],[103,-101],[44,-62],[8,-26],[6,-61],[12,-29],[23,-25],[34,-14],[99,-28],[78,-33],[7,-10],[10,-23],[16,-20],[2,-5],[3,-5],[9,-7],[10,-3],[22,-1],[4,-5],[8,-2],[42,-17],[34,-25],[-3,-24],[-31,-40],[0,-8],[4,-17],[-1,-9],[-10,-25],[-1,-11],[4,-14],[9,-16],[7,-7],[10,-6],[17,-5],[57,-8],[34,-12],[1,0],[63,-24],[22,-4],[19,2],[20,26],[26,-3],[26,-10],[12,-6],[16,-1],[16,-2],[12,-4],[5,-7],[7,-6],[15,6],[15,9],[5,5],[57,10],[14,12],[-2,24],[64,-18],[55,-12],[54,7],[64,33],[51,-69],[6,-19],[-4,-47],[-3,-9],[-17,-17],[4,-11],[13,-11],[7,-16],[-2,-16],[-11,-28],[-2,-17],[5,-15],[21,-31],[-5,-17],[-13,-10],[-4,-9],[22,-11],[21,-3],[20,5],[18,8],[14,8],[3,-4],[1,-1],[1,-1],[7,-2],[-31,-40],[19,-25],[35,-21],[19,-30],[2,-11],[10,-17],[2,-10],[-7,-6],[-28,1],[-7,-5],[4,-16],[6,-12],[1,-10],[-11,-13],[-17,-18],[26,-10],[68,-4],[10,-20],[-22,-19],[-32,-17],[-19,-14],[27,-70],[8,-14],[17,-6],[6,-12],[9,-13],[25,-6],[19,3],[40,13],[24,3],[15,-9],[-35,-49],[13,-26],[7,3],[69,7],[20,-6],[-5,-15],[-14,-17],[-8,-13],[11,-18],[53,-37],[20,-25],[12,-53],[16,-8],[42,15],[14,-17],[-5,-16],[-10,-18],[1,-23],[10,-12],[52,-40],[3,-10],[-10,-45],[13,-13],[28,7],[42,20],[17,-13],[-3,-14],[-10,-15],[-4,-14],[7,-18],[9,-12],[34,-21],[10,-13],[-4,-14],[-13,-20],[16,-24],[72,-43],[23,-30],[-1,-49],[9,-12],[19,-6],[46,-6],[19,-6],[25,-27],[20,-60],[16,-29],[15,-41],[196,-185],[55,-15],[200,-2],[76,-27],[12,-11],[14,-9],[17,-7],[43,-9],[18,-10],[12,-13],[7,-16],[-95,-24],[-62,-23],[-32,-2],[-31,10],[-29,16],[-33,14],[-39,3],[-34,-10],[-27,-13],[-29,-11],[-41,1],[-41,5],[-27,-5],[-88,-46],[-25,-7],[-27,0],[-145,16],[-27,6],[-33,18],[-13,13],[-17,7],[-44,0],[-68,-5],[-33,1],[-37,5],[-53,19],[-38,21],[-24,28],[-13,38],[-62,33],[-98,-26],[-174,-73],[-41,6],[-74,30],[-50,3],[-45,-11],[-30,-18],[-25,-22],[-32,-19],[-43,-15],[-29,-7],[-20,-12],[-50,-90],[-22,-25],[-135,-114],[-61,-30],[-95,-17],[-62,-1],[-172,21],[-73,3],[-65,-12],[-164,-48],[-69,-28],[-34,-9],[-35,2],[-61,16],[-32,3],[-12,-10],[2,-21],[12,-42],[-6,-23],[-14,-25],[-35,-44],[-33,-26],[-85,-11],[-96,2],[-66,12],[-14,11],[-15,30],[-16,13],[-34,12],[-21,-2],[-19,-9],[-26,-5],[-38,1],[-45,5],[-43,8],[-35,12],[-15,10],[-20,22],[-9,3],[-23,-10],[-14,-18],[-11,-20],[-15,-17],[-18,-8],[-46,-13],[-15,-9],[-3,-14],[12,-28],[-1,-13],[-55,-25],[-26,-3],[-148,-17],[-5,-5]],[[5192,5736],[-29,-8],[-15,-28],[-18,-22],[-7,-14],[-3,-15],[1,-12],[-2,-11],[-9,-10],[95,-95],[23,-16],[13,-21],[-2,-98],[-50,-195],[4,-56],[50,-86],[52,-193],[27,-23],[93,18],[29,-21],[30,-58],[49,-45],[38,-14],[88,-18],[21,-8],[14,-7],[29,-11],[42,-9],[95,-11],[307,2],[149,23],[30,3]],[[6015,4158],[-156,44],[-32,5],[-16,1],[-17,0],[-32,-3],[-17,-3],[-51,-15],[-42,-18],[-29,-15],[-31,-24],[-41,-46],[-11,-10],[-273,-161],[-38,-32],[-55,-39],[-32,-16],[-14,-6],[-9,-2],[-22,-2],[-68,1],[-29,5],[-14,7],[-18,10],[-139,120],[-12,14],[-7,14],[-11,35],[-19,31],[-7,6],[-10,6],[-15,3],[-11,2],[-14,-1],[-13,-2],[-15,-3],[-91,-30],[-14,-3],[-15,-3],[-14,0],[-44,5],[-28,0],[-120,-13],[-276,7],[-29,4],[-30,8],[-67,21],[-16,7],[-15,9],[-15,12],[-7,13],[0,13],[10,17],[11,12],[25,20],[8,11],[1,13],[-15,58],[-3,58],[8,26],[10,19],[12,9],[9,10],[0,16],[-8,23],[-29,45],[-9,22],[-17,23],[-44,11],[-43,-8],[-16,-5],[-16,-5],[-16,-8],[-17,-10],[-21,-17],[-12,-12],[-66,-89],[-10,-9],[-12,-9],[-16,-7],[-20,-6],[-41,-4],[-75,5],[-24,-2]],[[3478,4321],[1,13],[-8,4],[-23,2],[-24,5],[-18,11],[-15,14],[-16,11],[-119,44],[-27,24],[-17,-12],[-17,-3],[-44,7],[-9,1],[-22,0],[-9,2],[-8,8],[5,17],[-8,5],[-26,0],[-40,-12],[-19,-2],[-11,7],[-29,26],[-18,7],[-20,3],[-24,1],[-20,-4],[-9,-11],[-11,-9],[-25,3],[-49,11],[-39,-4],[-32,-6],[-21,3],[-11,25],[-11,10],[-22,8],[-22,0],[-11,-11],[-5,-15],[-11,-6],[-18,0],[-25,4],[-32,11],[-23,20],[-10,25],[7,26],[54,38],[18,2],[41,0],[18,5],[19,12],[7,13],[2,13],[5,16],[11,16],[58,56],[17,22],[12,24],[5,26],[-9,58],[29,61],[5,81],[14,40],[15,25],[7,25],[2,52],[36,82],[-3,39],[-57,19],[-90,34],[-42,21],[-26,20]],[[2661,5384],[17,9],[40,29],[96,49],[28,18],[17,14],[9,18],[37,52],[19,41],[24,31],[18,17],[20,11],[22,8],[133,28],[14,1],[14,1],[89,-4],[65,8],[31,0],[185,-25],[32,0],[117,7],[22,26],[-15,112],[-16,50],[0,16],[7,12],[11,9],[58,36],[86,39],[12,4],[9,1],[12,0],[152,-31],[31,-3],[30,-1],[14,0],[19,3],[22,5],[34,13],[18,10],[11,11],[28,33],[38,32],[23,16],[20,12],[74,27],[16,4],[20,2],[16,-1],[15,-5],[15,-8],[14,-9],[43,-39],[39,-25],[9,-9],[30,-38],[10,-10],[13,-9],[28,-17],[10,-8],[3,-10],[-4,-51],[2,-10],[8,-9],[16,-7],[28,-5],[19,1],[17,4],[75,22],[20,0],[16,-3],[10,-6],[53,-46],[15,-8],[15,-6],[15,-3],[91,-3],[22,-3],[16,-3],[14,-4],[13,-7],[10,-9],[52,-55]],[[6352,6673],[53,-15],[11,0],[16,2],[36,11],[76,15],[69,-41],[13,-4],[30,-3]],[[6656,6638],[22,-44],[1,-24],[-25,-55],[22,-24],[29,-9],[138,-30],[65,-8],[16,-1],[86,-9],[9,-9],[14,-23],[23,-14],[38,-35],[14,-5],[17,-2],[20,1],[28,-1],[19,-8],[36,-24],[16,-2],[15,3],[12,8],[11,9],[17,6],[23,5],[92,-4],[16,3],[47,12],[14,2],[42,-1],[22,5]],[[5192,5736],[83,2],[177,19],[49,10],[35,24],[46,59],[37,56],[24,55],[12,58],[-2,93],[14,87],[-8,86],[8,30],[50,72],[27,25],[6,33],[0,111],[-6,14],[-22,33],[-1,28],[29,181],[-6,13],[-11,12],[-8,11],[4,11],[11,9],[6,12],[3,12],[1,12],[-7,24],[-48,65],[-5,26],[0,61],[-4,15]],[[5686,7095],[24,0],[-16,9],[34,54],[0,2]],[[5728,7160],[44,-18],[114,-118],[26,-19],[21,-13],[82,-35],[79,-59],[25,-32],[12,-22],[4,-14],[2,-12],[0,-9],[2,-8],[34,-76],[0,-8],[-3,-11],[7,-4],[11,-1],[90,-3],[22,-5],[16,-5],[36,-15]],[[5890,363],[-25,-20],[14,-28],[38,-53],[13,-28],[2,-33],[-14,-24],[-63,-67],[-17,0],[-16,6],[-16,4],[0,3],[-8,5],[-11,6],[-10,3],[-9,-2],[-26,-14],[-13,-3],[-207,13],[-31,-2],[-23,-12],[-57,-54],[-32,-23],[-39,-19],[-49,-13],[-41,-6],[-36,-2],[-37,4],[-41,11],[-52,28],[-18,28],[-10,30],[-33,32],[-37,21],[-42,15],[-11,3],[-80,20],[-339,40],[-131,28],[-36,13],[-25,23],[-44,65],[-17,15],[-37,14],[-9,24],[-4,25],[-24,21],[-18,1],[-42,-7],[-24,4],[-8,6],[-14,21],[-8,8],[-10,4],[-25,1],[-10,3],[-18,15],[-40,47],[-19,14],[-64,34],[-34,29],[-57,62],[-42,23],[-43,9],[-37,-3],[-35,-6],[-41,-2],[-23,4],[-21,7],[-19,10],[-44,31],[-4,11],[33,30],[43,55],[-2,16],[-6,2],[-13,-2],[-25,4],[-76,20],[-24,1],[-41,-10],[-25,1],[-19,14],[-9,28],[-4,30],[2,22],[7,15],[25,26],[10,15],[2,12],[-5,35],[3,12],[12,22],[1,12],[-6,14],[-23,29],[-3,18],[6,14],[23,24],[7,13],[-1,14],[-19,40],[-1,51],[11,53],[-3,46],[-44,33],[-18,3],[-40,1],[-19,2],[-25,9],[-63,36],[-81,28],[-38,18],[-21,26],[3,12],[21,23],[-1,15],[-4,14],[-2,30],[-4,15],[-59,88],[-7,26],[0,17],[-3,10],[-17,23],[-8,5],[-26,7],[-10,5],[1,4],[10,17],[1,7],[-64,83],[-8,27],[13,221],[42,111],[6,29],[-8,78],[10,34],[20,32],[54,59],[11,6],[14,3],[12,4],[6,9],[-2,10],[-15,14],[-3,8],[7,4],[25,3],[5,5],[-4,9],[-17,12],[-6,9],[0,18],[11,10],[14,9],[14,12],[27,62],[9,13],[53,58],[22,46],[6,1],[13,1],[14,2],[10,6],[2,10],[-13,18],[-3,9],[9,65],[-35,-8],[6,23],[35,57],[-17,34],[-37,28],[-31,30],[0,40],[52,37],[167,39],[77,48],[46,13],[18,10],[12,15],[1,12],[-2,12],[1,16],[17,34],[26,17],[83,25],[40,21],[7,19],[-9,23],[-6,30],[13,28],[29,31],[38,26],[38,10],[20,2],[11,7],[3,10],[-3,13],[-15,12],[-24,5],[-65,7],[-19,0],[-13,5],[2,35],[-9,8],[-12,7],[-29,34],[-69,43],[-19,21],[6,32],[23,22],[5,20],[-43,22],[-87,19],[-34,16],[-23,36],[-4,15],[-1,11],[6,24],[5,8],[18,16],[4,9],[-4,9],[-21,16],[-3,6],[21,25],[70,48],[13,32],[0,10]],[[5322,8788],[-99,-82],[-78,-48],[-43,-18],[-248,-68],[-30,-11],[-121,-84],[-23,-20],[-13,-16],[1,-10],[4,-10],[7,-10],[38,-39],[8,-11],[6,-10],[1,-11],[-3,-13],[-15,-11],[-52,-27],[-16,-12],[-12,-12],[-113,-229],[-4,-19],[-2,-19],[4,-19],[41,-99],[2,-15]],[[4562,7865],[-110,32],[-91,14],[-16,1],[-15,-1],[-23,-6],[-11,-7],[-8,-6],[-3,-7],[-8,-25],[-6,-6],[-25,-11],[-43,-24],[-22,0],[-30,3],[-122,27],[-29,16],[-14,5],[-14,2],[-58,-3],[-16,5],[-12,5],[-168,116],[-14,7],[-13,4],[-212,34],[-295,107],[-20,1],[-29,-2],[-61,-11],[-25,-8],[-15,-8],[-2,-8],[-9,-17],[-10,-10],[-27,-17],[-12,-9],[-19,-19],[-13,-8],[-14,-7],[-17,-2],[-20,1],[-81,19],[-32,-3],[-17,-7],[-12,-7],[-7,-8],[-10,-9],[-14,-9],[-14,-9],[-14,-6],[-12,-4],[-15,-2],[-72,13],[-63,19],[-37,5],[-22,1],[-28,-6],[-16,2],[-16,6],[-47,30],[-63,25],[-73,18],[-34,7],[-35,-1],[-24,-4]],[[2133,8093],[-24,18],[-24,9],[-27,1],[-33,-3],[-29,0],[-23,8],[-21,9],[-25,6],[-52,1],[-44,-11],[-33,-21],[-45,-54],[-26,0],[-142,75],[-22,14],[-30,40],[-1,41],[26,36],[49,30],[9,10],[5,10],[0,10],[-4,12],[-18,18],[-23,38],[-14,17],[-15,8],[-18,4],[-16,7],[-9,13],[1,12],[2,8],[-1,8],[-8,10],[-28,13],[-28,4],[-26,7],[-47,57],[-12,20],[-2,21],[29,35],[92,20],[32,26],[28,34],[20,19],[14,7],[29,-4],[19,10],[8,17],[-5,20],[31,37],[1,14],[-7,26],[1,12],[10,13],[46,36],[40,50],[29,18],[46,10],[172,-2],[89,6],[50,25],[16,31],[45,27],[98,45],[8,4],[30,18],[21,22],[24,18],[98,26],[35,19],[33,22],[42,21],[43,9],[81,-5],[44,2],[34,13],[21,24],[17,54],[24,21],[3,15],[-6,16],[0,20],[15,21],[52,27],[22,16],[35,11],[102,15],[42,2],[42,9],[39,24],[26,30],[2,27],[-82,88],[-211,157],[-125,122],[40,-12],[67,-29],[73,-49],[116,-117],[77,-49],[57,-20],[100,-18],[51,-17],[111,-54],[59,-21],[60,-8],[19,-21],[3,-3],[3,-10],[8,-3],[13,1],[114,-16],[15,-9],[27,-22],[182,-103],[-47,50],[-71,46],[-86,38],[-152,41],[-188,86],[-123,44],[-17,15],[-25,38],[5,17],[48,5],[34,-9],[72,-38],[83,-17],[40,-18],[65,-37],[134,-53],[186,-56],[216,-103],[372,-146],[123,-61],[30,-19],[29,-26],[110,-67],[278,-207],[105,-55],[59,-57],[48,-42]],[[4562,7865],[-1,-28],[-40,-86],[-4,-23],[6,-16],[15,-6],[14,-3],[50,-7],[11,-4],[23,-10],[11,-3],[74,-18],[24,-3],[27,-1],[13,1],[12,1],[11,2],[12,5],[37,26],[13,6],[23,2],[54,-12],[20,-21],[2,-8],[8,-55],[12,-17],[16,-12],[18,-6],[36,-8],[31,-1],[12,1],[12,2],[24,5],[17,3],[17,0],[10,-12],[1,-11],[32,-50]],[[5215,7498],[33,-39],[6,-22],[-11,-76],[-9,-30],[-6,-47],[8,-15],[9,-9],[12,-3],[25,-2],[102,-4],[23,-3],[20,-6],[122,-42],[18,-5],[17,0],[9,4],[16,3],[10,0],[32,-9],[4,-1]],[[5655,7192],[-6,-16],[-135,-128],[8,-3],[6,-5],[62,38],[21,8],[6,6],[6,7],[8,5],[27,-8],[18,-2],[10,1]],[[2661,5384],[-5,4],[-65,100],[-17,15],[-92,-22],[-29,18],[-19,32],[-27,5],[-85,-15],[-37,-12],[-82,-55],[-39,-18],[-45,-1],[-89,21],[-43,-2],[-15,-8],[-24,-27],[-20,-9],[-15,0],[-14,7],[-14,10],[-15,7],[-40,5],[-115,-11],[-30,3],[-22,7],[-21,8],[-25,7],[-24,4],[-121,5],[-45,-1],[-91,-14],[-156,113],[-155,113],[-154,113],[-154,114],[-154,113],[-154,113],[-154,113],[-155,114],[-65,48],[-35,55],[21,15],[68,25],[30,16],[96,100],[25,44],[19,19],[27,10],[68,8],[33,7],[24,10],[20,18],[22,34],[26,16],[28,3],[30,-3],[23,5],[6,21],[1,19],[10,51],[-3,14],[-7,4],[-7,3],[-5,9],[-11,10],[-35,15],[-11,12],[-15,38],[-3,15],[12,65],[10,19],[18,16],[4,12],[1,11],[-2,11],[-6,11],[-22,20],[-20,41],[-16,20],[-31,19],[-28,11],[-19,13],[-5,28],[14,47],[30,50],[40,48],[64,49],[19,15],[38,5],[45,-2],[38,-8],[19,25],[43,-4],[43,-9],[38,19],[92,-8],[43,4],[11,6],[55,38],[4,6],[0,11],[-4,13],[-20,19],[-5,15],[12,5],[27,-1],[45,-8],[13,-7],[15,-9],[18,-9],[24,-5],[19,1],[47,7],[24,2],[42,-7],[74,-32],[31,-7],[43,10],[33,23],[57,55],[33,18],[39,11],[146,23],[260,107],[55,9],[34,-13],[19,67],[17,22],[30,18],[35,15],[29,15],[20,19],[16,23],[8,24],[-1,23],[-16,21],[-26,16],[-71,26],[-1,1]],[[7085,7496],[0,-2],[2,-75],[7,-18],[12,-19],[17,-21],[6,-12],[3,-12],[-6,-36],[2,-9],[7,-9],[15,-17],[-1,-7],[-18,-7],[-15,0],[-16,1],[-14,2],[-14,1],[-14,0],[-12,-4],[-10,-7],[-1,-13],[3,-10],[17,-31],[1,-9],[0,-10],[-3,-10],[-5,-10],[-9,-10],[-17,-9],[-15,-2],[-60,-5],[-27,-5],[-9,-3],[-9,-4],[-14,-11],[-42,-42],[-19,-13],[-17,-8],[-14,-5],[-14,-7],[-17,-14],[-16,-17],[-107,-186],[-6,-16],[-3,-21],[4,-71],[19,-65]],[[6352,6673],[33,35],[2,18],[-6,14],[-20,33],[-6,14],[-4,6],[-16,18],[-12,19],[0,9],[3,8],[5,6],[17,17],[13,20],[8,21],[1,12],[-3,9],[-5,6],[-20,15],[-24,14],[-8,7],[-8,11],[-11,23],[-3,13],[0,11],[3,8],[3,8],[20,29],[6,14],[0,9],[-2,9],[-13,21],[-12,26],[1,10],[3,8],[5,6],[25,20],[68,46],[4,2],[3,2],[17,15],[107,139],[23,38],[0,10],[-2,8],[-14,28],[-7,23],[-4,22],[2,12],[5,16],[5,10],[23,61],[0,3]],[[6557,7635],[8,-2],[8,6],[7,16],[18,3],[174,-14],[127,-41],[40,-22],[61,-30],[76,-50],[9,-5]],[[5776,7530],[-17,-30],[-14,8],[-3,21],[12,38],[10,39],[15,29],[43,52],[26,12],[41,18],[28,4],[5,-12],[-19,-21],[-29,-24],[-48,-58],[-41,-39],[-9,-37]],[[5728,7160],[8,176],[21,57],[214,251],[55,49],[74,35],[89,15],[86,-3],[78,-16],[122,-43],[40,-24],[10,-4],[6,-5],[17,-10],[9,-3]],[[6013,7757],[-40,-29],[-6,23],[13,30],[21,28],[31,15],[19,19],[7,5],[19,2],[63,-2],[92,-9],[-3,-6],[-114,-56],[-102,-20]],[[5215,7498],[87,37],[64,21],[15,7],[17,10],[60,62],[16,11],[21,9],[37,7],[25,1],[19,2],[14,6],[10,13],[6,12],[15,66],[17,17],[38,19],[139,50],[38,8]],[[5853,7856],[-32,-17],[-31,-25],[-22,-27],[-14,-28],[-11,-52],[-49,-81],[-4,-29],[4,-89],[-4,-14],[-19,-17],[-4,-15],[0,-241],[-12,-29]],[[5941,7780],[-28,-29],[-24,2],[7,22],[31,38],[27,36],[26,33],[19,35],[29,1],[26,-12],[22,-15],[-22,-15],[-41,-15],[-33,-25],[-31,-36],[-8,-20]],[[7085,7496],[45,-22],[110,-69],[65,-44],[18,-20],[37,-11],[45,-30],[116,-63],[65,-35],[43,-24],[27,-20],[31,-20],[40,-29],[42,-67],[62,-96],[22,-19],[6,-26],[10,-11],[17,17]],[[5322,8788],[4,-4],[50,-68],[34,-32],[7,8],[-20,34],[4,15],[28,-2],[50,-11],[43,-24],[39,-24],[34,-28],[33,-33],[43,-46],[51,-42],[32,-30],[160,-105],[37,-42],[15,-45],[-20,-43],[14,10],[-11,-59],[11,-174],[-36,-142],[-26,-22],[-45,-23]]],"transform":{"scale":[0.0004915385336533662,0.0007372927239723939],"translate":[-61.39671280899995,1.185820211000092]}};
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
