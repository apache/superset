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
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = {"type":"Topology","objects":{"lbr":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"River Gee"},"id":"LR.RG","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Gbapolu"},"id":"LR.GP","arcs":[[5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Grand Kru"},"id":"LR.GK","arcs":[[10,11,12,-2]]},{"type":"Polygon","properties":{"name":"Maryland"},"id":"LR.MY","arcs":[[13,-11,-1]]},{"type":"Polygon","properties":{"name":"Sinoe"},"id":"LR.SI","arcs":[[-3,-13,14,15,16,17]]},{"type":"Polygon","properties":{"name":"Bomi"},"id":"LR.BM","arcs":[[18,19,20,21,-7]]},{"type":"Polygon","properties":{"name":"Bong"},"id":"LR.BG","arcs":[[22,23,24,25,-19,-6,26,27]]},{"type":"Polygon","properties":{"name":"Grand Bassa"},"id":"LR.MG","arcs":[[28,29,30,31,-24]]},{"type":"Polygon","properties":{"name":"Grand Cape Mount"},"id":"LR.CM","arcs":[[-22,32,-8]]},{"type":"Polygon","properties":{"name":"Lofa"},"id":"LR.LF","arcs":[[-27,-10,33]]},{"type":"Polygon","properties":{"name":"Montserrado"},"id":"LR.MO","arcs":[[34,35,-20,-26]]},{"type":"Polygon","properties":{"name":"Margibi"},"id":"LR.MG","arcs":[[-32,36,-35,-25]]},{"type":"Polygon","properties":{"name":"Nimba"},"id":"LR.NI","arcs":[[37,-17,38,-29,-23,39]]},{"type":"Polygon","properties":{"name":"River Cess"},"id":"LR.RI","arcs":[[-16,40,-30,-39]]},{"type":"Polygon","properties":{"name":"Grand Gedeh"},"id":"LR.GD","arcs":[[41,-4,-18,-38]]}]}},"arcs":[[[9457,1114],[-1,1],[-8,6],[-18,9],[-50,12],[-15,6],[-11,10],[-21,38],[-7,8],[-12,8],[-20,6],[-33,4],[-75,39],[-20,5],[-13,-1],[-7,-4],[-8,-4],[-8,-1],[-8,2],[-10,3],[-9,0],[-9,-2],[-8,-5],[-26,-23],[-20,-11],[-9,-3],[-12,-3],[-13,0],[-27,9],[-10,-1],[-16,-4],[-7,-1],[-16,2],[-11,-1],[-11,-2],[-8,2],[-8,8],[-6,20],[-6,35],[-2,7],[-1,9],[1,9],[3,9],[1,8],[-1,9],[-3,10],[-2,18],[2,342],[-4,12],[-6,11],[-11,11],[-9,6],[-18,5],[-397,68]],[[8433,1815],[-341,53],[-81,6],[-15,-8],[-11,0],[-16,4],[-86,56],[-36,11],[-108,14]],[[7739,1951],[6,74],[-3,38],[-10,37],[-11,21],[-75,109],[-172,171],[-12,17],[-13,27],[-21,62],[-8,37],[3,31],[18,87]],[[7441,2662],[86,-32],[269,3],[320,34],[158,31],[1662,66]],[[9936,2764],[4,-3],[-13,-20],[-28,-22],[-18,-35],[2,-89],[-11,-25],[-34,17],[0,-37],[10,-43],[17,-40],[23,-32],[36,-20],[26,5],[18,-4],[13,-44],[7,-46],[-3,-27],[-14,-24],[-30,-41],[-6,-15],[-8,-39],[-13,-15],[-23,-10],[-6,9],[0,18],[-8,15],[-3,12],[13,12],[4,9],[-28,5],[-6,-6],[-64,-33],[-18,-22],[-10,-22],[-26,-78],[20,-112],[-2,-40],[-14,-41],[-66,-116],[-34,13],[-42,1],[-40,-18],[-30,-43],[-6,-41],[19,-137],[-3,-51],[17,-33],[23,-31],[14,-46],[0,-36],[-10,1],[-20,14],[-32,3],[-75,-57],[-1,-22],[17,-73],[-3,-27],[-14,-49],[0,-19]],[[4063,6790],[-34,-32],[-91,-50],[-40,-30],[-47,-56],[-12,-10],[-15,-6],[-11,-13],[-12,-9],[-14,3],[-12,6],[-15,3],[-16,0],[-14,-1],[-58,-16],[-52,-22],[-91,-60],[-76,-73],[-41,-29],[-38,-7],[-27,12],[-7,3],[-6,4],[-1,5],[4,6],[5,4],[3,6],[-1,6],[-7,23],[-4,9],[-7,25],[-4,9],[-7,7],[-5,8],[2,9],[6,9],[11,9],[6,7],[3,14],[1,6],[-2,6],[-4,4],[-34,14],[-85,20],[-64,2],[-26,-9],[-7,-8],[-21,-25],[-160,-126],[-12,-16],[-24,-44],[-39,-48],[-77,-78],[-18,-14],[-19,-6],[-19,-3],[-18,0],[-63,11],[-9,0],[-18,-5],[-82,-36],[-24,-14],[-15,-12],[-4,-8],[-3,-9],[-2,-52],[-8,-40],[-20,-76]],[[2462,5997],[-73,-15],[-268,-1],[-127,-48],[-20,-12],[-25,-21],[-20,-13],[-24,-14],[-45,-18],[-21,-3],[-14,1],[-18,15],[-17,19],[-9,13],[-5,10],[-3,9],[-5,6],[-18,16],[-3,14],[1,6],[6,14],[1,7],[-4,17],[2,8],[5,8],[1,9],[-3,10],[-5,9],[-5,16],[-1,7],[1,7],[4,6],[2,9],[4,8],[4,17],[1,6],[-2,7],[-3,8],[-4,9],[-2,8],[1,6],[5,4],[9,1],[38,-1],[8,2],[3,5],[-6,5],[-4,5],[-3,6],[1,10],[-4,9],[-13,12],[-153,31],[-11,0],[-12,0],[-46,-12],[-52,-4],[-29,3],[-136,46],[-15,0],[-19,-7]],[[1312,6272],[-17,17],[-1,1],[7,11],[18,11],[15,7],[32,5],[16,12],[17,19],[27,41],[23,27],[13,7],[8,6],[16,16],[9,8],[11,5],[39,12],[12,5],[9,9],[20,23],[12,8],[44,24],[12,3],[24,0],[11,3],[10,6],[8,9],[18,15],[21,10],[7,6],[5,6],[38,63],[10,12],[10,9],[49,34],[9,8],[8,9],[9,8],[11,5],[13,4],[59,12],[177,105],[35,31],[11,6],[11,6],[51,15],[11,7],[9,7],[7,9],[18,17],[33,21],[10,15],[3,17],[-12,54],[2,21],[-1,46],[-9,49],[-8,22],[-6,12],[-142,191],[-22,17],[-25,10],[-49,5],[-38,1],[-42,-4],[-15,7],[-20,30],[-36,-4],[-13,-3],[-176,32],[-20,14],[-6,3],[-7,0],[-34,-6],[-14,-1],[-7,2],[-8,5],[-7,16],[-11,7],[-8,4],[-88,19],[-32,4]],[[1496,7577],[326,384],[93,76],[115,60],[18,6],[56,8],[-6,573],[3,28]],[[2101,8712],[126,-105],[245,62],[136,-123],[445,-132],[63,88],[227,-308],[390,88],[617,-247],[27,-158],[-363,-810],[49,-277]],[[8433,1815],[26,-63],[3,-16],[1,-30],[-4,-16],[-6,-14],[-8,-14],[-16,-20],[-58,-94],[-36,-64],[-86,-206],[0,-23],[3,-20],[3,-13],[4,-12],[5,-8],[13,-16],[18,-14],[10,-5],[175,-57],[158,-67],[35,-19],[19,-13],[20,-17],[18,-18],[16,-20],[107,-175],[35,-47],[58,-95],[10,-24],[5,-18],[-3,-20],[-17,-63],[-5,-46],[2,-85],[-3,-17],[-7,-18],[-9,-17],[-35,-55],[-9,-19]],[[8875,257],[-46,14],[-58,44],[-28,10],[-40,5],[-24,12],[-19,16],[-24,16],[-44,17],[-106,27],[-84,12],[-153,58],[-297,35],[-87,29],[-104,112],[-39,19],[-47,8],[-253,89],[-272,186],[-140,76],[-235,83]],[[6775,1125],[64,55],[22,27],[12,37],[5,35],[18,61],[9,13],[9,7],[61,4],[12,4],[21,7],[10,8],[7,9],[35,72],[56,95],[16,20],[13,13],[72,40],[162,121],[9,5],[9,3],[19,3],[106,0],[13,2],[20,8],[12,8],[9,10],[20,33],[78,90],[13,13],[21,11],[31,12]],[[9457,1114],[0,-2],[12,-28],[19,-17],[19,-14],[14,-17],[7,-21],[11,-123],[-11,-508],[4,-21],[6,-22],[5,-25],[-5,-60],[17,-47],[4,-23],[-8,-23],[-25,-44],[-4,-24],[14,-28],[80,-54],[-128,-13],[-37,5],[-57,24],[-31,5],[-167,0],[-20,7],[-11,17],[-8,17],[-11,7],[-40,3],[-96,38],[-30,17],[-27,23],[-15,27],[-13,32],[-23,27],[-27,8]],[[6775,1125],[-106,38],[-76,39],[-172,140],[-63,40],[-76,33],[-25,5],[-50,22],[-75,11],[-60,17],[-58,26],[-42,31],[8,5],[2,2],[1,3],[5,8],[-108,28],[-86,49],[-140,117],[-39,24],[-84,39],[-77,55],[-43,16],[-41,20],[-33,42],[32,0],[-32,43],[-49,26],[-55,20],[-48,24],[-156,142]],[[5029,2190],[3,1],[6,5],[1,3],[-1,4],[-5,6],[-21,16],[-4,3],[-3,4],[-1,4],[-2,9],[-1,14],[0,7],[1,5],[3,5],[6,4],[36,11],[8,3],[5,4],[4,3],[17,15],[7,3],[13,6],[7,7],[5,12],[7,23],[5,11],[7,8],[13,4],[9,1],[10,1],[7,-1],[4,0],[4,2],[10,9],[68,88],[10,20],[10,40],[4,20],[0,12],[-50,217],[-13,36],[-18,29],[-14,31],[-9,34],[51,53],[67,38],[70,66],[39,28],[68,27],[22,12],[75,56],[31,12],[52,8],[24,8],[19,18],[10,26],[6,66],[7,30],[30,58],[40,49],[51,35]],[[5839,3519],[65,15],[284,-6],[39,18],[24,23],[37,53]],[[6288,3622],[637,-345],[140,-58],[156,184],[8,6],[17,5],[24,3],[78,-5],[22,-4],[19,-7],[75,-44],[28,-21],[34,-33],[47,-66],[38,-66],[13,-37],[10,-35],[2,-16],[-1,-25],[-2,-9],[-3,-8],[-4,-8],[-7,-7],[-8,-5],[-9,-5],[-41,-10],[-21,-2],[-79,-2],[-11,-2],[-18,-4],[-9,-3],[-9,-5],[-8,-6],[-6,-8],[-4,-8],[-2,-9],[-4,-26],[-3,-8],[-3,-8],[-52,-70],[-10,-18],[-4,-9],[-3,-10],[0,-11],[3,-13],[10,-19],[10,-9],[10,-6],[38,-8],[34,-12],[13,-8],[8,-9],[4,-8],[1,-9],[0,-9],[-4,-25],[-1,0]],[[2462,5997],[-40,-65],[-15,-18],[-35,-14],[-2,0]],[[2370,5900],[-48,-19],[-67,-7],[-16,-9],[-5,-22],[1,-33],[-3,-29],[-19,-13],[-9,-13],[4,-27],[13,-50],[-9,-21],[-42,-48],[-15,-21],[3,-1],[-3,-46],[-3,-14],[-9,-22],[-4,-14],[-3,-25],[3,-80],[10,-18],[64,-63],[22,-29],[0,-16],[-29,-28],[-57,-42],[-28,-6],[-41,19],[-7,7],[-9,8],[-99,61],[-22,10],[-13,2],[-14,-2],[-17,-6],[-22,-14],[-22,-17],[-39,-35],[-36,-26],[-8,-3],[-58,-10],[-30,-10],[-27,-16],[-13,-13],[-7,-12],[-2,-14],[-1,-23],[2,-19],[3,-19],[24,-65],[5,-20],[-3,-29],[-28,-65],[-1,-1]],[[1636,4872],[-43,83],[-81,84],[-94,62],[-385,202],[-58,19]],[[975,5322],[0,1],[-7,28],[-4,30],[3,18],[8,19],[19,29],[13,14],[12,10],[11,7],[24,9],[26,6],[9,9],[5,15],[3,30],[8,22],[16,25],[12,13],[12,8],[9,6],[9,3],[9,0],[11,-2],[20,-7],[9,2],[6,6],[4,5],[6,16],[19,75],[3,47],[6,36],[-7,28],[-8,13],[-25,27],[-3,13],[2,19],[32,67],[63,167],[3,20],[-4,24],[1,21],[11,45],[-9,26]],[[5791,6769],[-8,-21],[-81,-258],[-43,-59],[-5,-35],[-1,-24],[-12,-29],[-2,-22],[-1,-32],[-1,-1],[-5,-7],[-41,-41],[1,-10],[15,-16],[14,-19],[10,-7],[22,-10],[8,-11],[6,-13],[6,-18],[8,-12],[9,-9],[6,-10],[7,-26],[7,-9],[10,-4],[8,-1],[11,-1],[4,-2],[7,-4],[12,-21],[21,-20],[0,-18],[-14,-67],[-2,-26],[2,-23],[12,-49],[-3,-16],[-7,-12],[-18,-15],[-8,-8],[-10,-8],[-9,-9],[-9,-12],[2,-12],[7,-9],[9,-15],[0,-13],[-5,-10],[-18,-15],[-5,-11],[-5,-12],[-6,-12],[-16,-22],[-1,-12],[5,-15],[-9,-34],[-6,-15],[-8,-13],[-19,-21],[0,-12],[17,-29],[1,-16],[-14,-38],[-11,-12],[-10,-4],[-25,0]],[[5600,5402],[-27,-3],[-40,1],[-232,-56],[-28,2],[-5,13],[-6,11],[-18,7],[-10,-4],[-8,-9],[-15,-13],[-37,-26],[-11,-11],[-6,-14],[-3,-13],[-6,-13],[-9,-12],[-18,-15],[-16,-3],[-22,1],[-12,-5],[-47,-44],[-37,-25],[-13,-19],[-15,-29],[-12,-1],[-13,4],[-21,3],[-14,-4],[-12,-7],[-11,-11],[-13,-1],[-12,2],[-17,1],[-8,-6],[-5,-10],[-2,-11],[-16,-23],[-14,-16],[-9,-5],[-11,-4],[-24,3],[-10,-1],[-21,-2],[-13,0],[-28,10],[-20,2],[-11,-5],[-45,-38],[-67,-37],[-29,-10],[-20,0],[-7,9],[-6,9],[-4,9],[-2,8],[0,9],[1,9],[3,10],[4,9],[23,37],[62,76],[34,32],[30,35],[5,9],[3,8],[2,9],[0,8],[-1,10],[-4,12],[-9,16],[-12,14],[-58,50],[-64,75],[-11,10],[-14,9],[-24,11],[-14,2],[-12,0],[-9,-2],[-121,-13],[-18,1],[-9,5],[-8,5],[-12,16]],[[4229,5463],[50,105],[12,36],[1,14],[-1,16],[-5,24],[-5,16],[-5,13],[-7,11],[-8,10],[-17,17],[-33,25],[-41,25],[-19,9],[-20,6],[-23,5],[-10,1],[-10,-1],[-9,-4],[-10,-6],[-17,-17],[-12,-17],[-5,-9],[-4,-10],[-3,-11],[-2,-11],[0,-21],[7,-55],[-1,-10],[-3,-9],[-6,-9],[-36,-33],[-6,-8],[-9,-18],[-7,-19],[-5,-18],[-4,-35],[-6,-28],[-4,-9],[-8,-9],[-14,-10],[-28,-13],[-17,-2],[-13,1],[-8,5],[-9,6],[-17,19],[-43,56],[-8,7],[-18,12],[-9,5],[-55,18],[-103,24],[-22,1],[-9,-1],[-28,-11],[-56,-29],[-33,-9],[-19,-2],[-20,2],[-301,96],[-21,11],[-21,14],[-21,16],[-41,41],[-12,10],[-17,11],[-33,16],[-20,7],[-16,4],[-37,-2],[-53,-7],[-81,-1]],[[2735,5724],[-40,33],[-25,7],[-12,-1],[-20,-3],[-23,-1],[-106,6],[-29,9],[-25,19],[-8,20],[-77,87]],[[4063,6790],[73,-32],[34,-9],[89,-11],[16,0],[23,5],[21,10],[42,27],[21,10],[0,-14],[34,17],[31,33],[16,36],[-13,27],[14,29],[18,26],[25,19],[68,12],[47,22],[55,12],[39,17],[94,61],[59,61],[-4,8],[-1,9],[-3,8],[-1,0]],[[4860,7173],[2,-1],[20,10],[71,67],[27,39],[47,-81],[28,-23],[37,52],[14,4],[13,8],[5,26],[10,8],[22,4],[41,2],[35,-5],[18,-6],[20,-12],[17,-21],[17,-47],[15,-16],[38,-6],[83,21],[38,-4],[35,-48],[34,-148],[60,-54],[15,-3],[55,2],[13,-9],[2,-41],[19,-15],[47,-24],[9,-31],[-23,-82],[28,24],[19,6]],[[5600,5402],[111,-34],[29,-5],[13,5],[6,4],[21,7],[18,-2],[11,-4],[15,-10],[4,-7],[1,-6],[-6,-17],[-5,-20],[-1,-4],[-2,-5],[-5,-12],[-4,-4],[-5,-3],[-33,-12],[-6,-4],[-4,-3],[-27,-31],[-4,-8],[-8,-21],[-12,-67],[-3,-12],[-21,-39],[-1,-6],[1,-5],[2,-1],[5,-2],[5,0],[6,0],[13,5],[5,0],[7,-4],[10,-7],[3,-9],[1,-8],[-13,-57],[-18,-51],[-3,-14],[-1,-15],[3,-38],[0,-10],[-7,-37],[-2,-70]],[[5699,4759],[-516,-2],[-34,-22],[-18,-7],[-37,-10],[-18,-9],[-12,-4],[-97,-19],[-11,-5],[-9,-6],[-11,-10],[-7,-9],[-5,-8],[-1,-8],[1,-8],[2,-9],[6,-16],[3,-8],[1,-8],[0,-17],[-2,-16],[-17,-60],[-2,-17],[1,-36],[24,-123],[-5,-12],[-10,-15],[-76,-67],[-14,-16],[-53,-83],[-14,-17],[-10,-3],[-10,1],[-8,6],[-6,7],[-12,16],[-8,6],[-9,4],[-17,4],[-35,2],[-28,-1],[-26,-5],[-15,-7],[-11,-9],[-7,-10],[-5,-9],[-3,-10],[-1,-10],[2,-20],[-1,-12],[-7,-16],[-8,-8],[-62,-23],[-14,-10],[-9,-11],[-3,-9],[0,-10],[3,-17],[2,-8],[1,-8],[0,-16],[-1,-8],[-30,-91],[-1,-9],[0,-8],[8,-24],[0,-10],[-3,-9],[-13,-22],[-3,-9],[0,-8],[4,-17],[22,-42],[1,-9],[-1,-8],[-3,-8],[-79,-123],[-8,-17],[-8,-30],[0,-9],[0,-8],[4,-17],[21,-45],[6,-16],[1,-8],[0,-15],[-1,-7],[-2,-6],[-15,-29],[-4,-9],[-1,-10],[0,-9],[1,-10],[3,-9],[3,-9],[17,-26],[8,-18],[17,-73],[0,-11],[-1,-14],[-6,-23],[-8,-13],[-57,-52],[-11,-16],[-6,-14],[-5,-15],[-8,-8],[-12,-6],[-15,-7],[-9,-8],[-5,-8],[-2,-9],[0,-11],[0,-1]],[[4259,2925],[-266,247],[-336,267],[-87,95],[-18,15],[-43,23],[-15,18],[-7,24],[11,30],[-4,28],[-23,37],[-38,31],[-44,21],[-37,9],[-26,13],[-173,133],[-100,105],[-130,79],[-44,19],[-93,17],[-43,24],[-26,32],[7,32],[22,-13],[19,-2],[16,9],[11,22],[-49,11],[-33,25]],[[2710,4276],[1,3],[25,47],[3,12],[8,15],[17,25],[4,12],[-3,11],[-9,23],[-1,14],[9,70],[4,11],[5,11],[37,44],[12,25],[8,7],[15,4],[12,7],[8,14],[1,14],[-5,12],[-8,8],[-5,9],[-1,10],[0,10],[-2,10],[1,10],[9,6],[24,9],[27,14],[42,38],[15,23],[9,19],[0,14],[-12,36],[-2,13],[2,13],[5,11],[76,79],[11,26],[12,20],[7,25],[9,22],[0,11],[-7,8],[-21,10],[-5,11],[-4,22],[-8,6],[-10,3],[-7,6],[-5,18],[11,7],[20,11],[88,16],[40,14],[26,-8],[10,-5],[1,-5],[-1,-6],[-3,-7],[-2,-9],[1,-10],[4,-10],[7,-7],[18,-10],[6,-6],[4,-6],[4,-6],[4,-5],[7,-5],[37,-11],[10,-6],[7,-6],[14,-16],[8,-7],[15,-4],[19,-1],[35,5],[20,6],[19,15],[12,10],[9,12],[20,19],[8,3],[39,-6],[31,6],[35,-1],[67,-20],[20,-3],[19,0],[17,7],[23,14],[64,56],[23,25],[12,9],[14,6],[20,3],[14,-2],[12,-3],[47,-25],[9,-3],[9,-2],[9,-1],[9,1],[10,2],[52,48],[183,213]],[[975,5322],[-381,132],[-293,126],[-53,61],[-3,94],[15,53],[3,22],[1,31],[-34,60],[-9,12],[-46,13],[-48,29],[-41,33],[-24,24],[-62,85],[77,35],[19,11],[-5,60],[10,40],[67,37],[24,39],[15,45],[5,35],[-9,48],[8,16],[54,5],[18,7],[13,13],[5,20],[-8,30],[-35,55],[-6,24],[7,9],[44,40],[85,129],[42,8],[201,88],[21,19],[159,197],[44,54],[363,277],[99,54],[93,21],[33,13],[27,21],[26,30]],[[2101,8712],[10,22],[22,18],[62,33],[26,24],[57,101],[36,43],[57,28],[49,7],[197,1],[50,7],[48,14],[48,26],[60,57],[7,44],[-20,47],[-17,67],[5,53],[43,90],[75,291],[1,123],[27,-2],[26,5],[50,18],[19,-39],[41,22],[83,78],[41,12],[41,0],[140,-34],[36,-20],[17,-35],[-25,-111],[11,-32],[32,-10],[52,8],[99,56],[95,72],[42,20],[39,12],[41,6],[47,0],[12,2],[35,9],[11,-6],[12,-10],[11,-16],[22,7],[45,22],[60,17],[3,15],[-8,18],[0,19],[17,21],[17,18],[12,20],[-1,29],[41,-6],[26,-31],[14,-40],[16,-112],[11,-42],[25,-41],[34,-36],[10,7],[0,34],[6,49],[30,33],[48,-1],[49,-22],[32,-30],[13,-51],[-20,-29],[-32,-21],[-23,-30],[-3,-43],[21,-7],[37,8],[42,1],[20,-2],[21,3],[18,8],[12,16],[17,19],[20,-14],[31,-42],[123,-50],[43,-30],[17,-18],[13,-6],[-30,-17],[-10,-5],[-17,-8],[-15,-12],[-26,-27],[22,-20],[12,-25],[10,-26],[14,-24],[12,-10],[3,-11],[-4,-10],[-11,-11],[-24,-37],[-16,-68],[4,-64],[36,-25],[59,-11],[24,-13],[8,-28],[0,-27],[45,-172],[-5,-25],[-27,-43],[-3,-27],[29,35],[26,19],[26,-2],[29,-33],[12,-25],[5,-25],[-6,-23],[-17,-22],[-4,-8],[-31,-103],[-6,-100],[24,-98],[56,-99],[63,-79],[22,-40],[32,-40],[30,-37],[-27,-61],[-24,-84],[4,-80],[52,-58],[-27,-20],[-21,-30],[-14,-36],[-12,-63],[-17,-27],[-44,-49],[9,-33],[-21,-51],[-55,-80],[-50,-36],[-24,-23],[-9,-30],[-2,-32],[-6,-28],[-16,-24],[-26,-22],[8,-7]],[[2735,5724],[8,-59],[-5,-22],[-123,-228],[-9,-22],[-4,-15],[2,-17],[6,-18],[5,-8],[29,-36],[11,-19],[7,-19],[6,-19],[9,-54],[3,-138],[-4,-36],[-6,-24],[-8,-9],[-18,-16],[-11,-6],[-11,-5],[-85,-27],[-9,-5],[-11,-12],[-13,-20],[-41,-75],[-16,-16],[-9,-7],[-20,-11],[-113,-42],[-19,-9],[-79,-58],[-20,-9],[-29,-9],[-11,-5],[-11,-8],[-18,-15],[-10,-11],[-6,-11],[-51,-160]],[[2051,4444],[-55,13],[-315,155],[-48,43],[18,40],[12,-19],[13,-14],[18,-9],[26,-7],[-41,66],[-8,57],[24,53],[57,54],[-35,0],[-26,-7],[-20,-12],[-20,-15],[-15,30]],[[2710,4276],[-2,2],[-31,32],[-37,27],[-79,48],[-41,16],[-47,3],[0,-18],[127,-63],[56,-44],[18,-55],[-37,44],[-68,40],[-78,31],[-440,105]],[[6982,5086],[-1,0],[-40,-87],[-58,-189],[-147,-285],[-38,-57],[-56,-62],[-64,-51],[-68,-25],[-35,-18],[-31,-77],[-36,-30],[27,-38],[6,-59],[-11,-61],[-22,-45],[-38,-25],[-99,-11],[-42,-14],[-31,-40],[19,-30],[30,-22],[0,-22],[-45,-56],[-14,-54],[13,-25],[36,32],[37,-32],[19,-37],[-5,-44]],[[5839,3519],[11,56],[3,19],[2,5],[20,32],[1,7],[-3,11],[-11,18],[-26,34],[-7,16],[-1,11],[2,11],[8,19],[18,14],[5,2],[4,4],[-1,4],[-8,7],[-5,4],[-5,5],[-8,11],[-6,10],[-7,7],[-4,3],[-5,2],[-5,2],[-4,2],[-3,2],[-2,6],[1,8],[9,30],[3,6],[2,3],[3,0],[5,0],[19,-2],[7,1],[6,1],[9,5],[6,4],[9,9],[3,4],[0,4],[-2,4],[-40,30],[-11,12],[-5,6],[0,3],[1,4],[5,9],[41,47],[2,4],[3,6],[-1,6],[-5,10],[-20,34],[-6,7],[-14,6],[-7,6],[-2,2],[0,5],[1,6],[10,29],[0,5],[-1,33],[-2,7],[-5,8],[-12,11],[-51,33],[-4,4],[-3,5],[2,5],[9,6],[12,5],[2,3],[2,3],[2,11],[3,3],[4,2],[4,5],[1,10],[0,19],[2,10],[2,5],[5,1],[4,-3],[5,-6],[3,-8],[3,-4],[3,-1],[3,1],[4,4],[10,16],[5,6],[3,7],[3,27],[3,8],[5,4],[33,11],[5,4],[2,2],[1,4],[0,8],[-4,26],[-2,12],[-1,7],[0,5],[-1,12],[-8,47],[0,14],[3,11],[13,10],[-4,8],[-15,10],[-46,21],[-58,14],[-8,3],[-24,31],[-47,102]],[[5791,6769],[14,5],[34,5],[33,10],[34,24],[31,27],[33,18],[42,-3],[20,10],[54,16],[11,1],[8,37],[11,4],[26,-11],[13,55],[31,-18],[47,-71],[32,3],[106,39],[27,16],[16,47],[-11,45],[-18,42],[-5,41],[11,25],[22,33],[45,53],[23,14],[39,11],[21,18],[9,21],[4,49],[9,22],[14,12],[69,39],[41,43],[24,43],[10,47],[-3,55],[-6,11],[-11,3],[-10,5],[-3,14],[4,14],[15,24],[3,14],[6,82],[17,49],[64,75],[19,47],[292,-14],[-13,-89],[15,-65],[45,-54],[79,-56],[74,-45],[102,-50],[44,-83],[50,-167],[30,-230],[13,-46],[16,-28],[42,-58],[15,-31],[20,-73],[11,-19],[29,-36],[10,-18],[2,-16],[-6,-30],[2,-15],[9,-15],[36,-35],[15,-24],[7,-23],[3,-57],[42,-226],[-6,-57],[-19,-23],[-50,-37],[-13,-21],[-3,-42],[3,-39],[-2,-37],[-31,-65],[12,-18],[20,-13],[12,-14],[1,-32],[-4,-33],[-20,-71],[-31,-69],[-34,-52],[-220,-237],[-48,-52],[-177,-135],[-33,-39],[-6,1],[-40,-22],[-3,-1],[3,-4],[-11,-33],[-5,-10],[-12,-7],[-29,-4],[-12,-5],[-60,-74]],[[5029,2190],[-129,117],[-17,35],[-26,86],[-22,42],[-26,25],[-40,26],[-42,22],[-36,8],[-7,4],[-69,13],[-15,-1],[-3,23],[29,36],[6,22],[-40,57],[-244,138],[-89,82]],[[6982,5086],[41,-2],[24,-5],[59,1],[28,-8],[28,-23],[72,-94],[45,-15],[31,25],[19,44],[11,43],[12,20],[15,-10],[28,-35],[77,-40],[32,-35],[-3,-14],[-18,-15],[-13,-39],[5,-22],[22,-44],[5,-18],[-12,-21],[-23,-12],[-8,-15],[29,-28],[26,25],[30,11],[30,-1],[26,-11],[32,26],[25,-10],[24,-26],[25,-23],[12,2],[8,10],[11,8],[17,-10],[13,-19],[2,-19],[0,-17],[4,-9],[22,-8],[190,-42],[29,-10],[26,-15],[17,-12],[20,-7],[40,1],[34,8],[54,29],[29,11],[113,16],[66,1],[43,-9],[40,-27],[157,-36],[13,-1],[11,4],[11,3],[15,-5],[4,-8],[7,-27],[8,-12],[109,-84],[38,-45],[6,-32],[-32,-92],[-12,-49],[-6,-54],[7,-48],[26,-33],[1,11],[24,12],[30,8],[22,-1],[24,-21],[10,-22],[8,-54],[8,-9],[13,-3],[12,-7],[6,-15],[-5,-12],[-23,-12],[-5,-11],[-2,-67],[3,-18],[31,-38],[97,-49],[30,-28],[43,-59],[34,16],[29,48],[27,31],[16,-13],[26,-29],[36,-28],[44,-7],[3,-9],[51,-26],[6,-2],[53,-22],[13,-15],[-20,-25],[19,-15],[32,-40],[17,-9],[29,13],[30,25],[18,7],[-8,-40],[38,-6],[16,-31],[12,-34],[24,-14],[18,18],[13,39],[7,71],[78,-33],[11,-83],[-15,-100],[-3,-87],[45,-185],[32,-63],[52,-101],[31,-38],[-51,8],[-17,-28],[12,-45],[33,-42],[-49,-2],[-16,0],[25,-23]]],"transform":{"scale":[0.00040924767186718163,0.00042185820482048555],"translate":[-11.476185675999915,4.347235419000043]}};
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
