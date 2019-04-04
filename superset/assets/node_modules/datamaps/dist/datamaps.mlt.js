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
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = {"type":"Topology","objects":{"mlt":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Attard"},"id":"MT","arcs":[[0,1,2,3,4,5,6,7]]},{"type":"Polygon","properties":{"name":"Mdina"},"id":"MT","arcs":[[8,9,-5]]},{"type":"Polygon","properties":{"name":"Imtarfa"},"id":"MT","arcs":[[-10,10,-6]]},{"type":"Polygon","properties":{"name":"Rabat"},"id":"MT","arcs":[[-7,-11,-9,11,12,13,14,15,16]]},{"type":"Polygon","properties":{"name":"Mġarr"},"id":"MT","arcs":[[17,-16,18,19,20]]},{"type":"Polygon","properties":{"name":"Mellieħa"},"id":"MT","arcs":[[21,-20,22]]},{"type":"Polygon","properties":{"name":"St. Paul's Bay"},"id":"MT","arcs":[[23,24,-21,-22,25]]},{"type":"Polygon","properties":{"name":"Mosta"},"id":"MT","arcs":[[26,27,-8,-17,-18,-25]]},{"type":"Polygon","properties":{"name":"Naxxar"},"id":"MT","arcs":[[28,29,30,31,32,-27,-24,33]]},{"type":"Polygon","properties":{"name":"Lija"},"id":"MT","arcs":[[34,35,-1,-28,-33]]},{"type":"Polygon","properties":{"name":"Balzan"},"id":"MT","arcs":[[36,-2,-36,37]]},{"type":"Polygon","properties":{"name":"Iklin"},"id":"MT","arcs":[[38,39,-38,-35,-32,40]]},{"type":"Polygon","properties":{"name":"Għargħur"},"id":"MT","arcs":[[41,-41,-31,42]]},{"type":"Polygon","properties":{"name":"Swieqi"},"id":"MT","arcs":[[43,44,-43,-30,45]]},{"type":"Polygon","properties":{"name":"Pembroke"},"id":"MT","arcs":[[46,-46,-29,47]]},{"type":"Polygon","properties":{"name":"St. Julian's"},"id":"MT","arcs":[[48,49,50,-44,-47,51]]},{"type":"Polygon","properties":{"name":"Sliema"},"id":"MT","arcs":[[52,53,-49,54]]},{"type":"Polygon","properties":{"name":"San Ġwann"},"id":"MT","arcs":[[-51,55,56,57,-39,-42,-45]]},{"type":"Polygon","properties":{"name":"Gżira"},"id":"MT","arcs":[[58,59,60,-56,-50,-54]]},{"type":"Polygon","properties":{"name":"Birkirkara"},"id":"MT","arcs":[[61,62,63,-37,-40,-58]]},{"type":"Polygon","properties":{"name":"Msida"},"id":"MT","arcs":[[64,65,66,-62,-57,-61]]},{"type":"Polygon","properties":{"name":"Ta' Xbiex"},"id":"MT","arcs":[[67,68,-65,-60]]},{"type":"Polygon","properties":{"name":"Pietà"},"id":"MT","arcs":[[69,-66,-69,70]]},{"type":"Polygon","properties":{"name":"Santa Venera"},"id":"MT","arcs":[[71,72,-63,-67]]},{"type":"Polygon","properties":{"name":"Ħamrun"},"id":"MT","arcs":[[73,74,-72,-70,75]]},{"type":"Polygon","properties":{"name":"Qormi"},"id":"MT","arcs":[[-73,-75,76,77,78,79,-3,-64]]},{"type":"Polygon","properties":{"name":"Żebbuġ"},"id":"MT","arcs":[[80,-12,-4,-80]]},{"type":"Polygon","properties":{"name":"Dingli"},"id":"MT","arcs":[[81,82,-14]]},{"type":"Polygon","properties":{"name":"Siġġiewi"},"id":"MT","arcs":[[-79,83,84,85,86,-82,-13,-81]]},{"type":"Polygon","properties":{"name":"Valletta"},"id":"MT","arcs":[[87,88,89,90,-59,-53,91]]},{"type":"Polygon","properties":{"name":"Kalkara"},"id":"MT","arcs":[[92,93,94,-88,95]]},{"type":"Polygon","properties":{"name":"Birgu"},"id":"MT","arcs":[[96,97,-89,-95]]},{"type":"Polygon","properties":{"name":"Xgħajra"},"id":"MT","arcs":[[98,-93,99]]},{"type":"Polygon","properties":{"name":"Senglea"},"id":"MT","arcs":[[100,101,102,-90,-98]]},{"type":"Polygon","properties":{"name":"Floriana"},"id":"MT","arcs":[[-103,103,104,-76,-71,-68,-91]]},{"type":"Polygon","properties":{"name":"Cospicua"},"id":"MT","arcs":[[105,106,107,-101,-97]]},{"type":"Polygon","properties":{"name":"Żabbar"},"id":"MT","arcs":[[108,109,110,111,-106,-94,-99]]},{"type":"Polygon","properties":{"name":"Marsa"},"id":"MT","arcs":[[112,113,-77,-74,-105]]},{"type":"Polygon","properties":{"name":"Paola"},"id":"MT","arcs":[[-108,114,115,116,-113,-104,-102]]},{"type":"Polygon","properties":{"name":"Fgura"},"id":"MT","arcs":[[117,118,-115,-107,-112]]},{"type":"Polygon","properties":{"name":"Tarxien"},"id":"MT","arcs":[[119,120,121,-116,-119]]},{"type":"Polygon","properties":{"name":"Żejtun"},"id":"MT","arcs":[[122,123,124,-120,-118,-111]]},{"type":"Polygon","properties":{"name":"Marsaskala"},"id":"MT","arcs":[[125,-123,-110,126]]},{"type":"Polygon","properties":{"name":"Marsaxlokk"},"id":"MT","arcs":[[-126,127,128,129,-124]]},{"type":"Polygon","properties":{"name":"Luqa"},"id":"MT","arcs":[[-117,130,131,132,133,134,135,136,-84,-78,-114]]},{"type":"Polygon","properties":{"name":"Santa Luċija"},"id":"MT","arcs":[[137,138,-131,-122]]},{"type":"Polygon","properties":{"name":"Gudja"},"id":"MT","arcs":[[139,-132,-139]]},{"type":"Polygon","properties":{"name":"Għaxaq"},"id":"MT","arcs":[[-130,140,-133,-140,-138,-121,-125]]},{"type":"Polygon","properties":{"name":"Birżebbuġa"},"id":"MT","arcs":[[141,142,-141,-129]]},{"type":"Polygon","properties":{"name":"Mqabba"},"id":"MT","arcs":[[143,144,145,-85,-137]]},{"type":"Polygon","properties":{"name":"Kirkop"},"id":"MT","arcs":[[146,147,-144,-136]]},{"type":"Polygon","properties":{"name":"Safi"},"id":"MT","arcs":[[148,-147,-135]]},{"type":"Polygon","properties":{"name":"Qrendi"},"id":"MT","arcs":[[149,150,-86,-146]]},{"type":"Polygon","properties":{"name":"Żurrieq"},"id":"MT","arcs":[[-149,-134,-143,151,-150,-145,-148]]},{"type":"Polygon","properties":{"name":"Saint Lawrence"},"id":"-99","arcs":[[152,153,154]]},{"type":"Polygon","properties":{"name":"Għarb"},"id":"-99","arcs":[[155,-155,156,157]]},{"type":"Polygon","properties":{"name":"Għasri"},"id":"-99","arcs":[[158,159,-158,160,161]]},{"type":"Polygon","properties":{"name":"Żebbuġ"},"id":"-99","arcs":[[162,163,-162,164]]},{"type":"Polygon","properties":{"name":"Xagħra"},"id":"-99","arcs":[[165,166,167,-163,168]]},{"type":"Polygon","properties":{"name":"Nadur"},"id":"-99","arcs":[[169,170,-166,171]]},{"type":"Polygon","properties":{"name":"Qala"},"id":"-99","arcs":[[172,-170,173]]},{"type":"Polygon","properties":{"name":"Kerċem"},"id":"-99","arcs":[[-160,174,175,176,177,-153,-156]]},{"type":"Polygon","properties":{"name":"Victoria"},"id":"-99","arcs":[[-164,-168,178,179,-175,-159]]},{"type":"Polygon","properties":{"name":"Fontana, Gozo"},"id":"-99","arcs":[[180,181,-176,-180]]},{"type":"Polygon","properties":{"name":"Munxar"},"id":"-99","arcs":[[-182,182,183,184,-177]]},{"type":"Polygon","properties":{"name":"Sannat"},"id":"-99","arcs":[[185,186,-184,187]]},{"type":"Polygon","properties":{"name":"Xewkija"},"id":"-99","arcs":[[188,-188,-183,-181,-179,-167]]},{"type":"MultiPolygon","properties":{"name":"Għajnsielem"},"id":"-99","arcs":[[[189]],[[-173,190,-186,-189,-171]]]}]}},"arcs":[[[6561,3424],[116,-21],[162,10]],[[6839,3413],[69,-118],[93,-65],[146,-32]],[[7147,3198],[-23,-119],[-61,-97]],[[7063,2982],[-293,-22],[-162,-10],[-85,-97],[-131,-33],[-139,22],[-131,43],[-147,-32]],[[5975,2853],[-46,172]],[[5929,3025],[8,119],[7,140]],[[5944,3284],[23,97],[16,129]],[[5983,3510],[85,54],[162,22],[146,-76],[93,-75],[92,-11]],[[5975,2853],[-77,10],[-131,0],[-62,65]],[[5705,2928],[39,65],[92,32],[93,0]],[[5705,2928],[-162,65],[-15,151],[77,97],[131,11],[116,0],[92,32]],[[5975,2853],[-8,-151],[47,-43],[54,-378]],[[6068,2281],[-93,-140],[-162,-32],[-208,43]],[[5605,2152],[-70,108],[-15,97],[-62,75],[-138,0],[-270,-43],[-186,11],[-140,-97]],[[4724,2303],[-46,83],[-83,110],[-369,227],[-80,173],[0,711]],[[4146,3607],[117,-75],[100,32],[108,-129],[93,-11],[61,54],[77,97],[101,0],[85,54],[100,-54],[85,11],[77,108],[162,21],[185,33],[139,0],[115,43]],[[5751,3791],[78,-108],[69,-76],[85,-97]],[[5728,3899],[23,-108]],[[4146,3607],[0,419],[-46,506]],[[4100,4532],[163,35],[170,65],[208,108],[92,86],[170,21],[54,76]],[[4957,4923],[147,-43],[46,-65],[-39,-108],[-69,-75],[8,-108],[84,-22],[193,-21],[62,-97],[31,-194],[15,-141],[93,-86],[115,-54],[85,-10]],[[5793,6073],[-157,-460],[-262,-86],[-170,-130],[-208,-75],[-78,-65],[-15,-162],[54,-172]],[[4100,4532],[-69,780],[-149,578],[-273,375],[331,337],[333,231],[365,135],[411,45],[0,-270],[-237,-51],[-153,-89],[-337,-338],[1471,-192]],[[6638,5880],[-200,-418],[-162,-302],[-85,-173],[-23,-150],[54,-141],[0,-107],[-39,-54],[39,-65],[92,-129]],[[6314,4341],[-77,-108],[-69,-65],[-69,65],[-31,118],[-70,65],[-100,86],[-139,33],[-208,-43],[-54,-54],[31,-44],[100,11],[77,-32],[31,-108],[93,-65],[92,-43],[23,-75],[-54,-54],[-100,-65],[-62,-64]],[[5793,6073],[591,-78],[254,-115]],[[6314,4341],[108,-22],[54,-97],[24,-97],[15,-108],[8,-108],[31,-97]],[[6554,3812],[-47,-64],[0,-119],[54,-205]],[[7333,5297],[-47,-396],[-15,-237]],[[7271,4664],[-193,-11]],[[7078,4653],[-116,-54],[-61,-64],[-31,-205],[8,-140],[100,-119]],[[6978,4071],[-77,-129],[46,-130],[-93,-54]],[[6854,3758],[-154,-32],[-146,86]],[[6638,5880],[179,-80],[516,-503]],[[6854,3758],[54,-118]],[[6908,3640],[-69,-227]],[[7063,3564],[61,-108],[39,-129],[-16,-129]],[[6908,3640],[155,-76]],[[7263,3942],[8,-302]],[[7271,3640],[-100,-43],[-108,-33]],[[6978,4071],[100,-11],[85,-32],[100,-86]],[[7302,4028],[-39,-86]],[[7078,4653],[0,-108],[116,-53],[23,-173],[62,-119],[23,-172]],[[7834,4330],[46,-65],[-7,-129],[-93,-87]],[[7780,4049],[-54,65],[-69,-75],[-132,-54],[-154,11],[-69,32]],[[7271,4664],[123,-65],[93,-97],[31,-161],[100,-33],[216,22]],[[8286,4707],[-259,-237],[-185,-43],[-8,-97]],[[7333,5297],[360,-350],[593,-240]],[[8519,4496],[-367,-356],[-89,-299]],[[8063,3841],[-113,-70]],[[7950,3771],[-77,97],[-78,60],[-15,121]],[[8286,4707],[166,-67],[67,-144]],[[8611,3630],[-175,-77]],[[8436,3553],[7,120],[-264,65],[-116,103]],[[8519,4496],[65,-138],[30,-363],[-3,-365]],[[7950,3771],[-70,-158]],[[7880,3613],[-260,-16],[-97,-38]],[[7523,3559],[-252,81]],[[8436,3553],[-147,-129]],[[8289,3424],[-98,75],[-225,6]],[[7966,3505],[-86,108]],[[7523,3559],[93,-87],[28,-87],[-70,-87]],[[7574,3298],[-51,-32],[-15,-92],[-37,-149]],[[7471,3025],[-169,22],[-155,151]],[[7966,3505],[7,-199]],[[7973,3306],[-7,-111],[-66,-92]],[[7900,3103],[-113,125],[-143,49],[-70,21]],[[8289,3424],[-93,-97]],[[8196,3327],[-123,-32],[-100,11]],[[8148,3174],[-136,-87],[-112,16]],[[8196,3327],[-48,-153]],[[7900,3103],[-155,-71],[-42,-93]],[[7703,2939],[-139,32],[-93,54]],[[8160,3032],[-118,-82],[-54,-237],[-154,10]],[[7834,2723],[-131,216]],[[8148,3174],[51,-82],[-39,-60]],[[7834,2723],[-85,-54],[-15,-86]],[[7734,2583],[-85,-108],[-185,-323]],[[7464,2152],[-85,0],[-85,86]],[[7294,2238],[-15,119],[0,118],[-78,76],[-131,21],[-61,76],[-23,151],[46,86],[31,97]],[[7294,2238],[-69,-43],[-47,32],[-84,87],[-108,21],[-155,-32],[-38,-86],[-77,-87],[-162,-64],[-162,86],[-155,75],[-77,65],[-92,-11]],[[5605,2152],[-16,-119],[-108,-215],[-92,-97],[-30,-325]],[[5359,1396],[-199,125],[-436,782]],[[7464,2152],[15,-140],[-123,-119],[-93,-119],[-108,-21],[-23,-76]],[[7132,1677],[-77,-43],[-31,-107],[-62,-141]],[[6962,1386],[-92,-32],[-77,-22],[-93,-97],[23,-107],[-23,-65],[-116,0],[-100,-76],[-91,-209]],[[6393,778],[-113,41],[-921,577]],[[8897,3528],[-141,-137]],[[8756,3391],[-107,-114]],[[8649,3277],[-121,-79]],[[8528,3198],[-239,226]],[[8611,3630],[141,-31],[145,-71]],[[9500,3237],[-177,-147],[-31,-119]],[[9292,2971],[-178,0],[-100,-43]],[[9014,2928],[-9,270],[-110,54],[-139,139]],[[8897,3528],[603,-291]],[[9014,2928],[-211,202]],[[8803,3130],[-154,147]],[[9713,2844],[-205,-99],[-124,65],[-92,161]],[[9500,3237],[213,-393]],[[8803,3130],[-198,-245]],[[8605,2885],[-139,183]],[[8466,3068],[62,130]],[[8466,3068],[-100,-108],[-100,-97]],[[8266,2863],[-54,130],[-52,39]],[[9014,2928],[-62,-140],[-7,-119]],[[8945,2669],[-101,-10],[-146,-11],[-93,0]],[[8605,2648],[-77,75],[77,162]],[[9713,2844],[123,-227]],[[9836,2617],[-220,-152],[-31,-108],[-70,-97],[-77,-11],[-69,-76]],[[9369,2173],[-208,22],[-78,97],[-115,11],[-62,43]],[[8906,2346],[31,119],[46,86],[23,86],[-61,32]],[[8266,2863],[-8,-226],[-69,-226],[-116,-162]],[[8073,2249],[-100,0],[-108,97],[-85,21],[0,98],[-46,118]],[[8605,2648],[-139,-173]],[[8466,2475],[-92,-108],[-39,-118],[-85,-54],[-138,-108]],[[8112,2087],[-39,162]],[[8906,2346],[-93,-32],[-61,-22],[-23,-97],[-54,-43]],[[8675,2152],[-39,108],[23,86],[-69,86],[-124,43]],[[8675,2152],[-101,-76],[-38,-54]],[[8536,2022],[-31,-64]],[[8505,1958],[-185,43],[-124,21],[-84,65]],[[9369,2173],[85,-194],[38,-118],[-31,-87],[8,-75],[39,-75]],[[9508,1624],[-85,-108],[-154,97],[-155,21],[-61,-64],[-162,10]],[[8891,1580],[-124,238],[-108,161],[-123,43]],[[9964,1475],[-171,52],[-147,21],[-138,76]],[[9836,2617],[59,-109],[104,-890],[-35,-143]],[[9964,1475],[-105,-433],[-359,226],[-202,-256]],[[9298,1012],[-68,180],[-123,162],[-108,54],[-93,0]],[[8906,1408],[-15,172]],[[8112,2087],[0,-151],[-8,-129]],[[8104,1807],[46,-140],[0,-76],[8,-140],[62,-65],[115,-97]],[[8335,1289],[85,-118],[62,-130]],[[8482,1041],[-124,-21]],[[8358,1020],[-146,161],[-93,141],[-123,75]],[[7996,1397],[-23,130],[-54,32],[-77,118],[-70,44],[-92,-76]],[[7680,1645],[-139,43],[-100,65],[-116,-97],[-93,-43],[-100,64]],[[8505,1958],[15,-119],[-15,-54]],[[8505,1785],[-185,11],[-216,11]],[[8505,1785],[-15,-118],[-54,-43],[-31,-87],[-8,-118],[0,-65],[-62,-65]],[[8906,1408],[-39,-108],[-123,-32],[-69,-33],[-23,-97],[-62,-86],[-108,-11]],[[9298,1012],[-203,-256],[-129,-307],[0,-449],[-418,191],[-115,80],[-247,28]],[[8186,299],[41,85],[31,64],[-54,140],[16,87],[69,0],[147,-54],[115,21],[23,65],[-54,183],[-38,151]],[[7680,1645],[38,-97],[-38,-65],[-47,-129]],[[7633,1354],[-100,-11],[-146,-11]],[[7387,1332],[-155,-32],[-123,54],[-147,32]],[[7996,1397],[-177,-194]],[[7819,1203],[-70,97],[-116,54]],[[8358,1020],[-92,-97],[-70,32],[-92,54],[-100,-76],[-116,-64],[-85,32],[-85,97],[-7,76],[108,129]],[[7387,1332],[30,-107],[-77,-44],[-7,-75],[54,-54],[-62,-65],[-77,-75],[-154,-205],[-56,-158]],[[7038,549],[-645,229]],[[8186,299],[-650,73],[-498,177]],[[735,9136],[-44,-164],[-86,-95],[0,-138],[-173,-207],[-139,-216]],[[293,8316],[-259,190],[81,393],[-96,397],[-19,309]],[[0,9605],[204,-193],[278,-138],[111,52],[49,-130],[93,-60]],[[920,9119],[-185,17]],[[0,9605],[310,121],[454,78]],[[764,9804],[-11,-142],[93,-129],[55,-173],[19,-241]],[[1457,9041],[-130,9],[-117,-18],[-37,-51]],[[1173,8981],[-173,34],[-80,104]],[[764,9804],[537,92]],[[1301,9896],[-79,-148],[-6,-224],[25,-190],[55,-26],[86,35],[62,-95],[13,-207]],[[2304,9832],[-107,-118],[12,-95],[6,-121],[-24,-69],[-155,-9],[-123,-69],[-92,-120],[-13,-121],[37,-121],[-31,-69],[-68,-8]],[[1746,8912],[-141,0],[-148,129]],[[1301,9896],[602,103],[401,-167]],[[2750,9594],[-78,-251],[0,-405],[-80,-44],[-19,-163],[-37,-104],[-6,-164]],[[2530,8463],[-142,121],[-99,52],[-117,-26],[-148,-35],[-160,35]],[[1864,8610],[12,95],[-55,86],[-75,121]],[[2304,9832],[276,-115],[170,-123]],[[3567,8930],[-124,-96],[-92,-69],[-93,-26],[-18,-86],[-7,-173],[-61,-94],[-216,-35]],[[2956,8351],[-204,0],[-111,26],[-111,86]],[[2750,9594],[670,-488],[147,-176]],[[3038,8155],[-21,110],[-61,86]],[[3567,8930],[360,-433],[-318,-263],[-458,-20],[-113,-59]],[[1173,8981],[74,-112],[37,-130],[68,-43],[6,-69]],[[1358,8627],[-6,-224]],[[1352,8403],[-130,43],[-105,17],[-99,-52],[-166,-129],[-172,-196]],[[680,8086],[-222,108],[-165,122]],[[1864,8610],[-25,-181],[-93,-9],[-86,9],[-68,-69]],[[1592,8360],[-6,120],[-92,61],[-50,86],[-86,0]],[[1592,8360],[-92,-78]],[[1500,8282],[-99,35],[-49,86]],[[1500,8282],[-19,-69]],[[1481,8213],[-68,-138],[-105,-138],[-20,-91]],[[1288,7846],[-316,98],[-292,142]],[[2296,7946],[51,-120]],[[2347,7826],[-355,-90],[-484,42],[-220,68]],[[1481,8213],[93,-26],[197,0],[117,-34],[87,-95],[123,-43],[117,-78],[81,9]],[[2530,8463],[-49,-121],[-56,-69],[-12,-163],[-105,-121],[-12,-43]],[[4029,7410],[-265,-46],[-17,22],[-70,-16],[32,107],[-70,192],[-37,195],[96,77],[184,-9],[289,-120],[182,-221],[-324,-181]],[[3038,8155],[-588,-303],[-103,-26]]],"transform":{"scale":[0.00003835832802526496,0.000027440081208119336],"translate":[14.183604363075489,35.801214911000045]}};
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
