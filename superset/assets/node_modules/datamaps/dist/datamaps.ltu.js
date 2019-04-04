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
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = '__LBY__';
  Datamap.prototype.lcaTopo = '__LCA__';
  Datamap.prototype.lieTopo = '__LIE__';
  Datamap.prototype.lkaTopo = '__LKA__';
  Datamap.prototype.lsoTopo = '__LSO__';
  Datamap.prototype.ltuTopo = {"type":"Topology","objects":{"ltu":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Alytaus"},"id":"LT.AS","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Kauno"},"id":"LT.KS","arcs":[[4,5,-4,6,7,8]]},{"type":"Polygon","properties":{"name":"Marijampoles"},"id":"LT.MA","arcs":[[-7,-3,9,10]]},{"type":"Polygon","properties":{"name":"Panevezio"},"id":"LT.PA","arcs":[[11,12,-5,13,14]]},{"type":"Polygon","properties":{"name":"Šiauliai"},"id":"LT.SH","arcs":[[-14,-9,15,16,17]]},{"type":"Polygon","properties":{"name":"Taurages"},"id":"LT.TG","arcs":[[-16,-8,-11,18,19,20]]},{"type":"Polygon","properties":{"name":"Utenos"},"id":"LT.UN","arcs":[[21,-12,22]]},{"type":"Polygon","properties":{"name":"Vilniaus"},"id":"LT.VI","arcs":[[23,-1,-6,-13,-22]]},{"type":"MultiPolygon","properties":{"name":"Klaipedos"},"id":"LT.KP","arcs":[[[24]],[[-20,25,26]]]},{"type":"Polygon","properties":{"name":"Telšiai"},"id":"LT.TL","arcs":[[-17,-21,-27,27]]}]}},"arcs":[[[5936,2570],[17,-89],[-4,-24],[-1,-37],[-9,-12],[-5,-12],[2,-10],[29,-42],[8,-29],[-7,-59],[-7,-33],[-1,-31],[7,-27],[34,-29],[150,-27],[29,3],[56,22],[22,20],[40,24],[30,24],[23,2],[47,-13],[50,-31],[11,-13],[5,-23],[-3,-23],[-5,-26],[3,-23],[12,-20],[18,-2],[15,7],[27,24],[21,5],[33,-8],[23,-11],[18,4],[80,79],[139,69],[85,9],[3,-178],[-2,-18],[-5,-25],[-31,-22],[-46,-13],[-17,-13],[-7,-12],[-6,-18],[-8,-54],[-9,-120],[-12,-58],[-61,-107],[-184,-245],[-5,-38],[8,-31],[17,-20],[41,-27],[16,-14],[11,-21],[7,-25],[12,-57],[31,-81],[0,-1]],[[6681,1010],[-50,-41],[-7,-25],[0,-29],[2,-26],[-1,-15],[-31,-27],[-16,-26],[-10,-2],[-3,-13],[8,-60],[20,-84],[23,-67],[15,-74],[-3,-107],[-1,-1],[-22,-67],[-30,-22],[-110,-24],[-31,3],[-25,33],[-22,77],[-6,5],[-7,2],[-6,-1],[-41,-43],[-108,-29],[-86,-67],[-195,-238],[-62,-42],[-61,1],[-54,22],[-57,-4],[-33,9],[-18,38],[-30,112],[-48,79],[-53,25],[-56,-14],[-105,-77],[-51,-19],[-109,-2],[-28,10],[-50,43],[-26,15],[-26,-6],[-130,-102],[-13,-3],[-14,6],[-31,24],[-12,4],[-26,-14],[-30,-30],[-106,-21],[-84,-48],[-26,-4],[-29,15],[-153,125],[-59,21],[7,23],[1,21],[-5,20],[-10,18],[-18,20],[-14,28],[-7,36],[1,42],[8,17],[10,15],[20,24],[25,60],[0,88],[-25,183],[-13,83],[-19,88],[-23,78],[-28,56],[-16,13],[-37,13],[-17,16],[-16,31],[-31,80],[-16,34],[-32,36]],[[4103,1328],[0,1],[6,71],[16,126],[-2,25],[-5,26],[0,27],[5,27],[13,42],[5,34],[19,67],[30,52],[25,27],[41,22],[54,13],[15,11],[2,21],[-4,10],[-21,20],[-8,15],[13,27],[16,20],[129,66],[2,28],[0,13],[-4,41],[-1,31],[5,34],[11,30],[14,21],[143,153],[16,6],[19,-7],[28,-39],[14,-33],[31,-43],[89,-32]],[[4819,2281],[17,-24],[159,9],[4,-12],[-4,-13],[8,-3],[24,11],[45,36],[58,63],[99,51],[7,7],[3,9],[0,12],[-2,11],[-4,8],[-13,19],[-3,6],[-4,10],[-3,12],[-2,15],[1,14],[2,13],[5,12],[6,10],[11,13],[12,11],[39,17],[33,-1],[34,-13],[15,-12],[16,-8],[15,-3],[187,51],[35,17],[32,8],[27,-7],[36,-33],[15,-27],[31,-19],[24,-7],[152,26]],[[5007,6582],[33,-2],[12,-4],[14,-11],[9,-25],[5,-27],[8,-69],[8,-32],[17,-25],[24,-14],[32,4],[14,15],[15,2],[20,-9],[34,-41],[18,-32],[50,-66],[9,-30],[0,-33],[-3,-32],[-11,-60],[2,-21],[8,-10],[18,9],[30,38],[16,10],[21,2],[28,-9],[33,11],[84,54],[17,19],[18,8],[14,-8],[21,-34],[17,-32],[19,-24],[37,-15],[22,0],[12,14],[2,19],[2,19],[12,1],[80,-57],[24,-26],[21,-34],[22,-70],[45,-62]],[[5940,5893],[-26,-116],[-7,-23],[-7,-37],[2,-39],[-4,-36],[-3,-49],[11,-45],[33,-71],[13,-138],[15,-34],[20,-24],[67,-31],[22,-21],[2,-14],[-10,-8],[-17,-5],[-12,-17],[-6,-30],[6,-56],[12,-36],[16,-28],[15,-18],[28,-27],[15,-18],[4,-22],[-2,-31],[1,-47],[19,-46],[19,-17],[21,2],[34,23],[15,-4],[9,-17],[23,-104],[51,-33],[18,-41],[6,-41],[0,-19],[-5,-20],[-10,-15],[-14,-14],[-30,-23],[-10,-10],[-9,-16],[-9,-11],[-21,-17],[-9,-11],[-6,-11],[-9,-24],[-11,-32],[-33,-64],[15,-8],[22,-37],[88,-58],[91,-115],[31,-16],[73,-7],[31,-17],[30,-32],[38,-66],[8,-25],[-49,-52],[-29,-81],[-23,-31],[-112,-82],[-20,-22],[-11,-20],[-5,-24],[-11,-74],[-5,-18],[-11,-33],[-8,-29],[-6,-37],[-3,-36],[-1,-39],[-4,-46],[-12,-18],[-18,-6],[-63,20],[-19,1],[-10,-13],[-21,-47],[-70,-28],[-29,-24],[-15,-30],[-3,-38],[5,-31],[6,-32],[4,-29],[2,-20],[-4,-46],[24,-38],[2,-16],[1,-22],[-5,-23],[-4,-36],[-9,-23],[-13,-16],[-15,-4],[-16,5],[-13,10],[-16,-5],[-9,-24],[-5,-36],[-5,-83],[-7,-31],[-5,-18],[-18,-31]],[[4819,2281],[10,30],[9,23],[15,27],[4,28],[-3,41],[-30,115],[-11,26],[-12,7],[-31,-5],[-20,5],[-18,22],[-20,36],[-38,41],[-12,18],[-2,24],[9,29],[15,21],[12,23],[1,21],[-14,26],[-48,24],[-9,11],[-6,13],[-9,9],[-11,8],[-7,12],[0,15],[12,20],[17,12],[43,21],[16,13],[9,34],[2,39],[-32,182],[5,50],[-1,29],[-8,26],[-8,11],[-8,20],[-6,25],[3,42],[-13,22],[-13,7],[-17,-1],[-13,3],[-5,13],[3,19],[18,29],[7,25],[7,18],[3,11],[20,13],[-6,41],[-5,20],[-10,32],[-6,44],[1,22],[3,25],[1,21],[-6,22],[-12,24],[-37,51],[-46,49],[-31,20],[-25,5],[-41,-30],[-41,-11],[-38,161],[-15,26],[-19,26],[-83,29],[-8,22],[3,21],[10,23],[13,18],[12,13],[18,11],[19,5],[73,-10],[15,2],[14,6],[10,12],[9,17],[19,49],[11,22],[8,9],[9,6],[10,3],[22,1],[13,4],[13,17],[0,35],[-10,35],[-32,39],[-37,3],[-39,-7],[-37,7],[-88,95],[-35,14]],[[4233,4663],[19,121],[28,70],[22,40],[6,30],[0,38],[-4,41],[-1,72],[2,39],[9,31],[30,51],[-34,56],[-43,9],[-96,-29],[-15,4],[-13,16],[-9,25],[-28,31],[-19,8],[-68,-17],[-108,0],[-31,15],[-10,17],[-7,47],[-9,27],[-29,29],[-16,9],[-13,-1],[-9,-11],[-12,-10],[-18,-7],[-32,-5],[-23,12],[-18,2],[-15,-4],[-7,-7],[-13,-17],[-10,-7],[-49,-12],[-43,0],[-19,16],[-3,23],[9,25],[23,33],[3,16],[-6,15],[-116,120],[-21,31],[-11,10],[-7,1],[-3,-7],[-1,-11],[2,-13],[0,-13],[-3,-12],[-7,-7],[-8,-6],[-4,-7],[-5,-13],[-4,-11],[-10,-9],[-9,-7],[-6,-7],[-7,-14],[-9,-14],[-18,-12],[-10,5],[-7,17],[-3,24],[-4,22],[-32,47],[-33,34],[-16,29],[-9,30],[-1,28],[7,57],[1,33],[-3,30],[-11,29],[-11,10],[-14,-1],[-28,-14],[-21,-1],[-9,4],[-37,42],[-3,40],[6,35],[-4,24],[-9,12],[-36,10],[-34,32],[-19,32],[-38,98]],[[2929,6211],[53,59],[98,49],[126,25],[22,-8],[12,-17],[3,-29],[6,-24],[11,-16],[45,-14],[262,136],[61,55],[16,21],[10,23],[5,29],[32,67],[35,35],[106,17],[37,-2],[30,-10],[12,-11],[8,-22],[15,-62],[11,-25],[15,-11],[23,11],[15,18],[86,69],[129,-143],[37,-30],[58,-21],[28,0],[18,10],[3,16],[1,23],[2,11],[7,8],[20,5],[10,6],[10,11],[8,10],[7,8],[11,5],[15,-4],[17,-11],[22,-30],[32,-15],[10,-8],[2,-17],[-8,-30],[-11,-22],[-7,-28],[-5,-20],[20,-62],[50,-3],[27,-24],[14,-7],[11,7],[25,66],[18,30],[32,43],[78,73],[232,151]],[[4103,1328],[-34,39],[-137,70],[-65,54],[-105,119],[-31,20],[-34,-10],[-41,-24],[-39,0],[-31,58],[0,41],[10,45],[6,37],[-10,21],[-59,10],[-19,17],[-11,25],[-7,31],[-10,30],[-18,25],[-17,5],[-39,-10],[-18,3],[-103,71],[-36,6],[-42,-26],[-2,-6],[-43,-107],[-32,-35],[-103,244],[-45,135],[-10,153],[12,303],[37,187],[8,71],[-2,42],[-11,89],[1,40],[7,28],[37,73],[1,16],[-5,17],[-3,19],[3,19],[6,6],[15,5],[18,21],[29,22],[14,21],[24,52],[53,52],[25,37],[22,68],[5,70],[-7,72],[-26,158],[-14,50],[-21,32],[-101,63],[-14,31],[19,53],[-23,11],[-16,25],[-12,26],[-11,17],[-16,7],[-96,-1],[-28,19],[-20,48],[-23,87],[-28,177],[-19,78],[-16,25]],[[2802,4605],[0,1],[48,29],[13,-20],[31,-30],[10,-6],[22,-1],[144,35],[51,29],[20,21],[85,38],[86,15],[93,-34],[24,21],[21,25],[32,21],[52,18],[542,-133],[157,29]],[[8571,8105],[-34,-78],[-1,-71],[-2,-39],[-10,-26],[-22,-37],[-17,-24],[-35,-34],[-22,-36],[-12,-35],[-8,-44],[-46,-90],[-16,-54],[-27,-123],[-9,-23],[-11,-8],[-31,6],[-34,19],[-13,3],[-15,-13],[-25,-65],[-13,-26],[-63,-96],[-4,23],[-2,11],[-4,14],[-6,10],[-21,6],[-184,-8],[-23,-8],[-26,-25],[-70,-46],[-32,64],[-6,18],[-15,17],[-17,-2],[-12,-11],[-20,-25],[-9,-3],[-11,9],[-11,19],[-13,40],[-6,29],[-34,42],[-129,-95],[-12,-19],[-12,-28],[10,-58],[-3,-28],[-9,-9],[-16,3],[-37,16],[-19,-1],[-13,-4],[-196,-100],[-49,-13],[-26,-1],[-15,8],[-3,12],[5,34],[-4,17],[-25,28],[-11,16],[-13,30],[-5,8],[-25,24],[-7,4],[-107,11],[-51,-17],[-32,-23],[-24,-4],[-54,6],[-15,-5],[-9,-10],[-5,-14],[-6,-13],[-14,-13],[-16,3],[-49,27],[-21,-2],[-25,-15],[-19,-5],[-112,22],[2,-50],[-3,-18],[-4,-30],[9,-18],[36,-36],[8,-23],[0,-18],[-8,-28],[-14,-20],[-19,-7],[-19,12],[-12,17],[-12,9],[-50,-18],[-13,-16],[6,-15],[16,-17],[23,-17],[19,-24],[17,-34],[11,-49],[1,-26],[-5,-20],[-31,-32],[-18,-23],[-14,-34],[-4,-35],[1,-67],[1,-15],[4,-14],[5,-14],[0,-25],[-33,-72]],[[6306,6400],[-33,-13],[-9,-8],[-9,-15],[2,-20],[9,-19],[31,-30],[12,-18],[2,-19],[-10,-17],[-28,-7],[-20,6],[-40,28],[-19,4],[-17,-11],[-20,-43],[-10,-39],[-11,-68],[-12,-37],[-20,-42],[-61,-87],[-15,-10],[-14,10],[-13,1],[-12,-3],[-49,-50]],[[5007,6582],[16,48],[7,14],[19,35],[26,65],[14,51],[18,12],[37,-3],[16,10],[24,30],[14,3],[17,-2],[16,1],[11,21],[0,33],[-23,118],[3,43],[14,21],[19,16],[16,24],[9,28],[-3,59],[1,32],[-9,97],[-8,24],[-27,43],[-5,28],[0,19],[-4,16],[-9,15],[-21,15],[-19,7],[-28,36],[-21,114],[65,10],[6,8],[7,17],[-2,24],[0,24],[12,31],[22,18],[47,29],[36,36],[16,40],[-5,59],[8,18],[14,40],[2,40],[-6,61],[-10,24],[-15,14],[-16,5],[-19,12],[-18,16],[-18,29],[-8,27],[-4,29],[-2,104],[0,23],[2,21],[4,17],[5,13],[8,10],[8,0],[9,-5],[11,-11],[8,-3],[9,0],[12,22],[8,31],[11,78],[15,43],[39,74],[5,38],[1,39],[5,28],[10,35],[12,21],[17,15],[52,19],[12,22],[3,31],[2,60],[-3,28],[-9,16],[-8,-1],[-12,-10],[-9,1],[-12,10],[-9,43],[6,37],[11,30],[14,26],[3,24],[-3,19],[-4,61]],[[5472,9275],[45,11],[206,138],[52,12],[55,-28],[108,-102],[56,-19],[58,32],[98,74],[33,43],[25,43],[113,197],[67,67],[62,36],[154,87],[17,1],[38,-19],[14,4],[10,34],[2,43],[7,42],[23,28],[37,-15],[30,-66],[44,-164],[44,-237],[19,-73],[17,-40],[57,-81],[16,-38],[31,-126],[49,-118],[62,-57],[408,-91],[180,-40],[115,27],[86,-53],[29,-7],[101,10],[21,-12],[13,-34],[31,-132],[15,-41],[21,-27],[98,-87],[49,-73],[129,-187],[154,-132]],[[2929,6211],[-42,27],[-9,92],[35,72],[-3,17],[-11,15],[-18,15],[-64,127],[-18,27],[-79,64],[-24,29],[-11,29],[-14,44],[-3,25],[1,22],[7,21],[5,25],[-7,15],[-36,22],[-19,27],[-9,27],[-3,20],[1,34]],[[2608,7007],[53,63],[15,10],[14,22],[1,30],[-9,64],[-3,32],[3,34],[5,38],[5,51],[-6,36],[-21,65],[2,25],[22,27],[19,11],[24,8],[20,12],[24,23],[18,22],[7,38],[-5,72],[3,32],[13,23],[27,10],[24,4],[25,16],[17,29],[25,96],[50,78],[-6,43],[20,20],[22,15],[2,13],[-9,11],[-17,14],[-14,19],[-20,41],[-13,14],[-13,-4],[-7,-16],[-7,-21],[-14,-15],[-18,-8],[-22,5],[-16,23],[-23,41],[-7,29],[0,20],[9,14],[25,24],[9,16],[6,19],[0,31],[-1,51],[-14,63],[2,32],[17,22],[80,22],[7,6],[7,8],[7,20],[4,5],[21,6],[28,18],[-28,43],[-7,26],[-5,33],[3,31],[7,29],[-1,20],[-12,18],[-22,8],[-38,-5],[-51,-21],[-18,-14],[-13,-20],[-23,-13],[-30,-7],[-65,12],[-74,-47],[-23,1],[-24,11],[-21,19],[-7,32],[-3,27],[-8,17],[-12,2],[-15,-1],[-8,7],[1,28],[17,38],[-6,17],[-9,13],[-63,26],[24,228],[48,90],[28,33],[27,50],[11,42],[-1,33],[-18,34],[-4,14],[7,22],[13,25],[13,40],[20,15],[21,0],[45,-17],[24,-2],[24,7],[24,24],[14,32],[9,35],[0,33],[-9,31],[-11,23],[-5,25],[9,18],[12,11],[22,26]],[[2814,9781],[45,-30],[75,-102],[30,-16],[26,5],[240,127],[63,56],[50,44],[60,15],[55,-40],[42,-113],[60,-193],[78,-77],[85,27],[86,118],[-15,40],[31,26],[197,59],[38,-10],[115,-62],[176,-96],[61,-6],[103,78],[54,21],[119,-8],[46,10],[14,-7],[15,-27],[2,-29],[-2,-24],[2,-13],[53,-11],[118,35],[56,-2],[22,-9],[187,-77],[160,-162],[57,-41],[52,-12],[2,0]],[[2802,4605],[-10,15],[-41,31],[-179,-70],[-283,46]],[[2289,4627],[0,2],[0,84],[3,25],[19,57],[7,38],[14,29],[7,20],[-3,46],[-29,22],[-15,-4],[-15,1],[-14,5],[-14,8],[-15,4],[-36,-9],[-19,2],[-18,12],[-31,41],[-17,13],[-17,2],[-44,-10],[-12,-8],[-31,-39],[-20,-17],[-16,4],[-7,19],[10,63],[1,19],[-3,24],[-26,76],[-21,88],[-11,24],[-15,21],[-162,95],[-54,10],[-20,13],[-4,32],[16,52],[128,190],[29,33],[23,34],[12,33],[13,108],[27,20],[-1,33],[-6,11],[-10,12],[-55,19],[-68,43],[-36,37],[-16,11],[-16,-4],[-30,-34],[-17,-1],[-18,26],[-35,192],[-8,30],[-25,37],[-9,28],[-11,129],[-6,21],[-25,27],[-3,38],[88,51],[13,15],[10,25],[5,20],[-8,34]],[[1622,6709],[193,36],[22,-10],[23,-3],[18,9],[42,54],[9,18],[2,17],[-2,24],[1,23],[5,28],[7,22],[6,17],[8,7],[13,4],[22,-9],[22,0],[21,6],[30,28],[59,34],[140,23],[42,5],[51,-33],[21,-6],[42,4],[18,-8],[21,-15],[20,-4],[130,27]],[[9896,5305],[-1,1],[-5,15],[-35,87],[-15,15],[-24,16],[-24,1],[-78,-32],[-16,-13],[-11,-17],[-85,-70],[-190,-72],[-230,15],[-85,26],[-60,50],[-33,19],[-20,-1],[-16,-10],[-17,-16],[-30,-7],[-22,16],[-11,38],[2,38],[12,38],[11,28],[1,27],[-11,28],[-22,27],[-45,28],[-23,8],[-107,-5],[-6,-1],[-11,-6],[-10,-9],[-11,-15],[-7,-14],[-11,-33],[-6,-14],[-10,-16],[-16,-19],[-23,-15],[-29,-10],[-19,7],[-9,14],[-3,16],[-4,16],[-12,19],[-12,3],[-49,-17],[-20,7],[-15,18],[-17,45],[-20,33],[-65,-47],[-63,27],[-74,62],[-34,-157],[-10,-32],[-51,-79],[-48,-41],[-10,-22],[-5,-27],[-6,-59],[7,-33],[7,-27],[25,-43],[52,-63],[11,-22],[9,-23],[28,-45],[18,-20],[31,-22],[14,-16],[15,-12],[18,-9],[9,-16],[-6,-25],[-40,-44],[-6,-23],[3,-17],[10,-13],[6,-10],[-5,-16],[-14,-20],[-33,-40],[-4,-31],[4,-28],[8,-21],[-8,-11],[-23,-1],[-92,23],[-16,11],[-4,16],[-6,15],[-53,1],[-176,-55],[-232,-96],[-22,-15],[-26,-6],[-27,5],[-108,50],[-81,3],[-10,89],[-5,19],[-10,29],[-29,30],[-24,17],[-70,23],[-12,14],[-4,21],[10,44],[10,61],[-4,79],[58,30],[16,12],[25,29],[29,24],[19,32],[15,11],[21,8],[13,10],[3,18],[-23,24],[-82,64],[-20,0],[-17,-4],[-17,1],[-11,16],[-7,47],[8,24],[26,44],[9,23],[6,26],[-1,21],[-11,18],[-27,7],[-23,-5],[-20,-11],[-16,-3],[-17,11],[-21,42],[-47,48],[-16,21],[-7,17],[4,78],[-130,-14],[-16,5],[-16,11],[0,20],[1,27],[1,30],[-2,33],[-7,26],[-9,9],[-12,-2],[-68,-44],[-33,-12],[-15,5],[-6,13],[2,25],[1,25],[-8,23],[-18,8],[-82,3],[-28,13],[-20,21],[-11,24],[-8,26],[-6,25],[-2,23],[2,26],[6,22],[10,16],[25,20],[9,13],[0,23],[-11,34],[-42,63],[-235,233]],[[8571,8105],[95,-83],[106,-153],[168,-190],[43,-87],[40,-119],[89,-210],[107,-105],[236,-149],[96,-35],[97,-9],[16,-93],[6,-105],[-4,-103],[-16,-87],[-33,-68],[-42,-63],[-33,-71],[-8,-94],[32,-82],[-5,-46],[-60,-80],[-15,-43],[-23,-146],[-11,-37],[-41,-99],[-16,-73],[7,-40],[27,-25],[101,-50],[29,-2],[103,37],[282,-65],[39,-40],[16,-66],[-19,-63],[-41,-41],[-43,-15]],[[9896,5305],[-67,-23],[-26,-21],[-49,-63],[-27,-49],[-12,-42],[-11,-109],[-19,-113],[-26,-57],[-37,-9],[-180,106],[-24,-4],[-15,-19],[-10,-23],[-10,-15],[-17,-7],[-14,-1],[-189,65],[-77,-18],[-53,-111],[-5,-45],[2,-97],[-3,-47],[-8,-33],[-63,-181],[-30,-60],[-28,-58],[-26,-37],[-61,-47],[-207,-56],[-31,1],[-62,19],[-31,1],[-64,-36],[-20,-23],[-7,-29],[-3,-36],[-10,-40],[-36,-55],[-40,-41],[-33,-47],[-18,-73],[2,-35],[15,-78],[1,-33],[-8,-33],[-8,-7],[-12,-1],[-16,-11],[-38,-44],[-18,-35],[-5,-53],[6,-199],[-3,-41],[-6,-41],[-9,-36],[-8,-39],[-2,-49],[12,-78],[42,-139],[10,-75],[-9,-78],[-24,-61],[-32,-45],[-105,-82],[-26,-47],[-18,-80],[-8,-102],[2,-82],[-7,-75],[-30,-85],[-78,-127],[-32,-84],[-3,-99],[24,-50],[37,-19],[73,6],[102,73],[26,9],[23,-19],[10,-32],[5,-38],[18,-69],[7,-15],[7,-2],[19,9],[8,-3],[16,-24],[15,-29],[14,-35],[11,-43],[7,-13],[9,-5],[8,-8],[5,-24],[-4,-17],[-20,-37],[-6,-18],[-1,-179],[-14,-61],[-39,-40],[-20,-4],[-64,12],[-18,-12],[-27,-50],[-18,-15],[-37,-1],[-151,34],[-46,30],[-39,50],[-13,70],[13,27],[49,23],[12,29],[-10,34],[-41,29],[5,39],[34,27],[40,-4],[15,15],[-120,220],[-9,22],[-11,15],[-21,7],[-43,-28],[-69,-135],[-41,-36],[-140,-11],[-108,52],[-30,-7],[-22,-51],[-35,-184],[-28,-82],[-69,-105],[-75,-65],[-76,-17],[-134,71],[-78,15],[-79,-12],[-9,-7]],[[110,5495],[0,-71],[-110,37],[0,1],[128,290],[71,231],[70,319],[18,329],[10,66],[-9,19],[9,37],[-14,79],[4,244],[-14,107],[55,-90],[24,-173],[4,-342],[-4,-49],[-16,-65],[-4,-47],[0,-147],[-19,-64],[-27,-65],[-9,-60],[32,-54],[0,-24],[-24,-41],[-32,-74],[-27,-88],[-11,-80],[-22,-79],[-83,-146]],[[2289,4627],[-31,5],[-185,-63],[-22,-30],[-19,-36],[-32,-31],[-39,-5],[-46,19],[-38,43],[-15,64],[0,65],[-6,43],[-20,20],[-44,-6],[-45,-45],[-14,-9],[-17,9],[-42,37],[-60,19],[-33,29],[-57,67],[-118,34],[-30,32],[-29,52],[-120,123],[-69,45],[-172,8],[-62,65],[-106,240],[-52,68],[-42,-8],[-140,-153],[2,19],[-8,90],[0,29],[11,16],[13,-6],[12,2],[10,39],[-3,32],[-12,46],[-14,41],[-11,17],[-14,18],[-5,41],[1,88],[-18,3],[-98,-123],[-10,29],[0,9],[5,3],[65,196],[14,30],[27,43],[0,96],[-20,157],[-21,117],[-2,30],[-8,14],[-16,23],[-16,32],[-8,37],[2,48],[3,31],[0,29],[-5,40],[-64,222],[-12,69],[-5,73],[-11,39],[-71,160],[-16,25],[-15,13],[-11,25],[-8,96],[-16,77],[-27,330],[0,172],[4,43],[16,55],[4,36],[0,335],[-9,137],[65,21],[100,1],[68,25],[26,74],[12,108],[29,126],[43,86],[61,85],[63,68],[52,35],[77,5],[27,11],[112,111],[125,123],[64,42],[150,9],[89,53],[389,234]],[[1771,9768],[-6,-39],[-22,-24],[-62,-41],[-11,-18],[-5,-29],[3,-23],[9,-23],[14,-16],[15,-23],[11,-34],[0,-81],[4,-40],[6,-31],[20,-33],[9,-22],[49,-146],[7,-38],[-4,-17],[-15,-10],[-17,-2],[-16,-9],[-11,-17],[-11,-42],[-10,-27],[-9,-16],[-19,-65],[-42,-115],[-13,-16],[-18,-15],[-83,1],[-24,-6],[-14,-17],[-17,-30],[-14,-14],[-18,-8],[-66,-4],[-18,-14],[-81,-99],[-11,-81],[-60,-150],[-17,-30],[-16,-17],[-39,-12],[-21,-21],[-7,-25],[1,-21],[4,-24],[4,-26],[-8,-159],[2,-36],[6,-35],[8,-23],[31,-62],[6,-21],[5,-30],[-7,-20],[-24,-27],[-6,-20],[-8,-13],[-90,-96],[-23,-35],[-11,-23],[-5,-18],[-1,-21],[3,-24],[71,-9],[16,6],[22,13],[32,37],[9,-5],[3,-19],[-1,-26],[1,-23],[20,-41],[13,-21],[8,-16],[2,-17],[-5,-16],[-9,-18],[-4,-19],[6,-24],[14,-5],[20,3],[21,9],[81,2],[40,19],[27,3],[13,-12],[5,-15],[-5,-20],[-2,-22],[-1,-23],[-3,-19],[-7,-22],[2,-23],[34,-75],[5,-21],[4,-18],[8,-56],[8,-23],[13,-27],[7,-18],[5,-26],[51,-96],[90,-103]],[[1771,9768],[30,19],[189,113],[77,-6],[32,-22],[63,-60],[34,-17],[505,22],[109,-33],[4,-3]]],"transform":{"scale":[0.0005876739229360665,0.00025560169128088024],"translate":[20.92456870056236,53.886841126000036]}};
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
