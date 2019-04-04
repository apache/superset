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
  Datamap.prototype.kgzTopo = {"type":"Topology","objects":{"kgz":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Bishkek"},"id":"KG.GB","arcs":[[0]]},{"type":"Polygon","properties":{"name":"Chuy"},"id":"KG.GB","arcs":[[1,2,3,4,5],[-1]]},{"type":"Polygon","properties":{"name":"Ysyk-Köl"},"id":"KG.YK","arcs":[[6,-2,7]]},{"type":"Polygon","properties":{"name":"Naryn"},"id":"KG.NA","arcs":[[8,9,10,-3,-7]]},{"type":"Polygon","properties":{"name":"Batken"},"id":"KG.BA","arcs":[[11,12],[13],[14],[15]]},{"type":"Polygon","properties":{"name":"Jalal-Abad"},"id":"KG.DA","arcs":[[-4,-11,16,17,18]]},{"type":"Polygon","properties":{"name":"Talas"},"id":"KG.TL","arcs":[[-5,-19,19]]},{"type":"Polygon","properties":{"name":"Osh"},"id":"KG.OS","arcs":[[-10,20,-12,21,-17]]}]}},"arcs":[[[4898,8879],[-14,5],[-12,-26],[-7,-31],[-5,-14],[-6,0],[-6,13],[-5,21],[-1,32],[3,22],[-1,31],[-14,16],[-37,61],[-9,40],[13,31],[49,24],[17,27],[11,29],[9,41],[4,3],[3,-5],[7,-45],[7,-34],[15,-31],[12,-30],[3,-11],[2,-13],[-2,-13],[-10,-11],[-6,-22],[-10,-16],[-2,-30],[0,-28],[3,-30],[-2,-6],[-9,0]],[[7238,9135],[10,-61],[-2,-21],[-3,-17],[-5,-5],[-7,1],[-12,7],[-6,0],[-5,-5],[-4,-8],[-23,-50],[-4,-20],[-5,-45],[-5,-14],[-7,-12],[-25,-16],[-18,-8],[-214,9],[-11,-4],[-5,-11],[-4,-13],[-2,-15],[-3,-16],[-4,-15],[-6,-16],[-6,-6],[-7,-2],[-29,9],[-42,35],[-10,4],[-6,-3],[-48,-52],[-13,-6],[-10,0],[-29,21],[-23,-3],[-58,26],[-9,2],[-6,-6],[-4,-11],[-17,-76],[-6,-8],[-6,-5],[-67,-31],[-63,-58],[-20,-25],[-19,-30],[-50,-119],[-6,-12],[-22,-31],[-9,-9],[-8,-3],[-7,0],[-6,2],[-11,6],[-15,17],[-21,0],[-126,-61],[-16,-3],[-69,12],[-12,-4],[-8,-10],[-9,-41],[-5,-10],[-9,-12],[-23,-21],[-12,-15],[-21,-37],[-12,-10],[-11,-5],[-12,-2],[-6,-8],[-2,-12],[0,-38],[-1,-7],[-4,-24],[-3,-11],[-7,-12],[-36,-45]],[[5811,8030],[-17,-16],[-3,-11],[-12,-28],[-47,-63],[-13,-8],[-6,4],[0,13],[3,44],[-1,13],[-2,12],[-2,12],[-3,9],[-6,8],[-5,-1],[-14,-14],[-66,-33],[-13,-1],[-7,4],[-38,35],[-6,-1],[-6,-5],[-5,-8],[-7,-8],[-26,-19],[-10,-2],[-138,10],[-36,26],[-8,-2],[-5,-6],[-5,-10],[-12,-19],[-29,-20],[-24,60],[-9,8],[-8,2],[-5,-9],[-7,-12],[-12,-12],[-131,-41],[-11,-12],[18,-87],[42,-136],[6,-33],[2,-26],[-5,-8],[-6,-1],[-8,3],[-20,15],[-6,1],[-71,-14],[-17,-19],[-36,-96],[-21,-62],[-6,-1],[-5,0],[-3,11],[-1,12],[-3,12],[-5,10],[-22,2],[-160,-50],[-10,6],[-6,7],[-9,7],[-36,12],[-22,0],[-6,-1],[-5,-5],[-2,-3],[-3,-25],[-17,-204],[1,-27],[3,-28],[23,-11],[7,-9],[7,-17],[2,-9],[-2,-8],[-11,-16],[-9,-16],[-11,-31],[-4,-14],[-4,-16],[-4,-24],[-1,-14],[1,-15],[4,-41],[-1,-20],[-4,-20],[-23,-50],[-7,-23],[-3,-17],[-1,-18],[2,-40],[-3,-18],[-6,-17],[-10,-17],[-10,-9],[-8,-1],[-6,4],[-4,6],[-8,15],[-4,6],[-4,3],[-5,0],[-6,-4],[-26,-36],[-8,-16],[-4,-15],[-2,-20],[-4,-61],[-5,-15],[-5,-9],[-5,2],[-4,4],[-3,9],[-2,10],[-1,15],[0,16],[4,54],[1,17],[-1,14],[-3,9],[-4,5],[-5,0],[-21,-15],[-7,-3],[-8,1],[-7,4],[-8,8],[-5,10],[-5,12],[-11,39],[-4,11],[-9,15],[-4,12],[-3,14],[-5,30],[-2,10],[-6,21],[-38,-61],[-17,-13],[-15,2],[-108,-23]],[[4147,6797],[-15,103],[-9,34],[-13,13],[-8,6],[-19,8],[-8,0],[-6,-2],[-6,-3],[-20,-22],[-5,-8],[-7,-16],[-6,-16],[-5,-8],[-7,-7],[-15,-5],[-9,2],[-84,66],[-12,5],[-12,-2],[-27,-13],[-14,-1],[-29,24],[-10,6],[-9,2],[-25,-15],[-4,4],[-2,9],[-7,47],[-4,22],[-3,11],[-5,12],[-9,14],[-16,20],[-11,9],[-10,4],[-15,0],[-6,8],[-13,27],[-11,8],[-40,15],[-47,35],[-13,6],[-9,1],[-6,-5],[-4,6],[-4,10],[-6,32]],[[3522,7243],[10,38],[2,13],[0,9],[-1,7],[-3,6],[-4,4],[-34,21],[-5,9],[-3,13],[-1,17],[1,13],[7,73],[3,19],[7,13],[10,8],[29,-1],[12,5],[11,16],[10,27],[3,8],[4,4],[25,25],[22,13],[17,4],[17,11],[13,2],[17,-4],[11,-10],[13,-5],[14,3],[35,31],[16,7],[21,2],[35,-10],[6,-5],[25,-28],[15,0],[20,10],[55,47],[13,16],[26,69],[2,39],[5,22],[15,42],[24,47],[4,14],[3,20],[-1,28],[-3,18],[-11,33],[-10,7],[-4,0],[-26,-6],[-9,0],[-8,4],[-7,6],[-6,8],[-3,8],[-3,10],[-3,11],[-5,43],[-3,9],[-5,0],[-7,-19],[-4,-22],[-2,-30],[2,-15],[1,-11],[1,-10],[-6,-28],[-23,-41],[-25,6],[-1,0]],[[3878,7936],[-65,254],[-14,77],[-7,82],[3,92],[10,87],[48,217],[24,106],[3,37],[-2,45],[-11,82],[-3,41],[3,43],[8,35],[19,66],[34,199],[10,36],[14,25],[43,50],[156,128],[15,7],[38,-3],[34,36],[30,169],[28,42],[18,-13],[32,-62],[17,-11],[143,34],[15,17],[2,35],[-9,42],[-25,68],[26,-29],[46,-84],[26,-21],[30,-13],[26,-27],[47,-77],[18,-19],[38,-8],[33,-43],[37,-20],[17,-19],[12,-32],[23,-78],[13,-30],[93,-143],[32,-24],[103,-35],[78,-76],[25,-45],[26,-25],[55,-34],[26,-30],[22,-34],[54,-66],[24,-11],[60,2],[205,-54],[35,8],[18,-5],[59,-49],[23,2],[27,23],[25,37],[22,45],[10,32],[29,157],[10,19],[14,7],[9,1],[47,8],[35,-10],[72,-42],[20,-3],[59,40],[24,1],[66,-32],[83,0],[77,-48],[10,3],[18,17],[11,1],[9,-12],[10,-39],[9,-10],[16,10],[28,53],[16,15],[24,-6],[47,-40],[24,-9],[19,9],[35,31],[40,-2],[18,8],[34,38],[4,9],[1,11],[2,9],[7,3],[16,-7],[6,1],[7,9],[19,45],[17,25],[18,6],[41,1],[35,28],[18,6],[18,-15],[103,-35],[31,-22],[10,-18],[26,-73],[13,-22],[15,-7],[15,-1]],[[8162,4870],[0,1],[-18,25],[-11,26],[-5,22],[-6,37],[-8,37],[-6,18],[-7,14],[-7,7],[-10,6],[-8,2],[-6,-1],[-11,-10],[-19,-26],[-14,-23],[-40,-46],[-23,-11],[-43,-11],[-67,-1],[-116,64],[-85,-3],[-12,5],[-9,8],[-3,10],[-2,24],[0,27],[1,15],[2,14],[12,55],[2,13],[0,15],[-3,14],[-8,15],[-14,5],[-30,3],[-11,-4],[-31,-30],[-149,-86],[-29,-8],[-4,8],[0,11],[3,12],[4,9],[9,15],[4,10],[4,11],[3,14],[10,78],[2,28],[1,14],[3,13],[14,45],[3,11],[0,10],[-1,10],[-6,13],[-6,9],[-30,38],[-46,43],[-13,27],[-1,12],[0,13],[-4,50],[-5,29],[-5,22],[-4,26],[0,8],[3,1],[8,-7],[1,-1],[1,-1],[2,-1],[6,-1],[6,6],[7,12],[16,86],[7,61],[5,102],[-7,47],[-4,1],[-5,0],[-14,-22],[-18,-14],[-30,-16],[-8,-7],[-10,-17],[-8,-10],[-12,-12],[-9,-5],[-163,-7],[-51,25],[-65,13],[-10,0],[-12,-7],[-28,-26],[-19,-11],[-21,-4],[-45,12],[-7,5],[-6,8],[-3,10],[-2,11],[-4,11],[-6,10],[-11,9],[-7,0],[-17,-14],[-15,-8],[-7,5],[-2,10],[2,13],[3,12],[15,44],[10,37],[5,30],[1,15],[2,43],[2,16],[3,14],[3,14],[14,46],[2,14],[5,44],[1,14],[-1,13],[-3,11],[-3,9],[-20,26],[-24,25],[-14,10],[-10,4],[-6,-3],[-15,-17],[-18,-7],[-121,11],[-4,9],[-4,14],[-1,12],[-15,36],[14,53],[10,15],[10,12],[7,4],[21,4],[57,-7],[28,5],[7,11],[5,13],[1,41],[1,13],[9,60],[18,81],[-3,8],[-5,3],[-5,-3],[-21,-22],[-6,-2],[-7,0],[-15,7],[-28,23],[-74,80],[-14,6],[-67,4],[-7,3],[-27,22],[-21,27],[-35,19],[-7,2],[-7,0],[-22,-15],[-6,-2],[-7,0],[-10,7],[-13,15],[-22,33],[-12,14],[-9,7],[-5,-3],[-22,-20],[-69,-40],[-8,-2],[-8,0],[-14,9],[-5,10],[-3,14],[1,13],[3,13],[3,11],[5,8],[19,26],[19,33],[8,18],[4,12],[3,12],[4,30],[1,15],[0,18],[-3,20],[-8,30],[-7,15],[-7,11],[-34,43],[-6,16],[-3,15],[2,33],[-1,18],[-4,10],[-6,5],[-10,3],[-7,7],[-3,10],[-2,13],[0,13],[6,60],[2,16],[15,85],[1,13],[-1,16],[-3,26],[-3,12],[-3,10],[-10,25],[-16,22],[-3,11],[-2,14],[-1,13],[0,13],[-2,35],[-5,28],[-6,14],[-7,9],[-23,12],[-8,1],[-6,-1],[-4,-10],[-3,-12],[-2,-13],[-4,-12],[-3,-11],[-9,-14],[-5,-5],[-11,-9],[-65,-9],[-8,2],[-5,8],[-3,9],[-14,59],[-6,12],[-6,9],[-26,25],[-6,7],[-6,6],[-7,5],[-23,4],[-4,8],[-3,11],[-12,80],[-2,22]],[[7238,9135],[16,0],[90,-30],[29,17],[39,37],[14,7],[14,-2],[25,-18],[36,1],[18,-19],[15,-26],[18,-20],[15,-1],[48,46],[18,7],[60,-4],[61,-30],[6,-14],[4,-17],[6,-13],[10,-16],[24,21],[15,20],[8,7],[20,6],[21,-4],[21,-16],[51,-61],[40,-13],[98,18],[41,-5],[42,12],[17,-6],[38,-27],[19,-3],[15,12],[33,42],[19,14],[40,6],[60,-12],[89,-62],[38,-44],[31,-52],[16,-16],[109,-22],[73,-60],[60,-7],[35,-28],[34,-2],[71,71],[36,14],[22,-13],[7,-25],[-5,-94],[1,-57],[5,-50],[9,-46],[13,-45],[33,-66],[71,-67],[29,-61],[41,-198],[25,-67],[46,-38],[87,-11],[73,28],[39,-3],[201,-87],[38,-51],[13,-30],[35,-103],[58,-107],[30,-80],[24,-84],[28,-74],[39,-47],[6,-38],[3,-79],[4,-41],[10,-35],[11,-31],[8,-35],[1,-47],[-24,-77],[-45,-31],[-227,5],[-47,-24],[-33,-28],[-14,-24],[-13,-36],[-8,-43],[-10,-91],[-9,-44],[-32,-62],[-41,-12],[-43,2],[-40,-20],[-51,-74],[-59,-45],[-71,-99],[-19,-15],[-21,-1],[-57,38],[-20,-10],[-16,-22],[-43,-82],[-19,-29],[-20,-17],[-42,-20],[-35,-29],[-102,-149],[-55,-21],[-17,-17],[-82,-118],[-122,-98],[-13,-15],[-12,-21],[-7,-27],[-7,-61],[-9,-24],[-32,-30],[-67,-28],[-84,-133],[-36,-34],[-16,-22],[-15,-38],[-4,-44],[16,-95],[3,-44],[-10,-42],[-16,-29],[-36,-44],[-15,-29],[-22,-70],[-18,-68]],[[8162,4870],[-24,-96],[-13,-39],[-13,-30],[-91,-162],[-16,-13],[-19,5],[-35,33],[-119,35],[-32,-2],[-31,-21],[-119,-131],[-14,-10],[-17,-3],[-46,4],[-70,-41],[-26,3],[-27,28],[-51,45],[-51,22],[-29,-4],[-52,-33],[-113,15],[-27,19],[-49,51],[-25,9],[-97,-45],[-36,-31],[-23,-48],[-13,-39],[-34,-50],[-15,-31],[-9,-46],[4,-47],[6,-48],[3,-49],[-8,-50],[-14,-31],[-36,-41],[-30,-54],[-24,-75],[-15,-89],[-6,-249],[-3,-39],[-11,-35],[-48,-77],[-23,-76],[-29,-173],[-20,-70],[-25,-50],[-79,-107],[-29,-59],[-15,-11],[-13,30],[-14,151],[-9,42],[-27,17],[-26,-61],[-27,-79],[-31,-39],[-17,8],[-34,39],[-17,11],[-22,-4],[-81,-81],[-12,-35],[-10,-41],[-15,-42],[-18,-26],[-19,-8],[-20,2],[-59,31],[-20,3],[-19,-4],[-42,-38],[-21,-3],[-15,34],[-8,43],[-14,108],[-2,47],[7,47],[12,34],[9,32],[-2,44],[-9,27],[-25,49],[-10,31],[-7,47],[-5,139],[-16,104],[-25,52],[-33,0],[-38,-47],[-198,-328],[-9,-11],[-11,-4],[-11,-10],[-5,-19],[-3,-23],[-7,-20],[-17,-9],[-17,17],[-17,25],[-16,14],[-23,-8],[-44,-42],[-23,-6],[-33,15],[-33,29],[-79,113],[-21,20],[-19,-4],[-3,-9]],[[5081,3238],[-24,21],[-70,-3],[-16,4],[-11,6],[-4,8],[-8,24],[-7,16],[-67,24],[-13,13],[-7,14],[4,29],[3,14],[2,14],[2,14],[0,14],[-1,13],[-3,15],[-5,17],[-12,26],[-10,12],[-125,95],[-19,23],[-37,65],[-15,37],[-7,19],[-8,32],[-7,19],[-29,60],[-34,68],[-15,19],[-10,18],[-4,12],[-2,12],[0,31],[-2,19],[-6,27],[-4,15],[-7,13],[-23,31],[-99,181],[-4,10],[-12,38]],[[4365,4377],[80,199],[12,38],[2,21],[-70,117],[-2,18],[2,16],[7,36],[6,14],[7,8],[7,-1],[8,-2],[8,1],[9,7],[10,25],[6,11],[6,6],[15,8],[8,7],[24,33],[3,3],[46,2],[73,33],[6,-1],[7,-3],[16,-15],[10,-4],[13,6],[4,6],[1,6],[-2,6],[-3,9],[-5,11],[-25,71],[-4,19],[-12,61],[0,19],[4,12],[9,10],[73,52],[23,29],[15,13],[13,8],[57,17],[15,10],[32,33],[27,19],[8,11],[7,15],[31,90],[5,22],[12,69],[11,92],[8,52],[2,26],[2,80],[2,26],[12,54],[3,17],[1,15],[-1,8],[-9,16],[-25,35],[-7,2],[-12,-1],[-7,-5],[-5,-7],[-3,-8],[-2,-16],[-1,-5],[-1,-5],[-2,-4],[-8,-10],[-113,-98],[-15,-4],[-6,6],[-9,5],[-11,3],[-18,-2],[-9,-8],[-19,-33],[-20,-20],[-11,-2],[-9,6],[-6,10],[-6,6],[-49,13],[-47,-4],[-20,-8],[-14,-10],[-9,-11],[-6,-3],[-6,2],[-6,7],[-14,27],[-9,13],[-13,11],[-21,6],[-15,-2],[-29,-18],[-10,-2],[-11,3],[-9,9],[-10,11],[-19,38],[-5,7],[-5,4],[-7,2],[-6,4],[-5,9],[-9,24],[-7,13],[-9,10],[-11,8],[-16,-7],[-5,19],[-13,67],[-9,30],[-4,2],[-1,14],[4,8],[23,43],[5,6],[6,4],[6,2],[37,-11],[17,-9],[8,-8],[9,-12],[7,-15],[5,-19],[4,-21],[2,-19],[0,-19],[0,-14],[-2,-37],[5,-19],[12,-17],[29,-20],[12,-1],[7,8],[0,17],[-12,196],[-5,51],[-3,21],[-4,11],[-6,7],[-29,14],[-40,4],[-32,14],[-3,4],[-1,7],[-1,11],[5,135],[0,38],[-3,35],[-3,19],[-4,14],[-3,8],[-4,6],[-22,14],[-10,11],[-4,3],[-3,-1],[-24,-27],[-6,-2],[-5,5],[-11,19],[-6,9],[-30,28],[-3,1],[0,-6],[1,-24],[-1,-16],[-3,-14],[-6,-15],[-7,-10],[-7,-6],[-8,2],[-10,11],[-11,19],[-21,51],[-6,13],[-6,9],[-7,12],[-3,11],[1,9],[2,5],[4,2],[13,0],[6,3],[5,5],[5,10],[3,11],[6,25],[21,61],[6,30]],[[2526,2634],[1,0],[32,3],[44,36],[80,46],[14,-6],[9,-16],[7,-39],[-1,-24],[-6,-45],[1,-26],[2,-20],[5,-27],[-2,-24],[-6,-15],[-9,-10],[-4,-12],[2,-16],[8,-16],[38,-34],[13,-21],[6,-25],[2,-38],[-6,-27],[-20,-37],[-3,-10],[1,-12],[29,-29],[9,-17],[5,-17],[1,-26],[-2,-16],[-5,-16],[0,-20],[2,-24],[9,-38],[1,-26],[-3,-23],[-5,-20],[-4,-25],[-1,-19],[0,-18],[4,-15],[9,-9],[24,-11],[12,-10],[15,-21],[10,-17],[9,-29],[14,-59],[20,-63],[14,-16],[9,2],[17,24],[8,8],[9,-5],[6,-14],[6,-52],[5,-23],[12,-25],[19,-50],[21,-78],[-12,-32],[-5,-27],[-3,-12],[-6,-11],[-8,-11],[-32,-35],[-45,-30],[-43,-41],[-24,-45],[-10,-14],[-14,-12],[-29,-18],[-20,-19],[-32,-12],[-57,21],[-28,-7],[-15,-7],[-20,-17],[-9,-4],[-9,1],[-18,25],[-7,6],[-13,-4],[-14,2],[-19,9],[-12,11],[-20,31],[-7,9],[-6,10],[-14,13],[-133,57],[-14,11],[-13,15],[-6,15],[-6,32],[-7,12],[-12,5],[-17,-1],[-11,-8],[-7,-12],[-10,-30],[-10,-22],[-17,-21],[-70,-36],[-22,-41],[-19,-80],[-3,-16],[-7,-69],[-8,-41]],[[2070,972],[-15,27],[-31,39],[-16,-3],[-32,-31],[-25,-10],[-9,-6],[-6,-10],[-13,-28],[-7,-11],[-31,-36],[-13,-20],[-29,-69],[-9,-16],[-12,1],[-51,21],[-39,-5],[-37,-22],[-30,-41],[-19,-68],[-13,-80],[-17,-68],[-29,-31],[-25,14],[-22,30],[-20,20],[-17,-17],[-11,-27],[-7,-6],[-8,3],[-14,-1],[-11,-7],[-28,-32],[-25,-8],[-27,10],[-24,30],[-14,50],[1,31],[4,32],[2,34],[-5,34],[-9,17],[-21,19],[-10,16],[0,1],[0,2],[-18,117],[-13,52],[-22,35],[-16,4],[-33,-13],[-16,4],[-11,14],[-21,38],[-12,10],[-16,-4],[-29,-23],[-15,-6],[-9,-7],[-5,-13],[-5,-13],[-5,-8],[-9,0],[-19,12],[-10,3],[-11,-10],[-81,-124],[-16,-8],[-16,12],[-1,35],[9,88],[0,42],[-4,45],[-9,24],[-14,-22],[-25,-114],[-8,-24],[-15,-10],[-14,11],[-31,37],[-18,9],[-20,1],[-19,-13],[-15,-28],[-14,-43],[-8,-12],[-27,26],[-37,8],[-70,-30],[-36,22],[-37,46],[-36,25],[-37,9],[-79,-10],[-16,-14],[-30,-55],[-16,-20],[-16,-12],[-17,-5],[-20,0],[-40,-14],[-18,14],[-22,48],[-5,7],[-9,-8],[-3,-16],[-3,-19],[-5,-18],[-36,-31],[-13,60],[5,292],[-3,47],[-7,40],[-13,33],[-16,29],[-14,32],[-6,45],[3,97],[10,95],[42,262],[17,81],[4,24],[0,15],[3,6],[13,-6],[27,-62],[43,-155],[88,64],[-2,33],[-20,79],[0,17],[0,16],[-2,16],[-4,14],[-7,78],[6,63],[14,56],[19,57],[2,16],[4,42],[4,11],[8,-5],[9,-37],[6,-12],[14,-4],[16,5],[357,265],[31,-7],[130,-176],[19,-13],[45,6],[21,-3],[20,-21],[13,-30],[11,-34],[15,-33],[16,-18],[32,-9],[35,-31],[72,-23],[22,-14],[22,-31],[9,-43],[-13,-55],[-15,-21],[-15,-16],[-14,-21],[-12,-34],[-8,-46],[-3,-43],[7,-32],[20,-15],[8,22],[7,54],[6,22],[11,11],[38,3],[20,14],[18,24],[16,34],[12,45],[8,85],[-1,75],[4,63],[24,47],[58,41],[12,16],[36,62],[5,16],[3,6],[5,1],[5,-4],[3,-6],[1,-4],[16,18],[6,12],[12,8],[49,-22],[28,20],[30,46],[15,60],[-18,60],[32,69],[53,19],[105,-31],[29,5],[13,42],[8,54],[14,45],[13,8],[9,-15],[8,-26],[9,-23],[13,-11],[15,-3],[28,6],[19,-2],[28,-56],[41,-26],[8,-29],[8,-36],[16,-33],[19,-25],[21,-17],[43,-18],[22,5],[8,28],[2,43],[6,47],[16,30],[16,-29],[13,-55],[6,-50],[0,-101],[6,-37],[18,-17],[13,8],[47,58],[15,29],[10,34],[17,78],[28,58],[33,4],[36,-18],[35,-6],[11,7],[5,2],[7,-4],[11,-9],[15,-5],[12,7],[6,27],[-5,19],[-6,8]],[[1628,1698],[12,17],[13,25],[10,15],[17,-2],[5,-21],[2,-27],[10,-20],[14,-3],[43,24],[30,2],[13,10],[9,29],[2,76],[-40,89],[-2,64],[15,30],[42,61],[6,38],[-7,23],[-11,5],[-24,-13],[-4,-6],[-10,-17],[-5,-3],[-7,2],[-3,4],[-3,6],[-51,44],[-25,34],[-15,40],[-13,67],[-15,60],[-21,27],[-28,-32],[-16,-77],[-5,-43],[-1,-41],[5,-39],[22,-103],[11,-31],[12,-13],[24,-11],[10,-17],[4,-71],[-38,-127],[1,-63],[12,-12]],[[1153,1701],[-13,0],[-1,-37],[7,-41],[12,-36],[30,-45],[9,-24],[26,-92],[5,-8],[47,78],[26,28],[30,12],[9,18],[2,44],[-7,45],[-11,6],[-29,-27],[-32,2],[-110,77]],[[2280,1747],[14,6],[9,30],[21,157],[-4,25],[-23,-14],[-33,-52],[-16,-16],[-22,-3],[-15,-36],[9,-36],[19,-29],[18,-17],[23,-15]],[[4365,4377],[-104,112],[-4,11],[-4,19],[-2,36],[1,32],[-1,24],[-3,17],[-19,30],[-6,14],[-2,23],[3,33],[-1,13],[-4,8],[-10,8],[-14,-4],[-15,-36],[-48,-164],[-6,-11],[-35,-49],[-10,-21],[-8,-21],[-3,-20],[-2,-19],[0,-18],[2,-33],[0,-13],[-1,-10],[-3,-7],[-6,-1],[-12,7],[-7,10],[-11,20],[-5,6],[-6,3],[-16,5],[-6,7],[-4,9],[-1,15],[-1,15],[-1,13],[-2,9],[-4,5],[-23,4],[-5,5],[-1,9],[2,11],[4,13],[11,25],[77,150],[4,17],[2,13],[-1,12],[-2,9],[-2,8],[-12,30],[-7,22],[-3,6],[-5,1],[-27,-11],[-6,-5],[-4,-8],[-3,-21],[1,-14],[2,-12],[2,-10],[1,-11],[0,-9],[-3,-10],[-5,-6],[-13,-8],[-10,-2],[-77,13],[-31,-2],[-4,2],[-6,4],[-3,-6],[-6,-13],[-17,-58],[-6,-16],[-11,-15],[-7,-13],[-6,-23],[-8,-35],[-8,-7],[-6,-3],[-6,1],[-4,3],[-2,6],[-6,22],[-4,13],[-4,10],[-5,6],[-5,-1],[-6,-5],[-47,-72],[-8,-17],[-7,-19],[-4,-28],[1,-21],[2,-35],[-1,-15],[-3,-29],[0,-12],[2,-13],[3,-13],[2,-16],[0,-13],[-1,-16],[-2,-15],[-8,-19],[-12,-20],[-53,-49],[-25,-52],[-16,-29],[0,-1]],[[3543,4041],[-20,10],[-54,-7],[-18,27],[-13,36],[-14,20],[-67,-64],[-42,-60],[-12,-3],[2,40],[-3,72],[-35,20],[-117,-22],[-39,10],[-35,32],[-28,63],[-39,124],[-18,14],[-22,3],[-17,18],[0,56],[2,15],[0,12],[-3,11],[-5,7],[-48,10],[-26,15],[-19,24],[-26,84],[-12,17],[-16,-28],[-5,-17],[-10,-65],[-7,-11],[-34,-10],[-52,-32],[-27,-18],[12,59],[6,44],[0,48],[-8,128],[-2,70],[-4,67],[-10,47],[-23,28],[-22,-7],[-22,-28],[-19,-36],[-27,-34],[-16,17],[-14,41],[-22,37],[-72,-25],[-23,23],[-5,104],[2,105],[-5,80],[-15,73],[-85,259],[-7,14],[-7,6],[-6,-10],[-1,-52],[-7,-13],[-9,8],[-5,39],[-9,9],[-5,-14],[-3,-27],[-6,-20],[-8,7],[-1,29],[17,138],[0,51],[-5,48],[-12,33],[-20,6],[-20,-16],[-11,-28],[-18,-94],[1,0],[9,-41],[25,-67],[4,-45],[-4,-49],[-13,-83],[-31,-133],[-25,-53],[-30,-13],[-40,35],[-43,84],[-13,6],[-5,-31],[8,-424],[-5,-85],[-20,-36],[-62,109],[-23,-59],[-10,-47],[-12,-2],[-12,25],[-8,34],[-11,93],[-11,30],[-21,3],[-19,-21],[-2,-34],[4,-44],[2,-51],[-9,-48],[-14,20],[-23,79],[-15,24],[-34,10],[-16,19],[-19,30],[-20,19],[-43,16],[-39,-12],[-18,4],[-17,32],[-12,35],[-15,31],[-16,25],[-18,15],[-20,-5],[-18,-17],[-14,-4],[-12,33],[-1,43],[13,151],[-1,51],[-9,51],[-51,179],[-15,41],[-17,22],[-31,-9],[-111,-130],[-31,-25],[-6,1],[-16,1],[-14,27],[-22,85],[-13,35],[-15,28],[-34,42],[-1,0],[-127,29],[-34,36],[-16,79],[19,64],[147,175],[54,87],[29,29],[28,37],[21,65],[26,116],[40,94],[90,156],[27,33],[91,21],[31,25],[10,41],[3,141],[16,90],[37,20],[45,-4],[37,18],[128,193],[75,44],[34,48],[13,91],[-3,2]],[[1834,7388],[1,1],[22,14],[121,-56],[11,-2],[13,2],[33,20],[19,19],[9,6],[113,7],[25,-14],[151,-138],[14,-7],[11,4],[6,5],[30,-13],[101,-86],[17,-12],[17,-21],[22,-40],[59,-4],[17,8],[17,20],[20,49],[10,45],[8,77],[6,32],[8,30],[12,23],[21,20],[17,10],[68,20],[29,1],[11,-8],[14,-26],[7,-27],[4,-24],[12,-15],[16,-8],[28,4],[32,-4],[31,-41],[15,-10],[37,24],[14,2],[30,-36],[50,-37],[19,-21],[18,-27],[42,-91],[13,-12],[16,-3],[28,9],[18,13],[11,24],[3,21],[0,27],[2,27],[15,26],[24,21],[88,44],[6,-3],[8,-16],[11,-11],[9,-6],[28,19]],[[1834,7388],[-29,20],[-127,184],[-29,24],[-29,-8],[-40,-60],[-20,-38],[-26,13],[-19,21],[-36,72],[-5,37],[11,38],[22,41],[10,21],[30,72],[6,28],[-2,17],[-5,17],[-2,26],[6,48],[10,48],[13,42],[14,26],[43,-56],[15,-3],[12,14],[9,24],[2,29],[-8,28],[-32,56],[-9,24],[-8,92],[34,42],[78,24],[14,30],[5,36],[-2,97],[3,52],[8,24],[34,23],[14,20],[12,31],[19,72],[16,15],[20,-12],[21,-21],[20,-7],[16,14],[14,28],[12,35],[9,36],[16,29],[22,2],[44,-30],[15,13],[10,2],[9,-10],[36,-61],[11,-9],[16,6],[99,128],[30,20],[64,6],[31,23],[15,6],[14,-12],[14,-19],[15,-13],[56,-28],[105,-117],[29,-17],[14,4],[26,25],[14,8],[116,-10],[60,-48],[107,-145],[32,-12],[65,2],[129,-63],[28,-31],[22,-48],[31,-117],[23,-42],[31,-29],[31,-17],[30,-3],[117,39],[40,-2],[34,-29],[18,-28],[15,-17],[16,-9],[65,-9],[21,-16],[14,-33],[-3,-75],[1,-53],[10,-31],[83,-29],[54,-44],[25,10],[1,44],[-1,1]],[[5081,3238],[-11,-35],[-3,-25],[-1,-9],[-7,-45],[-12,-51],[-6,-49],[6,-38],[43,-82],[11,-32],[7,-81],[-28,-15],[-76,41],[-20,2],[-17,-15],[-47,-98],[-15,-23],[-35,-39],[-31,-47],[-80,-183],[-97,-164],[-32,-29],[-28,-9],[-28,9],[-31,25],[-32,14],[-32,-8],[-32,-27],[-28,-41],[-29,-27],[-59,-17],[-25,-42],[-9,-26],[-8,-29],[-5,-32],[-3,-36],[-5,-58],[-15,-41],[-18,-38],[-13,-48],[-7,-102],[-4,-29],[-7,-20],[-26,-46],[-11,-35],[-8,-44],[-4,-49],[1,-47],[8,-49],[13,-16],[15,-8],[18,-22],[12,-43],[6,-52],[4,-105],[21,-132],[-5,-26],[-20,-26],[-15,-26],[-11,-35],[-11,-55],[-10,-85],[-9,-35],[-15,-18],[-171,-49],[-26,28],[-83,19],[-32,-6],[-99,-52],[-22,-32],[-7,-38],[-2,-35],[-7,-25],[-51,-20],[-92,-67],[-29,-5],[-32,19],[-16,17],[-11,7],[-11,-5],[-45,-50],[-14,-2],[-15,11],[-57,26],[-19,3],[-39,-18],[-14,-1],[-167,92],[-15,2],[-16,-10],[-9,-17],[-18,-46],[-10,-13],[-15,0],[-23,32],[-13,8],[-10,-9],[-29,-64],[-15,-5],[-15,2],[-30,16],[-15,-1],[-34,-36],[-20,-6],[-16,-12],[-11,-38],[-21,-132],[-37,-171],[-10,-2],[-1,1],[-9,28],[-8,40],[-3,23],[0,19],[-3,16],[-19,21],[-13,23],[-8,9],[-39,14],[-19,17],[-8,37],[-2,52],[-5,62],[-10,54],[-16,25],[-16,-5],[-32,-37],[-34,-14],[-15,-17],[-90,-133],[-33,-30],[-33,-8],[-17,12],[-17,26],[-13,40],[-7,48],[2,51],[9,30],[12,27],[11,36],[3,50],[-2,63],[-8,56],[-15,27],[-18,-1],[-92,-41],[-44,5],[-37,36],[-19,85],[7,39],[24,71],[4,36],[-5,40],[-13,37],[-1,2]],[[2526,2634],[-6,9],[-27,26],[-17,25],[-6,37],[5,35],[78,82],[24,50],[13,68],[6,46],[8,26],[60,68],[16,9],[41,4],[7,1],[17,-4],[8,-14],[-4,-25],[-13,-9],[-15,-3],[-11,-6],[-4,-23],[12,-8],[41,4],[13,-10],[53,-65],[25,-19],[21,9],[19,52],[10,62],[0,57],[0,1],[-5,28],[-4,20],[0,1],[-39,58],[-8,23],[-1,27],[7,40],[0,44],[-1,1],[-19,67],[3,41],[27,25],[30,-55],[30,-72],[26,-27],[35,-10],[64,-90],[36,4],[14,23],[9,30],[4,35],[1,36],[7,41],[17,0],[33,-31],[26,25],[11,163],[22,69],[31,28],[66,34],[78,101],[85,65],[43,50],[27,75],[-4,50],[-1,0],[-7,3]]],"transform":{"scale":[0.0011032367885788557,0.00040728718861886184],"translate":[69.22629602000012,39.189236959000084]}};
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
