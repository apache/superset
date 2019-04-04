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
  Datamap.prototype.ltuTopo = '__LTU__';
  Datamap.prototype.luxTopo = '__LUX__';
  Datamap.prototype.lvaTopo = '__LVA__';
  Datamap.prototype.macTopo = '__MAC__';
  Datamap.prototype.mafTopo = '__MAF__';
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = {"type":"Topology","objects":{"mdg":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Alaotra-Mangoro"},"id":"MG.","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Amoron'i Mania"},"id":"MG.","arcs":[[6,7,8,9,10,11]]},{"type":"Polygon","properties":{"name":"Analamanga"},"id":"MG.","arcs":[[-4,12,13,14,15]]},{"type":"MultiPolygon","properties":{"name":"Analanjirofo"},"id":"MG.","arcs":[[[16]],[[17,18,19,-1,20]]]},{"type":"Polygon","properties":{"name":"Androy"},"id":"MG.","arcs":[[21,22,23]]},{"type":"Polygon","properties":{"name":"Anosy"},"id":"MG.","arcs":[[24,25,-24,26,27]]},{"type":"Polygon","properties":{"name":"Atsimo-Andrefana"},"id":"MG.","arcs":[[28,29,-27,-23,30,31,-10]]},{"type":"Polygon","properties":{"name":"Atsimo-Atsinanana"},"id":"MG.","arcs":[[32,-25,33,34,35]]},{"type":"Polygon","properties":{"name":"Atsinanana"},"id":"MG.","arcs":[[36,-7,37,-2,-20,38]]},{"type":"Polygon","properties":{"name":"Betsiboka"},"id":"MG.","arcs":[[-5,-16,39,40,41,42]]},{"type":"Polygon","properties":{"name":"Boeny"},"id":"MG.","arcs":[[43,-42,44,45]]},{"type":"Polygon","properties":{"name":"Bongolava"},"id":"MG.","arcs":[[-15,46,47,48,49,-40]]},{"type":"MultiPolygon","properties":{"name":"Diana"},"id":"MG.","arcs":[[[50]],[[51,52,53]]]},{"type":"Polygon","properties":{"name":"Haute Matsiatra"},"id":"MG.","arcs":[[54,-35,55,-29,-9]]},{"type":"Polygon","properties":{"name":"Ihorombe"},"id":"MG.","arcs":[[-34,-28,-30,-56]]},{"type":"Polygon","properties":{"name":"Itasy"},"id":"MG.","arcs":[[-14,56,-47]]},{"type":"Polygon","properties":{"name":"Melaky"},"id":"MG.","arcs":[[-45,-41,-50,57,58]]},{"type":"Polygon","properties":{"name":"Menabe"},"id":"MG.","arcs":[[-49,59,-11,-32,60,-58]]},{"type":"Polygon","properties":{"name":"Sava"},"id":"MG.","arcs":[[-18,61,-52,62]]},{"type":"Polygon","properties":{"name":"Sofia"},"id":"MG.","arcs":[[-62,-21,-6,-43,-44,63,-53]]},{"type":"Polygon","properties":{"name":"Vakinankaratra"},"id":"MG.","arcs":[[-3,-38,-12,-60,-48,-57,-13]]},{"type":"Polygon","properties":{"name":"Vatovavy-Fitovinany"},"id":"MG.","arcs":[[64,-36,-55,-8,-37]]}]}},"arcs":[[[7819,6532],[-33,-80],[0,-65],[-86,-110],[34,-119],[-69,-82],[90,-54],[-72,-93],[-121,-46],[34,-37],[138,-37],[35,-64]],[[7769,5745],[-52,-73],[-172,0],[-86,-18],[86,-55],[120,-74],[18,-73],[-173,-55],[-172,-19],[-51,-101],[0,-146],[69,-110],[120,-166],[0,-137],[-120,-18],[-18,-111],[-240,-36],[51,-138],[-120,0],[-52,-165],[-224,9],[-103,46],[-103,-37],[-193,-19]],[[6354,4249],[13,17],[4,19],[0,4],[-3,6],[-3,7],[-3,9],[-2,44],[1,9],[5,5],[16,11],[5,6],[2,6],[0,5]],[[6389,4397],[-4,14],[1,17],[2,6],[3,5],[19,16],[9,11],[4,8],[2,9],[2,5],[4,3],[19,11],[23,19],[5,6],[4,5],[4,11],[10,48],[0,9],[-3,15],[-1,25],[-8,11],[-2,6],[-1,7],[3,22],[-1,6],[-2,3],[-45,45],[-3,5],[-2,10],[0,6],[2,5],[23,24],[7,9],[2,8],[0,9],[2,5],[3,4],[7,5],[5,6],[6,7],[2,7],[4,35],[-1,17],[4,24],[-1,5],[-10,20],[-5,18],[-3,56],[18,49],[46,67],[5,12],[1,10],[-1,9],[11,61],[-1,27],[2,6],[2,4],[2,3],[8,5],[22,10],[5,4],[7,6],[2,5],[-1,5],[-2,4],[-3,3],[-11,10],[-2,5],[-2,7],[0,20],[-2,6],[-21,19],[-4,4],[-1,7],[3,45],[-1,2],[-1,2],[-5,12],[-1,15],[3,8],[3,7],[5,7],[0,4],[-1,4],[-8,7],[-6,7],[-7,16],[-4,8],[-10,10],[-3,4],[-5,32],[-2,4],[-4,3],[-5,3],[-6,2],[-21,4],[-12,4],[-6,3],[-19,5],[-5,3],[-5,4],[-2,4],[-6,15]],[[6427,5637],[45,32],[36,35],[5,8],[-4,9],[-1,5],[0,9],[3,4],[5,4],[15,7],[10,7],[3,5],[1,5],[0,12],[2,9],[4,5],[4,4],[5,2],[3,1],[6,1],[7,1],[8,0],[8,0],[10,0],[10,1],[16,8],[7,5],[4,6],[6,22],[3,27],[5,11],[6,3],[15,3],[4,3],[2,4],[0,17],[4,10],[5,5],[6,3],[14,5],[9,5],[2,4],[-1,9],[3,7],[1,5],[-2,4],[-6,2],[-25,1],[-7,3],[-4,4],[-2,7],[1,5],[4,3],[18,8],[8,5],[4,6],[14,30],[3,6],[5,4],[13,7],[10,6],[17,14],[7,7],[3,6],[-6,13],[-1,8],[2,4],[5,3],[10,5],[9,6],[29,27],[7,10],[2,8],[-3,3],[-3,4],[-3,4],[-2,6],[-2,10],[-3,6],[-3,4],[-3,5],[-1,7],[2,12],[-3,6],[-4,5],[-7,1],[-17,1],[-18,0],[-9,0],[-8,1],[-7,2],[-24,8],[-19,10],[-32,23],[0,3],[-1,19],[-4,6],[-6,5],[-6,4],[-1,3],[16,24],[0,6],[-3,5],[-6,2],[-12,4],[-8,1],[-6,2],[-5,2],[-4,3],[-6,7],[-4,3],[-5,3],[-5,2],[-7,2],[-5,3],[-5,4],[-4,13],[-3,4],[-4,4],[-4,2],[-10,4],[-7,4],[-4,2],[-3,3],[-5,8],[-4,3],[-4,3],[-5,3],[-8,5],[-21,10],[-7,6],[-7,9],[-4,8],[2,5],[3,5],[6,6],[2,6],[-2,26],[-5,19],[-5,7],[-5,8],[-21,19],[-2,4],[-12,34],[0,14]],[[6446,6652],[4,17],[2,5],[10,11],[2,5],[11,44],[1,6],[-2,9],[-11,26],[0,6],[2,5],[9,11],[8,6],[10,5],[17,6],[11,6],[5,5],[1,5],[-1,9],[4,4],[5,1],[7,-1],[11,-3],[7,-1],[4,1],[6,1],[12,3],[7,1],[7,0],[8,-1],[14,-3],[15,-2],[17,0],[8,1],[8,-1],[7,-1],[13,-4],[7,-1],[7,-1],[35,-1],[9,0],[7,1],[7,1],[7,2],[7,1],[24,3],[8,1],[19,6],[7,1],[66,6],[17,-1],[8,-1],[8,0],[8,0],[15,2],[7,-1],[7,-1],[6,-2],[16,-8],[21,-14],[5,-2],[18,-6],[10,-5],[7,-2],[7,-1],[25,-3],[6,-2],[5,-2],[3,-4],[1,-14],[3,-4],[4,-2],[6,0],[14,2],[9,0],[17,0],[32,3],[7,0],[7,-2],[11,-4],[15,-7],[38,-26],[24,-8],[14,-3],[30,-5],[27,-7],[23,-8],[9,-5],[4,-4],[4,-7],[4,-4],[5,-2],[13,-4],[5,-2],[2,-3],[3,-11],[3,-3],[8,-7],[3,-3],[2,-4],[3,-18],[-2,-8],[1,-4],[3,-4],[4,-3],[4,-2],[15,-8],[3,-3],[2,-4],[0,-4],[-2,-4],[-6,-7],[-22,-20],[-6,-7],[-4,-8],[-1,-4],[0,-10],[3,-8],[5,-8],[13,-14],[43,-33],[6,-3],[6,-2],[7,-1],[8,0],[8,1],[6,2],[13,4],[11,4],[25,13],[117,41],[7,2],[7,1],[8,0],[17,0],[23,2],[9,0],[28,-6],[8,-1],[8,0]],[[6173,4045],[-1,-37],[-4,-14],[-6,-7],[-15,-21],[-22,-47],[-5,-18],[5,-61],[4,-6],[4,-3],[5,-3],[3,-3],[9,-11],[5,-3],[5,-2],[22,-4],[7,-2],[6,-2],[14,-8],[5,-2],[13,-4],[5,-3],[4,-2],[4,-4],[5,-3],[6,-3],[9,-3]],[[6260,3769],[-126,-60],[-103,-19],[-17,-100],[-17,-46],[-104,-10],[-69,-36],[-17,-119]],[[5807,3379],[-172,9],[-51,46],[-104,18],[-223,-46],[-103,-73],[-173,0],[-189,64],[-137,101],[-35,55],[-120,-19],[-103,19],[-121,-28],[-120,-55],[-104,-55],[-189,-27],[-172,-46],[-183,0]],[[3508,3342],[4,3],[2,4],[2,4],[10,66]],[[3526,3419],[4,9],[0,6],[-3,10],[-9,17],[-4,9],[0,7],[1,9],[0,9],[1,4],[8,21],[3,4],[7,6],[4,4],[2,4],[2,14],[2,4],[3,4],[5,3],[7,2],[27,1],[7,1],[6,3],[4,3],[1,4],[1,5],[-5,34],[-36,78],[-1,7],[3,3],[3,4],[2,4],[4,9],[1,13],[2,3],[2,3],[14,11],[2,4],[2,4],[1,10],[-1,4],[-11,29],[-1,4],[1,5],[4,8],[6,7],[2,4],[0,6],[-2,7],[-23,50],[-2,6],[-1,14],[-18,38],[-11,14],[-6,8],[-2,6],[0,10],[-1,8],[-4,6],[-9,8],[-2,5],[1,4],[2,4],[1,5],[-1,13],[1,5],[2,4],[4,3],[5,3],[11,4],[6,2],[3,4],[2,4],[-3,10],[1,5],[6,8],[2,5],[-1,4],[-4,3],[-6,3],[-20,5],[-11,4],[-7,4],[-7,4],[-9,7],[-2,6],[1,4],[11,10],[3,4],[2,4],[3,18],[3,7]],[[3517,4186],[30,-17],[35,-9],[10,-1],[12,0],[12,1],[8,2],[14,5],[9,0],[10,-1],[32,-3],[67,-16],[89,-2],[9,-3],[18,-9],[10,-3],[10,0],[25,2],[12,-2],[15,-11],[8,-26],[11,-11],[23,-7],[23,-2],[17,-4],[7,-15],[4,-16],[10,1],[33,20],[34,12],[13,7],[10,12],[18,-8],[41,-11],[15,-6],[10,-11],[2,-12],[-8,-9],[-21,-4],[11,-9],[13,-18],[13,-8],[-33,-10],[-5,-11],[14,-12],[24,-12],[55,-19],[32,-8],[26,-3],[18,2],[33,10],[16,3],[17,-1],[13,-2],[12,-4],[27,-5],[26,-3],[17,0],[12,-2],[8,-5],[7,-5],[11,-5],[32,-1],[26,11],[23,12],[22,3],[92,-24],[30,-4],[33,1],[23,7],[20,3],[23,-8],[27,-7],[27,5],[22,7],[13,2],[35,1],[8,2],[5,2],[5,2],[9,6],[32,15],[42,24],[12,9],[5,3],[18,7],[8,1],[14,1],[8,0],[7,-2],[15,-5],[26,-6],[11,-1],[10,1],[41,9],[63,2],[11,1],[27,6],[24,3],[24,0],[12,1],[8,2],[2,4],[7,22],[1,14],[2,4],[3,3],[5,3],[9,5],[5,3],[19,6],[5,2],[7,3],[10,1],[8,0],[6,-2],[4,-3],[4,-4],[6,-4],[10,-4],[9,-2],[7,2],[5,2],[21,13],[3,2],[6,1],[26,4],[15,2],[11,0],[9,-2],[6,-1],[17,-7],[7,-2],[85,-11],[14,-1],[10,1],[5,3],[4,3],[3,3],[5,4],[6,3],[13,3],[9,0],[8,-2],[6,-2],[5,-3],[7,-7],[6,-4],[7,-1],[7,0],[69,21],[15,3],[42,3],[8,2],[5,2],[19,11],[7,2],[9,2],[13,2],[8,-1],[6,-3],[2,-3],[-2,-3],[-4,-3],[-9,-6],[-3,-3],[-2,-3],[2,-4],[5,-2],[7,-2],[9,-2],[32,-3],[7,-1],[6,-2],[5,-3],[4,-2],[4,-4]],[[6389,4397],[-186,73],[-241,55],[0,92],[35,101],[-155,0]],[[5842,4718],[-69,119],[-147,126],[-18,21],[-39,8],[-43,14],[-96,11],[-64,8]],[[5366,5025],[-25,18],[-57,16],[-43,32],[-18,34],[-47,21],[-23,22],[-43,102],[-138,68],[-183,128],[-119,161],[-45,124]],[[4625,5751],[91,4],[82,10],[21,2],[29,-1],[51,-5],[57,-2],[18,2],[22,6],[17,0],[13,1],[11,-1],[9,-6],[15,-24],[3,-7],[-1,-9],[-5,-15],[6,-6],[15,-4],[72,0],[39,-3],[29,-4],[14,-6],[17,-10],[12,2],[8,5],[15,14],[8,5],[22,10],[13,4],[14,2],[52,4],[15,3],[46,17],[15,4],[21,3],[35,2],[31,0],[37,-3],[58,-11],[27,-6],[13,-6],[0,-6],[0,-6],[3,-7],[10,-15],[8,-6],[11,-4],[40,-11],[12,-4],[9,-6],[6,-6],[12,-7],[22,-5],[38,-6],[59,-4],[46,3],[19,-3],[10,-6],[16,-14],[13,-6],[33,-2],[54,1],[197,19],[40,7],[77,9]],[[9093,6244],[-25,-17],[-12,20],[7,19],[33,37],[6,10],[3,9],[1,21],[5,12],[11,10],[31,18],[93,75],[5,10],[3,12],[4,11],[12,10],[17,6],[53,16],[-6,-18],[-49,-52],[-37,-57],[-67,-75],[-49,-34],[-39,-43]],[[8738,7804],[83,-38],[27,-16],[12,-11],[31,-22],[16,-9],[13,-4],[7,1],[112,24],[7,2],[14,0],[21,-1],[67,-7],[16,0],[7,1],[20,6],[9,2],[13,1],[7,-1],[7,-2],[6,-2],[9,-5],[26,-27],[92,-62],[3,-4],[1,-4],[-2,-3],[-5,-3],[-5,-2],[-6,-2],[-36,-8],[-8,-3],[-5,-2],[-5,-2],[-9,-6],[3,-6],[8,-8],[29,-17],[11,-9],[6,-7],[-1,-4],[-2,-4],[-15,-13],[-3,-3],[-7,-17],[-1,-9],[1,-5],[1,-4],[7,-7],[49,-39],[7,-7],[0,-5],[-2,-4],[-2,-4],[-25,-33],[-2,-4],[-1,-4],[1,-19],[0,-4],[-14,-28],[0,-5],[1,-6],[23,-27],[18,-30],[5,-23],[5,-11],[7,-11],[8,-7],[12,-9],[5,-6],[3,-6],[3,-13],[54,-86],[9,-3],[0,-1]],[[9484,7087],[-30,-2],[-68,31],[-26,16],[-10,21],[-6,38],[-3,5],[-17,4],[-19,8],[-18,9],[-12,8],[-9,10],[-7,12],[-4,12],[1,12],[7,12],[9,9],[2,10],[-14,11],[-8,4],[-8,3],[-9,1],[-12,0],[-7,2],[-39,27],[-3,9],[7,23],[1,13],[-11,37],[2,4],[5,4],[2,5],[-9,7],[-7,1],[-25,1],[-36,-9],[-50,-3],[-89,0],[-45,-8],[-30,-15],[-79,-57],[2,-19],[29,-42],[2,-10],[-2,-10],[-14,-20],[-3,0],[9,-9],[16,-8],[15,-10],[11,-24],[19,-24],[10,-37],[13,-23],[21,-20],[3,-8],[-4,-13],[-10,-12],[-42,-38],[-13,-21],[0,-25],[9,-24],[18,-21],[35,-17],[90,-17],[40,-13],[31,-24],[6,-21],[-29,-68],[-3,-29],[8,-25],[24,-11],[15,-5],[3,-11],[-5,-28],[-6,-11],[-2,-5],[0,-25],[-6,-10],[-72,-65],[-40,-23],[-61,-26],[2,-33],[10,-16],[21,-16],[29,-14],[29,-7],[33,-3],[37,2],[-42,-12],[-43,-9],[-81,-6],[-34,-10],[-69,-3],[-28,-3],[-22,-8],[-17,-11],[-92,-95],[-64,-92],[-70,-85],[-14,-53],[7,-11],[41,-34],[26,-71]],[[8586,5920],[-198,-10],[-52,-55],[0,-55],[-172,-27],[-206,-9],[-189,-19]],[[7819,6532],[68,6],[10,2],[12,3],[5,3],[1,4],[-3,3],[-13,9],[-8,6],[-1,5],[0,5],[5,7],[6,4],[9,5],[13,5],[11,6],[6,5],[14,18],[17,15],[7,9],[4,6],[-1,10],[1,6],[6,9],[7,4],[8,2],[9,1],[7,0],[8,1],[54,15],[28,11],[21,16],[4,5],[2,4],[1,8],[7,8],[81,77],[7,8],[3,7],[-2,4],[-2,4],[-8,11],[-1,3],[1,9],[0,4],[-2,4],[-3,4],[-4,3],[-6,2],[-14,3],[-16,2],[-54,1],[-43,4],[-128,30],[-6,3],[-5,2],[-2,5],[2,6],[19,23],[12,26],[1,1],[13,22],[10,10],[8,6],[34,19],[19,13],[18,18],[4,7],[1,5],[-2,9],[-16,42],[-9,15],[-12,14],[-7,6],[-18,12],[-3,3],[-2,4],[-1,4],[0,5],[3,9],[17,32],[23,90],[0,4],[-1,4],[-3,4],[-2,3],[-3,5],[-2,5],[3,10],[3,5],[5,4],[22,10],[15,10],[6,6],[3,5],[0,3],[-4,3],[-5,0],[-13,-2],[-7,-1],[-7,2],[-6,2],[-5,2],[-7,1],[-7,1],[-14,-2],[-8,-1],[-9,0],[-8,1],[-8,1],[-6,2],[-6,2],[-4,3],[-7,7],[-2,4],[-1,4],[-2,9],[-2,4],[-7,7],[-3,4],[0,6],[4,10],[5,5],[7,3],[16,2],[35,3],[16,2],[7,0],[9,0],[15,-1],[9,0],[8,1],[7,1],[39,10],[30,5],[13,3],[6,3],[7,4],[7,6],[7,3],[6,3],[12,4],[7,1],[7,2],[8,0],[9,1],[18,-1],[10,0],[12,2],[38,12],[15,3],[7,2],[13,7],[5,3],[7,1],[8,1],[8,0],[22,-4],[9,0],[9,1],[10,4],[6,4],[5,4],[5,7],[1,5],[0,4],[-1,5],[-2,4],[-3,3],[-8,6],[-3,3],[-1,5],[0,5],[1,6],[4,4],[6,2],[8,0],[7,-1],[21,-4],[17,-2],[17,0],[10,1],[9,2],[12,4],[5,4],[4,4],[3,14],[0,9],[-2,5],[-2,3],[-4,5],[-1,3],[0,5],[2,5],[12,17],[2,4],[2,9],[-1,9],[-8,16],[-1,5],[0,6],[4,7],[5,4],[6,2],[7,-1],[6,-2],[32,-11],[4,-1],[6,-2],[7,-1],[9,0],[8,0],[9,2],[9,4],[24,18],[6,2],[6,2],[6,2],[13,2],[10,-1]],[[4140,293],[-272,-58],[-172,-44],[-192,-52],[-138,-63],[-26,-9],[-29,-6],[-31,-1],[-69,-32],[-95,-10],[-390,-8],[-21,-2],[-20,-5],[-21,-3],[-24,2],[-13,9],[-13,28],[-11,12],[-42,15],[-147,27],[-41,14],[-18,10],[-17,23],[-23,10],[-101,36],[-93,22],[-54,8]],[[2067,216],[67,113],[241,101],[189,91],[52,110],[-34,129],[0,92],[68,82],[35,138],[69,101],[86,55],[258,27]],[[3098,1255],[54,-91],[161,4],[189,-28],[103,-46],[-69,-110],[69,-82],[155,-64],[0,-83],[-52,-101],[35,-73],[0,-110],[275,-74],[122,-104]],[[4481,1423],[-19,-10],[-8,-7],[-18,-21],[-29,-26],[-23,-29],[-3,-8],[-2,-6],[7,-7],[13,-9],[51,-21],[29,-10],[11,-4],[9,-6],[13,-14],[8,-6],[10,-5],[13,-4],[14,-3],[78,-9],[103,-19],[50,-16],[9,-4],[5,-5],[2,-3],[-4,-13],[4,-7],[15,-11],[6,-8],[9,-24],[13,-6],[23,-3],[76,-1],[26,-4],[15,-5],[11,-5],[10,-6],[41,-30],[5,-6],[2,-8],[-3,-7],[-11,-15],[-6,-16],[-1,-12],[2,-8],[5,-7],[11,-6],[15,-3],[25,0],[19,2],[40,6],[23,6],[11,3],[11,5],[6,6],[12,15],[8,6],[19,11],[7,6],[4,8],[-1,7],[-6,7],[-21,19],[-12,14],[-5,8],[-2,8],[0,8],[4,8],[10,5],[14,2],[40,-6],[19,-2],[37,5],[13,5],[8,4],[3,6],[0,6],[-9,22],[1,19],[9,4],[20,2],[98,-14],[19,-5],[36,-12],[176,-47],[68,-27],[3,-1]],[[5775,1079],[-79,-106],[-10,-5],[-17,3],[-29,7],[-7,-5],[19,-40],[-36,-118],[-115,-143],[-35,-26],[-4,-11],[1,-23],[-9,-11],[-71,-27],[-19,-22],[12,-47],[-16,-19],[-14,9],[-9,9],[-5,11],[0,12],[-12,-11],[-1,-10],[3,-12],[1,-12],[-6,-14],[-10,-7],[-40,-7],[-24,-7],[-38,-18],[-66,-39],[-14,-4],[-5,3],[-14,17],[-16,1],[-4,-1],[-1,-2],[-80,-28],[-30,-14],[-15,-5],[-40,-7],[-16,-5],[-19,-13],[-14,-6],[-11,0],[-14,3],[-14,0],[-13,-8],[-13,-5],[-95,-12],[-21,0],[-46,6],[-141,10],[-158,-2],[-205,-25]],[[3098,1255],[68,129],[-86,91],[-258,-9],[-3,89],[165,133],[-51,130]],[[2933,1818],[8,8],[20,15],[-1,62],[29,88],[22,14],[269,77],[262,53],[67,7],[19,0],[89,-4],[58,1],[33,-5],[101,-31],[31,-14],[23,2],[30,-12],[99,-31],[8,-4],[26,-20],[78,-86],[5,-7],[13,-12],[3,-4],[3,-8],[3,-5],[1,-1],[26,-19],[4,-5],[2,-4],[11,-12],[16,-12],[23,-22],[3,-5],[5,-10],[6,-4],[8,-3],[97,-26],[13,-5],[10,-6],[7,-11],[7,-34],[0,-7],[-5,-6],[-13,-13],[-5,-8],[0,-7],[4,-8],[6,-7],[8,-15],[0,-7],[-4,-7],[-6,-7],[-5,-6],[-7,-14],[-7,-6],[-11,-4],[-26,-8],[-9,-5],[-4,-6],[3,-7],[7,-10],[6,-15],[6,-8],[27,-19],[19,-11],[10,-8],[21,-26],[13,-13],[4,-9],[2,-8],[-1,-6],[-2,-6],[-3,-4],[-7,-4],[-10,-5]],[[3508,3342],[-18,-17],[-9,-6],[-15,-7],[-5,-3],[-2,-4],[0,-4],[26,-74],[1,-9],[-4,-19],[-2,-4],[-3,-3],[-4,-3],[-6,-3],[-6,-1],[-8,-2],[-27,-1],[-7,-1],[-6,-2],[-7,-2],[-16,-1],[-18,-6],[-14,-3],[-5,-2],[-4,-4],[-5,-3],[-7,-1],[-8,-1],[-8,-1],[-5,-3],[-4,-3],[-4,-3],[-5,-8],[-4,-3],[-6,-2],[-16,-2],[-6,-2],[-5,-2],[-4,-3],[-2,-4],[2,-13],[-1,-5],[-2,-4],[-3,-4],[-3,-3],[-52,-30],[-3,-3],[-1,-4],[1,-5],[8,-20],[1,-9],[-1,-5],[-8,-16],[0,-4],[1,-4],[23,-48],[1,-5],[-1,-4],[-1,-4],[-4,-3],[-5,-3],[-27,-6],[-3,-3],[-1,-3],[0,-2],[3,-8],[2,-8],[-1,-3],[-3,-4],[-5,-2],[-6,-2],[-7,-2],[-16,-2]],[[3148,2879],[-17,-1],[-47,-1],[-8,-1],[-8,-1],[-6,-2],[-6,-2],[-5,-3],[-4,-3],[-3,-3],[-3,-4],[-31,-93],[-4,-3],[-5,-3],[-6,-2],[-7,-1],[-16,-2],[-7,-1],[-7,-2],[-5,-3],[-4,-3],[-2,-4],[-4,-8],[-3,-4],[-6,-2],[-6,-2],[-57,-7],[-57,0],[-17,-1],[-14,-2],[-6,-2],[-11,-5],[-4,-3],[-3,-3],[5,-8],[11,-10],[30,-21],[20,-17],[8,-11],[4,-5],[4,-5],[12,-33],[1,-4],[-2,-4],[-6,-8],[-2,-4],[-1,-4],[3,-6],[7,-7],[16,-13],[6,-8],[2,-6],[-2,-4],[-4,-3],[-5,-3],[-21,-9],[-2,-5],[2,-6],[7,-10],[2,-6],[0,-6],[-5,-8],[-4,-3],[-6,-2],[-17,0],[-9,-1],[-5,-2],[-4,-4],[-6,-12],[-7,-7],[-2,-4],[-2,-9],[-1,-10],[1,-5],[2,-5],[7,-13],[2,-4],[-2,-4],[-4,-3],[-6,-2],[-22,-4],[-6,-2],[-4,-3],[-12,-14],[0,-4],[2,-8],[1,-4],[-3,-4],[-4,-3],[-6,-2],[-21,-4],[-31,-5],[-14,-3],[-6,-2],[-5,-3],[-2,-4],[-2,-5],[-2,-4],[-4,-3],[-4,-3],[-5,-3],[-8,-6],[-59,-53],[-10,-16],[-3,-9],[-3,-19],[-4,-9],[-7,-7],[-39,-26],[-3,-4],[-3,-3],[-2,-4],[1,-5],[1,-5],[12,-17],[2,-4],[0,-5],[0,-4],[-1,-5],[-10,-10],[-2,-3],[-1,-3],[-1,-10],[-1,-3],[-3,-4],[-3,-3],[-8,-7],[-6,-7],[-15,-29],[-11,-15],[-1,-4],[1,-5],[4,-11],[1,-10],[1,-5],[3,-4],[4,-5],[5,-4],[6,-7],[2,-4],[4,-13],[2,-5],[4,-5],[4,-4],[4,-3],[4,-2],[11,-6],[14,-8],[40,-21],[8,-2],[11,-2],[21,-2],[13,-1],[55,4],[8,0],[26,-2],[9,0],[23,3],[7,-1],[7,-2],[4,-5],[5,-9],[7,-7],[5,-3],[7,-6],[6,-12],[3,-4],[5,-3],[8,-2],[16,-1],[30,1],[18,-1],[25,-3],[9,0],[9,0],[8,1],[18,7]],[[2067,216],[-146,10],[-144,4],[-202,20],[-26,7],[-20,28],[-45,25],[-10,16],[27,-6],[24,-10],[42,-24],[28,-9],[23,-1],[11,8],[-6,17],[-22,-3],[-18,6],[-35,17],[-23,7],[-21,5],[-22,2],[-27,1],[-48,9],[-83,44],[-48,12],[-44,0],[-16,2],[-109,36],[-16,16],[-9,58],[-13,24],[-100,66],[-14,24],[13,66],[-13,24],[-14,13],[-59,31],[-6,3],[-7,3],[-8,6],[-3,6],[-5,15],[-6,6],[-45,20],[-96,32],[-42,21],[-46,52],[-23,110],[18,126],[-24,71],[3,7],[12,13],[3,7],[-1,9],[-17,22],[-11,29],[-9,13],[-17,13],[19,15],[-2,52],[6,23],[30,14],[93,20],[24,16],[-3,12],[-19,19],[3,14],[21,10],[6,5],[9,12],[0,6],[-4,7],[-15,10],[-37,16],[-26,17],[-58,28],[-10,3],[-8,0],[-10,1],[-11,5],[-3,4],[-5,17],[-15,25],[-5,66],[-18,55],[-19,30],[-38,20],[-94,35],[-14,10],[-23,23],[-20,9],[-25,10],[-47,26],[-28,22],[-16,16],[-6,10],[-8,30],[-17,20],[-7,38],[-16,21],[-9,26],[-6,6],[-19,12],[-7,7],[-10,17],[-1,17],[6,34],[-14,67],[-20,36],[-32,33],[-1,7],[2,7],[-1,7],[-9,19],[-15,17],[3,15],[30,11],[37,2],[29,-14],[9,12],[-2,12],[-6,13],[-1,13],[-47,1],[-19,29],[0,66],[3,9],[13,14],[3,8],[0,17],[3,7],[5,4],[6,2],[5,4],[3,1],[6,1],[6,2],[4,2],[-10,20],[2,10],[6,8],[9,9],[12,7],[16,-10],[2,-13],[-9,-26],[28,20],[5,34],[-2,37],[7,28],[15,14],[92,55],[23,9],[27,2],[30,-9],[0,196],[10,18],[29,34],[9,18],[11,-13],[11,0],[26,13]],[[439,3141],[0,-5],[20,-10],[49,-17],[16,-8],[6,-9],[12,-38],[13,-10],[59,-16],[13,-10],[6,-11],[14,-13],[27,-18],[38,-14],[9,-7],[4,-7],[2,-15],[3,-8],[25,-24],[9,-11],[4,-17],[10,-17],[45,-18],[10,-10],[5,-10],[10,-13],[23,-20],[33,-18],[7,-7],[6,-17],[6,-6],[16,-6],[17,-3],[19,-1],[18,-2],[10,-3],[16,-8],[12,-4],[30,-4],[29,3],[50,6],[22,4],[34,23],[23,12],[42,12],[50,10],[51,2],[46,-14],[22,-21],[13,0],[27,14],[12,11],[6,1],[14,-5],[7,-5],[12,-20],[41,13],[46,6],[105,2],[69,16],[50,7],[31,11],[32,9],[127,99],[0,183],[69,83],[189,-10],[86,-45],[155,-10],[104,55],[137,83],[293,55],[172,92],[137,18],[162,13]],[[6399,2199],[-33,-110],[-26,-45],[-8,-69],[-46,-81],[-52,-72],[-33,-106],[-163,-246],[-16,10],[-8,9],[-8,1],[-15,-10],[-14,-16],[9,-4],[23,-1],[24,-6],[6,-19],[-71,-156],[-75,-98],[-24,-21],[-9,-5],[-22,-7],[-7,-3],[-3,0],[-14,-3],[-2,0],[-9,-3],[3,-3],[6,-2],[0,-4],[0,-2],[-9,-18],[-24,-25],[-4,-5]],[[4481,1423],[260,-35],[120,9],[103,55],[35,138],[-35,156],[-34,110],[17,46],[121,9],[154,-37],[138,-46],[103,0],[0,55],[0,92],[-17,110],[-120,119],[-86,165],[-69,65]],[[5171,2434],[103,73]],[[5274,2507],[69,-55],[223,-55],[121,-9],[51,27],[121,-36],[52,-83],[172,-37],[172,0],[144,-60]],[[7407,3792],[-12,3],[-113,16],[-97,-1],[-69,8],[-11,2],[-12,7],[-4,5],[-2,5],[1,5],[0,9],[-2,4],[-6,7],[-4,3],[-7,3],[-23,9],[-8,3],[-9,3],[-8,1],[-15,0],[-43,-6],[-9,-1],[-9,0],[-15,2],[-16,4],[-31,9],[-24,9],[-4,2],[-29,26],[-5,3],[-5,2],[-7,2],[-8,1],[-13,0],[-9,-1],[-8,-1],[-6,-2],[-5,-3],[-4,-3],[-3,-3],[0,-4],[2,-3],[8,-6],[2,-3],[-1,-4],[-9,-5],[-4,-3],[-3,-4],[-3,-8],[-3,-3],[-13,-9],[-4,-3],[-5,-8],[-1,-4],[-3,-4],[-42,-35],[-4,-8],[-1,-4],[0,-4],[2,-4],[10,-10],[0,-3],[-3,-3],[-5,-3],[-6,-2],[-8,-1],[-8,0],[-12,2],[-15,5],[-27,11],[-25,8],[-7,0],[-13,1],[-17,-1],[-16,-2],[-7,-2],[-19,-6],[-15,-7],[-7,-2],[-7,-1],[-9,0],[-9,0],[-9,0],[-17,2],[-18,1],[-9,0],[-9,-1],[-7,-1],[-7,-2],[-25,-8],[-7,-1],[-8,-1],[-36,-1],[-17,-2],[-8,0],[-9,1]],[[6173,4045],[6,34],[6,12],[37,35],[5,7],[3,7],[0,25],[3,6],[3,4],[7,6],[5,3],[10,5],[23,9],[21,9],[10,6],[42,36]],[[8586,5920],[40,-109],[8,-47],[-17,-51],[-48,-87],[-67,-111],[-2,-13],[2,-12],[6,-10],[6,-6],[15,-9],[7,-5],[3,-9],[-8,-4],[-14,-3],[-14,-4],[-42,-41],[-34,-145],[-10,-10],[-26,-16],[-10,-9],[-33,-50],[-80,-86],[-72,-136],[-107,-124],[-50,-39],[-125,-230],[-173,-223],[-47,-116],[-3,-17],[1,-27],[-45,-66],[-9,9],[-16,12],[-19,6],[-12,-7],[6,-9],[33,-23],[8,-11],[-4,-10],[-113,-119],[-79,-106],[-35,-55]],[[4625,5751],[-21,1],[-19,3],[-14,4],[-11,-2],[-19,-10],[-26,-7],[-23,-8],[-13,-4],[-27,-3],[-13,-2],[-12,-3],[-18,-4],[-23,-2],[-39,-2],[-20,-4],[-13,-5],[-5,-6],[-10,-5],[-14,-3],[-37,-5],[-28,-2],[-19,-3],[-44,-14],[-13,-3],[-15,0],[-17,1],[-15,-3],[-14,-5],[-28,-4],[-17,0],[-9,5],[-1,14],[-8,6],[-10,0],[-28,-7],[-22,-2],[-18,0],[-15,3],[-15,4],[-19,4],[-54,5],[-14,3],[-9,4],[-15,8],[-11,3],[-17,2]],[[3773,5703],[-65,79],[-103,55],[-17,55],[69,37],[-17,55],[-121,9],[-155,-9],[-120,0],[-52,73],[-86,184],[17,73]],[[3123,6314],[259,28],[154,-37],[293,0],[51,-46],[104,-73],[154,-65],[87,28],[68,82],[86,28],[86,55],[155,18],[103,129],[58,121],[183,16],[207,10],[172,-10],[155,-36],[120,-28],[52,37],[-69,55],[-155,64],[103,55],[103,64]],[[5652,6809],[121,-36],[120,-37],[155,0],[69,-28],[120,-27],[209,-29]],[[5390,7434],[-47,-138],[51,-120],[52,-156],[103,-82],[86,-64],[17,-65]],[[3123,6314],[-68,64],[-138,19],[-120,73],[-18,64],[-137,37],[-172,73],[-86,83],[-18,92],[-93,57]],[[2273,6876],[8,7],[10,6],[19,5],[19,3],[40,3],[18,4],[-11,5],[80,20],[40,13],[27,18],[46,40],[31,20],[31,15],[37,12],[85,18],[53,19],[10,-4],[3,-11],[2,-23],[24,-41],[2,-3],[0,-7],[0,-5],[-8,-15],[-2,-13],[2,-9],[11,-6],[21,-3],[21,4],[14,8],[11,9],[15,7],[47,10],[19,6],[10,12],[-4,6],[-27,6],[-16,8],[-11,13],[-1,9],[13,6],[224,12],[9,2],[10,2],[18,6],[11,-20],[10,-8],[5,-1],[2,-3],[1,-11],[-15,-21],[1,-7],[24,6],[9,-14],[10,1],[13,13],[-14,38],[5,8],[21,11],[11,8],[-1,2],[1,19],[3,6],[5,6],[3,5],[-1,8],[-10,9],[-15,6],[-8,7],[10,10],[44,24],[45,15],[15,1],[22,-5],[21,-2],[21,0],[20,-2],[50,-16],[31,2],[83,26],[18,3],[18,2],[21,0],[30,-2],[10,-6],[-2,-25],[1,-11],[5,-6],[11,-3],[20,-2],[12,-1],[24,1],[11,0],[38,-11],[32,0],[0,4],[-14,9],[-9,13],[6,8],[13,6],[10,8],[0,13],[-33,-9],[-32,-13],[-19,-4],[8,16],[20,16],[29,16],[32,13],[32,10],[31,6],[33,4],[68,0],[35,-3],[16,-2],[6,-5],[0,-9],[2,-8],[6,-7],[11,-6],[-16,-13],[-7,-12],[-9,-11],[-25,-9],[30,-13],[21,-11],[18,-14],[48,-51],[22,-14],[30,-13],[2,7],[-1,10],[1,9],[8,4],[11,-1],[15,-14],[11,-5],[27,4],[12,12],[-1,16],[-10,13],[37,2],[26,-13],[24,-17],[28,-12],[14,6],[-15,19],[-33,31],[-27,6],[-57,28],[-34,6],[-44,-2],[-13,2],[-25,8],[3,5],[16,4],[17,8],[36,29],[6,15],[-15,11],[-15,1],[-19,-2],[-15,0],[-7,6],[4,12],[20,20],[16,27],[26,14],[61,25],[86,50],[32,12],[3,-3],[3,-4],[2,-3],[1,-5],[15,5],[37,18],[59,22],[16,8],[32,11],[37,2],[36,0],[31,5],[-18,6],[-42,6],[-6,7],[15,8],[79,10],[142,53],[103,49],[58,9],[39,11],[21,2],[9,-2],[4,-6],[2,-7],[0,-19],[2,-4],[17,-18],[10,-8],[15,-6],[22,-6],[47,-10],[23,-8],[0,-9],[-14,-10],[-21,-18],[-17,-8],[-21,-7],[-14,-8],[-61,-64],[-17,-24],[5,-18],[15,-1],[10,10],[12,24],[16,8],[25,4],[49,4],[47,9],[43,12],[43,6]],[[5366,5025],[-281,14],[-224,9],[-138,-9],[-137,-64],[-69,-129],[-138,-110],[-206,-128],[-138,-101]],[[4035,4507],[-241,-18],[-245,12]],[[3549,4501],[2,3],[3,2],[4,1],[21,4],[6,2],[4,3],[2,6],[-1,22],[5,18],[-2,22],[-2,7],[-3,7],[-13,20],[-5,12],[-13,14],[-2,5],[-1,8],[-3,5],[-10,4],[-9,1],[-8,-1],[-23,-3],[-13,-4],[-19,-5],[-6,-2],[-8,0],[-8,0],[-6,2],[-6,2],[-10,5],[-14,8],[-27,12],[-9,6],[-4,3],[-13,13],[-17,12],[-14,8],[-3,4],[-2,5],[2,9],[3,6],[7,8],[1,4],[-2,5],[-7,6],[-8,2],[-31,6],[-7,4],[-6,6],[-8,13],[-6,6],[-6,4],[-25,8],[-6,2],[-4,3],[-4,3],[-24,33],[-11,10],[-4,2],[-6,2],[-6,2],[-23,4],[-7,2],[-4,4],[0,6],[6,12],[6,7],[13,11],[3,3],[2,5],[1,6],[-9,20],[-3,4],[-8,16],[-6,36],[-4,8],[-5,8],[0,4],[2,5],[7,6],[14,6],[11,4],[23,14],[4,3],[11,10],[5,2],[5,3],[19,5],[5,3],[5,3],[6,6],[4,3],[5,3],[5,3],[24,8],[6,2],[4,3],[4,5],[9,38],[-19,88],[-1,24],[2,4],[3,4],[4,3],[15,8],[0,5],[-6,9],[-39,31],[-10,6],[-23,4]],[[3230,5353],[12,8],[5,5],[5,5],[6,7],[8,6],[20,10],[11,4],[14,1],[20,-3],[16,-3],[15,-4],[10,-5],[9,-3],[10,0],[11,2],[12,3],[18,-2],[54,-9],[12,-1],[52,20],[8,7],[3,7],[-5,24],[1,7],[5,9],[9,8],[35,20],[9,7],[7,7],[6,7],[3,14],[19,36],[10,13],[8,6],[39,20],[6,6],[4,14],[2,7],[22,27],[3,6],[0,7],[-3,14],[1,6],[4,8],[7,8],[8,7],[12,7]],[[7005,9041],[14,-15],[10,-16],[1,-8],[17,-5],[-8,-12],[-15,-14],[-8,-9],[10,-6],[20,-7],[16,-8],[1,-9],[-9,-5],[-13,-4],[-16,-1],[-14,-1],[-6,2],[-5,4],[-2,3],[0,2],[-9,-1],[-19,-4],[-50,4],[-17,4],[-19,7],[-9,0],[0,-10],[-6,0],[-4,2],[-3,1],[-5,1],[-13,9],[-9,16],[-7,31],[6,14],[7,13],[-1,9],[-20,4],[14,10],[20,-3],[21,-6],[19,4],[9,-4],[13,-3],[14,-1],[11,3],[1,6],[-6,5],[-9,6],[-4,6],[1,15],[6,8],[16,4],[28,0],[24,-3],[11,-9],[-2,-13],[-14,-12],[12,-4]],[[8806,9464],[-126,-68],[-120,-64],[-86,-64],[103,-9],[17,-55],[-68,-65],[-18,-128],[-86,-46],[86,-147],[-69,-146],[-34,-55],[-17,-65],[-138,-18],[-69,-119],[-114,-65]],[[8067,8350],[-7,1],[-73,21],[-8,2],[-9,1],[-25,2],[-9,1],[-8,3],[-15,5],[-10,2],[-9,0],[-20,-4],[-17,-2],[-6,-2],[-6,-1],[-5,-3],[-36,-27],[-6,-2],[-6,-2],[-28,-6],[-35,-12],[-10,-5],[-3,-3],[-5,-3],[-6,-2],[-9,-1],[-5,2],[-4,4],[-2,9],[-4,4],[-30,23],[-9,3],[-9,1],[-6,-1],[-11,-5],[-7,-1],[-8,-1],[-17,0],[-8,0],[-21,-5],[-7,-1],[-8,0],[-8,0],[-7,1],[-8,3],[-85,34],[-7,2],[-44,8],[-16,4],[-8,3],[-52,31],[-15,6],[-12,2],[-7,-1],[-7,-2],[-5,-2],[-16,-7],[-12,-4],[-39,-10],[-22,-3],[-34,-3],[-21,-4],[-8,-1],[-13,1],[-17,2],[-32,9],[-17,6],[-24,11],[-7,3],[-53,15],[-9,3],[-34,24],[-18,10],[-8,2],[-6,-1],[-5,-3],[-8,-5],[-8,-2],[-9,-1],[-16,1],[-8,3],[-5,3],[-2,4],[-2,5],[0,9],[7,17],[3,3],[4,3],[33,13],[17,12],[3,3],[22,14],[8,6],[3,3],[3,5],[0,4],[-3,6],[-6,2],[-8,0],[-6,-1],[-13,-4],[-46,-17],[-53,-12],[-12,-4],[-27,-12],[-6,-2],[-53,-12],[-5,-3],[-4,-2],[-1,-4],[1,-4],[5,-7],[1,-4],[1,-4],[-2,-4],[-2,-2],[-2,-1],[-5,-3],[-6,-2],[-6,-1],[-31,-5],[-4,-2],[0,-4],[15,-11],[1,-4],[-3,-3],[-11,-5],[-4,-1],[-10,-5],[-1,0]],[[6603,8447],[-43,7],[-30,11],[-51,25],[105,29],[0,9],[-66,22],[-56,12],[-15,6],[-36,35],[-21,48],[11,41],[60,14],[-15,11],[-17,5],[-13,6],[-2,19],[4,15],[11,22],[19,15],[27,-5],[21,-1],[11,18],[6,33],[12,6],[15,4],[14,0],[11,-7],[-6,-5],[-14,-6],[-9,-8],[10,-11],[8,2],[13,1],[8,2],[-8,-9],[3,-8],[11,-4],[17,3],[5,6],[0,7],[6,6],[21,4],[-25,14],[-2,6],[51,0],[21,-9],[10,-18],[5,-21],[7,-12],[38,9],[21,-7],[10,-15],[7,-17],[23,-34],[4,-12],[0,-5],[1,-5],[4,-4],[22,-4],[-3,-5],[-15,-9],[16,-15],[35,-14],[41,-10],[31,-4],[39,5],[39,13],[19,18],[-23,19],[10,12],[0,38],[8,12],[25,24],[5,10],[-30,25],[-6,13],[27,7],[16,-5],[40,-30],[7,13],[12,13],[14,11],[14,8],[17,3],[26,2],[25,1],[17,-1],[0,3],[0,8],[0,4],[32,-15],[16,-5],[13,2],[-3,7],[-24,25],[-11,21],[-24,16],[-9,8],[-4,10],[-1,10],[5,21],[21,-3],[13,-7],[9,-8],[14,-8],[1,-11],[25,-9],[72,-15],[13,-2],[14,1],[16,4],[17,2],[18,-1],[16,-3],[15,0],[50,7],[50,15],[45,20],[34,23],[-24,15],[20,20],[51,33],[-5,9],[-20,17],[-4,11],[1,24],[3,13],[31,57],[18,21],[38,26],[11,12],[8,11],[3,10],[7,8],[16,11],[19,9],[15,4],[-6,18],[21,48],[3,19],[-8,10],[-27,17],[-12,9],[-8,10],[-6,8],[-7,33],[-5,8],[-21,16],[-8,3],[-8,-1],[-6,0],[-6,8],[0,7],[7,4],[7,4],[5,5],[-1,6],[-8,9],[0,5],[15,18],[3,2],[-10,9],[-16,1],[-19,-4],[-20,-6],[-1,22],[-12,12],[-44,21],[-22,30],[-11,10],[-4,-14],[-56,14],[16,7],[25,20],[15,1],[17,-4],[14,-2],[34,-1],[47,-5],[29,-13],[42,-42],[15,-5],[21,4],[21,7],[13,8],[6,11],[4,39],[3,5],[15,15],[0,4],[-2,10],[2,6],[13,10],[17,7],[20,2],[17,-4],[9,13],[14,6],[17,6],[16,11],[20,-13],[18,10],[18,18],[19,10],[23,-10],[20,4],[16,12],[8,14],[-2,5],[-5,6],[-4,6],[1,8],[8,8],[10,4],[11,4],[10,4],[13,1],[3,4],[-8,10],[-12,7],[-9,1],[-10,0],[-16,2],[-7,3],[-4,5],[-6,4],[-11,4],[-15,1],[-51,-1],[19,13],[55,9],[20,13],[21,-8],[45,-33],[9,6],[10,-6],[2,14],[-11,16],[-20,12],[-28,4],[6,7],[8,5],[9,4],[6,3],[14,4],[4,2],[-1,2],[-5,4],[-3,6],[5,5],[41,24],[24,7],[25,-3],[14,-5],[38,-23],[9,-10],[0,-21],[9,-9],[27,-19],[4,-18],[-4,-19],[6,-21],[24,-27],[3,-11],[-8,-1],[-52,31],[-13,1],[-10,-6],[-9,-9],[-10,-4],[-19,2],[-15,8],[-11,10],[-3,10],[-15,-4],[-10,-5],[-8,-8],[-4,-8],[17,-4],[-4,-9],[-23,-22],[21,0],[28,-2],[25,-4],[11,-7],[-4,-4],[-20,-9],[-4,-4],[3,-7],[4,-6],[7,-3],[10,6],[14,13],[11,3],[12,-5],[14,-11],[-2,-4],[-6,-5],[-1,-4],[14,-2],[27,-1],[14,1],[11,4],[7,13],[-19,20],[6,10],[25,8],[16,-6],[40,-32],[4,-9],[0,-8],[5,-10],[13,-12],[14,-8],[10,-10],[1,-16],[9,10],[12,6],[15,3],[20,1],[20,-2],[9,-4],[6,-5],[23,-12],[8,-9],[1,-9],[-10,-3],[-19,2],[-17,4],[-15,1],[-15,-7],[34,-15],[17,-11],[16,-1],[27,17],[38,-45],[9,-16],[3,-19],[-4,-10],[-13,2],[-11,8],[-4,9],[0,20],[-8,-20],[20,-41],[-7,-17],[-11,-7],[-6,-8],[-1,-8],[4,-9],[13,-12],[10,1],[10,5],[15,1],[21,-7],[27,-13]],[[5807,3379],[-51,-138],[-69,-83],[34,-55],[52,-64],[-86,-211],[-52,-110],[-51,-55],[51,-55],[-206,-55],[-155,-46]],[[5171,2434],[-172,36],[-138,0],[-172,0],[-138,10],[-103,64],[-34,91],[-52,65],[-241,64],[-258,37],[-206,9],[-172,-9],[-121,9],[-216,69]],[[5842,4718],[-52,-74],[-138,-45],[-189,0],[-189,18],[-52,37],[-154,9],[-173,-19],[-172,-55],[-120,-64],[-103,-9],[-138,18],[-327,-27]],[[3230,5353],[-28,-2],[-7,-4],[-8,-4],[-12,-6],[-13,-3],[-13,1],[-9,4],[-6,7],[-5,6],[-7,6],[-12,5],[-27,6],[-14,0],[-10,-1],[-7,-5],[-10,-5],[-28,-9],[-20,-4],[-17,1],[-123,27],[-14,5],[-21,9],[-15,5],[-19,6],[-34,7],[-20,2],[-18,0],[-53,-13],[-26,-8],[-19,-3],[-13,2],[-10,5],[-10,7],[-15,5],[-43,11],[-32,12],[-12,-2],[-10,-4],[-10,-5],[-18,-7],[-7,-3],[-16,-10],[-21,-10],[-8,-6],[-8,-6],[-13,-6],[-17,-6],[-35,-5],[-36,-10],[-54,-23],[-9,-6],[-23,-19],[-6,-6],[-1,-7],[5,-6],[8,-7],[49,-35],[5,-7],[8,-13],[5,-6],[32,-25],[6,-6],[6,-8],[29,-69],[10,-13],[1,-15],[3,-7],[7,-7],[18,-11],[6,-6],[2,-7],[-4,-9],[1,-8],[19,-19],[29,-13],[6,-4],[5,-4],[5,-7],[10,-24],[-1,-10],[-5,-11],[-16,-16],[-7,-11],[-1,-9],[4,-7],[5,-5],[6,-3],[9,-2],[11,-2],[7,-6],[5,-6],[3,-9],[10,-13],[14,-35],[5,-7],[7,-7],[5,-8],[1,-9],[-6,-11],[-9,-9],[-15,-11],[-4,-9],[2,-7],[4,-7],[9,-9],[9,-4],[10,-5],[59,-22],[10,-5],[7,-6],[0,-8],[-9,-5],[-14,-3],[-28,0],[-32,-3],[-20,-6],[-16,-1],[-13,2],[-12,3],[-36,5],[-26,5],[-15,1],[-16,-2],[-16,-3],[-20,-6],[-12,-9],[-11,-11],[-16,-9],[-16,-4],[-47,-7],[-16,0],[-16,1],[-31,5],[-14,3],[-25,8],[-40,9],[-15,0],[-26,-3],[-12,0],[-24,7],[-23,-1],[-18,0],[-30,4],[-38,-3],[-18,1],[-32,4],[-14,3],[-9,6],[-57,41],[-18,11],[-10,3],[-8,3],[-10,2],[-13,1],[-13,1],[-16,0],[-16,-1],[-29,-5],[-13,-2],[-13,0],[-29,4],[-47,3],[-58,11],[-30,3],[-1,0]],[[1440,4725],[-27,18],[-24,24],[-9,25],[9,43],[19,22],[0,45],[-2,2],[-5,6],[-2,2],[3,5],[11,6],[4,4],[8,18],[1,8],[-5,22],[-33,52],[-66,90],[-98,69],[-89,66],[-10,22],[0,145],[-54,142],[-2,49],[40,90],[7,33],[-7,11],[-33,16],[-19,33],[-87,63],[-8,17],[1,23],[12,45],[14,22],[70,58],[25,31],[8,2],[17,-4],[8,5],[13,21],[104,84],[23,12],[10,10],[4,11],[5,34],[38,0],[33,28],[47,63],[10,7],[37,20],[7,6],[12,17],[10,7],[22,13],[16,14],[27,31],[36,27],[48,27],[40,29],[12,33],[-7,14],[-25,31],[-6,15],[7,18],[16,8],[14,-4],[1,-18],[22,20],[11,20],[-1,20],[-13,21],[-52,40],[-21,22],[-3,23],[6,10],[11,10],[13,10],[13,8],[9,7],[3,10],[4,41],[5,10],[11,7],[23,3],[46,0],[47,4],[299,-15],[37,5],[17,-1],[33,-14],[25,-7],[24,-3],[20,3],[13,9]],[[3549,4501],[3,-40],[0,-5],[-3,-4],[-4,-4],[-4,-6],[-2,-10],[1,-6],[3,-4],[5,-3],[5,-4],[6,-7],[13,-26],[30,-36],[3,-8],[2,-11],[3,-8],[8,-16],[2,-5],[-5,-28],[-2,-4],[-3,-4],[-8,-6],[-10,-5],[-11,-5],[-9,-5],[-6,-7],[-3,-4],[-3,-13],[-3,-4],[-7,-7],[-33,-20]],[[439,3141],[37,10],[18,13],[6,2],[76,-1],[52,8],[25,-4],[25,-5],[25,-3],[34,7],[40,15],[33,20],[14,18],[7,22],[49,69],[52,141],[87,85],[28,14],[45,5],[25,11],[74,70],[17,30],[13,34],[19,33],[36,23],[0,-6],[2,-5],[7,-9],[33,40],[19,13],[61,24],[19,9],[-5,24],[14,26],[100,101],[30,23],[82,41],[32,20],[26,23],[22,28],[7,22],[0,31],[-10,25],[-25,2],[-12,20],[-7,5],[-10,3],[-19,1],[-9,1],[-19,8],[-18,12],[-14,13],[-6,12],[6,10],[26,25],[11,8],[11,10],[4,12],[-1,26],[-3,7],[-5,7],[-4,7],[2,8],[7,3],[24,8],[8,5],[7,13],[3,12],[11,7],[30,3],[18,13],[-5,28],[-28,49],[-20,23],[-26,22],[-66,32],[-10,9],[-10,24],[-26,23],[-100,66]],[[8738,7804],[-14,25],[-9,10],[-67,46],[-13,4],[-12,3],[-14,5],[-14,7],[-7,5],[-5,4],[-26,36],[-2,4],[1,3],[4,8],[1,4],[-1,4],[-2,3],[-50,59],[-8,7],[-13,7],[-25,19],[-24,10],[-4,5],[0,4],[3,3],[7,7],[4,3],[10,4],[17,7],[5,3],[2,4],[0,7],[-3,4],[-4,4],[-21,10],[-5,2],[-20,5],[-6,2],[-15,7],[-6,2],[-14,3],[-15,3],[-6,1],[-29,13],[-25,18],[-17,17],[-6,4],[-5,2],[-40,15],[-48,26],[-38,14],[-6,5],[-7,8],[-8,5],[-11,5],[-6,3],[-4,4],[-17,29],[-11,12],[-8,3],[-8,1],[-6,-1]],[[8806,9464],[25,-15],[10,-13],[4,-9],[13,-16],[3,-8],[-4,-9],[-17,-16],[-7,-10],[12,4],[12,1],[12,-1],[11,-4],[8,9],[9,6],[8,6],[7,21],[10,6],[15,1],[19,-4],[-7,-7],[-4,-3],[19,-2],[18,-5],[17,-6],[34,-17],[6,-5],[-6,-18],[2,-7],[18,-19],[12,-8],[18,-3],[19,1],[19,-1],[13,-6],[1,-15],[-10,-3],[-15,-3],[-6,-5],[20,-13],[19,-5],[18,-4],[15,-6],[5,-15],[8,-10],[31,-20],[8,-7],[2,-40],[-12,-59],[1,-11],[7,-15],[2,-11],[5,-10],[37,-28],[4,-13],[-5,-31],[6,-11],[19,-6],[17,3],[15,4],[14,-1],[12,-11],[-1,-12],[-11,-25],[3,-20],[20,-42],[15,-20],[6,-4],[17,-7],[6,-4],[1,-6],[-2,-13],[1,-6],[5,-15],[4,-5],[3,-3],[5,-2],[5,-1],[6,0],[8,-1],[2,-3],[-1,-4],[5,-4],[3,-8],[-11,-25],[8,-12],[10,-8],[32,-35],[12,-24],[15,-146],[27,-54],[4,-22],[-1,-26],[-13,-20],[-4,-13],[-2,-26],[4,-15],[9,-9],[34,-16],[23,-22],[1,-21],[-17,-56],[-13,-23],[-3,-11],[2,-13],[17,-35],[10,-81],[38,-40],[4,-27],[-12,-23],[-31,-9],[13,-9],[36,-10],[17,-7],[10,-9],[9,-13],[17,-47],[98,-112],[25,-20],[67,-43],[13,-11],[12,-25],[14,-8],[18,-5],[17,-7],[19,-18],[11,-24],[8,-47],[-1,-4],[-8,-12],[-13,-11],[-1,-5],[3,-5],[2,-8],[-2,-5],[-13,-17],[-3,-8],[3,-7],[4,-6],[1,-5],[-6,-6],[-17,-9],[-5,-4],[-10,-26],[-24,-36],[-3,-14],[-9,-20],[-122,-119],[-10,-21],[13,-4],[-9,-10],[-99,-67],[-31,-41],[-16,-9],[-22,-3],[-22,2],[-21,-1],[-20,-8],[-28,36],[-23,12],[-3,-1]],[[5390,7434],[44,-8],[50,10],[22,8],[4,13],[-5,4],[-9,1],[-11,0],[-12,2],[-12,4],[-5,3],[-23,22],[-19,47],[0,4],[-4,3],[-17,0],[-13,-1],[-39,-9],[-4,9],[2,8],[13,18],[-19,-1],[-15,0],[-10,3],[-9,15],[-23,7],[-9,7],[-3,16],[12,16],[37,27],[46,21],[59,20],[52,24],[29,43],[20,13],[69,34],[29,9],[31,5],[32,2],[18,8],[4,17],[-9,15],[-22,3],[-16,-7],[-8,-12],[-15,-4],[-21,-1],[-13,4],[-21,17],[8,0],[42,34],[171,94],[19,8],[9,-3],[5,-8],[9,-9],[28,-17],[2,-8],[-6,-44],[5,-12],[6,-2],[9,-2],[9,-3],[4,-8],[-3,-2],[-16,-18],[-78,-48],[-21,-17],[-14,-22],[-14,-89],[4,-9],[20,-6],[16,2],[45,13],[14,5],[24,20],[13,21],[18,19],[39,16],[16,-6],[4,7],[-1,19],[8,12],[98,97],[7,21],[6,9],[45,24],[4,6],[0,14],[5,5],[10,4],[24,6],[8,3],[31,19],[12,10],[5,10],[10,12],[20,6],[20,7],[6,15],[58,-42],[27,-12],[18,-4],[43,-6],[15,-6],[7,-8],[-2,-17],[3,-10],[20,12],[2,16],[-11,15],[-19,8],[38,16],[36,-2],[28,-16],[10,-23],[-2,-50],[8,-14],[23,18],[7,22],[0,30],[-13,27],[-27,11],[-19,4],[-17,7],[-30,17],[-26,7],[-21,-1],[-43,-14],[-18,-3],[-17,-2],[-19,2],[-21,9],[-11,10],[-9,11],[-9,4],[-39,-28],[-17,-9],[-14,-4],[-8,6],[-29,27],[-6,8],[3,3],[13,7],[3,5],[-2,7],[-6,4],[-6,4],[-23,25],[0,4],[6,3],[3,2],[-16,6],[-3,2],[3,32],[8,25],[18,23],[28,18],[32,11],[11,6],[4,11],[1,22],[6,8],[12,8],[33,5],[64,-24],[44,1],[19,3],[27,-2],[11,2],[12,8],[9,12],[5,12],[2,11],[-5,16],[-14,20],[-21,18],[-26,8],[18,10],[29,-4],[57,-21],[11,-3],[11,-3],[12,-3],[8,-6],[2,-9],[-9,-7],[-11,-7],[-6,-9],[-4,-19],[-20,-38],[-5,-19],[0,-7],[2,-11],[9,-9],[18,0],[9,6],[1,8],[-2,9],[2,6],[10,5],[18,6],[14,6],[0,6],[-11,7],[-10,8],[-9,9],[-2,9],[10,16],[37,26],[8,16],[0,17],[-3,17],[-13,13],[-11,2]],[[7407,3792],[-74,-115],[-138,-260],[-14,-12],[-18,-11],[-12,-11],[6,-11],[18,9],[10,-2],[3,-10],[-2,-12],[-9,-11],[-24,-21],[-5,-13],[-5,-25],[-13,-25],[-50,-59],[-5,-10],[-2,-22],[-23,-63],[-20,-26],[-19,-18],[-173,-280],[-175,-202],[-175,-202],[-19,-48],[-45,-49],[-25,-84]]],"transform":{"scale":[0.0007281734032403245,0.0013656313548354895],"translate":[43.22291100400008,-25.598565362999892]}};
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
