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
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = {"type":"Topology","objects":{"hun":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Vas"},"id":"HU.VA","arcs":[[0,1,2,3],[4]]},{"type":"Polygon","properties":{"name":"Baranya"},"id":"HU.BA","arcs":[[5,6,7,8],[9]]},{"type":"Polygon","properties":{"name":"Gyor-Moson-Sopron"},"id":"HU.GS","arcs":[[10,11,-4,12,13,14],[15]]},{"type":"Polygon","properties":{"name":"Somogy"},"id":"HU.SO","arcs":[[16,17,-8,18,19,20,21,22],[23]]},{"type":"Polygon","properties":{"name":"Veszprém"},"id":"HU.VE","arcs":[[24,25,-23,26,-1,-12],[27]]},{"type":"Polygon","properties":{"name":"Zala"},"id":"HU.ZA","arcs":[[-22,28,-20,29,-2,-27],[30]]},{"type":"Polygon","properties":{"name":"Budapest"},"id":"HU.BU","arcs":[[31,32]]},{"type":"Polygon","properties":{"name":"Bács-Kiskun"},"id":"HU.BK","arcs":[[33,34,35,36,37,-6,38,39,40,41]]},{"type":"Polygon","properties":{"name":"Fejér"},"id":"HU.FE","arcs":[[42,43,-41,44,45,-17,-26,46,47,48,49],[50]]},{"type":"Polygon","properties":{"name":"Komárom-Esztergom"},"id":"HU.KE","arcs":[[-49,51,-47,-25,-11,52,53]]},{"type":"Polygon","properties":{"name":"Pest"},"id":"HU.PE","arcs":[[54,55,56,57,-35,58,-42,-44,59,-33,60,-50,-54,61,62]]},{"type":"Polygon","properties":{"name":"Tolna"},"id":"HU.TO","arcs":[[-9,-18,-46,-39],[63]]},{"type":"Polygon","properties":{"name":"Nógrád"},"id":"HU.NO","arcs":[[64,65,66,67,-63,68]]},{"type":"Polygon","properties":{"name":"Borsod-Abaúj-Zemplén"},"id":"HU.BZ","arcs":[[69,70,71,72,73,74,75,76,-67,77]]},{"type":"Polygon","properties":{"name":"Szabolcs-Szatmár-Bereg"},"id":"HU.SZ","arcs":[[78,-70,79],[80]]},{"type":"Polygon","properties":{"name":"Békés"},"id":"HU.BE","arcs":[[81,82,83,84,85,86],[87]]},{"type":"MultiPolygon","properties":{"name":"Csongrád"},"id":"HU.CS","arcs":[[[88,89,90,-83]],[[91,92,93,-37,94,-85]]]},{"type":"Polygon","properties":{"name":"Hajdú-Bihar"},"id":"HU.HB","arcs":[[95,-87,96,-71,-79],[97]]},{"type":"Polygon","properties":{"name":"Heves"},"id":"HU.HE","arcs":[[98,-75,99,-73,100,-55,-68,-77]]},{"type":"Polygon","properties":{"name":"Jász-Nagykun-Szolnok"},"id":"HU.JN","arcs":[[-86,-95,-36,-58,101,-56,-101,-72,-97]]},{"type":"Polygon","properties":{"name":"Szombathely"},"id":"HU.SH","arcs":[[-5]]},{"type":"Polygon","properties":{"name":"Sopron"},"id":"HU.SN","arcs":[[-14,102]]},{"type":"Polygon","properties":{"name":"Gyôr"},"id":"HU.GY","arcs":[[-16]]},{"type":"Polygon","properties":{"name":"Tatabánya"},"id":"HU.TB","arcs":[[-48,-52]]},{"type":"Polygon","properties":{"name":"Érd"},"id":"HU.ED","arcs":[[-32,-60,-43,-61]]},{"type":"Polygon","properties":{"name":"Székesfehérvár"},"id":"HU.SF","arcs":[[-51]]},{"type":"Polygon","properties":{"name":"Veszprém"},"id":"HU.VM","arcs":[[-28]]},{"type":"Polygon","properties":{"name":"Zalaegerszeg"},"id":"HU.ZE","arcs":[[-31]]},{"type":"Polygon","properties":{"name":"Nagykanizsa"},"id":"HU.NK","arcs":[[-21,-29]]},{"type":"Polygon","properties":{"name":"Kaposvár"},"id":"HU.KV","arcs":[[-24]]},{"type":"Polygon","properties":{"name":"Pécs"},"id":"HU.PS","arcs":[[-10]]},{"type":"Polygon","properties":{"name":"Szekszárd"},"id":"HU.SS","arcs":[[-64]]},{"type":"Polygon","properties":{"name":"Kecskemét"},"id":"HU.KM","arcs":[[-59,-34]]},{"type":"Polygon","properties":{"name":"Szeged"},"id":"HU.SD","arcs":[[103,-90,104,-93]]},{"type":"Polygon","properties":{"name":"Hódmezôvásárhely"},"id":"HU.HV","arcs":[[-84,-91,-104,-92]]},{"type":"Polygon","properties":{"name":"Szolnok"},"id":"HU.SK","arcs":[[-57,-102]]},{"type":"Polygon","properties":{"name":"Békéscsaba"},"id":"HU.MC","arcs":[[-88]]},{"type":"Polygon","properties":{"name":"Eger"},"id":"HU.EG","arcs":[[-74,-100]]},{"type":"Polygon","properties":{"name":"Salgótarján"},"id":"HU.ST","arcs":[[-65,105]]},{"type":"Polygon","properties":{"name":"Miskolc"},"id":"HU.MI","arcs":[[-99,-76]]},{"type":"Polygon","properties":{"name":"Nyíregyháza"},"id":"HU.NY","arcs":[[-81]]},{"type":"Polygon","properties":{"name":"Debrecen"},"id":"HU.DE","arcs":[[-98]]},{"type":"Polygon","properties":{"name":"Dunaújváros"},"id":"HU.DU","arcs":[[-40,-45]]}]}},"arcs":[[[1633,5859],[66,-133],[82,-94],[-98,-72],[-12,-21],[0,-52],[-11,-41],[-19,-30],[-17,-88],[12,-100],[-6,-170],[30,-370],[-180,-72]],[[1480,4616],[-41,-93],[-17,6],[-16,-4],[-10,19],[-5,28],[-35,1],[-20,-50],[6,-44],[-12,-38],[-61,-60],[-68,-25],[-36,9],[-68,-24],[-17,-66],[-28,-2],[-32,18],[-52,-60],[-147,-15],[-56,-44],[-24,-65],[-18,-84],[-26,-65],[-67,-102],[-30,-93],[-62,-68],[-70,0],[13,-123],[-71,-180],[-9,-15]],[[401,3377],[-1,1],[-12,8],[0,60],[-20,-6],[-14,27],[-13,40],[-17,36],[-20,102],[-3,13],[2,13],[4,26],[13,37],[6,16],[10,40],[8,43],[3,32],[-6,18],[-22,2],[-13,11],[-6,14],[-23,45],[-15,14],[-136,-19],[-65,-9],[-8,3],[-53,21],[24,18],[19,30],[53,120],[17,29],[38,46],[30,21],[10,13],[10,26],[1,21],[-1,20],[4,21],[15,21],[14,6],[12,16],[7,54],[14,39],[20,4],[55,-18],[60,12],[31,-6],[25,-32],[8,-9],[8,-4],[7,3],[7,10],[24,8],[38,0],[28,11],[-6,39],[-21,32],[-21,11],[-43,9],[19,27],[66,44],[16,17],[6,20],[-5,18],[-17,14],[-30,17],[-11,46],[10,52],[31,32],[33,72],[7,42],[-18,43],[-24,4],[-50,-40],[-19,22],[0,19],[12,61],[0,31],[-10,23],[-13,1],[-11,-1],[-9,12],[-5,59],[22,77],[-5,62],[46,41],[21,31],[10,47],[-6,58],[-45,153],[-4,8],[-6,4],[-7,5],[-4,14],[1,21],[6,9],[8,7],[3,10],[-4,136],[15,44],[18,9],[20,-23],[18,-46],[158,117],[56,71]],[[786,6026],[3,-6],[18,-37],[20,-26],[77,-28],[40,-66],[42,14],[111,113],[36,-49],[120,-34],[158,149],[37,-17],[-15,-72],[-13,-92],[140,121],[39,-46],[34,-91]],[[700,5423],[-17,23],[-38,0],[-6,-42],[16,-88],[17,-124],[32,-159],[44,-61],[41,65],[34,-8],[41,-15],[4,110],[11,79],[9,95],[-31,170],[-24,-4],[-38,15],[-95,-56]],[[3968,1267],[27,5],[26,-8],[10,-38],[-1,-49],[24,-86],[2,-85],[10,-52],[-11,-75],[-20,-68],[-11,-108],[-33,-71],[30,-51],[1,0]],[[4022,581],[-7,-1],[-19,29],[-15,-37],[-7,-33],[-6,-24],[-15,-15],[-18,4],[-59,51],[-73,43],[-27,-10],[-34,-56],[-5,-17],[-4,-43],[-4,-22],[-3,-1],[-21,-41],[-33,-105],[-17,-37],[-64,-91],[-38,-24],[-33,26],[-24,-27],[-52,-107],[-28,-36],[-11,-5],[-10,-2],[-10,2],[-9,4],[-1,1],[-24,53],[-24,0],[-24,-22],[-25,-17],[-26,16],[-25,46],[-34,1],[-45,57],[-27,15],[-122,0],[-12,-7],[-26,-31],[-16,-11],[-17,0],[-155,73],[-102,0],[-24,0],[-14,-13],[-7,-28],[-8,-25],[-18,-7],[0,15],[-29,84],[-43,52],[-179,93],[-34,4],[-12,13],[-3,24]],[[2300,392],[40,-6],[35,31],[5,102],[-24,73],[-43,64],[-31,84],[-17,107],[23,71],[-43,217],[87,75],[26,111],[-4,217],[43,82],[68,41],[72,4],[45,59],[136,297],[169,34],[28,54],[10,77],[28,41]],[[2953,2227],[38,-19],[38,-4],[29,63],[25,76],[174,27],[44,-13],[7,-46],[-4,-57],[56,-108],[28,-125],[23,-303],[57,69],[26,48],[36,11],[74,-118],[28,-1],[30,32],[24,-45],[38,-135],[45,-115],[47,-90],[73,-68],[79,-39]],[[3219,1453],[-58,21],[-61,11],[-60,-70],[-31,-64],[-15,-141],[26,-74],[-22,-85],[49,-53],[57,-95],[53,-42],[40,42],[26,74],[18,85],[26,74],[27,0],[48,-21],[14,42],[-23,138],[-52,222],[-62,-64]],[[2638,7111],[4,-47],[12,-75],[2,-77],[-6,-63],[11,-62],[-2,-108],[43,-62],[-32,-142],[35,-80],[-17,-62],[-33,19],[-13,-21],[17,-99],[-23,-102],[0,-72]],[[2636,6058],[-46,81],[-51,55],[-2,-66],[-26,19],[-28,6],[-26,-38],[-52,41],[-68,-37],[-62,-79],[-59,42],[-42,-42],[-76,18],[-30,-74],[-33,-17],[-33,-1],[-21,-31],[-27,1],[-24,15],[-50,58],[-55,-7],[-55,-29],[-26,9],[-13,-37],[-41,-52],[-57,-34]],[[786,6026],[20,26],[-6,142],[17,30],[43,29],[16,45],[1,55],[-11,44],[-21,34],[-25,23],[9,68],[-13,72],[-26,56],[-32,24],[-48,-14],[-26,17]],[[684,6677],[48,62],[56,2],[82,-33],[11,31],[-6,84],[43,92]],[[918,6915],[4,-12],[16,-27],[16,-16],[83,-21],[13,5],[16,26],[29,74],[20,27],[21,-92],[56,-17],[117,47],[107,24],[30,23],[-16,17],[-13,26],[-7,36],[-3,116],[-10,71],[-2,61],[22,40],[-9,22],[-14,66],[-12,14],[-31,23],[-9,16],[-1,39],[19,15],[51,19],[24,31],[15,35],[8,47],[6,63],[-3,7],[-7,4],[-8,7],[-1,15],[4,10],[13,15],[3,6],[4,31],[8,22],[0,22],[-15,29],[92,125],[54,52],[53,-18],[61,-28],[15,-7],[96,-23],[47,-62],[151,-327],[15,-21],[15,-11],[37,-12],[14,-15],[49,-121],[18,-29],[16,0],[14,12],[17,4],[22,-18],[31,-35],[27,-42],[11,-36],[16,-28],[63,-55],[33,-29],[124,-55],[85,9]],[[2128,6573],[22,10],[52,-58],[58,70],[94,0],[63,53],[92,92],[12,65],[-17,117],[-31,120],[-67,-10],[-69,25],[-144,-80],[-28,-175],[-85,-107],[48,-122]],[[3070,4285],[33,-138],[29,-90],[-3,-24],[-7,-22],[-1,-201],[10,-100]],[[3131,3710],[-68,-48],[-17,-5],[-13,-20],[-17,-58],[-21,-49],[-10,-50],[-3,-59],[-29,-108],[-12,-132],[-4,-138],[-44,-141],[-28,-164],[14,-145],[32,-30],[42,-336]],[[2300,392],[-2,18],[-1,41],[-8,52],[-2,29],[-11,34],[-69,123],[-55,41],[-62,22],[-126,10],[-12,-14],[-4,-11],[-6,-11],[-8,-11],[-9,58],[-16,11],[-35,-22],[-30,-4],[-4,10],[2,32],[-9,60],[-15,-44],[-16,6],[-15,22],[-2,3],[-22,13],[0,24],[10,5],[18,14],[11,3],[-13,31],[-24,6],[-23,14],[-10,59],[-4,36],[-18,113],[-8,33],[-59,129],[-17,16],[-119,7],[-22,18],[-72,89],[-17,31],[-7,38],[-12,27],[-79,106],[-14,32],[-36,113],[-55,107],[-11,16],[-10,21],[-14,70]],[[1158,2018],[56,36],[37,-72],[103,64],[25,4],[26,14],[27,57],[8,79],[-25,92]],[[1415,2292],[-13,105],[34,14]],[[1436,2411],[167,67],[18,116],[25,78],[23,127],[-9,465]],[[1660,3264],[57,162],[59,82],[99,-11],[60,52],[76,16],[300,209],[266,261],[66,31],[58,101],[34,37],[39,16],[142,131],[80,-11],[74,-55]],[[2430,1790],[58,74],[48,-53],[18,85],[31,116],[48,64],[-13,190],[-44,201],[0,21],[-96,-21],[-40,53],[-18,-63],[0,-96],[-9,-95],[-36,-74],[40,-190],[13,-212]],[[2636,6058],[5,-100],[-10,-97],[56,-37],[48,-12],[8,-75],[17,-64],[34,-12],[168,59]],[[2962,5720],[49,-156],[-53,-24],[-9,-96],[17,-95],[63,-100],[54,-198],[41,-40],[21,-87],[-13,-233],[16,-90],[-21,-173],[-57,-143]],[[1660,3264],[-79,-54],[-45,113],[19,245],[-20,798],[6,44],[12,36],[8,39],[-9,34],[-39,27],[-18,32],[-15,38]],[[2699,4487],[32,50],[28,153],[60,-34],[-3,220],[-18,152],[-46,153],[-42,76],[-50,-26],[-17,-110],[-85,-8],[-4,-59],[29,-60],[-4,-93],[-28,-110],[39,-135],[42,-144],[67,-25]],[[1436,2411],[-41,142],[-13,130],[-39,65],[-15,152],[-62,-6],[-9,-141],[-42,-12],[0,-105],[2,-136],[5,-166],[59,-70],[77,-18],[57,46]],[[1158,2018],[-12,54],[5,55],[-14,57],[-9,20],[-13,30],[-19,31],[-8,0],[-3,-16],[-4,-12],[-10,14],[-6,14],[-6,11],[-7,8],[-6,5],[-40,15],[-11,11],[-11,-50],[-10,0],[-18,63],[-45,46],[-27,60],[-24,67],[-27,55],[-32,36],[-39,13],[-13,14],[-12,3],[-9,-12],[-6,-31],[-9,0],[-20,33],[-64,65],[-8,12],[-21,152],[-50,70],[-54,141],[-53,51],[-27,36],[-6,26],[-6,23],[14,35],[28,22],[9,14],[11,19],[-8,67],[-22,24],[-27,3],[-8,5]],[[1108,4128],[-110,-31],[6,-221],[52,-59],[0,-140],[95,30],[56,37],[-25,273],[-74,111]],[[4208,5756],[10,125]],[[4218,5881],[28,105],[-1,45],[-52,241],[-13,207],[89,22],[40,31],[35,56],[70,8],[64,-65],[33,-69],[55,-62],[5,-42],[33,9],[112,-141],[29,-18],[20,-39],[-33,-136],[-70,-87],[-28,-59],[-140,-163],[-44,9],[-74,74],[-168,-51]],[[5237,4493],[-29,-53],[-76,63],[-20,-63],[-9,-83],[26,-111],[29,-132],[50,-146],[34,-201],[58,-77],[46,146],[0,160],[44,111],[52,0],[46,55],[3,96]],[[5491,4258],[29,3],[25,57],[42,64],[46,18],[44,-54],[47,-27],[61,123],[42,49],[43,32],[49,-49],[54,-97]],[[5973,4377],[-51,-62],[-9,-28],[9,-29],[22,-12],[24,-6],[16,-12],[0,-22],[-26,-66],[-13,4],[-27,39],[-33,5],[0,-57],[29,-30],[-21,-67],[-45,5],[-50,-31],[-32,-78],[9,-7],[-21,-92],[6,-47],[21,-29],[28,13],[39,-22]],[[5848,3746],[-73,-108],[-64,-147],[30,-38],[13,-64],[-28,-387],[-51,-93],[-128,33],[-56,-65],[2,-145],[70,-81],[17,-164],[-25,-161],[-19,-70],[-32,3],[-45,-25],[-42,-50],[-43,-8],[-40,22],[-34,-6],[-29,-38],[3,-83],[-1,-80],[-23,-75],[-4,-100],[28,-122],[37,-114],[22,-104]],[[5333,1476],[-32,34],[-31,17],[-32,2],[-85,-28],[-32,2],[-27,-8],[-36,-27],[-35,-39],[-21,-40],[3,-29],[11,-32],[3,-29],[-38,-35],[-11,-24],[-7,-27],[-11,-24],[-25,-34],[-12,-9],[-17,-4],[-18,-14],[-12,-31],[-11,-36],[-15,-27],[-25,-15],[-54,0],[-27,-10],[-13,-16],[-17,-21],[-11,-44],[-7,-43],[-16,-36],[-41,-13],[-129,22],[-33,32],[0,1],[-22,69],[-33,21],[-34,-24],[-23,-67],[-2,-105],[-26,-12],[-37,9],[-35,-41],[-5,-13],[-1,-13],[1,-13],[11,-30],[4,-15],[-2,-12],[-8,-7],[-29,22],[-90,11],[-22,-2],[-14,-29],[-17,-15],[-29,-15],[-26,-29],[-8,0]],[[3968,1267],[34,30],[30,52],[-33,30],[-18,70],[11,36],[23,-20],[23,22],[30,111],[-10,43],[-18,-10],[-17,13],[-4,21],[5,17],[26,30],[84,30],[23,41],[-1,300],[-5,44],[-22,71],[-4,54],[9,127],[35,193],[-3,106],[-19,117],[-45,210],[-28,84],[40,72],[100,74],[42,71],[22,66],[8,48],[-4,52],[-15,77],[-2,31],[-1,41],[-3,36],[-9,15],[-5,15],[-25,59],[-6,10],[-5,12],[-26,48],[-8,23],[-3,29],[1,46]],[[4175,3914],[2,59],[5,43],[11,52],[15,43],[14,18],[12,29],[1,66],[-10,147],[-8,61]],[[4217,4432],[-1,37],[4,23],[8,19],[6,23],[2,34]],[[4236,4568],[32,118],[70,7],[68,33],[110,145],[158,116],[54,-23],[42,-74],[6,-102],[-35,-94],[-11,-98],[29,-76],[44,24],[32,104],[42,45],[45,29],[18,50],[3,71],[22,44],[101,-26],[55,-91],[82,-221],[34,-56]],[[4017,5710],[43,-84],[11,-51],[18,-39],[51,-12]],[[4140,5524],[24,-58],[-17,-176],[-30,-104],[-8,-65],[-4,-73],[0,-70],[15,-137],[11,-71],[10,-31],[23,-27],[72,-144]],[[4217,4432],[-85,75],[-81,-139],[-20,-195],[23,-118],[121,-141]],[[4175,3914],[-67,-35],[-65,-72],[-143,-302],[-63,-68],[-28,-15],[-26,-25],[-45,19],[-104,272],[-29,-5],[-30,-36],[-18,-56],[-18,-37],[-19,-5],[-62,19],[-61,47],[-102,139],[-12,-9],[-76,1],[-76,-36]],[[2962,5720],[9,58],[16,41],[-3,105],[14,83],[35,3],[35,16],[25,65],[31,-2],[86,-121],[20,-52],[26,-27],[78,33],[-14,43],[-19,32],[22,52],[74,61],[42,69],[29,19],[22,39]],[[3490,6237],[31,119],[49,58]],[[3570,6414],[249,23]],[[3819,6437],[58,-192],[76,-152],[16,-90],[-9,-101],[39,-156],[18,-36]],[[3442,4683],[90,90],[49,-42],[52,139],[26,97],[0,97],[-35,77],[0,90],[15,125],[-55,69],[-41,0],[-29,98],[-29,13],[-37,-97],[-81,-132],[-73,-135],[70,-128],[43,-125],[18,-132],[17,-104]],[[3570,6414],[12,72],[-49,118],[-76,27],[-57,14],[-41,-69],[17,-90],[-14,-70],[52,-104],[76,-75]],[[2638,7111],[337,35],[182,-30],[55,8],[110,73],[302,57],[66,-8],[54,-38],[44,-14],[43,7],[36,36],[48,90],[26,31],[33,14],[37,21]],[[4011,7393],[3,-1],[46,-53],[51,-17],[33,-84],[15,-61],[9,-105],[19,-32],[-27,-38],[-33,18],[-60,-34],[15,-180],[-77,14],[-77,-19],[15,-43],[9,-51],[-41,-49],[-32,-68],[-22,-93],[-38,-60]],[[5139,7057],[22,-55],[18,-14],[18,-7],[-9,-47],[-17,-46],[15,-66],[28,-51],[41,-110],[2,-60],[21,-44]],[[5278,6557],[-15,-104],[28,-98],[47,-50],[55,9],[8,-65],[0,-58],[61,-88],[28,-61],[265,-428],[12,-50],[0,-64],[-6,-54],[3,-49],[26,-66]],[[5790,5331],[37,-42],[53,-140],[-39,-161]],[[5841,4988],[-8,-171],[47,-161],[82,-119],[93,-60],[-82,-100]],[[5491,4258],[-26,13],[-48,-4],[-113,115],[-67,111]],[[4140,5524],[38,53],[20,90],[10,89]],[[4218,5881],[-46,84],[-49,49],[-40,69],[-38,-27],[9,-118],[26,-118],[-63,-110]],[[4011,7393],[2,1],[-57,67],[-43,68],[-10,66],[4,75],[15,146],[-5,41],[-10,14],[-2,13],[19,38],[13,13],[29,7],[14,20],[40,132],[25,34],[141,50]],[[4186,8178],[49,-113],[4,-165],[-51,-74],[35,-125],[183,-209],[119,4],[314,-96],[58,-42],[48,-179],[14,-232],[89,82],[91,28]],[[3895,2124],[33,-23],[36,-20],[33,-7],[38,-16],[34,-17],[35,2],[14,42],[-3,34],[-12,25],[-19,-7],[-19,-16],[-1,35],[-6,18],[-10,10],[-13,7],[-13,-21],[-7,-16],[0,-9],[-7,9],[-9,16],[-5,15],[0,6],[-51,0],[-10,69],[-6,56],[-28,71],[-34,-10],[-13,-66],[-38,-10],[-27,15],[-21,-51],[-32,-46],[-15,-50],[-4,-48],[9,-38],[14,-31],[32,33],[7,29],[8,0],[3,-47],[6,-53],[19,-27],[29,-16],[25,59],[13,58],[15,36]],[[5413,8548],[-49,-98],[-11,-143],[-22,-143],[115,-36],[41,116],[71,81],[59,101]],[[5617,8426],[35,20],[67,100],[34,34],[56,28],[5,5]],[[5814,8613],[15,-33],[41,-48],[29,-47]],[[5899,8485],[-16,-14],[-11,-26],[-42,-32],[-32,-54],[-43,-18],[-20,-21],[-7,-48],[10,-20],[18,-14],[32,-94],[10,-117],[-44,-9],[-36,-51],[-19,-89],[-5,-82],[-38,-63],[-41,-41],[-20,32],[-25,-1],[-20,-54],[-16,-63],[-37,-43],[-48,43],[-41,-46],[-74,-206],[-56,-30],[-139,-267]],[[4186,8178],[71,26],[21,16],[33,-2],[29,-2],[89,20],[182,-36],[17,6],[88,91],[199,-7],[78,90],[3,18],[1,19],[-1,19],[-3,19],[0,3],[0,2],[0,2],[0,1],[18,56],[14,137],[16,51],[25,24],[136,58],[16,-1],[15,-7],[16,-23],[32,-63],[15,-12],[68,21],[35,-9],[26,-51],[1,-35],[-9,-31],[-4,-30]],[[8939,9408],[-31,-54],[-55,-185],[-31,-81],[-41,-41],[-13,5],[-29,24],[-17,-3],[-9,-15],[-50,-118],[-41,-78],[-22,-28],[-28,-17],[-94,-9],[-21,-27],[-27,-45],[-28,-36],[-23,-1],[-18,-8],[-112,-113],[-28,-7],[-28,8],[-58,45],[-25,1],[-55,-12],[-94,7],[-28,-7],[-22,-25],[-21,-43],[-17,-51],[-10,-48],[-3,-62],[8,-33],[11,-27],[5,-48],[-15,-111],[-38,-60],[-49,-23],[-51,-3],[11,0],[-70,-8],[-22,8],[-17,25],[-13,30],[-16,20],[-24,-2],[-10,-17],[-5,-25],[-5,-21],[-15,-10],[-36,3],[-10,-3],[-65,-69],[-16,-27],[-10,-44],[-9,-92]],[[7399,7847],[-3,-31],[-8,-49],[-12,-30],[-48,-92],[-13,-46],[-1,-27],[3,-33],[0,-66],[-4,-55],[-9,-28],[-31,-53],[9,-108],[-1,-21],[-81,-24],[0,-27],[-35,-113],[-9,-18],[-10,-35],[-74,-121],[-107,-17]],[[6965,6853],[-41,-7],[-26,-18]],[[6898,6828],[-48,12],[-33,36],[-162,53],[-31,83],[-19,109],[-69,130],[-94,269],[-11,14],[-13,30]],[[6418,7564],[15,33],[10,33],[-6,69],[-20,55],[-27,51],[-10,72]],[[6380,7877],[18,52],[65,110],[19,142]],[[6482,8181],[55,56],[75,27],[89,9],[49,-107],[78,-90],[78,-80],[60,9],[74,36],[49,89],[-8,81],[-33,98],[0,107],[-30,134],[-41,99],[-56,53],[-52,0],[-63,72],[-68,-80],[-86,-107],[-71,-99],[-78,-8],[-49,-93]],[[6454,8387],[-80,135],[-94,-200],[-50,59],[-53,-6],[-42,-60],[-52,0],[-24,32],[-19,50],[-21,12],[-24,-5],[-28,57],[-35,48],[-33,-24]],[[5814,8613],[59,58],[27,17],[13,15],[10,32],[8,64],[6,24],[19,35],[12,4],[15,-8],[26,-5],[25,18],[44,65],[17,12],[29,-24],[17,-29],[18,-12],[34,28],[42,69],[37,90],[31,102],[57,281],[17,55],[22,47],[45,75],[4,6],[19,47],[2,12],[0,13],[0,13],[-1,12],[-3,61],[1,30],[1,26],[43,28],[91,10],[312,114],[24,1],[23,-19],[44,-64],[21,-9],[46,-7],[81,-79],[52,-7],[37,4],[43,-12],[42,-30],[29,-47],[38,-13],[114,87],[49,17],[26,-18],[19,-25],[16,-12],[22,20],[17,40],[9,37],[12,33],[29,27],[24,8],[51,2],[76,39],[22,-11],[49,-47],[27,-16],[13,-19],[9,-30],[14,-69],[10,-24],[23,-18],[54,2],[26,-10],[12,-40],[20,-146],[12,-38],[82,-202],[35,-65],[39,-46],[46,-26],[45,7],[76,62],[64,15],[45,41],[21,14],[77,6],[27,15],[27,3],[88,-14],[28,13],[25,32],[28,58],[35,-10],[3,0]],[[8933,6509],[-1,1],[-31,66],[-30,204],[-25,62],[-69,-123],[-38,61],[8,93],[-42,123],[-103,93],[-50,-5],[-36,-100],[-18,-73],[-27,-45],[-31,29],[-27,53],[-30,21],[-31,1],[-62,36],[-29,45],[-72,24],[-24,55],[-138,176],[6,198],[18,188],[-15,75],[-46,27],[-57,-55],[-238,-30],[-66,-42],[-122,157],[-108,23]],[[8939,9408],[1,1],[15,25],[48,31],[50,-10],[53,-42],[-22,-107],[0,-56],[41,4],[10,-3],[11,-30],[0,-35],[-4,-41],[2,-48],[16,-72],[72,-179],[9,-16],[11,-4],[11,5],[12,15],[6,4],[6,2],[6,-2],[29,-19],[23,-8],[23,4],[29,23],[6,1],[6,-2],[6,-5],[110,-231],[19,-73],[21,-112],[25,-84],[8,-15],[4,0],[19,17],[106,0],[27,14],[25,26],[26,11],[24,-24],[5,-17],[53,-48],[43,-66],[20,-40],[15,-48],[10,-67],[-5,-37],[-10,-33],[-2,-55],[-26,-50],[13,-43],[54,-71],[-24,-46],[-37,-111],[-24,-35],[-59,-36],[-24,-27],[-16,-47],[1,-31],[7,-22],[3,-26],[-12,-40],[-9,-10],[-32,-5],[-30,-22],[-18,-23],[-36,-78],[-44,-60],[-53,-38],[-57,-13],[-51,13],[-109,94],[-45,-18],[-24,-139],[-17,-26],[-20,-13],[-21,-3],[-68,16],[-19,-3],[-26,-15],[-27,-24],[-17,-28],[-32,-80],[-11,-18],[-25,-29],[-11,-22],[-6,-27],[-5,-65],[-4,-30],[-37,-85],[-4,-23],[-1,-26],[-3,-23],[0,-4],[-8,-27],[-11,-14]],[[8308,8054],[-26,44],[-75,-8],[-26,-81],[-14,-75],[-11,-179],[-11,-214],[90,-45],[100,-45],[49,-53],[82,26],[33,117],[4,125],[48,18],[4,134],[-4,125],[-29,54],[-38,-45],[-78,9],[0,107],[-42,48],[-56,-62]],[[8166,4519],[4,-19],[12,-10],[15,-4],[10,-14],[13,-41],[1,-4],[-6,-4],[-28,-174],[-12,-26],[-67,-91],[-7,-4],[-2,-9],[-2,-42],[1,-43],[5,-38],[1,-38],[-13,-45],[-15,-22],[-54,-24],[-30,-47],[-19,-58],[-32,-143],[-6,-16],[-5,-19],[-4,-21],[-1,-21],[3,-10],[4,-9],[4,-6],[40,-45],[-5,-70],[-27,-66],[-29,-27],[-41,-12],[-15,-42],[-3,-13],[-10,-46],[-31,-67],[-32,-28],[-54,7],[-31,-13],[-23,-45],[-8,-67],[-6,-135],[-18,-65],[-26,-53],[-21,-56],[-3,-73],[43,-136],[9,-78],[-34,-43],[-62,-5],[-29,-17],[-25,-48],[-15,-77],[-6,-157],[-13,-68],[-17,-54],[-14,-19],[-43,1],[-9,-8],[-71,-143],[-26,-16],[-29,41],[-10,21],[-12,9],[-12,0],[-14,-9],[-29,-2],[-55,39],[-26,10],[-10,-6],[-22,-20],[-15,-2],[-12,10],[-26,37],[-14,12],[-29,2],[-31,-14],[-17,-15]],[[6918,1846],[0,1],[-18,43],[-27,36],[-11,55],[12,86],[2,83],[-17,69],[-24,52],[-29,-5],[-14,41],[-77,-34],[-74,1]],[[6641,2274],[26,98],[-47,-21],[1,148]],[[6621,2499],[15,45],[-10,71],[32,90],[19,115],[-43,31],[-23,71],[-5,264],[20,168],[-4,225],[-47,72],[-74,33],[-120,71]],[[6381,3755],[-22,117],[16,102],[57,84],[52,8],[50,-20],[42,96],[43,-19],[34,49],[22,-26],[19,-42],[29,12],[28,32],[24,8],[23,25],[15,105],[-7,116],[-15,44],[-1,55],[56,111],[-1,47],[-5,21],[15,46],[24,28],[89,180],[29,17],[30,-14],[20,21],[13,45],[22,12],[16,44],[12,47],[36,22],[16,37],[11,48],[22,48],[28,24]],[[7223,5285],[183,-195],[62,-36],[67,-12],[96,-77],[30,-103],[-1,-255],[-4,-101],[19,-56],[35,-16],[28,-45],[-13,-86],[28,-45],[49,-17],[102,47],[62,-1],[101,168],[63,50],[36,14]],[[7236,3268],[81,2],[69,21],[93,-7],[58,118],[-27,118],[18,139],[-67,160],[-142,109],[-60,-181],[-64,-111],[23,-180],[18,-188]],[[6918,1846],[-13,-12],[-58,-80],[-6,-19],[1,-34],[13,-78],[0,-29],[-12,-19],[-14,3],[-13,8],[-12,-6],[-7,-27],[-1,-43],[-1,-7],[-8,-35],[-22,-42],[-29,-24],[-83,-30],[-11,1],[-18,11],[-14,17],[-43,66],[-59,40],[-60,23],[-36,-96],[-237,-11],[-60,-126],[-80,114],[-26,18],[-37,-30],[-11,-2],[-11,10],[-15,35],[-8,11]],[[5927,1453],[19,127],[20,42],[34,-7],[35,-70],[26,-90],[35,14],[3,76],[-29,42],[-20,62],[-3,56],[18,54],[51,-17],[41,5],[-3,83]],[[6154,1830],[85,24],[64,0],[63,-56],[87,-14],[69,90],[41,195],[52,104],[26,101]],[[6621,2499],[-29,56],[-52,90],[-49,97],[-52,56],[-128,-84],[-63,35],[-53,7],[-23,-83],[-29,-209],[-34,-83],[-26,146],[-33,40],[-15,-119],[1,-84],[9,-74],[5,-81],[7,-37],[18,-27],[-7,-58],[9,-52]],[[6077,2035],[-45,-4],[-29,91],[-29,48],[-52,-97],[-86,28],[-58,-63],[-6,-187],[87,-42],[14,-90],[-14,-42],[-8,-249]],[[5851,1428],[-42,-8],[-62,58],[-94,15],[-59,-22],[-23,-15],[-122,-85],[-26,9],[-90,96]],[[5848,3746],[108,-115],[170,93],[53,-82],[54,-25],[47,63],[52,26],[49,49]],[[8933,6509],[-9,-10],[-72,-30],[-91,-112],[-44,-77],[-28,-87],[4,-110],[13,-122],[2,-118],[-30,-98],[-65,-32],[-27,-26],[-27,-49],[-57,-136],[-9,-41],[-17,-127],[-7,-32],[-17,-52],[-7,-40],[0,-41],[3,-32],[1,-32],[-9,-44],[-12,-28],[-33,-51],[-14,-34],[-7,-32],[-7,-62],[-10,-32],[-30,-48],[-72,-79],[-33,-51],[-58,-113],[2,-12]],[[7223,5285],[42,177],[8,224],[-14,167],[-25,168],[-18,299],[-19,142],[-46,71],[-47,10],[-48,35],[-57,95],[-34,180]],[[7848,6222],[101,0],[30,-170],[47,-33],[37,-44],[19,-144],[89,0],[82,171],[56,17],[60,-98],[101,188],[29,134],[4,224],[-48,143],[-56,116],[-53,-26],[-48,-99],[-67,-63],[-41,90],[-34,161],[-26,161],[-75,-18],[-18,-107],[-23,27],[19,188],[-30,-36],[-63,-108],[-62,-289],[-33,-206],[3,-179]],[[6454,8387],[26,-42],[7,-83],[-5,-81]],[[6380,7877],[-41,80],[0,101],[-14,67],[-70,22],[-23,-123],[-37,-33],[9,-112],[19,-135],[-19,-145],[0,-145],[33,-135],[65,0],[33,67],[0,101],[32,56],[51,21]],[[6898,6828],[-8,-26],[-7,-34],[-20,-45],[-44,-30],[-15,-22],[8,-42],[-5,-23],[-4,-15],[-7,-9],[-14,-4],[0,-22],[-9,-62],[-260,-287],[-13,-28],[-8,-74],[-20,-31],[-54,-29],[-8,-14],[-18,-40],[-14,-19],[-36,-18],[-33,16],[-84,91],[-26,54],[-17,63],[9,78],[-24,112],[-57,49],[-28,62],[-15,92],[-21,25],[-139,-63],[14,-50],[23,-27],[-73,-31],[-78,87],[-25,134],[-11,144],[-58,31],[-71,-37],[-33,15],[-25,-38],[-81,-179],[-18,6],[-33,42],[-80,-13],[-80,-60]],[[5841,4988],[85,-28],[74,-91],[20,-11],[23,-21],[40,-38],[75,17],[44,54],[4,116],[-52,36],[-30,102],[46,56],[11,45],[-38,119],[-101,135],[-90,179],[-104,-197],[-58,-130]],[[684,6677],[-71,47],[-41,-14],[-83,54],[-26,25],[12,26],[23,59],[11,18],[8,-18],[8,-11],[6,-2],[10,10],[18,25],[58,51],[13,19],[8,31],[-3,46],[9,34],[54,40],[62,-12],[118,-75],[19,-21],[8,-32],[5,-37],[8,-25]],[[6077,2035],[12,-49],[7,-46],[-12,-51],[38,-45],[32,-14]],[[5927,1453],[-24,9],[-15,-2],[-37,-32]],[[5413,8548],[14,-33],[14,-3],[54,33],[36,-19],[56,-81],[30,-19]]],"transform":{"scale":[0.0006784243692369169,0.0002828172221222168],"translate":[16.09403527800012,45.741343486000034]}};
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
