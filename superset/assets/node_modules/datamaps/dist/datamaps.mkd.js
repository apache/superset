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
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = {"type":"Topology","objects":{"mkd":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Resen"},"id":"MK.RE","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Vevčani"},"id":"MK.VV","arcs":[[4,5]]},{"type":"Polygon","properties":{"name":"Bitola"},"id":"MK.TL","arcs":[[6,7,8,-1,9,10]]},{"type":"Polygon","properties":{"name":"Demir Hisar"},"id":"MK.DM","arcs":[[11,-10,-4,12,13,14]]},{"type":"Polygon","properties":{"name":"Ohrid"},"id":"MK.OD","arcs":[[-13,-3,15,16]]},{"type":"Polygon","properties":{"name":"Debarca"},"id":"MK.","arcs":[[-14,-17,17,18,19]]},{"type":"Polygon","properties":{"name":"Skopje"},"id":"MK.PE","arcs":[[20,21,22,23,24,25,26]]},{"type":"Polygon","properties":{"name":"Plasnica"},"id":"MK.PN","arcs":[[27,28,29,30]]},{"type":"Polygon","properties":{"name":"Prilep"},"id":"MK.PP","arcs":[[31,32,33,34,35,36,37]]},{"type":"Polygon","properties":{"name":"Probistip"},"id":"MK.PT","arcs":[[38,39,40,41,42,43]]},{"type":"Polygon","properties":{"name":"Radovis"},"id":"MK.RV","arcs":[[44,45,46,47,48,49]]},{"type":"Polygon","properties":{"name":"Kriva Palanka"},"id":"MK.KZ","arcs":[[50,51,52,53,54]]},{"type":"Polygon","properties":{"name":"Vardar"},"id":"MK.RM","arcs":[[55,56,57,58]]},{"type":"Polygon","properties":{"name":"Saraj"},"id":"MK.AJ","arcs":[[59,60,61,62,63,64]]},{"type":"Polygon","properties":{"name":"Sopiste"},"id":"MK.SS","arcs":[[65,66,67,68,-62,69]]},{"type":"Polygon","properties":{"name":"Northeastern"},"id":"MK.NA","arcs":[[70,71,72,73]]},{"type":"Polygon","properties":{"name":"Štip"},"id":"MK.ST","arcs":[[74,-48,75,76,77,78,79,-42]]},{"type":"Polygon","properties":{"name":"Studenicani"},"id":"MK.SU","arcs":[[-24,80,81,82,-67,83,84,85]]},{"type":"Polygon","properties":{"name":"Cair"},"id":"MK.CI","arcs":[[86,87,88,89,90]]},{"type":"Polygon","properties":{"name":"Sveti Nikole"},"id":"MK.SL","arcs":[[-43,-80,91,92,-21,93,94]]},{"type":"Polygon","properties":{"name":"Veles"},"id":"MK.VE","arcs":[[95,96,97,98,-22,-93]]},{"type":"Polygon","properties":{"name":"Vraneštica"},"id":"MK.VC","arcs":[[-30,99,100,101,102]]},{"type":"Polygon","properties":{"name":"Zelenikovo"},"id":"MK.ZK","arcs":[[-99,103,-81,-23]]},{"type":"Polygon","properties":{"name":"Želino"},"id":"MK.ZE","arcs":[[-63,-69,104,105,106,107]]},{"type":"Polygon","properties":{"name":"Aracinovo"},"id":"MK.AR","arcs":[[108,109,110,111]]},{"type":"Polygon","properties":{"name":"Lipkovo"},"id":"MK.LI","arcs":[[112,-112,113,114,115,116]]},{"type":"Polygon","properties":{"name":"Butel"},"id":"MK.BU","arcs":[[-115,117,-91,118,119,120,121]]},{"type":"Polygon","properties":{"name":"Caška"},"id":"MK.CA","arcs":[[-98,122,-58,123,-38,124,125,-82,-104]]},{"type":"Polygon","properties":{"name":"Centar"},"id":"MK.CE","arcs":[[126,127,128,-89]]},{"type":"Polygon","properties":{"name":"Zrnovci"},"id":"MK.ZR","arcs":[[129,130,131,132]]},{"type":"Polygon","properties":{"name":"Cešinovo-Obleševo"},"id":"MK.CH","arcs":[[133,-131,134,-40]]},{"type":"Polygon","properties":{"name":"Cucer Sandevo"},"id":"MK.CS","arcs":[[-116,-122,135,-120,136,137,138]]},{"type":"Polygon","properties":{"name":"Demir Kapija"},"id":"MK.DK","arcs":[[139,140,141,142,143]]},{"type":"Polygon","properties":{"name":"Dolneni"},"id":"MK.DE","arcs":[[-37,144,145,146,-125]]},{"type":"Polygon","properties":{"name":"Gazi Baba"},"id":"MK.GB","arcs":[[-111,147,-25,-86,148,-87,-118,-114]]},{"type":"Polygon","properties":{"name":"Gradsko"},"id":"MK.GR","arcs":[[-78,149,-59,-123,-97,150]]},{"type":"Polygon","properties":{"name":"Lozovo"},"id":"MK.LO","arcs":[[-79,-151,-96,-92]]},{"type":"Polygon","properties":{"name":"Konce"},"id":"MK.KN","arcs":[[151,152,153,-144,154,-76,-47]]},{"type":"Polygon","properties":{"name":"Ilinden"},"id":"MK.IL","arcs":[[-26,-148,-110,155]]},{"type":"Polygon","properties":{"name":"Karbinci"},"id":"MK.KB","arcs":[[-135,-130,156,-49,-75,-41]]},{"type":"Polygon","properties":{"name":"Karpoš"},"id":"MK.KX","arcs":[[-119,-90,-129,157,-70,-61,158,-137]]},{"type":"Polygon","properties":{"name":"Kavadartsi"},"id":"MK.AV","arcs":[[-142,159,160,-32,-124,-57,161]]},{"type":"Polygon","properties":{"name":"Aerodrom"},"id":"MK.AD","arcs":[[-149,-85,162,-127,-88]]},{"type":"Polygon","properties":{"name":"Kisela Voda"},"id":"MK.VD","arcs":[[-84,-66,-158,-128,-163]]},{"type":"Polygon","properties":{"name":"Kocani"},"id":"MK.OC","arcs":[[163,164,-132,-134,-39,165,-52]]},{"type":"Polygon","properties":{"name":"Kratovo"},"id":"MK.KY","arcs":[[166,-53,-166,-44,-95,167,-72]]},{"type":"Polygon","properties":{"name":"Krivogaštani"},"id":"MK.KG","arcs":[[-36,168,169,-145]]},{"type":"Polygon","properties":{"name":"Kruševo"},"id":"MK.KS","arcs":[[-146,-170,170,-11,-12,171,-28,172]]},{"type":"Polygon","properties":{"name":"Kumanovo"},"id":"MK.UM","arcs":[[-168,-94,-27,-156,-109,-113,173,-73]]},{"type":"Polygon","properties":{"name":"Brod"},"id":"MK.MD","arcs":[[-105,-68,-83,-126,-147,-173,-31,-103,174,175,176]]},{"type":"Polygon","properties":{"name":"Pelagonia"},"id":"MK.MG","arcs":[[-35,177,-7,-171,-169]]},{"type":"Polygon","properties":{"name":"Negotino"},"id":"MK.NG","arcs":[[-155,-143,-162,-56,-150,-77]]},{"type":"Polygon","properties":{"name":"Novatsi"},"id":"MK.NV","arcs":[[178,-8,-178,-34]]},{"type":"Polygon","properties":{"name":"Gjorce Petrov"},"id":"MK.GP","arcs":[[-159,-60,179,-138]]},{"type":"Polygon","properties":{"name":"Zajas"},"id":"MK.ZA","arcs":[[180,181,182,183,184]]},{"type":"Polygon","properties":{"name":"Centar župa"},"id":"MK.CZ","arcs":[[185,186,187]]},{"type":"Polygon","properties":{"name":"Debar"},"id":"MK.DB","arcs":[[188,189,-188,190,191]]},{"type":"Polygon","properties":{"name":"Drugovo"},"id":"MK.DR","arcs":[[192,-100,-29,-172,-15,-20,193,-189,194,-183]]},{"type":"Polygon","properties":{"name":"Kicevo"},"id":"MK.KH","arcs":[[195,-101,-193,-182]]},{"type":"Polygon","properties":{"name":"Mavrovo and Rostusa"},"id":"MK.MR","arcs":[[-184,-195,-192,196,197]]},{"type":"Polygon","properties":{"name":"Oslomej"},"id":"MK.OS","arcs":[[-175,-102,-196,-181,198]]},{"type":"Polygon","properties":{"name":"Tearce"},"id":"MK.TR","arcs":[[199,200,201]]},{"type":"Polygon","properties":{"name":"Tetovo"},"id":"MK.ET","arcs":[[202,-107,203,204,205,-200]]},{"type":"Polygon","properties":{"name":"Polog"},"id":"MK.VH","arcs":[[206,207,208,209]]},{"type":"Polygon","properties":{"name":"Bogovinje"},"id":"MK.VJ","arcs":[[210,-210,211,-205]]},{"type":"Polygon","properties":{"name":"Brvenica"},"id":"MK.BN","arcs":[[-106,-177,212,-207,-211,-204]]},{"type":"Polygon","properties":{"name":"Gostivar"},"id":"MK.GT","arcs":[[-208,-213,-176,-199,-185,-198,213]]},{"type":"Polygon","properties":{"name":"Jegunovce"},"id":"MK.JG","arcs":[[-64,-108,-203,-202,214]]},{"type":"Polygon","properties":{"name":"Southeastern"},"id":"MK.RU","arcs":[[215,216,217,218,-153,219]]},{"type":"Polygon","properties":{"name":"Valandovo"},"id":"MK.VA","arcs":[[-219,220,221,222,223,-140,-154]]},{"type":"Polygon","properties":{"name":"Vasilevo"},"id":"MK.VL","arcs":[[224,-220,-152,-46,225]]},{"type":"Polygon","properties":{"name":"Bogdanci"},"id":"MK.BG","arcs":[[226,227,228,-223]]},{"type":"Polygon","properties":{"name":"Bosilovo"},"id":"MK.BS","arcs":[[229,-216,-225,230]]},{"type":"Polygon","properties":{"name":"Southeastern"},"id":"MK.GV","arcs":[[-229,231,-160,-141,-224]]},{"type":"Polygon","properties":{"name":"Novo Selo"},"id":"MK.NS","arcs":[[-217,-230,232,233]]},{"type":"Polygon","properties":{"name":"Dojran"},"id":"MK.SD","arcs":[[234,-227,-222]]},{"type":"Polygon","properties":{"name":"Vinitsa"},"id":"MK.NI","arcs":[[235,236,-50,-157,-133,-165,237]]},{"type":"Polygon","properties":{"name":"Berovo"},"id":"MK.BR","arcs":[[238,239,-233,-231,-226,-45,-237,240]]},{"type":"Polygon","properties":{"name":"Delcevo"},"id":"MK.DL","arcs":[[241,-241,-236,242,243]]},{"type":"Polygon","properties":{"name":"Makedonska Kamenica"},"id":"MK.MK","arcs":[[-243,-238,-164,-51,244]]},{"type":"Polygon","properties":{"name":"Phecevo"},"id":"MK.PH","arcs":[[-239,-242,245]]},{"type":"Polygon","properties":{"name":"Struga"},"id":"MK.UG","arcs":[[-194,-19,246,-6,247,-186,-190]]},{"type":"Polygon","properties":{"name":"Rankovce"},"id":"MK.RN","arcs":[[-167,-71,248,-54]]},{"type":"Polygon","properties":{"name":"Šuto Orizari"},"id":"MK.SO","arcs":[[-121,-136]]}]}},"arcs":[[[2545,1817],[-2,0],[0,-35],[36,-50],[8,-60],[-8,-75],[-39,-85],[-38,-45],[-33,-30],[-15,-65],[0,-75],[27,-40],[68,-15],[17,-18],[0,-59],[10,-56],[19,-48],[33,-44],[26,-40],[9,-40],[0,-52],[29,-32],[42,0],[66,4],[55,0],[52,-36],[43,-76],[16,-44],[0,-52],[40,-16],[41,0],[54,-3],[21,-21],[17,-83],[-5,-84],[41,-32],[9,-32],[-5,-44],[-14,-40],[-9,-72],[-15,-76],[-4,-9],[-12,-45],[0,-1]],[[3125,91],[-144,38],[-101,8],[-277,-107],[-572,-30],[-2,175],[-31,123],[-66,81],[-193,74],[-206,38],[-4,-1]],[[1529,490],[0,1],[-6,42],[-6,40],[0,60],[0,76],[15,88],[18,76],[45,44],[59,8],[41,4],[31,44],[7,72],[0,59],[-22,64],[-21,33],[-2,59],[0,36],[19,24],[33,20],[5,52],[0,68],[2,88],[19,140],[28,103],[38,61],[40,67],[45,56],[90,68],[67,52],[80,56],[83,80],[47,68],[36,84]],[[2320,2383],[5,12],[11,-56],[27,-40],[35,0],[38,-4],[16,-52],[19,-136],[0,-84],[22,-104],[40,-80],[12,-22]],[[267,2372],[-49,166],[-18,97]],[[200,2635],[283,22],[117,-18],[94,-32],[17,-47],[-23,-58],[-100,-57],[-321,-73]],[[3390,2372],[6,-7],[29,-56],[0,-54],[-15,-46],[-20,-38],[0,-65],[14,-58],[21,-58],[34,-52],[38,-32],[52,-23],[23,-29],[8,-45],[2,-42],[-4,-49],[0,-61],[-2,-65],[10,-35],[19,-26],[31,-23],[30,-9],[21,0],[40,32],[29,26],[19,6],[25,0],[33,-10],[10,-11]],[[3843,1542],[-8,-28],[0,-67],[-10,-40],[-14,-28],[-2,-47],[7,-68],[12,-27],[18,-24],[28,-40],[8,-59],[2,-91],[2,-52],[47,-12],[38,-16],[16,-47],[50,-76],[51,-71],[43,-79],[11,-55],[3,-60],[14,-79],[0,-59],[-1,-9],[-20,-68],[0,-1]],[[4138,339],[-298,53],[-95,-3],[-93,-53],[-141,-180],[-61,-45],[-132,-36],[-134,0],[-59,16]],[[2545,1817],[42,25],[54,29],[35,25],[50,10],[42,5],[50,30],[42,25],[44,75],[59,45],[51,5],[29,60],[21,50],[35,5],[45,30],[71,70],[38,85],[36,35],[7,2]],[[3296,2428],[19,8],[24,-35],[27,-25],[24,-4]],[[2709,3520],[27,-19],[63,-38],[30,-31],[0,-50],[0,-43],[59,12],[59,-12],[45,0],[26,-50],[0,-75],[0,-87],[-4,-63],[0,-37],[7,-25],[30,0],[40,6],[37,25],[37,-19],[49,-75],[11,-81],[18,-81],[44,-50],[23,-50],[0,-56],[0,-81],[-11,-44],[-3,-68]],[[2320,2383],[-5,32],[-26,54]],[[2289,2469],[-12,25],[-28,80],[0,76],[-45,32],[-26,44],[-22,72],[-16,60],[-38,28],[-38,24],[-38,40],[-28,40],[-10,52],[0,68],[5,12]],[[1993,3122],[24,59],[87,84],[93,52],[109,-4],[78,0],[116,7],[62,50],[60,75],[11,50],[59,37],[17,-12]],[[1529,490],[-76,-24],[-130,-140],[-68,-35],[-98,28],[-41,44],[-52,57],[-56,151],[-75,379],[-76,429]],[[857,1379],[354,636],[68,106],[23,66],[45,22],[23,13],[0,53],[-5,79],[16,43],[31,75],[49,40],[8,53],[26,30],[39,9],[99,-4],[65,35],[42,4],[65,-4],[50,-18],[91,-44],[102,-88],[75,-17],[109,-18],[57,19]],[[857,1379],[-40,106]],[[817,1485],[327,599],[14,30],[-10,29],[3,39],[8,35],[0,27],[-21,26],[-13,22],[-8,48],[0,44],[13,49],[24,35],[36,61],[29,119],[13,145],[-5,57],[-29,62],[-23,39],[-27,44],[-23,53],[0,66],[0,88],[-16,163],[-39,105],[-44,101],[-41,101],[-34,93],[-3,3]],[[948,3768],[34,40],[125,-8],[174,4],[100,4],[119,-13],[84,-26],[130,-4],[18,0],[26,-93],[42,-110],[13,-83],[-8,-75],[29,-75],[73,-30],[31,-44],[34,-93],[21,-40]],[[5335,7183],[-14,-37],[-22,-90],[-2,-73]],[[5297,6983],[-43,-40],[-33,-32],[-58,-55],[-53,-25],[-49,3],[-22,-15],[-4,-23],[5,-55],[5,-48],[0,-64],[-5,-54],[-8,-64],[-19,-66],[-13,-69],[-13,-66],[-10,-26],[-20,-8],[-46,20],[-19,40],[-24,37],[-27,0],[-2,-23],[-17,-26],[-22,-26],[-14,-34],[-22,0],[-3,14],[8,23],[-2,49],[-10,12],[-15,-9],[-19,-23],[-29,3],[-43,9],[-39,23],[-1,16]],[[4611,6381],[0,12],[8,20],[12,18],[12,29],[3,89],[4,155],[0,89],[-19,35],[-36,-4],[-51,32],[-36,14],[-34,0],[-22,3]],[[4452,6873],[-4,1],[-40,0],[-24,7],[-8,36],[8,40],[12,17]],[[4396,6974],[3,4],[32,43],[7,15]],[[4438,7036],[10,21],[30,11],[43,36],[47,29],[25,46],[34,0],[32,-35],[34,-22],[32,4],[41,3],[28,4],[12,32],[-8,58],[-24,28],[0,25],[6,28],[13,32],[20,57],[21,60],[9,5]],[[4843,7458],[21,-32],[57,-39],[39,-10],[38,-36],[15,-53],[23,-14],[26,0],[30,16],[22,23],[45,4],[56,-2],[37,-32],[31,-55],[38,-35],[14,-10]],[[2927,3811],[-4,-3],[-56,-42],[-48,-21],[-60,-28],[-36,-21],[-29,-25],[-7,-18]],[[2687,3653],[-21,19],[-60,31],[-52,31],[-28,66],[-13,35],[-32,-5],[-33,-22],[-4,0]],[[2444,3808],[-25,0],[-47,-17],[-26,53],[0,48],[-8,57],[-18,57],[2,44],[11,27],[60,8],[70,-26]],[[2463,4059],[2,-1],[37,14],[21,0],[37,4],[36,17],[29,11],[25,17],[31,28],[48,0],[19,-17],[2,-18],[0,-42],[0,-42],[4,-25],[15,-31],[23,-32],[46,-25],[39,-7],[38,-28],[12,-52],[0,-19]],[[5176,3892],[0,-52],[23,-48],[42,-57],[20,-17],[38,0],[10,24],[10,34],[10,23],[20,14],[8,-34],[0,-81],[-14,-37],[0,-61],[-4,-67],[8,-57],[21,-36],[22,-47],[8,-57],[0,-47],[-2,-48],[-12,-33],[-10,-20],[-8,-48],[0,-37],[-6,-71],[2,-97],[10,-57],[20,-88],[18,-47],[34,-14],[40,0],[34,4],[26,3],[50,-7],[16,0],[8,-27],[-14,-20],[-8,-54],[-20,-44],[-24,-60],[-6,-61],[-2,-77],[24,-58],[20,-13],[30,-64],[1,-83],[-6,-128],[6,-94],[8,-51],[22,-20],[30,-10],[32,0],[22,0],[22,-3],[10,-34],[0,-57],[8,-74],[0,-2],[1,-3]],[[5774,1692],[-64,-61],[-31,-44],[-16,-63],[-3,-108]],[[5660,1416],[-2,1],[-84,49],[-42,12],[-43,48],[-32,43],[-14,40],[-12,8],[-12,-4],[-17,-40],[-37,-4],[-52,0],[-54,20],[-33,28],[-40,67],[-35,32],[-40,8],[-54,16],[-45,28],[-84,51],[-40,8],[-87,16],[-70,12],[-52,23],[-61,56],[-21,44],[-16,47],[-17,24],[-28,-4],[-34,-38]],[[4502,2007],[-14,22],[-46,19],[-59,13],[-54,26],[-71,71],[-29,0],[-21,-20],[-29,-26],[-44,0],[-42,4],[-74,51],[-27,62],[-25,13],[-42,3],[-43,3],[-22,29],[-15,52],[-48,48],[-45,94],[-50,39],[-37,3],[-59,16],[-19,36],[-4,42],[5,1]],[[3588,2608],[23,9],[56,3],[33,29],[28,48],[27,36],[25,35],[15,101],[4,58],[19,32],[16,45],[0,59],[-18,16],[-38,6],[-40,3],[-15,26],[-2,36],[-17,16],[-2,42],[2,19],[44,49],[17,20]],[[3765,3296],[13,15],[23,23],[19,23],[27,6],[17,39],[23,42],[31,32],[19,23],[33,0],[48,0],[55,19],[35,16],[129,7],[40,26],[46,74],[50,23],[36,16],[8,77],[23,81],[31,42],[42,26],[2,0]],[[4515,3906],[17,0],[34,-3],[29,-7],[29,-26],[21,-42],[8,-35],[36,-3],[37,12],[21,13],[28,78],[4,74],[2,55],[11,26],[12,10],[36,3],[25,0],[41,6],[19,20],[30,19],[27,0],[21,-10],[15,-32],[29,-19],[39,-20],[36,-26],[13,-38],[20,-49],[21,-20]],[[7377,7736],[-6,-27],[-15,-63],[-13,-76],[-18,-5],[-29,-22],[-29,-24],[-25,-52],[-17,-52],[-57,-57],[-48,-62],[-38,-35],[-20,-30],[1,-7]],[[7063,7224],[-18,14],[-14,-3],[-27,-25],[-29,-72],[-10,-52],[-7,-56],[-21,-47],[-35,-22],[-27,-28],[-29,-41],[-21,0],[-16,-11],[-12,-33],[5,-47],[50,-92],[87,-136]],[[6939,6573],[-17,-24],[-38,-6],[-56,0],[-46,-3],[-41,22],[-13,53],[0,31],[-11,27],[-25,9],[-46,-31],[-8,-9]],[[6638,6642],[-3,8],[-10,22],[-15,13],[-10,-5],[-13,-8],[-12,0],[-23,8],[-25,17],[-30,5],[-28,0],[-21,-8]],[[6448,6694],[0,15],[-26,37],[-11,12],[-14,25],[3,15],[19,19],[12,41],[2,45],[-2,26],[-16,15],[-35,11],[-25,30],[-43,100],[-34,90],[-40,30],[-66,63],[-53,63],[-11,49],[9,71],[20,52],[20,60],[4,2]],[[6161,7565],[13,9],[13,0],[25,-15],[37,-26],[27,-26],[18,-8],[18,4],[8,26],[9,49],[16,52],[26,45],[22,14],[33,-3],[49,0],[51,11],[36,26],[95,45],[42,22],[38,-34],[17,-48],[20,-19],[47,0],[22,8],[20,26],[20,11],[19,-4],[20,-29],[22,-45],[31,-15],[18,0],[27,48],[0,86],[0,112],[15,15],[25,0],[46,4],[64,0],[70,-8],[47,-33],[57,-64],[33,-65]],[[8484,5770],[-2,-48],[4,-68],[14,-86],[27,-31],[31,-20],[18,-27],[-2,-35],[-21,-35],[-32,-78],[-24,-39],[-2,-43],[7,-55],[15,-46]],[[8517,5159],[-11,-17],[-43,-9],[-48,0],[-26,-6],[-14,-19],[-30,-72],[-19,-41],[-11,-43],[2,-38],[22,-47],[32,-62],[28,-22],[7,-44],[2,-47],[15,-37],[5,-44],[0,-50],[-3,-62],[-22,-44],[-17,-28],[-15,-16],[-22,3],[-39,50],[-35,44],[-41,50],[-61,47],[-23,0],[-16,-12],[-21,-63],[-37,-34],[-27,-10],[-23,0],[-15,-15],[0,-25],[10,-16],[9,-28],[9,-28],[0,-35],[-12,-14]],[[8027,4325],[-25,14],[-72,25],[-50,0],[-37,13],[-20,22],[2,34],[20,13],[18,18],[9,32],[0,37],[-16,28],[-36,53],[-35,75],[-54,75],[-33,35],[-56,6],[-76,6],[-46,3],[-30,6],[-33,35],[-32,37],[-35,13],[-26,0],[-39,21]],[[7325,4926],[-13,7],[-33,28],[-19,47],[0,47],[0,69],[-7,53],[-15,25],[-24,81],[-15,50],[13,37],[37,47],[28,38],[24,6],[32,-25],[20,-22],[35,-15],[43,-19],[42,-3],[30,6],[19,47],[10,37],[30,75],[35,66],[23,47],[7,21]],[[7627,5676],[15,41],[29,38],[16,53],[8,66],[0,87],[37,41],[46,40],[25,11]],[[7803,6053],[3,2],[35,-13],[28,-28],[26,-40],[17,-19],[33,-19],[44,3],[43,0],[54,16],[22,28],[7,34],[11,28],[15,4],[13,0],[13,-16],[10,-31],[13,-35],[22,-18],[33,-19],[32,-19],[27,-31],[24,-35],[43,-43],[48,-25],[32,0],[29,-7],[4,0]],[[8040,8543],[-1,0],[-67,-44],[-36,-29],[-69,-59],[-69,-56],[-40,-75],[-43,-29],[-26,-18],[0,-14]],[[7689,8219],[-42,11],[-19,4],[-17,0],[-29,0],[-25,0],[-48,-7],[-59,-2],[-25,-2],[-10,-17],[0,-20]],[[7415,8186],[-50,44],[-63,48],[-68,23],[-40,52],[-28,11],[-25,-30],[-33,-15],[-75,-18],[-60,-4],[-57,4],[-42,0],[-20,30],[3,24]],[[6857,8355],[13,60],[4,96],[-14,114],[-29,84],[-24,251],[-11,131],[25,132],[-7,96],[-68,90],[-81,30],[-46,65],[-17,158]],[[6602,9662],[372,196],[102,133],[36,8],[17,-32],[3,-112],[11,-47],[58,-85],[62,-59],[69,-33],[77,-6],[384,-651],[148,-139],[51,-189],[48,-103]],[[5999,4622],[0,-1],[0,-67],[6,-138],[-4,-118],[0,-1]],[[6001,4297],[-13,-16],[-12,-54],[4,-88],[-10,-107],[-40,-34],[-27,-20],[-16,-27],[-2,-51],[-20,-10],[-22,10],[-32,34],[-32,20],[-26,14],[-34,0],[-18,-24],[-8,-84],[-28,-27],[-60,-4],[-60,0],[-26,-10],[-30,0],[-70,10],[-34,48],[-40,70],[-22,45]],[[5323,3992],[0,26],[6,84],[6,41],[12,54]],[[5347,4197],[2,10],[22,27],[22,20],[42,7],[22,0],[18,20],[12,24],[0,33],[-8,61],[-6,17],[0,30],[0,30],[12,14],[28,3],[32,-13],[20,-24],[58,-37],[60,0],[22,34],[14,50],[24,38],[24,23],[46,-13],[24,-27],[28,0],[28,0],[2,27],[8,67],[33,27],[33,0],[30,-23]],[[3124,8197],[-17,-85],[9,-122],[27,-85],[36,-26],[42,10],[23,36],[31,5],[32,-46],[12,-85],[45,-106],[42,-121],[60,-96],[98,-11]],[[3564,7465],[-2,-97],[0,-122],[7,-21]],[[3569,7225],[-14,-29],[-41,-6],[-47,0],[-66,-47],[-76,-75],[-44,-53],[-47,-69],[-50,-48],[-95,-42],[-56,-32],[-19,-48],[-1,-16]],[[3013,6760],[-18,13],[-20,13],[-50,76],[-26,4],[-30,43],[0,64],[10,110],[13,94],[15,80],[2,85],[-12,26],[-53,38],[-50,47],[-48,25],[-41,13],[1,7]],[[2706,7498],[2,27],[10,13],[20,12],[53,13],[45,26],[28,12],[0,51],[-33,77],[-9,51],[3,37],[25,37],[38,21],[16,27],[0,58],[-16,59],[-22,-6],[-25,-21],[-28,0],[-32,48],[-31,37],[15,26],[44,27],[57,5],[47,11],[47,0],[48,11],[45,68],[7,21],[0,1]],[[3060,8247],[33,-43],[31,-7]],[[3837,7205],[33,0],[25,-16],[0,-33],[0,-48],[15,-34]],[[3910,7074],[-1,-78],[-15,-111],[-13,-55],[-63,-4],[-98,-9],[-60,39],[-41,12],[-53,0],[-60,-21],[-28,-38],[0,-85],[18,-59],[48,0],[52,-22],[31,-4],[20,-25],[-5,-34],[-35,0],[-41,-39],[-15,-55],[-22,-127],[-8,-73],[-15,-12],[-25,0],[-15,-22],[-5,-51],[17,-25],[35,-17],[18,-63],[-30,-67],[-15,-99],[0,-75],[20,-74],[11,-5]],[[3517,5776],[-25,-24],[-63,10],[-75,85],[-60,149],[-73,127],[-56,117],[-47,69],[-40,54]],[[3078,6363],[-4,5],[22,85],[9,106],[0,58],[-22,21],[-44,37],[-28,48],[2,37]],[[3569,7225],[7,-20],[92,0],[82,0],[72,0],[15,0]],[[6241,9553],[1,-97],[14,-46],[5,-57],[4,-68],[0,-42],[-27,-39],[-21,-3],[-55,-12],[-14,-39],[7,-44],[18,-42],[11,-27],[0,-51],[-1,-92],[3,-33],[18,-39],[30,-59],[14,-48],[0,-42],[-18,-30],[-28,-6],[-33,0],[-13,2]],[[6156,8639],[-25,4],[-44,3],[-39,0],[-19,-17],[0,-36],[3,-78],[0,-44],[-3,-69],[-37,-92],[-39,-75],[-46,-21],[-50,-3],[-3,-6]],[[5854,8205],[-16,53],[-11,59],[-18,52],[-27,16],[-33,-4],[-22,-19],[-9,-36],[-2,-30],[-17,-27],[-12,-5],[-33,3],[-67,25],[-39,18],[-18,23],[-17,22],[-26,3],[-46,-12],[-31,-13],[-27,-28],[-36,-9],[-39,-25],[-19,-36],[-31,0],[-31,16],[-24,41],[-41,57],[-35,65],[-13,53],[-3,64],[-2,43],[2,38],[5,32],[15,30],[11,29],[-2,66],[0,64],[-13,32],[-9,16],[1,52],[8,34],[20,14],[29,7],[32,16],[8,31],[-1,55],[-26,39],[-22,13],[-33,9],[-39,21],[-7,18],[-81,46],[-36,44]],[[4971,9280],[381,290],[78,23],[156,-2],[27,8],[133,144],[41,24],[49,-13],[208,-134],[128,-57],[69,-10]],[[6638,6642],[-62,-69],[-33,-85],[0,-92],[11,-113],[27,-97],[33,-64],[44,-11],[77,-3],[57,-11],[56,-44],[71,-80],[49,-72],[43,-11],[34,-6],[79,-86],[58,-75],[44,-74],[82,0],[103,27],[84,9],[57,25],[55,-3],[20,-31]],[[7325,4926],[-17,-40],[-45,-53],[-46,-69],[-47,-62],[-35,-38],[-37,-37],[-20,-25],[-4,-31],[5,-7]],[[7079,4564],[-31,-8],[-73,-3],[-69,24],[-59,54],[-40,33],[-43,24],[-30,24],[-2,95],[-11,43],[-63,27],[-51,2],[-54,6],[-32,-11],[-24,24],[-18,62],[-4,73],[-15,75],[-14,46],[-14,30],[-20,24],[-27,-5],[-19,-46],[-13,-43],[-12,-22],[-20,-11],[-19,0],[-32,46],[-29,65],[-14,24],[-38,19],[-37,3],[-35,38],[-11,10]],[[6106,5286],[-18,19],[-56,41],[-40,5],[-67,-8],[-12,12]],[[5913,5355],[-4,4],[-2,35],[0,38],[-17,19],[-31,29],[-30,36],[-11,26],[6,46],[8,38],[16,27],[22,30],[17,45],[23,17],[21,0],[21,-17],[29,-35],[13,-27],[22,-21],[14,5],[8,25],[7,32],[16,5],[12,0],[27,3],[7,16],[0,27],[-14,19],[0,22],[14,5],[12,4]],[[6119,5808],[6,-5],[35,-33],[22,-41],[26,-15],[23,0],[13,18],[-9,49],[-20,11],[-13,19],[4,22],[9,22],[20,8],[2,45],[-11,48],[-20,33],[-17,45],[2,26],[13,19],[18,8],[31,11],[22,7],[24,52],[31,53],[31,52],[29,63],[23,19],[24,19],[5,40],[-7,38],[-18,33],[-11,37],[-15,26],[-5,49],[7,26],[24,11],[20,19],[11,26],[0,26]],[[4452,6873],[-16,-37],[-50,-20],[-36,-29],[-41,-43],[-51,-35],[-10,-92],[-26,-63],[-29,-32],[-18,-34],[-2,-61],[-7,-40],[-17,-26],[-36,-3],[-22,6],[-10,17],[-2,46],[-7,26],[-29,3],[-32,-46],[-26,-72],[5,-84],[0,-54],[14,-46],[48,-78],[15,-46],[-11,-49],[-10,-38],[0,-55],[3,-3]],[[4049,5885],[-34,-16],[-76,-27],[-41,-42],[-25,-64],[-22,-53],[-22,-64],[-28,-37],[-44,-21],[-19,-38],[-13,-90],[-18,-81]],[[3707,5352],[-4,-19],[-35,41],[-44,116],[0,67],[0,157],[-34,50],[-45,0],[-28,12]],[[3910,7074],[4,-7],[10,0],[33,0],[34,25],[38,0],[36,-52],[0,-77],[0,-66],[9,-30],[48,-23],[29,17],[15,34],[8,38],[11,39],[19,27],[22,9],[25,19],[5,3]],[[4256,7030],[18,10],[26,30],[27,20]],[[4327,7090],[4,3],[19,-11],[21,-51],[25,-57]],[[3904,7545],[0,-31],[-6,-63]],[[3898,7451],[-8,6],[-15,-6]],[[3875,7451],[-12,30],[-21,0],[-10,-4]],[[3832,7477],[-1,29],[2,26],[2,51]],[[3835,7583],[0,19],[10,-7],[40,-31],[19,-19]],[[6119,5808],[-56,47],[-69,75],[-77,101],[-64,100],[-62,104],[-33,34],[-44,11],[-56,30],[-37,56],[-51,90],[-39,18],[-55,4],[-1,1]],[[5475,6479],[-34,51],[-51,82],[-51,82],[-18,78],[-24,127],[0,71],[0,13]],[[5335,7183],[5,14],[30,27],[13,36],[31,33],[20,32],[0,48],[9,45],[21,35],[55,57],[28,36],[48,12],[58,3],[53,-18],[41,-57],[25,-62],[23,-30],[42,3],[56,39],[71,33],[37,35],[9,51],[-1,7]],[[6009,7562],[20,0],[30,0],[23,0],[24,5],[30,9],[24,-6],[1,-5]],[[5475,6479],[1,-32],[-13,-28],[-21,-26],[-36,-55],[-23,-26],[-24,-31],[-12,-26],[7,-26],[13,-23],[26,-43],[19,-26],[20,-37],[0,-47],[-8,-34],[-24,-63],[-17,-46],[-6,-18],[-4,-37],[11,-23],[21,0],[24,0],[31,-14],[16,-38],[29,-75],[19,-34]],[[5524,5671],[0,-32],[0,-54],[-15,-95],[-34,-55],[-65,-83],[-26,-66],[-18,-64],[-21,-63],[-37,-75],[-43,-9],[-32,0],[-28,-2],[-12,-23],[-5,-41],[-7,-62]],[[5181,4947],[-38,5],[-89,29],[-34,49],[-7,55],[-2,69],[-1,43],[-14,26],[-19,-6],[-12,-17],[-24,-29],[-12,-11],[-20,-12],[-21,3],[-20,40],[-7,38],[2,37],[-11,55],[-32,63],[-14,110],[-24,72],[-41,26],[-42,3],[-48,11],[-33,17],[-29,21],[-22,5],[-20,0],[-14,-17],[-17,-14],[-22,0],[-21,20],[-27,75],[-34,86],[-24,43],[4,15]],[[4392,5857],[1,6],[70,8],[62,29],[23,20],[21,49],[34,72],[24,43],[0,81],[0,37],[-19,15],[-15,29],[0,31],[0,52],[0,43],[18,9]],[[2444,3808],[-2,-61],[-54,-35],[-55,-18],[-47,0],[-65,0],[-36,5],[-16,39],[0,39],[-19,40],[-41,35],[-60,53],[-16,40],[-5,48],[5,57],[34,18],[4,7]],[[2071,4075],[35,72],[39,123],[42,35]],[[2187,4305],[68,9],[49,44],[34,61],[21,97],[16,57],[31,40],[47,17],[52,58],[34,74],[23,40]],[[2562,4802],[3,4],[13,-39],[10,-106],[21,-39],[47,-58],[49,-30],[37,-31],[2,-40],[-39,-30],[-44,-58],[-44,-74],[-57,-53],[-24,-48],[-36,-13],[-29,-23],[-8,-48],[0,-26],[0,-31]],[[4392,5857],[-30,11],[-84,-3],[-81,-2],[-70,-3],[-55,-3],[-23,28]],[[3078,6363],[-29,17],[-39,22],[-44,52],[-47,40],[-36,12]],[[2883,6506],[0,63],[-21,39],[-29,0],[-29,-13],[-7,-35],[-8,-31],[-29,-4],[-52,0],[-44,0],[-26,30],[-50,53],[-47,0],[-60,5],[-39,8],[-2,58],[2,66],[11,48],[34,9],[10,30],[0,22],[-18,58],[-24,0],[-28,0],[-37,26],[-8,96],[0,58],[-21,13],[-33,4],[-45,57],[-26,58],[-12,29]],[[2245,7253],[-1,1],[29,49],[34,17],[29,5],[15,8],[3,49],[-13,13],[-42,18],[-18,35],[-8,31],[-34,13],[-15,22],[0,17],[20,40],[21,35],[24,7]],[[2289,7613],[1,-5],[14,-15],[67,-24],[44,0],[29,19],[20,-19],[0,-44],[-24,-30],[9,-24],[47,-20],[78,-10],[29,0],[20,40],[20,14],[38,0],[25,3]],[[4519,7955],[35,0],[46,-28],[31,-25],[2,-64],[3,-11]],[[4636,7827],[-22,-24],[-51,-68],[-33,-60],[-47,-75],[-25,-34],[-35,-4],[-38,-13],[-43,-30],[-24,-17],[-19,-30],[-19,-2],[-9,11]],[[4271,7481],[-5,6],[2,51],[3,62],[18,39],[28,32],[2,30],[-3,68],[-8,51],[-3,36],[-14,28],[-22,40],[-3,28],[0,49],[9,25]],[[4275,8026],[20,-37],[26,-37],[26,-33],[31,-70],[29,-30],[63,-18],[22,11],[24,122],[3,21]],[[4805,9109],[7,-32],[3,-138],[0,-89],[15,-60],[11,-71],[0,-55],[-7,-25],[-22,-12],[-30,-5],[-26,-25],[0,-53],[3,-30],[-2,-55],[-1,-30],[-12,-11],[-20,4],[-24,23],[-23,9],[-19,-9],[-14,-34],[0,-58],[1,-57],[-4,-63],[-17,-66],[-28,-37],[-29,-32],[-34,-26],[-23,-14],[-11,-41],[1,-48],[19,-14]],[[4275,8026],[-24,44],[-59,93],[-34,70]],[[4158,8233],[-25,52],[-41,101],[-44,65],[14,46]],[[4062,8497],[32,18],[36,23],[36,42],[11,88],[0,87],[-14,37],[-33,14],[-44,65],[-41,87],[-7,48],[-32,130]],[[4006,9136],[37,57],[69,-60],[81,3],[163,53],[9,-5],[43,-29],[193,5],[137,-47],[67,-4]],[[4158,8233],[-47,-36],[-72,-114],[-43,-105],[-10,-130],[0,-74],[0,-65],[0,-89],[-24,-65],[-58,0],[0,-10]],[[3835,7583],[-20,-21],[-32,0],[-60,20],[-45,65],[-24,61]],[[3654,7708],[27,45]],[[3681,7753],[12,-15],[33,-5],[24,-35],[9,-41],[24,-40],[27,-5],[16,19],[-12,63],[-3,84],[5,-6]],[[3816,7772],[14,-20],[7,14],[33,17],[-9,227],[9,147],[20,89],[57,130],[34,106],[58,24],[23,-9]],[[5181,4947],[-1,-10],[-4,-69],[-1,-49],[24,-43],[47,-46],[46,-37],[16,-40],[0,-64],[-18,-49],[-27,-34],[-25,-40],[-7,-61],[-2,-69],[12,-57],[41,-32],[46,-37],[19,-13]],[[5323,3992],[-4,6],[-18,27],[-46,10],[-23,-30],[-23,-54],[-33,-51],[0,-8]],[[4515,3906],[-4,26],[-25,48],[-36,39],[-46,16],[-58,19],[-36,10],[-25,16],[-13,26],[-8,49],[-12,48],[-9,29],[-27,10],[-25,-4],[-23,-22],[-25,-3],[-36,0],[-38,0],[-41,25],[-27,39],[-25,59],[-5,64],[0,91],[-10,77],[-19,62],[-42,19],[-21,23],[-19,45],[-12,55],[-32,45],[-64,32],[-42,20],[-52,19],[-33,0]],[[3625,4888],[2,20],[4,79],[0,64],[-16,53],[3,42],[13,22],[22,26],[34,53],[25,59],[-5,46]],[[3875,7451],[-5,-2],[-19,-57],[9,-13]],[[3860,7379],[-19,-27],[-7,-83]],[[3834,7269],[-42,52],[-28,35],[10,75],[26,39],[32,7]],[[7805,6179],[-17,0],[-81,3],[-77,11],[-42,5]],[[7588,6198],[-2,0],[-16,46],[-24,55],[-43,70],[-39,47],[-10,54],[0,87]],[[7454,6557],[28,0],[37,3],[37,40],[14,27],[18,17],[21,0],[16,-17],[5,-24],[21,-8],[18,11],[14,35],[31,52],[34,13],[13,0]],[[7761,6706],[-1,-7],[13,-32],[21,-28],[7,-37],[9,-85],[4,-78],[0,-56],[0,-53],[-5,-53],[-4,-66],[0,-32]],[[7063,7224],[1,-4],[16,-57],[50,-79],[59,-52],[81,3],[43,3],[28,0],[9,-17],[4,-29],[-4,-19],[-12,-11],[-10,-30],[0,-46],[3,-109],[16,-38],[8,-25],[7,-29],[13,-68],[22,-14],[18,0],[21,-35],[13,-11],[5,0]],[[7588,6198],[-12,-23],[-33,0],[-50,8],[-37,47],[-48,61],[-44,3],[-46,-8],[-74,16],[-79,17],[-102,94],[-85,100],[-39,60]],[[3816,7772],[-12,37],[-30,65],[-31,35],[-32,-10],[-27,-35],[-3,-65],[0,-46]],[[3654,7708],[-42,40],[-45,7]],[[3567,7755],[0,93],[-68,187],[-118,146],[-42,30]],[[3339,8211],[2,15],[-4,133],[-6,56],[-12,36],[-8,35],[5,58],[229,440],[27,27],[24,25],[68,7],[136,-65],[42,5],[-5,45],[-28,57],[-6,58],[64,44],[45,-18],[37,-46],[40,-13],[17,26]],[[7350,3782],[-12,-37],[-7,-46],[-2,-65],[7,-52],[21,-79],[19,-28]],[[7376,3475],[-4,-16],[-1,-36],[3,-33],[20,-31],[11,-22],[16,-67],[4,-50],[-2,-55],[-5,-28],[-20,-8],[-33,0],[-50,5],[-47,-2],[-33,-3],[-20,-22],[-27,-45],[-23,-39],[-2,-22]],[[7163,3001],[-24,-12],[-110,-97],[-98,-71],[-64,-11],[-70,11],[-65,52],[-55,49],[-20,71],[-18,37],[-24,4],[-22,15],[-15,22],[-14,19],[-15,7],[-20,22],[-38,45],[-65,81],[-38,41],[7,1]],[[6395,3287],[22,1],[53,-7],[59,0],[38,10],[20,7],[12,26],[7,41],[8,33],[6,38],[0,29],[-12,36],[-25,40],[-24,43],[-10,29],[4,21],[14,24],[20,3],[24,23],[19,19],[14,41],[17,48],[14,79],[20,88],[17,38],[39,38],[43,65],[27,23],[35,0],[23,-9],[22,-29],[19,-21],[39,-29],[34,-21],[27,-19],[36,-15],[19,0],[14,17],[14,28],[11,36],[11,29],[17,19],[30,19],[42,50],[20,29]],[[7234,4207],[10,-33],[36,-7],[46,-31],[32,-22],[18,-50],[-7,-46],[-23,-29],[-10,-12],[-8,-41],[2,-53],[9,-78],[11,-23]],[[3765,3296],[-7,15],[-44,36],[-27,3],[-23,0],[-34,-6],[-29,-17],[-31,-3],[-21,0],[-19,10],[-11,29],[-6,48],[-6,52],[-8,39],[-3,23],[-25,12],[-18,-9],[-28,-32],[-25,-4],[-19,-19],[-5,-15]],[[3376,3458],[-31,21],[-13,36],[-46,61],[-52,78],[-44,29],[2,45],[15,26],[39,3],[34,-3],[57,-3],[4,48],[0,23],[-13,39],[-23,19],[-61,90],[-46,81],[-19,43]],[[3179,4094],[-4,9],[0,39],[5,16],[29,22],[27,0],[21,17],[16,45],[17,26],[45,9],[40,-19],[21,-20],[30,-19],[20,-6],[-2,71],[-2,100],[11,45],[21,49],[23,35],[35,52],[29,45],[25,78],[4,119],[5,81],[20,0],[10,0]],[[4271,7481],[-16,-34],[-22,-43],[2,-23],[8,-22],[38,-29],[27,-11],[32,-30],[30,-25],[26,-26],[21,-45],[16,-42],[1,-52],[3,-55],[1,-8]],[[4327,7090],[-32,66],[-68,66],[-106,65],[-82,81],[-58,41],[-39,8],[-18,16],[-26,18]],[[6106,5286],[2,-40],[-10,-41],[-21,-37],[-23,-62],[-24,-16],[-27,-38],[-17,-49],[-5,-37],[0,-35],[13,-30],[25,-19],[29,0],[29,22],[30,18],[32,14],[21,0],[24,-24],[5,-30],[0,-35],[-16,-46],[-13,-38],[-24,-45],[-10,-27],[-1,-19],[4,-19],[13,-8],[21,-30],[0,-32],[-16,-51],[-14,-49],[-10,-22],[-27,-2],[-23,0],[-12,24],[-8,51],[0,74],[-19,27],[-23,0],[-12,-13]],[[5524,5671],[0,11],[4,32],[12,12],[15,0],[29,0],[24,-9],[10,-23],[5,-58],[19,-74],[2,-61],[0,-66],[8,-52],[9,-66],[13,-40],[24,-17],[50,-18],[39,-5],[31,0],[42,34],[38,46],[15,38]],[[8027,4325],[-4,-4],[-2,-41],[0,-50],[3,-53],[12,-53],[6,-60],[6,-6]],[[8048,4058],[-5,-44],[-19,-21],[-46,9],[-20,19],[-28,0],[-46,-19],[-56,-35],[-26,-34],[0,-11]],[[7802,3922],[-20,8],[-52,9],[-71,-3],[-100,-31],[-72,-22],[-94,-47],[-15,-34],[-5,-31],[-17,0],[-6,11]],[[7234,4207],[-6,17],[-2,65],[-19,53],[-27,53],[-33,69],[-43,60],[-25,40]],[[4636,7827],[12,-40],[46,-34],[46,-51],[46,-49],[28,0],[25,0],[10,-25],[0,-57],[-7,-37],[-4,-42],[0,-27],[5,-7]],[[7805,6179],[0,-77],[-2,-49]],[[3834,7269],[-2,-22],[0,-1],[5,-41]],[[3564,7465],[3,98],[0,146],[0,46]],[[7163,3001],[0,-5],[13,-34],[8,-22],[4,-39],[0,-83],[0,-36],[5,-39],[21,-14],[20,0],[10,-17],[-2,-38],[-21,-14],[-17,-6],[-39,-41],[-32,-37],[-46,-27],[-19,0],[-15,-3],[-14,-3],[-3,-42],[12,-47],[11,-36],[7,-58],[10,-31],[8,-30],[0,-34],[-12,-8],[-26,-3],[-56,3],[-66,-14],[-23,-14],[-13,-36],[-5,-44],[-8,-27],[21,-74],[1,-2]],[[6897,2046],[-31,5],[-88,-10],[-89,-52],[-140,-163],[-82,-37],[-29,14],[-129,89],[-10,19],[-6,33],[-13,32],[-28,12],[-16,-12],[-40,-57],[-19,-18],[-249,-93],[-118,-82],[-36,-34]],[[6001,4297],[27,-29],[42,0],[34,3],[40,30],[32,7],[40,-20],[20,-37],[-2,-135],[10,-78],[12,-70],[18,-102],[-2,-111],[2,-121],[18,-101],[34,-74],[8,-54],[-2,-40],[2,-31],[38,-27],[23,-20]],[[4256,7030],[-34,62],[-58,56],[-53,17],[-82,40],[-43,41],[-44,73],[-47,8],[-35,52]],[[7689,8219],[0,-18],[17,-65],[26,-19],[18,22],[15,37],[24,16],[23,-19],[25,-47],[4,-71],[0,-135],[17,-56],[39,-28],[57,-38],[15,-22],[11,-100],[-2,-50],[15,-31],[28,-44],[9,-37],[26,-41],[2,-59],[-2,-69],[7,-50],[19,-40],[0,-51]],[[8082,7204],[-18,-15],[-40,-35],[-25,0],[-22,4],[-18,19],[-19,34],[-24,25],[-19,12],[-33,0],[-29,-3],[-12,-25],[-11,-87],[-7,-91],[-19,-65],[-1,-57],[5,-159],[-27,-41],[-2,-14]],[[7377,7736],[24,111],[11,66],[28,59],[5,55],[-7,49],[-17,51],[-6,46],[0,13]],[[6156,8639],[27,-40],[34,-39],[39,0],[10,-15],[0,-27],[6,-77],[14,-30],[46,0],[42,-6],[64,-42],[44,-71],[66,-63],[39,-48],[29,-30],[32,0],[34,3],[39,24],[49,15],[36,21],[7,21],[-2,45],[5,56],[30,18],[11,1]],[[6009,7562],[-11,50],[-46,56],[-28,21],[-18,24],[-11,66],[-5,53],[-12,36],[-36,3],[-33,0],[-30,6],[-16,30],[-4,45],[25,62],[44,72],[11,95],[15,24]],[[3588,2608],[-18,9],[-19,19],[-30,58],[-41,26],[-9,-1]],[[3471,2719],[-2,33],[-27,4],[-21,12],[7,39],[14,20],[9,38],[10,42],[6,68],[-6,68],[-25,55],[-32,42],[-16,26],[-19,48],[0,62],[2,97],[0,67],[5,18]],[[3471,2719],[-18,-2],[-30,-13],[-15,-46],[-29,-113],[-27,-51],[-4,-62],[21,-32],[21,-28]],[[2709,3520],[-5,28],[-27,78],[10,27]],[[2927,3811],[52,33],[71,28],[55,28],[14,53],[0,59],[0,39],[9,42],[35,4],[16,-3]],[[4805,9109],[59,46],[56,86],[51,39]],[[2562,4802],[5,88],[0,101],[0,83],[-20,53],[-55,31],[-42,0],[-41,4],[-24,27],[-12,59]],[[2373,5248],[20,94],[-8,115],[-13,44],[-18,31],[-11,35],[0,52],[-5,57],[-36,36],[-19,65],[5,36],[21,22],[32,0],[10,26],[0,66],[0,97],[21,61],[81,9],[22,6]],[[2475,6100],[53,16],[55,66],[65,132],[91,127],[76,71],[52,0],[16,-6]],[[4502,2007],[-2,-2],[-16,-99],[-47,-83],[-56,-87],[-61,-99],[-45,-36],[-84,16],[-92,16],[-53,24],[-59,31],[-40,0],[-61,-55],[-35,-60],[-8,-31]],[[5660,1416],[-1,-22],[-7,-50],[-53,-101],[-139,-171],[-53,-123],[0,-1],[-1,0],[-146,-132],[-39,-61],[-7,-55],[-1,-71],[-14,-75],[-49,-64],[-33,-9],[-78,-22],[-202,58],[-110,-64],[-8,-26],[-9,-85],[-15,-37],[-19,-9],[-56,4],[-23,-4],[-39,-40],[-91,-116],[-34,-29],[-109,27],[-172,198],[-14,3]],[[3124,8197],[168,-43],[41,11],[6,46]],[[2108,5096],[-7,-57],[13,-66],[0,-105],[-3,-75],[-28,-66],[-18,-75],[-21,-17],[-5,-30]],[[2039,4605],[-19,8],[-21,0],[-41,-13],[-29,-31],[-31,-18],[-50,-31],[-65,-17],[-18,-53],[0,-33]],[[1765,4417],[-16,7],[-10,31],[-19,74],[-60,84],[-25,83],[-29,79],[-65,14],[-26,83],[-18,84],[-29,66],[-44,9]],[[1424,5031],[-16,4],[-52,-18],[-31,31],[-3,44],[42,66],[88,4],[31,31],[68,101],[45,35],[36,0],[52,0],[21,22],[61,8]],[[1766,5359],[43,5],[81,-30],[60,-40],[57,-53],[37,-61],[28,-44],[36,-40]],[[913,3787],[-25,-36],[-44,-74],[-55,-40],[-112,9],[-130,0],[-121,3],[-56,-10]],[[370,3639],[-20,66],[-46,84],[-29,24],[-65,14],[-28,30],[-8,35],[-8,108],[-13,50],[-7,19]],[[146,4069],[59,65],[57,86],[90,55],[85,69],[45,96],[94,0],[69,-14],[45,-82],[24,-124],[41,-48],[45,0],[28,-117],[0,-103],[0,-89],[61,-13],[24,-63]],[[1110,4138],[-19,9],[-18,13],[-31,-9],[-26,-44],[-16,-57],[-8,-70],[-13,-79],[-10,-44],[-31,-73]],[[938,3784],[-14,20],[-11,-17]],[[146,4069],[-42,102],[-30,39],[-43,25],[-28,98],[12,177],[-15,94],[190,52],[57,31],[52,40],[33,43],[21,68],[0,13]],[[353,4851],[73,-41],[77,-109],[97,-89],[131,-35],[44,0],[82,-89],[45,-89],[53,-76],[85,-41],[53,-34],[12,-76],[5,-34]],[[1765,4417],[0,-24],[10,-53],[24,-44],[26,-30],[60,-49],[54,-30],[58,-23],[57,-52],[17,-37]],[[948,3768],[-10,16]],[[1110,4138],[44,-22],[62,-13],[50,22],[42,53],[46,111],[48,34],[0,83],[4,61],[49,69],[0,83],[0,68],[0,124],[-24,178],[-7,42]],[[2039,4605],[-3,-23],[16,-31],[7,-57],[8,-26],[26,0],[23,26],[19,5],[31,-31],[21,-49],[0,-52],[0,-62]],[[353,4851],[-1,44],[-82,305],[-20,141],[-31,475],[11,70],[32,87],[38,64],[91,112],[25,58],[-3,43]],[[413,6250],[115,-62],[80,-41],[40,-57],[89,-53],[60,-66],[80,-18],[81,-8],[45,43],[36,62],[37,57],[81,0],[72,-13],[76,-18],[60,-4],[23,-35],[50,-110],[8,-127],[36,-53],[47,35],[47,0],[62,0],[39,-5],[0,-35],[-33,-39],[-21,-31],[29,-70],[49,-101],[57,-84],[8,-58]],[[2108,5096],[3,27],[21,17],[37,35],[55,9],[49,22],[42,9],[33,35],[24,0],[1,-2]],[[2281,7655],[-8,4],[-31,8],[-34,27],[-11,26],[0,49],[0,39],[11,48],[-16,40],[-28,48],[-34,18],[-24,0],[-34,13],[-13,48],[-21,71],[-31,79],[-34,48],[-36,27],[-50,39],[-49,27],[-45,17]],[[1793,8331],[277,119],[112,48],[98,62],[46,56]],[[2326,8616],[94,-109],[58,-88],[53,-93],[34,-88],[32,-24],[38,-10],[29,-25],[14,-58],[-6,-73],[-40,-64],[-35,-34],[-43,-98],[-27,-78],[-60,-39],[-67,-15],[-107,-29],[-15,-20],[3,-16]],[[2281,7655],[8,-42]],[[2245,7253],[-40,10],[-31,5],[-49,44],[-32,30],[-23,5],[-24,-18],[-21,-53],[-7,-26],[-16,2]],[[2002,7252],[-16,2],[-52,79],[-42,62],[-36,26],[-120,31],[-104,35],[-60,-4],[-44,-35],[-40,-49],[-46,-43],[-68,-31],[-60,-40],[-44,-57],[-60,-36],[-12,-20]],[[1198,7172],[-38,200],[5,150],[48,324],[39,141],[76,117],[100,71],[365,156]],[[1965,6731],[7,-26],[-3,-75],[3,-44],[22,-11]],[[1994,6575],[-27,-15],[-16,-22],[-18,-35],[10,-62],[8,-44],[-39,-57],[-73,-31],[-125,40],[-99,-18],[-47,-52],[-70,13],[-68,48],[-23,44],[-24,84],[-26,39],[-52,9],[-55,0],[-49,4],[-17,11],[-82,44],[-49,63]],[[1053,6638],[35,49],[65,141],[41,124],[2,22]],[[1196,6974],[48,40],[45,16],[120,-22],[123,-31],[127,-52],[112,-75],[99,-75],[52,-13],[26,-31],[17,0]],[[2002,7252],[1,-28],[3,-97],[15,-31],[53,0],[44,-4],[-3,-49],[-13,-35],[-15,-61],[-27,-49],[-28,-26],[-42,-9],[-18,-35],[3,-31],[13,-35],[5,-31],[-5,0],[-23,0]],[[1196,6974],[13,136],[-11,62]],[[2475,6100],[-18,42],[-34,57],[-42,71],[-70,70],[-31,48],[5,49],[-11,53],[-23,0],[-60,-5],[-83,13],[-84,62],[-30,15]],[[413,6250],[-7,93],[-31,166],[2,35],[3,110],[99,77],[91,-122],[47,-32],[63,5],[29,30],[43,100],[25,22],[36,-29],[74,-131],[38,-35],[84,37],[44,62]],[[2326,8616],[130,161],[94,76],[31,-1],[26,-10],[52,-36],[148,-144],[138,-170],[64,-131],[36,-95],[15,-19]],[[8692,4099],[18,-19],[30,-44],[9,-37],[13,-50],[7,-41],[-1,-34],[-17,-47],[-13,-35],[0,-37],[15,-6],[22,-10],[16,-21],[21,0],[11,9],[13,19],[33,3],[24,3],[15,-25],[7,-31],[6,-53],[11,-22],[24,-29],[32,-21],[33,-7],[19,7],[22,15],[19,13],[31,3],[16,0]],[[9128,3602],[0,-13],[12,-15],[15,-16],[3,-69],[-3,-99],[3,-126],[0,-34],[7,-13],[4,-10],[1,-1]],[[9170,3206],[-62,-14],[-73,-82]],[[9035,3110],[-12,14],[-61,47],[-76,50],[-65,43],[-46,16],[-26,-9],[-28,-22],[-20,-60],[-22,-68],[-27,-41],[-11,-13],[-20,0],[-13,26],[-26,3],[-20,-16],[-15,-31],[-26,-13],[-35,0],[-45,0],[-29,13],[0,44],[-41,53],[-30,31],[-26,3],[-16,-9],[-28,-13],[-39,-3],[-50,0],[-28,3],[-2,31],[-3,66],[-17,47],[-34,65],[-20,51],[0,28],[15,50],[30,46],[15,44],[0,31],[-19,38],[-21,22],[-37,6],[-29,-3],[-46,0],[-49,28],[-37,44],[-40,56],[-34,60],[-26,37],[2,17]],[[8048,4058],[5,-6],[15,19],[26,40],[22,37],[11,38],[13,25],[39,6],[45,-31],[26,0],[31,-31],[46,-28],[17,-28],[39,-60],[24,-43],[41,0],[72,-3],[35,18],[26,13],[39,9],[48,50],[24,16]],[[9035,3110],[-43,-48],[-36,-185]],[[8956,2877],[-2,1],[-6,3],[-45,19],[-29,2],[-30,10],[-36,0],[-27,-3],[-28,-7],[-21,0],[-47,17],[-40,5],[-27,-22],[-21,-43],[0,-38],[-10,-38],[-23,-15],[-59,-2],[-82,5],[-17,-34],[-30,-57],[-33,-60],[-33,-29],[-30,-14],[-8,1]],[[8272,2578],[-19,1],[-37,32],[-7,21],[-10,21],[-68,-2],[-17,-38],[-2,-43],[-7,-79],[-3,-36],[-25,-24],[-24,-22],[-17,-19],[-5,0]],[[8031,2390],[-9,0],[-20,41],[-18,41],[0,31],[-13,26],[-31,14],[-1,53],[1,67],[-24,96],[-20,57],[1,129],[0,60],[-8,46],[-14,9],[-29,0],[-41,22],[-27,33],[-35,70],[-63,91],[-31,64],[-25,27],[-42,7],[-49,31],[-38,52],[-30,8],[-34,2],[-53,5],[-2,3]],[[8902,4734],[8,-45],[7,-90],[0,-66],[-9,-62],[-5,-91],[-8,-34],[-15,-38],[-25,-62],[-36,-35],[-26,-40],[-22,-13],[-22,-6],[-24,-6],[-32,-25],[-4,-19],[3,-3]],[[8517,5159],[4,-13],[-5,-54],[11,-47],[12,0],[19,11],[20,63],[19,19],[27,-8],[55,-75],[47,-16],[18,-22],[13,-40],[0,-50],[-2,-50],[-9,-31],[-24,-10],[-24,-16],[-2,-25],[4,-31],[26,0],[59,3],[102,-31],[15,-2]],[[8272,2578],[7,-36],[22,-32],[28,-16],[16,-25],[21,-43],[22,-6],[30,0],[20,0],[17,8],[14,10],[24,0],[30,-2],[29,-14],[29,-27],[37,-34],[19,0],[9,-15],[2,-55],[-1,-49],[-1,-35],[4,-2],[-24,-51]],[[8626,2154],[-5,7],[-45,14],[-59,-21],[-13,-48],[3,-59],[-9,-53],[-67,-110],[-67,-71],[-13,-7]],[[8351,1806],[-1,2],[-12,34],[-59,51],[-63,41],[-37,25],[-42,6],[-28,0],[-19,2],[-9,14],[3,29],[1,34],[8,35],[13,49],[7,53],[0,33],[-5,33],[-20,38],[-19,39],[-24,33],[-14,33]],[[9408,4389],[4,-31],[2,-78],[-11,-53],[-24,-25],[-23,-38],[-20,-43],[-33,-54],[-43,-46],[-20,-19],[-34,-31],[-18,-32],[2,-56],[0,-59],[0,-75],[-2,-44],[-8,-34],[-14,-19],[-15,-13],[-19,-18],[-4,-16],[0,-3]],[[8902,4734],[40,-7],[28,-50],[11,-60],[33,-50],[58,-50],[46,-12],[69,-13],[58,-3],[74,-6],[35,-31],[36,-63],[18,0]],[[8351,1806],[-60,-30],[-86,-7],[-127,25],[-63,-1],[-74,-29],[-55,-18],[-62,-9],[-116,7],[-44,21],[-83,69],[-35,22],[-49,4],[-99,-22],[-73,-3],[-33,-27],[-25,4],[-8,23],[-5,86],[-10,26],[-36,13],[-119,19],[-147,60],[-45,7]],[[9408,4389],[26,0],[100,0],[138,13],[33,18],[35,9],[2,1]],[[9742,4430],[10,-460],[5,-32],[23,-67],[5,-38],[-10,-31],[-45,-71],[-13,-40],[8,-141],[20,-138],[-14,-122],[-93,-92],[-354,34],[-114,-26]],[[8956,2877],[-4,-23],[-16,-520],[-38,-254],[-44,-133],[-43,-39],[-50,33],[-70,79],[-30,52],[-17,51],[-18,31]],[[8426,7449],[3,-43],[0,-103],[5,-87],[2,-72],[0,-57],[17,-18],[42,-13],[78,-31],[74,-50],[76,-50],[48,-16],[36,-9],[23,0],[14,-3],[0,-35],[-17,-18],[-15,-44],[-33,-75],[-11,-94],[-17,-106],[-24,-59],[-28,-47],[-7,-47],[-2,-66],[3,-9]],[[8693,6297],[-9,-3],[-7,-53],[13,-35],[5,-68],[-5,-110],[-15,-78],[-26,-78],[-37,-56],[-54,0],[-42,-10],[-32,-34],[0,-2]],[[8082,7204],[0,-3],[19,-12],[36,-19],[28,0],[44,38],[28,71],[24,66],[7,60],[9,40],[24,28],[30,7],[60,-10],[35,-21]],[[9017,6174],[6,-52],[32,-94],[22,-87],[28,-19],[7,-37],[2,-63],[15,-44],[31,-9],[12,9],[3,35],[22,21],[54,4],[170,-41],[45,-25],[20,-47],[0,-47],[21,0],[33,3],[61,-6],[60,-47],[74,-78],[53,-22],[52,-22],[45,-40],[18,-22],[2,-2]],[[9905,5442],[-34,-70],[-26,-95],[-12,-33],[-21,-17],[-62,-22],[-19,-23],[-18,-75],[-12,-91],[-4,-95],[6,-88],[13,-37],[37,-73],[9,-45],[-3,-38],[-19,-109],[2,-101]],[[8693,6297],[10,-34],[39,3],[66,-10],[80,-12],[56,-22],[64,-47],[9,-1]],[[9502,6720],[-13,-17],[-16,-22],[-48,-43],[-69,-63],[-51,-72],[-24,-56],[-32,-84],[-20,-50],[-34,-7],[-44,-22],[-28,-56],[-39,-53],[-31,-6],[-36,5]],[[8426,7449],[-8,107],[9,35],[18,9],[19,3],[22,6],[9,19],[2,47],[2,62],[0,94],[2,97],[5,94],[3,63]],[[8509,8085],[189,-122],[117,-31],[17,-19],[15,-29],[17,-27],[26,-13],[178,10],[40,-6],[17,-26],[9,-43],[13,-45],[31,-30],[27,1],[60,26],[22,-2],[44,-37],[21,-33],[8,-46],[1,-4],[3,-86],[1,-1],[31,-72],[9,-71],[7,-157],[29,-151],[42,-151],[6,-46],[-2,-97],[10,-50],[5,-7]],[[8040,8543],[13,-27],[81,-103],[338,-305],[37,-23]],[[9502,6720],[12,-16],[45,-31],[18,-26],[25,-78],[41,-225],[84,-248],[24,-48],[43,-24],[92,-6],[41,-25],[69,-138],[3,-155],[-43,-153],[-51,-105]],[[817,1485],[-42,41],[-35,7],[-10,2],[-49,-3],[-53,7],[-31,18],[-79,48],[-28,89],[3,117],[-20,148],[-62,153],[-144,260]],[[200,2635],[-48,258],[-21,198],[1,13],[14,129],[56,-22],[56,43],[51,82],[37,90],[27,109],[1,89],[-4,15]],[[6241,9553],[60,-9],[135,31],[166,87]]],"transform":{"scale":[0.0002565681372137245,0.0001521092865286573],"translate":[20.44415734900008,40.84939402300006]}};
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
