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
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = {"type":"Topology","objects":{"mwi":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Chitipa"},"id":"MW.CT","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Chitipa"},"id":"MW.CT","arcs":[[-2,3,4]]},{"type":"Polygon","properties":{"name":"Kasungu"},"id":"MW.KS","arcs":[[5,6,7,8,9,10,11]]},{"type":"Polygon","properties":{"name":"Mzimba"},"id":"MW.MZ","arcs":[[12,13,-12,14,15]]},{"type":"Polygon","properties":{"name":"Nkhata Bay"},"id":"MW.NA","arcs":[[16,17,-13,18]]},{"type":"Polygon","properties":{"name":"Nkhotakota"},"id":"MW.NK","arcs":[[19,20,21,-6,-14,-18]]},{"type":"Polygon","properties":{"name":"Rumphi"},"id":"MW.RU","arcs":[[22,-19,-16,23,-4,-1]]},{"type":"Polygon","properties":{"name":"Machinga"},"id":"MW.MA","arcs":[[24,25,26,27]]},{"type":"Polygon","properties":{"name":"Dedza"},"id":"MW.DE","arcs":[[28,29,30,31,32]]},{"type":"Polygon","properties":{"name":"Dowa"},"id":"MW.DO","arcs":[[33,34,-8,35]]},{"type":"Polygon","properties":{"name":"Lilongwe"},"id":"MW.LI","arcs":[[36,-32,37,38,-9,-35]]},{"type":"Polygon","properties":{"name":"Mangochi"},"id":"MW.MG","arcs":[[-27,39,40,-29,41,42]]},{"type":"Polygon","properties":{"name":"Mchinji"},"id":"MW.MC","arcs":[[-39,43,-10]]},{"type":"Polygon","properties":{"name":"Ntcheu"},"id":"MW.NU","arcs":[[44,45,46,-30,-41]]},{"type":"Polygon","properties":{"name":"Ntchisi"},"id":"MW.NI","arcs":[[47,-36,-7,-22]]},{"type":"Polygon","properties":{"name":"Salima"},"id":"MW.SA","arcs":[[-42,-33,-37,-34,-48,-21,48]]},{"type":"Polygon","properties":{"name":"Balaka"},"id":"MW.BA","arcs":[[-26,49,50,-45,-40]]},{"type":"Polygon","properties":{"name":"Chikwawa"},"id":"MW.CK","arcs":[[51,52,53,54,55]]},{"type":"Polygon","properties":{"name":"Chiradzulu"},"id":"MW.CR","arcs":[[56,57,58,59]]},{"type":"Polygon","properties":{"name":"Thyolo"},"id":"MW.TH","arcs":[[60,61,62,-53,63,-58]]},{"type":"Polygon","properties":{"name":"Nsanje"},"id":"MW.NS","arcs":[[64,-54,-63]]},{"type":"Polygon","properties":{"name":"Zomba"},"id":"MW.ZO","arcs":[[65,66,67,-60,68,69,-50,-25]]},{"type":"Polygon","properties":{"name":"Blantyre"},"id":"MW.BL","arcs":[[-59,-64,-52,70,71,-69]]},{"type":"Polygon","properties":{"name":"Mwanza"},"id":"MW.MW","arcs":[[-71,-56,72,73]]},{"type":"Polygon","properties":{"name":"Mulanje"},"id":"MW.MJ","arcs":[[74,-61,-57,-68,75]]},{"type":"Polygon","properties":{"name":"Phalombe"},"id":"MW.PH","arcs":[[-76,-67,76]]},{"type":"MultiPolygon","properties":{"name":"Likoma"},"id":"MW.NA","arcs":[[[77]],[[78]]]},{"type":"Polygon","properties":{"name":"Neno"},"id":"MW.MW","arcs":[[-51,-70,-72,-74,79,-46]]}]}},"arcs":[[[6039,8450],[-13,-1],[-1333,-2],[-41,2],[-67,9],[-28,1],[-30,-3],[-38,-6],[-21,0],[-66,17],[-437,151]],[[3965,8618],[-704,454],[-35,30],[-24,12],[-22,3],[-111,-4],[-70,0],[-29,4],[-39,9],[-105,37],[-25,6],[-12,1],[-42,2],[-33,3],[-33,7],[-23,10],[-25,15],[-16,8],[-20,6],[-23,5],[-37,11],[-14,9],[-6,11],[2,16],[5,4],[13,4],[79,10],[149,39],[16,6],[18,11],[11,5],[40,3],[24,3],[42,15],[20,11],[21,13],[28,25],[11,7],[32,10],[39,17],[20,7],[19,5],[23,3],[52,4],[12,7],[2,14],[-20,22],[-7,13],[-4,25],[-13,12],[-21,15],[-9,11],[-2,10],[9,22],[2,14],[-13,11],[-13,6],[-59,46]],[[3045,9703],[1,0],[79,4],[81,19],[99,11],[85,-21],[78,-33],[80,-22],[73,-12],[87,-22],[74,-26],[34,-25],[36,-11],[51,23],[0,8],[45,13],[26,13],[11,17],[2,23],[22,39],[5,23],[-57,57],[46,33],[73,25],[37,17],[50,19],[107,-16],[96,-26],[4,-1],[29,-15],[43,-10],[105,-52],[23,-6],[53,-24],[90,-17],[300,-131],[92,-14],[19,-17],[8,-23],[15,-24],[18,-11],[69,-29],[14,-3],[55,-22],[4,-6],[308,-157],[35,-27],[93,-54],[36,-44],[4,-14],[-6,-15],[-28,-25],[-6,-13],[23,-44],[103,-95],[29,-69],[26,-28],[7,-16],[-1,-14],[-63,-140],[14,-28],[59,-41],[13,-24],[-6,-12],[-29,-29],[-6,-17],[2,-7],[3,-10],[14,-18],[20,-17],[25,-14],[26,-5],[27,0],[10,-1]],[[3965,8618],[-760,-141],[-87,-15]],[[3118,8462],[-1,5],[-3,13],[-22,23],[0,34],[-84,4],[-48,23],[-60,58],[-24,11],[-86,32],[-26,15],[-81,79],[-11,31],[19,72],[-7,41],[-44,21],[-61,18],[-58,31],[-80,11],[-56,19],[-50,23],[-65,23],[-252,46],[-41,24],[2,33],[16,33],[58,61],[92,58],[22,28],[-20,36],[-49,50],[-20,10],[-114,18],[-37,8],[-37,14],[-27,15],[-45,35],[-33,15],[-78,20],[-29,18],[-8,19],[10,13],[16,10],[8,14],[-4,19],[-14,18],[-44,32],[-62,18],[-166,4],[-72,14],[-18,-34],[-10,-38],[-27,-23],[-68,10],[-17,12],[-7,16],[-12,13],[-34,7],[-42,-4],[-34,-10],[-34,-6],[-41,5],[-37,35],[54,93],[-1,35],[-27,6],[-45,17],[-21,5],[-36,0],[-20,-7],[-19,-2],[-30,10],[-15,17],[-6,76],[47,21],[59,12],[60,1],[54,-13],[154,-64],[190,-61],[28,-4],[83,-8],[91,-15],[11,-2],[28,4],[43,14],[20,4],[43,0],[64,-8],[37,-1],[27,3],[49,14],[27,2],[55,-8],[174,-51],[57,-22],[53,-48],[37,-24],[47,-14],[60,-8],[128,-4],[96,10],[73,18],[75,13],[104,-5],[94,-12],[82,-6]],[[3615,5707],[-42,-102],[-3,-40],[9,-13],[13,-14],[16,-7],[21,-3],[27,-1],[174,9],[25,0],[28,-2],[29,-4],[38,-9],[27,-14],[32,-22],[102,-49],[16,-17],[3,-7],[-5,-4],[-31,-6],[-121,-41],[-10,-5],[-13,-9],[-23,-23],[-8,-5],[-39,-16]],[[3880,5303],[-224,-45],[-24,-8],[-30,-13],[-6,-10],[-16,-14],[-20,-7],[-29,-7],[-46,-7],[-41,-14],[-19,-9],[-39,-29],[-62,-30],[-34,-11],[-30,-7],[-22,-4],[-11,-6],[-7,-10],[-11,-5],[-15,-3],[-52,-4],[-52,-8],[-46,-11],[-49,-8],[-47,-2]],[[2948,5031],[-48,-20],[-27,-28],[-12,-9],[-12,-7],[-28,-8],[-44,-10],[-14,-5],[-34,-26],[-25,-7],[-22,-14],[-20,-5],[-19,-3],[-19,0],[-18,2],[-15,2],[-10,1],[-10,3],[-23,8],[-10,4],[-15,4],[-17,3],[-28,0],[-15,-4],[-8,-6],[0,-7],[5,-6],[7,-6],[17,-11],[7,-6],[5,-6],[1,-7],[-3,-8],[-24,-29],[-11,-8],[-38,-25],[-22,-29],[-57,-45]],[[2342,4713],[-26,-14],[-17,-3],[-29,-3],[-20,-5],[-27,-28],[-4,-9],[6,-7],[8,-5],[6,-9],[1,-12],[-6,-21],[-9,-11],[-12,-7],[-91,-31],[-55,-26]],[[2067,4522],[-124,58],[-85,20],[-32,12],[-43,21],[-110,42],[-37,19],[-27,22],[-33,36],[-51,43],[-15,17],[-3,15],[14,27],[-1,13],[-15,19],[-18,9],[-18,4],[-679,-18],[-43,-2]],[[747,4879],[44,73],[56,51],[77,39],[93,12],[16,18],[-9,14],[-50,30],[-24,22],[-13,22],[-3,22],[48,143],[84,78],[15,36],[-27,32],[-75,28],[-84,22],[-20,14],[-18,94],[11,23],[41,35],[112,68],[94,77],[33,17],[44,16],[25,5],[21,-2],[17,-7],[13,-10],[21,-9],[27,5],[28,10],[25,6],[49,5],[23,1],[29,-3],[22,-9],[37,-28],[13,-7],[31,1],[15,6],[10,9],[19,7],[15,5],[14,4],[19,5],[31,4],[43,12],[51,45],[36,16],[25,5],[82,5],[38,-1],[30,-6],[26,-7],[25,-3],[68,6],[70,18],[64,27],[48,29],[35,13],[94,16],[27,15],[2,32],[14,10],[47,3],[23,21],[80,20]],[[2624,6139],[46,-4],[138,-12],[20,-7],[17,-9],[-2,-8],[-4,-7],[-8,-7],[-9,-5],[-31,-14],[-9,-5],[-8,-6],[-6,-7],[-8,-16],[2,-69],[5,-14],[7,-9],[40,-20],[22,-16],[7,-11],[1,-9],[-6,-6],[-10,-5],[-12,-4],[-13,-10],[-9,-16],[-2,-37],[11,-14],[14,-6],[37,2],[20,-1],[20,-1],[17,-3],[13,-3],[20,-10],[54,-32],[34,-16],[16,-6],[16,-4],[15,-3],[35,-4],[41,-3],[42,-1],[19,0],[17,2],[32,4],[13,3],[25,7],[11,5],[12,3],[15,2],[36,0],[15,2],[23,-3],[26,-6],[67,-24],[19,-5],[14,0],[12,3],[11,4],[25,6],[26,3]],[[4298,7812],[-32,-92],[-75,-103],[-5,-23],[8,-15],[46,-11],[21,-6],[17,-10],[71,-117],[13,-7],[42,-20],[37,-48],[-2,-22],[-13,-11],[-27,-5],[-56,-6],[-43,-9],[-12,-2],[-15,2],[-32,6],[-18,2],[-15,1],[-48,-1],[-32,-9],[-30,-16],[-35,-35],[-24,-18],[-25,-14],[-26,-6],[-29,-4],[-25,0],[-22,1],[-122,14],[-17,1],[-24,0],[-24,-3],[-24,-6],[-66,-26],[-19,-5],[-18,-3],[-30,-8],[-34,-11],[-45,-21],[-22,-14],[-15,-15],[-35,-70],[-8,-27],[-1,-15],[3,-14],[6,-13],[14,-13],[18,-11],[37,-12],[9,-4],[8,-6],[4,-9],[7,-8],[13,-8],[43,-15],[12,-11],[0,-22],[-20,-23],[-13,-26],[-28,-18],[-7,-11],[-2,-13],[18,-30],[6,-19],[-1,-26],[4,-18],[12,-16],[13,-12],[8,-15],[-11,-12],[-64,-35],[-23,-10],[-31,-7],[-34,-3],[-33,-1],[-32,-5],[-29,-8],[-30,-15],[-31,-21],[-8,-12],[4,-11],[19,-7],[24,-5],[52,-7],[18,-5],[15,-7],[13,-10],[17,-7],[21,-5],[25,-3],[185,1]],[[3639,6437],[-200,-68],[-53,-36],[-1,-11],[12,-36],[13,-15],[25,-11],[35,-6],[98,-3],[44,-11],[41,-17],[46,-39],[31,-19],[58,-27],[9,-19],[7,-29],[15,-19],[21,-15],[24,-13],[27,-13],[30,-6],[81,1],[40,-3],[112,-23],[36,-5],[39,-4],[38,-2],[38,2],[71,7],[29,0],[31,-6],[10,-6],[2,-5],[-4,-3],[-6,-3],[-46,-18],[-27,-12],[-22,-29],[-10,-10],[-16,-7],[-17,-4],[-57,-3],[-66,-6],[-27,-4],[-26,-6],[-48,-17],[-33,-8],[-103,-15],[-90,-6],[-25,-4],[-22,-6],[-18,-7],[-17,-8],[-83,-58],[-70,-39]],[[2624,6139],[13,4],[28,20],[-5,27],[-35,5],[-52,0],[-120,17],[-228,-28],[-108,15],[-60,38],[-54,90],[-39,42],[-36,18],[-86,34],[-24,21],[-4,44],[11,42],[121,118],[29,66],[18,21],[10,20],[-12,18],[-34,28],[-1,21],[41,49],[11,47],[-28,165],[-8,44],[-18,21],[-41,20],[-51,3],[-54,-2],[-51,0],[-52,8],[-10,10],[45,40],[20,24],[4,16],[-15,109],[29,19],[79,-27],[26,18],[1,16],[-7,17],[6,18],[14,7],[47,8],[17,6],[4,8],[-11,15],[5,8],[217,137],[42,37],[27,38],[-99,72],[-69,28],[-57,32],[-44,36],[-30,39],[-10,38]],[[1936,7944],[59,-10],[143,-24],[113,-8],[104,-1],[26,-5],[17,-8],[12,-22],[9,-23],[-1,-12],[-6,-13],[-10,-9],[-10,-11],[-3,-11],[11,-13],[24,-3],[28,4],[62,18],[54,19],[47,20],[17,10],[39,27],[17,9],[22,7],[41,3],[32,-4],[30,-9],[32,-13],[32,-10],[42,-9],[37,-3],[34,0],[117,7],[27,-2],[19,-5],[25,-22],[16,-9],[29,-7],[28,-1],[24,1],[25,4],[21,6],[19,9],[10,10],[3,7],[-5,6],[-8,5],[-10,8],[-6,8],[6,8],[16,4],[113,12],[94,5],[291,-17],[44,2],[26,8],[21,56],[7,9],[11,6],[22,-3],[198,-65],[44,-21],[39,-23],[42,-34]],[[6030,7956],[-61,-33],[-16,-32],[14,-27],[41,-53],[9,-31],[23,-23],[147,-52],[16,-13],[10,-11],[15,-8],[55,-6],[25,-7],[19,-10],[8,-11],[10,-30],[27,-25],[40,-19],[49,-11],[0,-8],[-18,-5],[-27,-8],[-18,-4],[68,-53],[20,-9],[20,0],[39,15],[23,3],[26,-1],[133,-19],[74,-16],[58,-22],[23,-26],[14,-10],[57,-20],[27,-34],[29,-14],[29,-10],[13,-10],[7,-7],[14,-12],[16,-15],[7,-19],[0,-67],[5,-11],[-967,5],[-106,-11],[-30,-17],[0,-23],[21,-56],[-6,-52],[-23,-51],[-126,-127],[-235,-146],[-332,-206],[-65,-65],[-15,-58],[5,-7]],[[5221,6358],[-1,0],[-1008,0],[-226,22],[-125,23],[-42,11],[-66,24],[-30,4],[-27,1],[-57,-6]],[[4298,7812],[427,103],[124,41],[1166,0],[14,0],[1,0]],[[5221,6358],[76,-111],[182,-263],[170,-248],[41,-145],[50,-181],[43,-154],[36,-129],[-20,-109],[7,-105],[102,-94],[4,-3],[10,-4]],[[5922,4812],[-787,0],[-267,-63],[-127,-22],[-75,-6],[-37,-2],[-93,-18]],[[4536,4701],[-27,171],[-63,99],[3,20],[13,17],[12,11],[3,11],[-26,67],[-9,13],[-17,10],[-34,3],[-29,0],[-26,1],[-18,7],[-12,12],[-1,13],[6,11],[7,11],[5,10],[-7,7],[-15,0],[-130,-16],[-12,-3],[-7,-5],[-21,-33],[-11,-11],[-14,-7],[-22,-7],[-24,-2],[-23,3],[-29,8],[-20,8],[-17,9],[3,21],[-3,13],[-34,24],[-17,10],[-15,8],[-22,25],[-3,63]],[[6039,8450],[11,-1],[9,-15],[-3,-25],[9,-8],[66,-32],[29,-26],[3,-28],[-41,-27],[19,-12],[6,-6],[13,-7],[20,-6],[19,-9],[7,-17],[-37,-12],[-19,-11],[12,-33],[-40,-81],[0,-57],[-7,-14],[-56,-52],[-29,-15]],[[1936,7944],[-9,39],[-23,40],[-45,16],[-42,-2],[-39,0],[-24,7],[2,18],[28,23],[28,4],[33,-4],[37,0],[46,11],[58,37],[37,13],[42,6],[78,6],[43,7],[42,3],[102,-8],[48,-1],[40,8],[56,23],[47,3],[63,16],[34,23],[51,51],[150,70],[41,11],[39,8],[121,36],[48,18],[51,31],[-1,5]],[[9642,2481],[-1,0],[-795,6],[-8,-3],[-12,-3],[-7,-3],[-30,-11],[-32,-8],[-39,-7],[-66,-8],[-41,-2],[-34,0],[-57,7],[-158,26],[-61,6],[-36,-1],[-34,-5],[-20,-6],[-59,-24],[-31,-8],[-28,0],[-39,3],[-50,7],[-52,4],[-31,-2],[-25,-7],[-26,-11],[-37,-11],[-30,1],[-23,6],[-12,9],[-26,21]],[[7742,2457],[25,9],[24,22],[10,26],[45,49],[19,34],[54,45],[7,13],[4,20],[9,11],[19,16],[94,59],[46,13],[33,12],[20,28],[31,104],[-7,61],[-35,55],[-73,32],[-9,3]],[[8058,3069],[4,10],[-2,3],[-14,16],[-3,7],[-1,6],[2,8],[11,11],[16,11],[6,5],[5,14],[6,5],[9,2],[21,-1],[15,-2],[16,-3],[19,-6],[52,-19],[33,-15],[33,-22],[19,-6],[23,-4],[33,-3],[160,-22],[44,-4],[48,4],[45,9],[81,35],[46,10],[33,5],[30,7],[34,17],[13,17],[4,18],[-15,44],[1,8],[8,7],[47,21],[43,11],[66,11],[153,15],[75,4],[92,1],[69,10],[86,29],[1,0]],[[9525,3343],[112,-58],[150,-62],[36,-19],[18,-22],[31,-269],[21,-12],[40,-2],[66,0],[-116,-111],[-85,-81],[-149,-143],[-21,-32],[1,-30],[13,-21]],[[6395,3942],[38,-236],[-1,-54]],[[6432,3652],[-249,-62],[-232,-71],[-176,-30],[-48,-4],[-32,1],[-36,13],[-51,10],[-23,6],[-17,5],[-22,4],[-26,3],[-47,2],[-73,6],[-17,-1],[-14,-1],[-33,-10],[0,-1],[-38,-12]],[[5298,3510],[-26,15],[-87,19],[-27,-2],[-23,-6],[-22,-8],[-24,-6],[-24,-2],[-50,2],[-23,-1],[-305,-45],[-225,-2],[-99,-17],[-23,-13],[-35,-33],[-24,-6],[-325,17],[-90,0],[-85,-8],[-179,-45],[-88,-13],[-87,4],[-166,52],[-65,-9],[-47,-29],[-26,-37],[0,-45],[-10,-23],[-31,-9],[-54,7],[-36,13],[-27,18],[-18,21]],[[2947,3319],[53,11],[28,17],[31,8],[27,11],[69,43],[10,14],[9,56],[9,20],[16,19],[22,15],[28,12],[40,10],[213,42],[35,11],[37,15],[66,20],[37,4],[55,-2],[30,4],[74,12],[29,2],[29,0],[25,5],[25,11],[16,21],[14,60],[14,18],[24,13],[44,10],[118,6],[33,7],[37,13],[38,16],[35,20],[47,15],[48,19],[31,37],[19,15],[26,17],[46,20],[39,23],[44,18],[29,16],[84,65],[12,16],[14,12],[16,9],[37,8],[79,23],[56,22],[55,37]],[[4999,4235],[135,-78],[191,-75],[43,-21],[103,-76],[98,-59],[49,-21],[37,-9],[14,2],[16,5],[65,29],[19,6],[17,5],[13,3],[21,3],[575,-7]],[[4484,4682],[47,-95],[-1,-15],[-7,-21],[-16,-10],[-12,-9],[4,-4],[38,-10],[20,-6],[139,-56],[25,-8],[26,-7],[24,-2],[26,0],[30,2],[109,24],[21,3],[18,0],[21,-7],[9,-13],[0,-14],[-3,-12],[0,-8],[9,-11],[17,-7],[29,-6],[12,-6],[5,-5],[-4,-8],[-6,-7],[-8,-5],[-16,-5],[-15,-3],[-44,-6],[-30,-3],[-20,-3],[-12,-3],[-6,-3],[-3,-1],[-13,-6]],[[4897,4326],[-86,-19],[-31,0],[-112,5],[-40,-3],[-35,-6],[-37,-9],[-56,-10],[-64,-6],[-159,-7],[-46,10],[-27,10],[-16,10],[-10,5],[-25,9],[-38,10],[-20,3],[-62,7],[-91,15],[-75,7],[-48,1],[-41,0],[-149,-9],[-108,-1],[-56,7],[-36,13],[-14,16],[-11,31],[-20,28],[-6,12],[-3,13],[-8,11],[-16,3],[-28,-1],[-487,-56],[-182,1],[-144,30],[-31,19],[-11,18],[-6,18],[-51,95],[0,20],[19,46],[0,10],[-14,9],[-15,6],[-59,16]],[[2948,5031],[25,-46],[15,-5],[23,-8],[36,-8],[44,-13],[81,-34],[44,-25],[36,-27],[67,-71],[9,-17],[8,-58],[10,-23],[17,-10],[16,-5],[22,-1],[160,-1],[168,24],[35,3],[48,-1],[49,-4],[77,-12],[44,-3],[87,3],[48,-1],[176,-27],[31,-2],[25,0],[21,2],[86,15],[28,6]],[[4897,4326],[-7,-35],[-34,-14],[-85,-15],[-42,-12],[-20,-9],[-13,-9],[-2,-9],[5,-8],[16,-6],[26,-1],[33,5],[106,22],[25,3],[24,2],[38,0],[32,-5]],[[2947,3319],[-44,48],[-26,17],[-36,11],[-83,16],[-35,11],[-26,17],[-16,16],[-20,15],[-41,15],[-130,24],[-40,13],[-56,30],[-156,129],[-55,31],[-43,34]],[[2140,3746],[8,23],[-36,65],[-47,52],[-6,18],[5,16],[24,29],[6,20],[-21,40],[-1,11],[3,9],[11,10],[6,17],[-6,16],[-14,13],[-61,39],[-48,48],[-12,9],[-20,10],[-23,7],[-27,11],[-27,15],[-31,24],[-4,12],[5,8],[20,10],[8,8],[7,11],[4,32],[5,10],[8,6],[19,11],[10,7],[9,8],[5,15],[-2,10],[-7,10],[0,7],[6,6],[8,6],[42,19],[7,6],[10,15],[14,13],[19,10],[11,5],[20,11],[20,18]],[[8058,3069],[-849,0],[-30,0]],[[7179,3069],[-104,31],[-94,17],[-40,16],[-358,194],[-86,104],[-44,90],[-21,131]],[[6395,3942],[394,725]],[[6789,4667],[94,-24],[315,-118],[271,-101],[268,-130],[332,-162],[282,-137],[264,-129],[207,-162],[267,-137],[324,-167],[112,-57]],[[2140,3746],[-8,6],[-22,9],[-28,4],[-44,12],[-26,12],[-77,52],[-13,23],[15,64],[-34,37],[-69,22],[-170,38],[-52,26],[-96,74],[-44,15],[-31,-7],[-30,-33],[-28,-11],[-107,-13],[-43,-9],[-42,-20],[-96,-64],[-57,-5],[-72,38],[-16,19],[11,65],[6,8],[-1,7],[-18,11],[-25,5],[-56,-1],[-25,8],[-19,20],[-7,20],[-12,19],[-154,77],[-45,17],[-94,14],[-114,9],[-89,16],[-18,35],[33,15],[114,22],[26,14],[-17,15],[-117,67],[-82,15],[-113,1],[-98,9],[-36,41],[13,26],[30,10],[44,-1],[58,-8],[39,2],[83,29],[41,11],[114,7],[40,11],[14,30],[-2,23],[7,20],[25,14],[57,4],[88,19],[55,50],[41,68]],[[7179,3069],[-16,-16],[7,-19],[13,-22],[1,-12],[-6,-17],[-52,-74],[-13,-11],[-158,-88],[-9,-9],[-3,-6],[9,-12],[2,-9],[0,-11],[-229,-414]],[[6725,2349],[-35,-16],[-14,0],[-20,2],[-7,4],[-1,6],[8,14],[1,7],[-3,13],[-7,14],[-15,18],[-24,11],[-26,9],[-37,7],[-46,5],[-122,10],[-44,6],[-25,3],[-23,0],[-51,-3],[-14,0],[-183,23],[-146,12],[-42,1]],[[5849,2495],[-33,99],[7,22],[28,14],[-8,15],[-19,16],[-7,18],[18,18],[63,36],[22,19],[6,22],[-22,19],[-34,20],[-28,20],[-18,26],[-7,21],[-1,96],[-17,40],[-34,38],[-51,42],[-30,44],[42,77],[-4,43],[-50,41],[-161,64],[-71,36],[-101,85],[-41,24]],[[4536,4701],[-52,-19]],[[5922,4812],[52,-21],[36,-20],[63,-46],[15,-14],[3,-8],[9,-5],[33,-7],[50,-4],[395,2],[105,-6],[104,-16],[2,0]],[[7742,2457],[-141,-54],[-60,-40],[-39,-15],[-124,-13]],[[7378,2335],[-653,14]],[[6437,1706],[312,-12],[39,-3],[13,-5],[6,-5],[16,-17],[8,-7],[5,-7],[0,-8],[-12,-11],[-34,-26],[-10,-13],[5,-25],[-4,-11],[-46,-36],[-2,-15],[15,-5],[29,-1],[31,2],[33,-3],[12,-7],[-2,-7],[-23,-12],[-4,-8],[1,-11],[13,-20],[8,-7],[10,-3],[19,7]],[[6875,1430],[176,-116],[412,-191],[5,-9],[1,-13],[-4,-10],[41,-54]],[[7506,1037],[-101,-190],[-9,-9],[-10,-5],[-23,-5],[-59,-23],[-167,-76],[-19,-13],[-16,-22],[3,-14],[6,-10],[-2,-8],[-16,-6],[-38,-7],[-55,-14],[-52,-20],[-67,-41],[-22,-14]],[[6859,560],[-28,9],[-54,9],[-47,11],[-31,20],[-22,28],[-25,18],[-143,49],[-31,17],[-56,43],[-40,18],[-195,42],[-23,3],[-19,6],[-38,38],[-17,12],[-20,9],[-100,31],[-39,15],[-33,20],[-86,89],[-69,29],[-137,8],[-106,2],[-60,25],[-128,113],[13,43],[61,84],[-14,36],[-52,29],[-257,110],[-45,11],[-103,20],[-38,13],[-34,36],[-5,46],[15,45],[33,33],[88,38],[55,17],[52,10],[64,8],[33,8],[2,1]],[[5180,1812],[44,-8],[435,-75],[122,-16],[656,-7]],[[8260,1872],[-59,-73],[-3,-47],[44,-214],[-3,-19],[-16,-14],[-15,-6],[-41,-42]],[[8167,1457],[-63,15],[-36,15],[-24,13],[-14,11],[-16,28],[-18,18],[-19,12],[-109,41],[-23,11],[-20,13],[-21,5],[-29,4],[-115,0]],[[7660,1643],[-68,54],[-20,23],[-4,25],[7,125],[-8,37],[-13,25],[-20,9],[-4,18],[3,15],[115,87]],[[7648,2061],[43,3],[21,-3],[21,4],[20,6],[35,8],[17,-2],[6,-8],[-6,-19],[3,-12],[22,-14],[31,-9],[49,-8],[29,-9],[21,-12],[24,-28],[21,-18],[44,-26],[37,-13],[34,-9],[140,-20]],[[8167,1457],[37,-118],[-12,-37],[-26,-11],[-17,-6],[-19,-9],[-20,-12],[-22,-23],[-6,-14],[5,-11],[11,-6],[33,-15],[1,0]],[[8132,1195],[-68,-33],[-57,-48],[-21,-60],[7,-13],[37,-37],[-12,-13],[-72,-35],[-5,-7]],[[7941,949],[-1,1],[-144,18],[-52,-5],[-12,-8],[-31,2],[-24,4],[-171,76]],[[6875,1430],[84,9],[24,7],[77,28],[30,15],[59,43],[21,11],[21,9],[17,3],[19,2],[59,2],[44,3],[330,81]],[[7941,949],[-12,-17],[1,-51],[-17,-23],[-42,-18],[-216,-58],[-39,-11],[51,-58],[49,-31],[13,-14],[18,-11],[34,-4],[29,-2],[67,-11],[20,-4],[14,-6],[16,-13],[12,-7],[10,-3],[26,-5],[8,-2],[75,-33],[9,-7],[9,-85],[13,-25],[62,-51],[15,-32],[-77,-26],[-7,-27],[7,-49],[-10,-6],[-19,-6],[-15,-7],[1,-8],[15,-6],[99,-24],[19,-11],[-16,-16],[-33,-24],[-3,-21],[27,-48],[4,-26],[-8,-22],[-17,-18],[-23,-14],[-1,0],[-176,-8],[-311,4],[-162,11],[-47,18],[9,33],[-100,62],[24,40],[67,23],[78,15],[68,20],[36,35],[9,42],[-2,46],[-28,40],[-69,21],[-102,1],[-92,-3],[-88,6],[-91,29],[-57,30],[-26,12],[-42,12],[-21,3],[-47,4],[-21,5],[-14,9],[-10,25],[-13,11],[-22,6]],[[9642,2481],[72,-121],[88,-144],[-9,-53],[0,-2]],[[9793,2161],[-1,0],[-352,-5],[-116,-15],[-76,-13],[-44,-20],[-73,-28],[-162,-43],[-37,-7],[-33,-9],[-26,-10],[-39,-40]],[[8834,1971],[-75,-22],[-23,-8],[-92,-43],[-23,-3],[-39,-3],[-129,-2],[-40,-3],[-41,-8],[-27,-4],[-85,-3]],[[7648,2061],[-39,-1],[-18,1],[-19,4],[-14,6],[-3,10],[6,8],[11,8],[64,30],[7,8],[-4,5],[-20,2],[-54,0],[-26,2],[-29,9],[-29,14],[-103,61],[-70,25],[-65,48]],[[7243,2301],[135,34]],[[6437,1706],[-19,96],[-22,29],[0,16],[47,11],[19,9],[16,10],[7,9],[-7,80]],[[6478,1966],[7,22],[36,15],[151,39],[52,8],[47,30],[113,134],[51,30],[29,5],[86,30],[31,4],[97,5],[56,11],[9,2]],[[5180,1812],[190,107],[37,41],[10,52]],[[5417,2012],[365,-16],[364,-16],[332,-14]],[[9667,1550],[-22,-33],[2,-20],[17,-39],[-3,-21],[-30,-27],[-46,-22],[-224,-63],[-32,-6],[-29,-1],[-58,4],[-32,-1],[-294,-35],[-75,-3],[-15,-8],[-9,-20],[-20,-12],[-39,1],[-41,8],[-27,10],[-22,21],[-51,14],[-63,7],[-61,2],[-70,-8],[-58,-16],[-215,-79],[-18,-8]],[[8834,1971],[23,-11],[2,-2],[2,-2],[-7,-7],[-9,-13],[-3,-2],[-2,-1],[-4,-3],[-3,-2],[-2,-1],[-2,-1],[-6,0],[-2,-1],[-16,-12],[-5,-3],[-4,-3],[-2,-1],[-3,-1],[-6,-4],[-35,-24],[-6,-8],[-2,-6],[2,-2],[3,0],[3,0],[2,0],[10,0],[3,-1],[3,0],[10,-1],[2,-1],[3,0],[7,-2],[2,-1],[2,-1],[2,-1],[20,-119],[12,-24],[17,-21],[5,-4],[5,-2],[5,-1],[7,-2],[3,-1],[2,-1],[3,0],[3,-1],[2,-1],[2,0],[2,0],[2,0],[3,0],[7,-4],[4,-1],[2,-2],[2,-1],[4,-2],[3,-3],[3,-1],[2,0],[3,0],[5,-1],[1,0],[2,0],[6,1],[5,0],[2,0],[3,0],[4,0],[4,-2],[6,-5],[90,-100],[15,-8],[122,44],[78,11],[13,-2],[36,-10],[46,-19],[55,-17],[21,-5],[26,-9],[6,-1],[10,-2],[14,-1],[4,0],[4,0],[4,1],[4,1],[3,1],[3,2],[4,1],[4,1],[9,1],[3,1],[3,0],[5,1],[3,0],[15,3],[3,2],[3,1],[4,1],[7,1],[10,2],[6,0],[4,0],[8,0],[3,0],[4,1],[5,0],[6,0],[15,-4],[4,-1],[4,0],[7,0],[4,-1],[5,-1],[2,0],[3,0],[2,0],[1,0]],[[9793,2161],[-17,-102],[-28,-161],[-19,-114],[-31,-186],[-31,-48]],[[6319,6466],[-69,-5],[-62,9],[-40,27],[-1,27],[21,30],[57,56],[40,12],[67,-2],[70,-10],[49,-14],[25,-26],[-10,-33],[-34,-32],[-48,-24],[-65,-15]],[[6073,6554],[-64,-25],[-46,0],[-39,17],[-39,23],[-83,38],[-7,22],[62,21],[3,0],[110,10],[90,-22],[42,-39],[-29,-45]],[[5417,2012],[-28,77],[0,44],[39,22],[55,11],[61,40],[62,15],[20,16],[16,33],[14,16],[35,19],[38,10],[40,9],[42,13],[57,33],[12,34],[-31,91]]],"transform":{"scale":[0.0003241314934493438,0.0007754875828582898],"translate":[32.66330814700012,-17.135335387999902]}};
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
