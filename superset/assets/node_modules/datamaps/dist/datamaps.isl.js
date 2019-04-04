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
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = '__IRN__';
  Datamap.prototype.irqTopo = '__IRQ__';
  Datamap.prototype.islTopo = {"type":"Topology","objects":{"isl":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Reykjavík"},"id":"IS.NE","arcs":[[[0]],[[1,2,3]]]},{"type":"MultiPolygon","properties":{"name":"Vestfirðir"},"id":"IS.VF","arcs":[[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10,11,12]]]},{"type":"MultiPolygon","properties":{"name":"Austurland"},"id":"IS.AL","arcs":[[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24,25,26]]]},{"type":"Polygon","properties":{"name":"Norðurland vestra"},"id":"IS.NV","arcs":[[27,28,-11,29,30]]},{"type":"MultiPolygon","properties":{"name":"Norðurland eystra"},"id":"IS.NE","arcs":[[[31]],[[32]],[[-26,33,-31,34]],[[35]]]},{"type":"Polygon","properties":{"name":"Suðurnes"},"id":"IS.SU","arcs":[[-2,36,37,38]]},{"type":"MultiPolygon","properties":{"name":"Suðurland"},"id":"IS.SL","arcs":[[[39]],[[40]],[[41]],[[-25,42,-38,43,44,-28,-34]]]},{"type":"Polygon","properties":{"name":"Höfuðborgarsvæði"},"id":"IS.HO","arcs":[[-44,-37,-4,45,46]]},{"type":"MultiPolygon","properties":{"name":"Vesturland"},"id":"IS.VL","arcs":[[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[-29,-45,-47,55,-12]]]}]}},"arcs":[[[2453,2644],[-9,-9],[-9,14],[-6,8],[-3,13],[-5,10],[-8,10],[8,12],[11,-12],[2,-13],[10,-14],[9,-19]],[[2364,2168],[-95,-8],[-80,130]],[[2189,2290],[75,22],[25,25],[21,51],[8,-17],[6,-4],[5,7],[5,14],[0,19],[-15,25],[-22,22],[-22,11],[-15,-14],[9,49],[23,24],[25,4],[17,-14],[-7,-4],[-17,-19],[16,-13],[19,-4],[18,5],[15,12],[0,23],[-18,0],[12,17],[6,4],[-56,77],[-31,24],[-31,3],[27,31],[136,-36],[7,-13],[5,-14],[5,-10],[28,-24],[15,2],[13,22],[-10,-3],[-10,2],[-9,8],[-9,14],[11,24],[7,10],[8,8],[-19,21],[24,13],[32,-15],[12,0],[18,1],[19,61],[-31,-26],[-17,-3],[-7,20],[6,36],[15,19],[28,21],[-18,17],[-28,5],[-27,-6],[-20,-16],[5,52],[-10,24],[-18,6],[-25,-2],[-9,-4],[-8,-9],[-6,-15],[-34,11],[26,34],[9,25],[-4,45],[17,18]],[[2414,2993],[126,6],[109,-57],[9,-218],[-45,-319],[-164,-105],[-85,-132]],[[1544,6048],[-4,-7],[-5,3],[-6,-3],[-6,-7],[9,19],[13,10],[1,-7],[-2,-8]],[[1473,6356],[-9,-7],[3,15],[8,6],[7,1],[-9,-15]],[[1565,6354],[-7,-17],[0,27],[12,12],[4,3],[-3,-17],[-6,-8]],[[1735,6589],[-5,-25],[-17,-11],[-5,9],[7,13],[2,6],[5,-4],[13,12]],[[2212,6617],[-7,-2],[-1,1],[5,18],[7,8],[5,2],[-1,-8],[-4,-10],[-4,-9]],[[1261,6636],[-8,-19],[-3,8],[7,14],[4,7],[5,3],[2,-6],[-4,-1],[-3,-6]],[[3131,5730],[0,-28],[9,-42],[1,-53],[-3,-56],[1,-26],[4,-32],[7,-36],[14,-43],[22,-86],[15,-117],[5,-32],[15,-49]],[[3221,5130],[-60,2],[-30,15],[-27,23],[-70,90],[1,20],[0,10],[-1,14],[-3,11],[-10,15],[-6,10],[-16,39],[-9,15],[-17,21],[-6,15],[-5,29],[-15,70],[-2,29],[0,22],[1,20],[1,16],[3,14],[4,15],[23,67],[6,22],[1,22],[-3,24],[-17,81],[-2,20],[-5,23],[-6,21],[-47,82],[-8,8],[-8,4],[-6,6],[-6,12],[-6,23],[-26,44],[-53,154],[-16,69],[-6,17],[-10,8],[-34,1],[-78,-32],[-3,2],[-6,13],[-18,33],[-6,16],[-2,19],[3,20],[10,27],[22,28],[7,11],[2,13],[-3,16],[0,16],[5,47],[3,36],[-1,90],[-10,42],[-24,-24],[-11,-26],[-22,-78],[-16,-21]],[[2577,6601],[-87,-40],[-32,-1],[-64,20],[-54,-22],[-18,2],[18,47],[20,36],[-33,45],[-12,34],[-5,46],[-12,-12],[-12,-8],[-13,-3],[-13,2],[5,-42],[-8,-14],[-13,4],[-9,11],[-9,27],[-17,73],[-11,25],[4,-52],[-2,-43],[-8,-38],[-13,-34],[-16,-28],[-9,-11],[-8,-5],[-4,-13],[-5,-28],[-8,-29],[-8,-13],[-35,-5],[-15,9],[-24,54],[-54,69],[-38,27],[-5,27],[18,50],[20,21],[100,31],[42,41],[22,10],[10,13],[2,32],[1,36],[2,27],[7,22],[10,16],[20,23],[-27,-11],[-66,-135],[-31,-37],[-29,-19],[-64,-7],[0,21],[38,39],[12,22],[0,23],[-19,-2],[-14,-19],[-23,-44],[-19,-10],[-11,12],[-11,17],[-16,4],[0,-23],[11,-24],[-4,-27],[-14,-23],[-50,-29],[-13,10],[-10,53],[0,50],[3,38],[0,38],[-12,52],[-18,107],[-11,38],[-11,-29],[1,-16],[-1,-33],[1,-33],[15,-65],[0,-25],[-5,-23],[-17,-54],[-10,-21],[-12,-2],[-13,29],[-17,58],[-8,5],[-6,-79],[-7,-25],[-9,-11],[-12,1],[-7,13],[-7,25],[-21,96],[-4,50],[7,51],[20,57],[-8,17],[-5,-4],[-4,-11],[-8,-2],[-24,23],[-16,0],[-5,-5],[-4,-18],[0,-17],[9,-66],[8,-38],[25,-234],[-13,-19],[-15,5],[-17,12],[-16,2],[0,19],[5,26],[-5,20],[-10,14],[-12,5],[-30,-14],[-10,4],[-1,29],[-7,-3],[-23,3],[0,23],[22,31],[40,77],[25,17],[-10,34],[-15,23],[-32,29],[-5,-69],[-18,-58],[-23,-30],[-19,20],[-6,33],[-4,38],[-5,30],[-10,13],[-2,-21],[-5,-97],[-2,-28],[-20,-35],[-54,-19],[-25,-21],[-50,35],[-27,38],[3,45],[0,19],[-26,-21],[-15,-60],[-1,-67],[17,-40],[0,-23],[-12,-17],[-20,-47],[-13,-17],[-14,-7],[-60,10],[-25,16],[-15,3],[-14,10],[-11,23],[-10,27],[-5,-1],[-6,-1],[-4,-4],[-9,-14],[4,-4],[2,-4],[7,-13],[-26,-15],[-48,-56],[-122,-35],[-28,23],[-1,-37],[-4,-12],[-6,-3],[-8,-11],[-34,-83],[-166,-66],[-42,7],[-37,36],[0,23],[5,24],[-3,22],[-10,20],[-10,17],[16,-1],[7,-7],[8,-13],[2,57],[-16,28],[-21,-4],[-9,-41],[-22,46],[-139,81],[-258,-38],[-33,8],[-20,51],[40,34],[20,28],[9,31],[11,21],[53,48],[16,26],[4,48],[0,55],[5,46],[28,25],[15,30],[13,7],[23,-6],[88,-73],[26,-6],[15,-13],[50,-90],[36,-32],[63,-24],[15,-29],[13,-34],[16,-29],[27,-19],[27,2],[51,38],[-41,-2],[-22,8],[-17,13],[-15,27],[-12,36],[-14,32],[-18,13],[-45,69],[-25,61],[-29,54],[-15,44],[136,-40],[89,-73],[28,-12],[-17,47],[-24,40],[-26,28],[-40,20],[-47,44],[-42,22],[-20,27],[-32,64],[-37,106],[-3,39],[1,37],[-1,36],[-9,36],[38,48],[39,-4],[382,-298],[9,-15],[16,-46],[24,-26],[7,-15],[9,-55],[-4,-35],[-10,-31],[-7,-46],[16,-13],[21,23],[37,73],[4,-15],[14,-27],[10,29],[49,-17],[22,9],[0,21],[-8,6],[-4,7],[-6,29],[15,1],[41,41],[14,2],[15,-3],[14,3],[12,18],[-107,-12],[-49,22],[-36,32],[-12,21],[-17,36],[-8,34],[9,15],[56,37],[12,-7],[14,-18],[74,14],[24,30],[19,7],[39,-21],[20,-3],[18,24],[-11,16],[-6,5],[-8,0],[0,19],[43,42],[13,23],[-50,-10],[-28,-19],[-39,-49],[-244,8],[-48,28],[-32,42],[-47,-25],[-11,13],[-13,32],[-53,82],[-29,83],[-19,100],[3,92],[39,61],[18,2],[51,-44],[67,-21],[17,-15],[29,-49],[17,-19],[17,-3],[57,24],[112,-63],[37,0],[65,-66],[35,-20],[31,22],[-75,33],[-24,42],[-75,10],[-23,19],[-43,54],[-93,31],[-21,21],[-49,94],[-25,19],[-12,29],[-20,11],[-41,55],[-37,71],[-9,25],[0,94],[6,50],[13,37],[37,19],[47,-15],[165,-138],[48,-17],[32,25],[4,-48],[11,-41],[16,-28],[18,-10],[0,19],[-15,33],[-28,95],[-18,20],[-21,7],[-42,28],[-21,7],[-10,10],[-28,53],[-53,66],[-31,59],[30,33],[79,11],[59,-13],[81,-92],[-22,28],[-35,80],[-21,17],[-87,-3],[-21,22],[0,23],[9,23],[13,28],[15,23],[9,6],[6,4],[38,2],[14,18],[1,40],[21,15],[142,-56],[93,-94],[27,-9],[18,-20],[23,-46],[15,-55],[-3,-46],[6,-66],[45,96],[17,12],[10,-8],[9,-19],[12,-38],[17,-32],[2,-17],[0,-45],[5,-49],[1,-30],[-6,-22],[-15,-40],[-4,-6],[-40,-107],[-9,-30],[5,0],[20,44],[49,84],[18,41],[6,25],[4,28],[5,22],[10,9],[11,-10],[7,-22],[13,-73],[-4,-13],[-2,-9],[13,17],[14,30],[15,17],[14,-21],[-16,-71],[-21,-71],[-26,-58],[-30,-29],[36,3],[17,12],[15,27],[17,78],[13,47],[10,9],[13,-82],[-6,-85],[-8,-72],[5,-44],[31,149],[-2,68],[4,79],[7,73],[10,51],[7,23],[5,5],[62,-8],[6,-10],[2,-41],[6,-25],[7,-16],[35,-50],[33,-86],[5,-11],[1,-14],[-4,-66],[-4,-34],[-6,-30],[-7,-15],[3,-11],[3,-8],[-46,-180],[-10,-56],[7,-26],[12,4],[21,118],[60,224],[6,60],[0,23],[19,5],[13,-29],[10,-43],[14,-39],[7,-2],[5,7],[6,0],[7,-26],[-1,-25],[-4,-23],[-1,-21],[12,-15],[2,16],[4,31],[6,23],[7,-7],[0,-21],[-6,-104],[-8,-35],[-21,-58],[-9,-34],[0,-19],[35,27],[35,171],[29,31],[0,23],[-18,28],[-11,59],[-6,68],[-8,54],[-13,44],[-17,41],[-20,30],[-19,12],[10,40],[4,37],[5,35],[13,31],[17,12],[18,1],[16,11],[11,42],[-19,-1],[-45,-31],[-17,-23],[-16,-9],[-76,52],[-51,73],[-215,128],[-64,93],[-38,136],[43,37],[134,50],[29,-2],[96,-42],[25,0],[10,-5],[4,-12],[3,-15],[4,-11],[25,-35],[13,-4],[12,18],[-6,10],[-5,14],[-8,40],[45,0],[23,9],[40,43],[45,7],[21,23],[-123,-27],[-38,27],[-17,26],[3,4],[15,2],[15,21],[9,23],[13,19],[15,10],[15,-1],[0,23],[-20,16],[-12,-6],[-36,-51],[-46,-35],[-53,-7],[-43,12],[-7,7],[-1,33],[7,22],[19,30],[3,22],[5,61],[4,20],[12,18],[44,25],[-40,-11],[-30,-29],[-71,-106],[-17,-12],[-38,-9],[-11,18],[6,40],[14,42],[13,24],[0,22],[-31,-17],[-16,-18],[-15,-27],[-36,-89],[-7,-6],[-22,-36],[-144,52],[-37,29],[-25,44],[-15,20],[-6,20],[12,28],[35,4],[44,-23],[39,8],[20,95],[-26,5],[-29,30],[-26,43],[-20,47],[28,31],[29,-18],[28,-35],[27,-19],[-6,34],[-5,15],[-7,15],[99,23],[7,-4],[5,-12],[8,-38],[5,-13],[20,-6],[8,23],[-3,30],[-15,16],[-15,8],[-45,55],[91,0],[16,-10],[32,-43],[41,-22],[32,-54],[19,-17],[23,5],[35,57],[22,21],[-2,11],[-4,31],[36,17],[29,-32],[28,-45],[63,-43],[14,4],[4,38],[-7,30],[-24,23],[-7,29],[30,-7],[28,-38],[21,-61],[8,-72],[16,-45],[74,-56],[23,-57],[-13,-31],[11,-18],[39,-12],[0,-21],[-17,7],[-7,-13],[-1,-26],[0,-33],[4,-15],[8,-22],[2,-23],[-14,-21],[0,-23],[12,-21],[12,19],[15,15],[15,10],[13,0],[9,-14],[7,-21],[9,-9],[7,21],[13,39],[15,6],[8,-21],[-5,-45],[64,10],[17,-10],[8,19],[8,1],[7,-9],[7,-11],[5,-11],[33,-72],[-9,-22],[-53,-62],[12,-11],[12,8],[12,16],[14,10],[13,-5],[42,-48],[12,-24],[7,-8],[9,-1],[18,16],[10,3],[57,-41],[-3,-11],[-4,-29],[16,-14],[9,-37],[-1,-37],[-12,-17],[4,-19],[7,-30],[2,-15],[0,1],[1,-50],[5,-59],[6,-21],[12,-15],[13,2],[16,14],[16,6],[11,-22],[2,-43],[-8,-38],[-11,-35],[-7,-33],[11,5],[15,14],[12,18],[5,16],[1,51],[-1,23],[-19,62],[11,17],[33,22],[40,4],[7,-10],[5,-23],[3,-23],[4,-10],[17,-11],[-11,-24],[-20,-22],[-8,-4],[-6,-29],[4,-23],[18,-41],[23,-26],[98,37],[26,-9],[21,-17],[16,-36],[11,-65],[-127,-17],[-24,-28],[-96,-39],[-13,1],[16,-44],[26,5],[51,39],[85,21],[26,-21],[-11,-26],[-39,-39],[0,-21],[98,39],[24,-29],[13,-61],[3,-53],[-11,-40],[-27,-23],[43,-42],[0,-22],[-45,-147],[-16,-40],[-27,-34],[-92,-49],[0,-23],[20,-2],[33,9],[16,-7],[48,-43],[14,-20],[-74,-125],[-27,-28],[-123,7],[-8,14],[-15,40],[-5,9],[-17,18],[-16,40],[-11,43],[-2,26],[-22,44],[-28,21],[-29,-1],[-27,-22],[18,-4],[43,-39],[14,-20],[2,-8],[19,-50],[4,-5],[2,-36],[-3,-25],[-7,-20],[-11,-25],[14,-21],[8,-15],[3,-16],[5,-41],[10,-23],[11,-12],[4,-9],[16,-20],[152,5],[26,-19],[12,-40],[-10,-34],[-46,-105],[-19,-28],[0,-20],[44,34],[56,70],[47,16],[20,-132],[-19,-112],[-45,-107],[-53,-79],[-44,-25],[0,-21],[91,50],[36,45],[19,10],[21,-6],[13,-17],[25,-61],[35,-46],[9,-30],[-7,-51],[13,-11],[2,-23],[-2,-32],[0,-38],[6,-68],[0,-47],[-4,-62],[0,-30],[36,-161],[12,-31],[-4,-6],[-1,-2],[0,-2],[-2,-9],[18,-27],[18,-51],[10,-60],[-8,-54],[0,-19],[15,-18],[5,7]],[[6781,1497],[43,-9],[-84,0],[-4,6],[45,3]],[[6630,1491],[-73,-13],[-1,6],[55,19],[16,-5],[3,-7]],[[6710,1496],[-11,-6],[-25,8],[-4,6],[13,-6],[27,-2]],[[7007,1506],[-92,-16],[37,16],[5,18],[45,-4],[7,-10],[-2,-4]],[[7102,1530],[-64,-20],[0,5],[25,7],[39,8]],[[7113,1531],[-5,-2],[2,2],[3,0]],[[7155,1547],[-38,-12],[6,8],[7,7],[18,4],[7,-7]],[[6854,1569],[-4,-30],[-7,6],[4,41],[5,9],[2,-26]],[[7159,1564],[-9,-3],[-4,11],[7,14],[24,27],[4,-5],[-22,-44]],[[7250,1773],[-51,-112],[-5,6],[3,21],[43,77],[12,16],[-2,-8]],[[9385,3988],[2,-1],[3,1],[10,-6],[12,-2],[-1,-8],[2,-7],[-4,-11],[-9,-6],[-8,6],[-3,-3],[-6,12],[-6,2],[0,6],[3,5],[2,-2],[0,11],[-3,3],[4,9],[2,-9]],[[6481,1461],[0,1],[-1,34],[3,533],[5,60],[33,187],[422,1323]],[[6943,3599],[171,510],[23,111],[19,120],[5,42],[2,27],[0,25],[-2,28],[-3,23],[-6,27],[-2,25],[-4,23],[-22,85],[-2,23],[1,15],[3,11],[24,76],[13,29],[6,18],[2,14],[1,15],[-5,23],[-1,11],[0,17],[2,21],[5,46],[4,18],[5,10],[24,2],[52,38],[16,6],[36,1],[17,6],[6,4],[10,14],[48,98],[39,60],[10,11],[60,27],[12,13],[12,22],[23,52],[7,25],[1,17],[-17,18],[-3,9],[-1,12],[0,14],[4,30],[2,12],[13,105],[0,12],[0,54],[-3,39],[0,26],[2,25],[2,21],[0,8],[-2,4],[-1,15],[0,22],[6,44],[6,25],[5,17],[26,55],[27,78],[9,15],[47,50],[10,17],[8,24],[12,49],[4,26],[1,19],[-5,36],[-5,22],[-25,63],[-17,33],[-70,68],[-4,8],[-7,17],[-2,9],[0,11],[0,18],[4,34],[3,18],[5,12],[11,20],[19,49],[16,10],[9,12],[11,22],[13,40],[14,58],[8,49],[3,22],[4,55],[2,19],[5,21],[8,13],[12,4],[282,-81],[10,3],[2,14],[0,36],[2,23],[4,27],[21,100],[1,25],[-2,24],[-3,25],[-3,24],[-2,30],[-1,80],[-1,22],[-3,17],[-7,24],[-1,15],[-1,21],[2,48],[2,21],[5,19],[10,9],[188,73],[8,6],[2,16],[1,13],[3,17],[6,20],[15,25],[13,15],[48,40],[11,16],[9,23],[12,71],[81,17],[54,57],[36,57],[23,67],[369,66],[28,114],[44,16]],[[8992,8231],[9,-68],[1,-33],[-3,-13],[-11,-16],[-4,-13],[-1,-14],[1,-33],[0,-14],[-21,-75],[-4,-21],[-10,-13],[-59,-102],[-67,-69],[-20,-37],[2,-53],[-18,-44],[-46,-70],[27,2],[24,28],[43,76],[-14,-62],[-26,-69],[-11,-55],[32,-23],[33,14],[71,57],[194,74],[70,53],[37,14],[29,-44],[-39,-129],[-23,-31],[3,-27],[6,-25],[4,-11],[4,-7],[21,-23],[57,-54],[17,-29],[-49,-22],[-26,-29],[-23,-79],[-46,-78],[-19,-65],[-69,-116],[-13,-38],[-11,-46],[-5,-52],[12,24],[19,67],[10,14],[10,8],[30,44],[10,20],[16,50],[113,236],[19,20],[25,-9],[71,-75],[-14,29],[-26,40],[-10,34],[199,-167],[26,-6],[99,36],[17,-4],[11,-15],[6,-37],[2,-31],[-5,-21],[-12,-6],[0,-19],[28,2],[13,-7],[8,-18],[1,-21],[-2,-28],[-4,-36],[6,-23],[8,-17],[16,-21],[42,88],[23,24],[28,-9],[5,-13],[1,-20],[-1,-18],[2,-10],[5,-2],[13,5],[6,-3],[32,-50],[5,-15],[2,-67],[-13,-43],[-17,-29],[-9,-28],[2,-17],[10,-59],[1,-26],[-6,-12],[-31,-32],[9,-19],[0,-23],[-4,-28],[1,-34],[-31,-32],[-82,18],[-36,-28],[22,-28],[71,-35],[2,-50],[-20,-34],[-29,-19],[-45,0],[-19,-9],[-38,-34],[-76,-20],[-23,-22],[14,-28],[143,76],[44,-6],[88,33],[27,-12],[45,-43],[23,-35],[9,-32],[4,-17],[-22,-24],[-36,-84],[-20,-18],[-115,-41],[-121,0],[-53,-19],[-55,0],[28,-32],[105,32],[140,-23],[62,23],[34,0],[9,-11],[-4,-22],[-14,-34],[-3,-19],[1,-14],[0,-12],[-5,-14],[-34,-22],[-30,-5],[-29,-16],[0,-23],[70,21],[17,-21],[0,-19],[-9,-3],[-8,-9],[-7,-13],[-7,-19],[28,0],[9,-6],[7,-14],[5,-13],[4,-7],[9,10],[15,42],[7,9],[2,12],[26,74],[37,62],[3,-45],[0,-65],[-3,-62],[-6,-37],[0,-22],[17,-18],[5,-29],[-6,-37],[-16,-42],[-18,-24],[-39,-16],[-18,-22],[16,-42],[9,-29],[-3,-13],[-14,-10],[-28,-44],[-14,-10],[-65,22],[-56,-14],[-19,14],[-9,29],[-7,42],[-10,38],[-14,17],[-15,7],[-30,29],[-47,23],[-50,71],[-28,16],[6,-34],[9,-24],[11,-17],[10,-9],[-32,-52],[-185,-10],[0,-23],[286,-40],[9,-12],[13,-23],[11,-30],[5,-30],[7,-16],[43,-56],[93,-62],[18,-44],[-38,-43],[-44,10],[-79,55],[-91,-22],[-55,34],[-16,-12],[54,-55],[129,-44],[59,-70],[7,-18],[9,-28],[3,-26],[-10,-11],[-15,-10],[-22,-43],[-12,-10],[-95,54],[-27,-35],[98,-58],[17,-23],[0,-33],[-26,-11],[-103,6],[-29,17],[-5,-15],[-8,-10],[-18,-17],[0,-23],[28,-50],[14,-34],[14,-41],[-15,-8],[-41,-55],[-201,-62],[-33,15],[-18,16],[-12,21],[-26,119],[-23,34],[-24,71],[-14,16],[-71,23],[9,-18],[10,-6],[21,1],[13,-14],[-1,-32],[-6,-35],[-3,-22],[14,-25],[46,-37],[15,-2],[0,-21],[-1,-38],[12,-49],[17,-42],[12,-17],[46,-23],[17,-27],[-10,-34],[6,-21],[-152,75],[-46,-54],[14,-26],[37,-27],[17,-30],[9,-35],[-1,-29],[-10,-24],[-17,-17],[-121,0],[-11,-20],[11,-41],[18,-34],[10,0],[9,-31],[20,-20],[17,-2],[4,23],[37,15],[56,122],[28,30],[6,-15],[-14,-34],[-83,-147],[-12,-36],[-3,-28],[-2,-63],[-4,-25],[-30,-76],[-4,-28],[1,-19],[1,-10],[2,-22],[-1,-11],[-4,-10],[-5,-5],[-5,-9],[-1,-19],[-2,-14],[-10,-47],[-4,-10],[-94,-16],[-65,-34],[-24,-15],[39,46],[81,34],[42,25],[-24,22],[-100,24],[-7,-5],[-2,-13],[2,-41],[-3,-8],[-7,-7],[-19,-29],[-11,-6],[-4,-8],[-19,-53],[-10,-16],[-50,-47],[-21,-32],[-19,-37],[-11,-37],[5,35],[3,15],[4,13],[0,21],[-6,0],[-6,-31],[-14,-27],[-15,-19],[-11,-7],[-3,-10],[2,-22],[7,-22],[9,-10],[20,3],[9,6],[8,13],[5,-43],[8,-40],[-21,0],[-26,-51],[-18,-14],[-42,7],[-19,13],[-17,22],[-29,51],[-17,23],[-19,10],[-8,-9],[-17,-40],[-9,-12],[-11,3],[-10,12],[-11,4],[-11,-19],[11,-23],[-9,-15],[-11,-5],[-22,1],[18,84],[0,19],[-30,-12],[-14,1],[-6,22],[-4,47],[-10,32],[-12,10],[-11,-15],[0,-21],[7,-15],[6,-15],[3,-22],[3,-31],[-12,12],[-26,14],[-12,15],[0,19],[9,43],[-13,64],[-23,59],[-20,26],[-18,30],[-36,21],[-23,10],[15,-19],[31,-19],[19,-14],[10,-34],[16,-75],[8,-25],[-7,-17],[-8,-5],[-8,6],[-8,16],[0,-23],[19,-25],[3,-47],[-8,-53],[-14,-44],[-22,-17],[-50,20],[-21,-22],[13,-16],[14,-7],[29,0],[-23,-28],[-58,-31],[-52,-7],[-54,-30],[-24,-29],[-4,15],[-6,14],[-2,15],[-26,-53],[-80,-95],[75,37],[18,-19],[-30,-37],[-235,-107],[-33,-44],[43,0],[0,-18],[-58,-74],[-19,-10],[-9,-8],[-31,-55],[-22,-23],[-8,-15],[-7,-26],[-10,29],[-9,6],[-9,-13],[-10,-22],[0,-21],[12,0],[0,-19],[-54,-57],[-20,-8],[6,44],[-49,-55],[-24,-43],[-14,-50],[15,-1],[12,16],[9,17],[-23,-71],[-13,-26],[-65,-84],[-43,-102],[-28,-22],[11,9],[11,15],[10,23],[5,36],[-137,-169],[-121,-53],[-19,8],[-15,26],[7,-18],[7,-14],[8,-7],[9,-3],[-17,-15],[-14,-6],[3,-32],[-1,-42],[-4,-36],[-11,-15],[-4,10],[-2,21],[0,41],[-2,10],[-16,23],[-34,70],[-10,13],[-14,8],[-8,-9],[-2,-27],[0,-45],[3,-57],[-1,-39],[-5,-19],[-13,11],[-1,27],[4,77],[-3,28],[-6,35],[-7,20],[-3,-20],[1,-82],[-2,-38],[-4,-35],[12,-28],[-5,-21],[-14,-13],[-18,-4],[10,69],[1,30],[-6,26],[4,26],[3,12],[3,5],[8,9],[0,18],[-3,15],[-2,0],[5,82],[1,45],[-3,20],[-3,12],[-10,23],[-10,14],[-5,-17],[-2,-80],[1,-32],[8,-27],[-15,-20],[-17,2],[-15,-5],[-9,-38],[11,-31],[4,-35],[7,-33],[15,-24],[-17,-35],[-33,-12],[-65,3],[-14,7],[-33,37],[-12,-13],[-12,-21],[-9,1],[-4,52],[-112,-105],[-50,-25]],[[5538,4849],[-403,-128],[-256,-165],[-227,1],[-237,-105],[-27,-2],[-21,7],[-234,151]],[[4133,4608],[49,120],[104,164],[9,21],[5,27],[1,21],[-1,21],[-2,16],[-5,14],[-8,5],[-267,17],[-217,8],[-42,32],[-14,3],[-291,-127],[-14,4],[-35,49],[-10,6],[-75,8],[-13,6],[-77,75],[-9,32]],[[3131,5730],[10,11],[7,42],[-13,74],[-3,50],[-3,22],[-8,31],[-16,46],[-7,28],[14,34],[5,9],[-3,27],[5,19],[10,17],[6,19],[5,47],[0,42],[-19,232],[-4,97],[12,43],[28,-22],[19,-55],[28,-130],[27,-74],[3,-22],[7,-22],[30,-14],[13,-16],[7,23],[-24,70],[-21,94],[-16,101],[-8,90],[-3,72],[0,50],[3,45],[4,17],[11,29],[4,15],[10,88],[3,20],[27,75],[102,113],[56,105],[17,13],[17,6],[13,13],[3,30],[12,3],[9,-9],[17,-36],[4,-1],[11,4],[3,-3],[3,-26],[-3,-8],[-4,-2],[-2,-7],[-7,-123],[0,-62],[7,-45],[-11,-52],[-1,-53],[10,-32],[20,12],[-9,56],[2,49],[11,23],[21,-24],[8,-20],[1,-12],[0,-18],[3,-35],[-3,-24],[-2,-20],[0,-17],[3,1],[17,-14],[5,-8],[6,-25],[4,-21],[4,-19],[10,-19],[10,-11],[11,-8],[12,-2],[11,2],[3,3],[17,17],[8,33],[5,47],[10,66],[-10,13],[-14,41],[-10,8],[-31,-4],[-15,6],[-13,21],[30,17],[29,2],[12,7],[25,28],[13,7],[11,-29],[-3,-136],[13,-44],[-3,49],[8,37],[6,35],[-11,46],[10,41],[29,59],[14,37],[4,22],[1,50],[4,23],[9,11],[17,0],[18,8],[-20,6],[-12,37],[-2,43],[12,20],[12,12],[9,32],[5,43],[2,50],[-7,78],[-17,72],[-23,57],[-21,32],[0,23],[24,31],[-9,89],[-24,99],[-34,108],[-6,29],[-6,105],[-6,51],[-10,39],[-13,32],[-16,26],[14,30],[13,47],[4,49],[-12,40],[19,22],[21,5],[38,-7],[9,6],[16,26],[9,10],[12,5],[32,-5],[18,14],[32,57],[15,13],[44,-23],[10,-1],[10,-2],[20,26],[4,-66],[12,-38],[18,-23],[21,-19],[-6,-23],[9,-13],[7,-23],[9,-46],[12,-45],[38,-101],[5,-27],[4,-24],[4,-20],[11,-13],[-3,-9],[-6,-23],[-3,-9],[18,-41],[23,-34],[17,-38],[-2,-57],[16,-21],[49,-11],[36,-34],[11,1],[10,-3],[11,-26],[6,-8],[11,3],[5,-5],[6,-22],[2,-22],[2,-21],[2,-20],[20,-61],[6,-23],[4,-38],[5,-83],[6,-35],[19,-37],[46,-19],[19,-38],[5,65],[7,23],[28,-5],[3,-5],[13,-26],[6,-9],[10,-4],[26,2],[-8,-7],[-7,-10],[-2,-14],[3,-25],[8,-1],[16,16],[10,18],[8,42],[10,88],[7,89],[0,77],[-6,72],[-13,75],[-26,106],[-2,19],[-54,84],[0,21],[4,29],[8,25],[11,10],[16,5],[18,16],[18,26],[13,35],[-10,17],[-9,25],[-7,30],[-8,65],[0,11],[3,8],[9,24],[17,28],[51,39],[121,28],[43,-45],[22,-6],[-2,51],[7,12],[7,8],[8,2],[9,-3],[-2,-12],[-4,-30],[18,-10],[31,-44],[18,-6],[-11,15],[-8,17],[-6,22],[-5,29],[6,0],[0,19],[-5,5],[-8,13],[-5,5],[0,19],[8,21],[10,72],[6,31]],[[4948,8757],[4,-3],[42,-54],[7,-15],[8,-21],[14,-59],[32,-88],[10,-23],[75,-126],[11,-36],[1,-24],[-16,-19],[-4,-7],[-2,-5],[-1,-2],[-1,-3],[0,-5],[-1,-10],[0,-12],[1,-22],[0,-9],[-1,-9],[-3,-8],[-4,-6],[-6,-6],[-6,-7],[-4,-9],[-2,-12],[2,-8],[3,-5],[15,-12],[11,-15],[6,-14],[4,-21],[3,-27],[0,-27],[-1,-21],[-4,-19],[-6,-20],[-23,-54],[-7,-11],[-7,-7],[-8,-5],[-32,-4],[-6,-3],[-5,-7],[-5,-10],[-4,-12],[-3,-17],[-3,-21],[-1,-32],[3,-21],[5,-18],[7,-12],[35,-35],[44,-66],[19,-9],[8,-12],[9,-21],[14,-52],[6,-26],[2,-20],[-2,-11],[-2,-13],[-1,-22],[3,-17],[6,-16],[6,-12],[7,-18],[2,-18],[1,-29],[-3,-17],[-5,-14],[-39,-43],[-6,-8],[-3,-11],[-2,-14],[0,-38],[-3,-14],[-4,-11],[-10,-20],[-3,-9],[-1,-10],[-1,-24],[-3,-12],[-4,-12],[-6,-8],[-10,-13],[-3,-6],[-2,-10],[-1,-15],[1,-12],[2,-9],[5,-13],[2,-3],[4,-5],[1,-1],[13,-6],[7,-6],[7,-12],[17,-40],[4,-5],[5,-3],[30,-8],[8,-7],[13,-20],[21,-22],[13,-24],[16,-25],[6,-14],[2,-13],[0,-12],[-2,-10],[-2,-11],[-5,-12],[-19,-34],[-3,-5],[-2,-9],[0,-9],[0,-26],[0,-10],[-1,-13],[-4,-14],[-9,-30],[-5,-20],[0,-25],[5,-14],[9,-11],[13,-9],[14,-16],[12,-20],[9,-32],[3,-28],[3,-34],[6,-23],[10,-15],[12,-9],[62,-12],[8,-9],[8,-16],[4,-31],[12,-104],[12,-49],[15,-41],[40,-64],[74,-67],[13,-18],[15,-35],[7,-33],[9,-71],[9,-117],[4,-155],[-1,-83],[-2,-68],[-4,-57],[-22,-201],[-40,-249]],[[5602,8217],[-12,-11],[-11,5],[-8,12],[-5,18],[-2,24],[-6,37],[-9,44],[6,11],[17,-27],[8,-20],[8,-17],[14,-40],[0,-36]],[[6079,8802],[-1,-35],[-8,2],[-3,-5],[-3,4],[3,-7],[-1,-10],[-16,10],[-15,0],[-1,27],[9,10],[24,7],[12,-3]],[[6943,3599],[-513,449],[-458,391],[-259,217],[-90,79],[-85,114]],[[4948,8757],[0,1],[9,19],[31,38],[81,42],[29,-20],[-7,-98],[18,10],[12,27],[20,66],[-4,30],[-3,11],[17,19],[25,-6],[45,-31],[-7,-46],[-15,-67],[-3,-45],[10,1],[65,94],[27,-9],[22,-37],[18,-40],[17,-19],[9,-21],[-11,-49],[-26,-78],[12,-1],[13,5],[12,11],[9,18],[11,11],[12,-13],[11,-20],[10,-11],[15,-23],[8,-53],[8,-62],[9,-48],[-16,-91],[-8,-54],[3,-24],[65,-23],[41,-36],[68,-14],[9,-10],[9,-24],[16,-50],[21,-23],[7,-32],[4,-35],[8,-41],[2,-13],[3,-10],[7,-4],[17,3],[8,-2],[6,-11],[9,-38],[3,-25],[-2,-85],[3,-35],[17,-55],[5,-23],[0,-129],[3,-19],[8,-9],[26,-54],[43,-63],[-5,-41],[5,-54],[10,-44],[15,-7],[12,38],[-1,56],[-8,56],[-9,36],[-7,12],[-19,20],[-5,12],[-4,34],[2,20],[5,14],[3,17],[0,29],[-2,21],[-1,22],[3,33],[5,12],[16,19],[4,10],[5,57],[-2,49],[-28,145],[0,9],[0,43],[-2,12],[-6,-1],[-6,-3],[-5,2],[-18,55],[-7,10],[-1,3],[-1,7],[-2,6],[-5,3],[-5,-6],[-7,-30],[-3,-6],[-13,12],[-28,50],[-9,22],[9,43],[-4,41],[-11,31],[-26,24],[-19,63],[-11,29],[0,21],[7,0],[0,23],[-25,86],[-11,142],[4,144],[25,88],[12,7],[81,-7],[12,-10],[22,-27],[13,-5],[39,5],[14,-5],[-2,-11],[0,-4],[-1,-2],[-4,-6],[34,-27],[89,32],[39,-24],[7,-23],[10,-61],[8,-22],[10,-7],[36,7],[16,-13],[29,-58],[17,-13],[12,-14],[36,-77],[11,-34],[15,-88],[10,-41],[29,-30],[16,-31],[23,-63],[31,-127],[13,-40],[3,59],[-7,45],[-12,41],[-9,45],[17,-1],[21,8],[20,15],[16,20],[-83,-6],[-22,25],[144,4],[11,-15],[6,-35],[13,-56],[5,0],[5,21],[1,23],[-3,21],[-8,18],[0,19],[12,14],[10,23],[5,31],[-2,40],[14,23],[6,15],[4,23],[1,18],[-2,47],[1,40],[12,41],[23,41],[27,31],[22,12],[10,16],[5,36],[1,36],[-4,16],[-10,9],[5,22],[18,43],[25,35],[55,29],[10,54],[24,-31],[91,-13],[24,-22],[0,-3],[18,-53],[35,-131],[-1,-16],[0,-7],[1,-6],[0,-14],[-12,0],[0,-21],[10,-13],[12,-7],[11,3],[11,17],[-6,2],[-13,19],[32,33],[114,44],[34,-15],[-15,1],[-14,-7],[-14,-13],[-13,-22],[11,-11],[17,-44],[6,3],[18,62],[11,24],[11,7],[26,-34],[18,-54],[20,-46],[30,-10],[0,19],[-29,29],[-14,22],[-10,22],[-7,40],[-1,30],[-3,24],[-17,23],[41,41],[62,28],[37,33],[21,0],[-80,-64],[-25,-38],[80,43],[19,-1],[22,-28],[35,-74],[24,-5],[0,23],[-32,46],[-17,34],[-6,34],[3,47],[9,39],[14,31],[16,20],[1,14],[-2,4],[3,15],[8,23],[6,30],[3,29],[-2,47],[-7,25],[-8,21],[-15,46],[-4,10],[-5,7],[-6,2],[-5,12],[-1,25],[-1,28],[-2,17],[-25,27],[-6,25],[6,54],[-3,1],[-9,-1],[3,10],[6,24],[3,10],[-6,9],[-4,13],[-9,39],[19,0],[0,20],[-15,30],[-18,98],[-25,41],[8,42],[19,37],[19,5],[5,-18],[1,-23],[2,-19],[11,-4],[2,13],[4,30],[7,29],[11,13],[26,15],[14,-2],[1,-24],[-5,-33],[3,-29],[8,-21],[10,-11],[-2,17],[-1,14],[-1,13],[-3,17],[14,8],[27,31],[8,5],[14,-16],[10,-24],[11,-19],[15,-4],[-12,-18],[-6,-4],[15,-20],[17,5],[18,12],[5,3],[0,22],[10,22],[10,29],[10,19],[2,-7],[6,-35],[11,-6],[10,18],[7,58],[8,14],[20,14],[25,0],[52,-31],[10,8],[42,25],[76,-104],[43,-24],[-12,-28],[-14,-12],[-12,-19],[-6,-47],[10,1],[3,-1],[0,-19],[-19,-23],[5,-9],[9,-24],[5,-9],[-11,-27],[13,-5],[32,11],[36,-11],[16,11],[-1,-13],[-3,-35],[-1,-14],[86,0],[17,-9],[14,-21],[9,-27],[-2,-29],[0,-19],[18,-83],[-38,-97],[-21,-39],[-28,-31],[13,-44],[11,17],[11,-10],[12,-18],[30,-18],[3,-21],[-4,-33],[-7,-42],[14,-17],[66,-4],[32,20],[11,-4],[5,-14],[9,-21],[4,0],[5,6],[9,13],[2,-33],[6,-27],[9,-19],[25,-16],[27,-42],[30,-32],[17,-42],[18,-26],[22,26],[-8,5],[-3,6],[-2,12],[15,16],[12,34],[8,48],[2,60],[-3,61],[-4,43],[6,30],[26,21],[112,0],[63,31],[5,24],[1,28],[5,24],[64,57],[10,36],[7,47],[15,38],[35,49],[24,24],[78,20],[21,-8],[35,-41],[21,-14],[173,40],[-43,-65],[-160,-100],[-72,-75],[-83,-29],[-29,-32],[-22,-54],[23,-11],[10,-16],[5,-24],[5,-6],[19,-55],[4,-13],[6,-17],[-4,-36],[-11,-51],[-7,-23],[-87,-116],[-15,-10],[-56,-4],[-24,-30],[-17,-68],[28,-30],[14,-9],[54,-5],[11,-23],[5,-58],[-9,-10],[-17,-24],[-11,-10],[19,-20],[102,-5],[59,-38],[41,5],[75,94],[46,8],[20,-15],[18,-29],[13,-46],[5,-69],[5,-36],[13,-12],[13,-4],[6,-12],[2,-35]],[[5943,9922],[-18,-17],[-16,35],[-2,50],[10,9],[22,-41],[7,-8],[-3,-28]],[[2364,2168],[118,10],[134,-22]],[[2616,2156],[-219,-368],[-16,-41],[-18,-55],[0,-1]],[[2363,1691],[-25,-13],[-37,-3],[-13,1],[-47,-22],[-245,83],[-19,-20],[-16,-38],[-17,-25],[-20,20],[13,21],[-21,0],[-34,-33],[-29,-14],[-18,-26],[-10,-10],[-9,-3],[-88,15],[-20,-12],[-5,-9],[-4,-13],[-6,-13],[-7,-5],[-11,9],[-14,40],[-10,10],[6,31],[7,20],[5,20],[2,35],[-4,34],[-8,15],[-10,12],[-10,24],[14,32],[18,111],[9,25],[40,0],[6,10],[-4,32],[-9,0],[-21,-21],[-18,6],[-19,22],[-15,39],[-6,58],[13,58],[4,25],[1,35],[-2,64],[1,29],[-1,24],[5,26],[10,21],[11,12],[13,-7],[28,-46],[31,-33],[25,-55],[22,-74],[12,-79],[-13,0],[15,-33],[22,-10],[89,-7],[22,8],[14,21],[-10,22],[5,25],[12,22],[11,15],[14,9],[43,11],[33,39],[10,5],[11,-7],[24,-30],[12,-7],[24,13],[44,58]],[[3567,0],[-4,0],[-9,5],[-4,11],[3,12],[6,20],[13,-1],[1,-35],[-6,-12]],[[3869,348],[-9,-19],[-7,11],[-4,27],[-6,24],[-7,36],[3,34],[18,14],[21,2],[2,-5],[-4,-15],[3,-11],[5,-36],[-7,-33],[-8,-29]],[[6158,1248],[-6,-35],[-14,-30],[-6,-4],[7,13],[4,16],[-1,18],[-8,9],[-10,-3],[-39,-20],[2,25],[28,41],[15,15],[7,3],[13,-4],[7,-19],[1,-25]],[[6481,1461],[-74,-37],[-84,-31],[10,22],[5,27],[0,33],[-5,31],[-7,-44],[-11,-30],[-13,-8],[-13,21],[2,-17],[0,-8],[1,-6],[4,-11],[0,-23],[-118,-125],[9,67],[23,37],[29,17],[26,4],[0,23],[-60,47],[-22,36],[-4,-41],[0,-17],[4,-25],[-23,-24],[-22,6],[-23,16],[-25,2],[19,-23],[0,-19],[-23,1],[-10,-6],[-10,-18],[-15,13],[-16,-18],[-13,-34],[-6,-34],[-5,-54],[-12,-37],[-16,-10],[-17,28],[-12,-26],[-4,-27],[5,-22],[15,-8],[11,6],[18,29],[14,6],[71,-12],[25,12],[-39,-114],[-24,-31],[-24,20],[3,6],[1,0],[1,1],[2,12],[-37,0],[1,-28],[-26,4],[-14,-18],[12,2],[8,-8],[3,-21],[-3,-35],[67,5],[13,17],[-22,-103],[-33,-95],[-41,-69],[-93,-64],[-60,-68],[-56,-20],[-30,62],[12,23],[25,14],[10,17],[12,33],[11,15],[29,3],[0,21],[-26,1],[-48,-23],[-25,1],[-62,58],[-18,7],[5,-23],[-6,-5],[-3,-6],[-3,-10],[9,-19],[19,-52],[6,-11],[9,-19],[4,-44],[3,-43],[3,-19],[38,-4],[21,0],[15,-4],[-193,-45],[-113,-82],[-190,-79],[-47,3],[-173,82],[-74,-31],[-26,12],[10,2],[4,4],[5,13],[-33,11],[-16,13],[-13,19],[-18,-39],[-122,39],[-12,8],[-47,55],[-74,23],[-106,108],[-146,60],[-28,39],[12,3],[7,12],[-1,15],[-12,14],[-11,1],[-15,-19],[-11,-5],[-87,23],[3,-16],[90,-28],[-239,25],[-15,38],[-4,-3],[-3,-5],[-2,-5],[-3,-6],[-5,13],[-2,3],[-6,3],[6,-42],[-69,-2],[-34,12],[-138,175],[-14,25],[13,-17],[15,-8],[15,6],[14,19],[-12,4],[-21,14],[-11,3],[4,48],[2,13],[-17,-37],[-15,-14],[-16,6],[-20,26],[0,19],[31,-19],[-12,47],[-17,27],[-18,22],[-16,29],[-14,52],[-8,37],[-11,18],[-22,-2],[0,-19],[31,-68],[19,-50],[12,-51],[-60,83],[-28,54],[-17,72],[4,5],[8,17],[-6,15],[-13,48],[26,44],[28,26],[61,14],[29,-20],[50,-81],[30,-6],[-15,30],[-22,57],[-12,20],[-70,61],[28,76],[4,30],[-4,43],[-10,11],[-8,-11],[3,-24],[0,-19],[-10,-30],[-40,-76],[-25,-44],[-17,-27],[-22,-11],[-8,-12],[-1,-29],[1,-35],[-2,-31],[-7,-29],[-4,-7],[-41,36],[-40,52],[-30,21],[-64,75],[59,0],[11,-7],[21,-32],[14,-2],[2,17],[12,6],[30,-2],[0,20],[-25,0],[0,21],[3,1],[6,-1],[4,0],[0,20],[-65,-25],[-23,5],[0,20],[31,60],[9,93],[-12,79],[-14,7],[-20,11],[0,-19],[25,-16],[-3,-42],[-17,-49],[-34,-69],[-21,-25],[-25,-8],[-24,21],[9,-50],[4,-13],[-37,59],[-82,82],[-116,65],[-39,43],[-22,15],[-21,25],[-19,47],[5,24],[-1,30],[-10,72],[71,-7],[39,13],[26,36],[-68,0],[-43,36],[-16,5],[-46,-18],[-10,-13],[-8,-19],[-28,-45],[-11,-11],[0,-19],[47,-31],[23,-29],[11,-46],[-18,15],[-41,10],[-42,-8],[-26,-16],[-14,-32],[12,-53],[-5,-1],[-3,-5],[-2,-8],[-3,-7],[-266,-54],[-32,33],[-30,49],[-29,30],[-30,7],[-125,-69]],[[2616,2156],[35,-2],[6,3],[1,5],[6,49],[5,18],[22,37],[22,48],[37,108],[79,232],[7,34],[7,42],[-12,78],[-2,19],[0,22],[3,19],[13,47],[11,29],[216,325]],[[3072,3269],[64,122],[134,184],[106,183],[21,23],[147,77],[285,267],[243,166],[26,37],[14,30],[4,11],[3,21],[3,24],[-1,37],[-2,45],[0,22],[1,17],[13,73]],[[2414,2993],[38,40],[27,46],[20,52],[16,62],[8,18],[16,15],[20,6],[40,-8],[17,0],[-18,11],[-8,11],[-7,0],[36,46],[20,14],[22,5],[124,-49],[22,7],[15,37]],[[2822,3306],[56,27],[84,6],[37,34],[11,3],[40,-10],[9,-7],[12,-15],[4,-8],[2,-14],[-3,-11],[-2,-42]],[[1996,3781],[2,-6],[4,2],[-6,-21],[-13,-6],[-11,-23],[-4,9],[0,23],[-3,2],[-1,6],[6,14],[9,14],[14,0],[3,-14]],[[1920,4421],[14,-25],[14,8],[4,-1],[0,-21],[-5,-4],[-10,4],[-13,11],[-14,27],[-17,35],[-9,16],[-4,33],[22,-46],[18,-37]],[[1906,5467],[1,-13],[-54,-14],[-6,4],[-4,0],[-12,-24],[-3,4],[5,21],[-2,11],[2,8],[6,-1],[3,-5],[41,20],[23,-11]],[[1767,5589],[4,-6],[-1,-15],[-1,-7],[1,-6],[-1,-4],[-9,-11],[-11,-7],[-5,6],[5,5],[8,4],[0,12],[-6,0],[-5,11],[-4,-2],[0,17],[4,-1],[3,2],[9,16],[9,-14]],[[1652,5603],[5,-5],[6,5],[4,-1],[-2,-9],[-6,-7],[-5,2],[-2,15]],[[1814,5633],[-2,-14],[-7,-11],[-3,-8],[-4,3],[-4,-4],[-2,-12],[2,-1],[-1,0],[-7,0],[-4,6],[-5,12],[-1,18],[7,-5],[2,0],[3,-5],[0,-4],[2,7],[4,3],[2,2],[2,12],[4,-7],[3,-1],[4,8],[5,1]],[[1706,5671],[-6,-7],[-7,-7],[-2,-6],[-6,-2],[-7,21],[6,-2],[3,4],[1,6],[5,5],[1,7],[7,0],[5,0],[0,-19]],[[1722,5710],[-19,-8],[-3,12],[9,23],[33,41],[7,-5],[-1,-9],[-11,-6],[-5,-9],[-13,-15],[-1,-8],[4,-11],[0,-5]],[[2822,3306],[10,24],[-41,-34],[-22,15],[0,19],[9,-1],[7,5],[15,17],[0,14],[-1,4],[-2,0],[-3,3],[6,0],[-165,15],[-77,-27],[-69,-91],[-3,-12],[-3,-17],[-4,-19],[-8,-16],[-8,-9],[-18,-9],[-8,-1],[-14,-8],[-41,-44],[-13,-24],[-34,-45],[-43,9],[-82,45],[0,23],[39,33],[36,51],[30,62],[19,18],[20,-18],[17,27],[40,18],[17,18],[-81,13],[-25,-13],[-17,-18],[-14,-7],[-14,17],[-17,52],[12,28],[2,37],[1,43],[7,47],[6,4],[7,-9],[6,-1],[5,53],[5,25],[11,42],[2,32],[23,32],[101,76],[54,8],[-4,27],[-9,16],[-11,5],[-13,-4],[0,19],[17,23],[34,69],[31,20],[14,26],[9,10],[12,4],[38,-4],[-3,-55],[18,-9],[23,-1],[12,-31],[12,-22],[75,-7],[-15,17],[-31,-5],[-16,7],[-13,21],[-20,47],[-17,15],[37,23],[0,19],[-93,0],[0,23],[52,46],[17,26],[15,6],[71,-18],[0,23],[-70,22],[-23,-1],[-58,-79],[-23,-4],[0,21],[24,33],[9,22],[5,30],[-36,-58],[-11,-9],[-8,-15],[-6,-71],[-11,-16],[-9,-8],[-38,-55],[-47,-26],[-14,-17],[6,-42],[-27,14],[-26,-11],[-52,-66],[-22,-38],[-14,-12],[-15,9],[-9,29],[1,30],[15,68],[-19,-9],[-9,-35],[-3,-46],[0,-48],[-3,-15],[-22,-58],[-4,-28],[0,-21],[-1,-18],[-7,-18],[-33,0],[-5,-11],[-3,-11],[-8,-9],[-9,-7],[-7,-2],[-15,10],[-16,27],[-14,40],[-8,48],[-8,-18],[-7,-12],[-8,-7],[-8,-5],[13,39],[11,48],[3,46],[-9,34],[4,5],[9,16],[-7,12],[-8,8],[-8,3],[-8,0],[3,10],[10,32],[0,19],[-42,-46],[-26,-18],[-20,3],[-16,37],[-6,50],[3,49],[13,31],[0,19],[-16,4],[-12,23],[-7,25],[-5,13],[-12,8],[-13,22],[-12,28],[-10,27],[23,-15],[23,-34],[24,-22],[23,27],[-19,0],[6,35],[8,23],[11,15],[12,11],[-8,17],[-4,4],[0,21],[105,76],[26,49],[0,21],[-56,-71],[-30,-23],[-29,-9],[-25,-23],[-28,-43],[-25,-27],[-18,29],[11,12],[26,52],[18,28],[11,22],[8,32],[-6,21],[8,5],[5,9],[11,27],[-20,35],[-27,11],[-58,-4],[13,42],[-19,0],[6,31],[17,60],[8,36],[-9,-4],[-9,-12],[-7,-20],[-6,-26],[-6,28],[-7,12],[-9,-4],[-9,-15],[0,-21],[-50,21],[-14,-11],[-27,-43],[-15,-9],[0,-23],[8,-3],[17,-18],[-83,-23],[-22,23],[21,-4],[11,2],[8,13],[-3,17],[-9,25],[-11,23],[-8,10],[-96,0],[14,-23],[48,-42],[0,-21],[-25,2],[-42,54],[-26,7],[6,0],[-114,15],[-108,0],[-124,13],[-53,81],[-50,5],[-88,-29],[0,-8],[-16,-42],[-6,-12],[-10,-13],[-10,-10],[-11,-4],[-105,48],[9,13],[11,7],[11,3],[-15,9],[-35,-27],[-27,-51],[-4,-61],[-17,-72],[-24,-29],[-67,-3],[-20,-8],[-40,-32],[-18,-4],[-66,55],[-14,30],[-13,7],[-9,15],[-4,52],[-5,27],[-39,89],[-16,49],[-14,51],[-25,130],[6,23],[18,-27],[17,11],[33,58],[18,15],[98,41],[19,-3],[73,-69],[100,-26],[9,8],[16,39],[9,14],[37,-3],[9,13],[33,75],[38,19],[82,-21],[0,23],[-5,9],[-3,9],[-2,10],[-3,14],[38,4],[12,-17],[-6,-52],[12,-13],[8,16],[7,21],[10,-1],[3,-29],[0,-43],[5,-22],[17,31],[14,-19],[16,12],[14,28],[5,31],[-3,31],[-7,40],[-5,43],[3,43],[25,49],[37,10],[74,-17],[-6,-35],[-12,-24],[-26,-26],[3,-12],[4,-30],[-10,-4],[-8,-11],[-6,-20],[-7,-26],[50,-106],[-6,46],[0,39],[4,32],[9,31],[5,7],[18,4],[7,8],[6,17],[6,39],[4,19],[25,47],[26,4],[24,-30],[21,-54],[14,31],[19,20],[56,20],[54,54],[-15,13],[-66,-13],[0,23],[38,12],[68,100],[36,13],[-5,-12],[-7,-9],[16,-6],[16,-15],[-2,-23],[0,-5],[2,-12],[-13,-26],[-27,-22],[-10,-18],[12,-5],[15,2],[15,9],[13,17],[6,-60],[8,-24],[30,-21],[41,-54],[15,-8],[0,19],[-11,9],[-11,19],[-22,57],[25,47],[13,15],[18,1],[2,40],[17,12],[76,-5],[74,25],[122,-35],[81,-60],[10,8],[14,27],[8,9],[68,0],[18,-13],[20,-21],[19,-10],[2,2],[15,21],[24,-23],[100,23],[25,29],[0,38],[-16,30],[-27,7],[9,41],[11,13],[13,7],[16,23],[12,35],[38,156],[3,106],[-29,44],[-39,-6],[-28,-41],[0,-21],[6,0],[0,-23],[-136,-167],[-46,-27],[-258,72],[-65,76],[-10,6],[-4,-2],[-13,-13],[-83,-19],[-24,15],[-17,30],[14,13],[26,12],[21,27],[7,-16],[6,-6],[17,-1],[0,23],[-20,21],[-23,3],[-43,-24],[9,45],[16,44],[31,57],[42,29],[16,26],[-2,50],[13,8],[33,-8],[8,11],[26,74],[25,26],[101,41],[85,94],[33,58],[58,43],[21,32],[-2,4],[-3,-1],[-1,2],[0,14],[14,-2],[22,-35],[14,-3],[-9,48],[-4,15],[56,46],[118,53],[34,29],[22,18]]],"transform":{"scale":[0.00110380911131114,0.00032691664346434855],"translate":[-24.539906378999973,63.29531484600001]}};
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
