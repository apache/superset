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
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = {"type":"Topology","objects":{"ner":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Tillabéri"},"id":"NE.TL","arcs":[[0,1,2],[3]]},{"type":"Polygon","properties":{"name":"Diffa"},"id":"NE.DF","arcs":[[4,5,6]]},{"type":"Polygon","properties":{"name":"Agadez"},"id":"NE.AG","arcs":[[-7,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Maradi"},"id":"NE.MA","arcs":[[11,12,13,-9]]},{"type":"Polygon","properties":{"name":"Zinder"},"id":"NE.ZI","arcs":[[14,-12,-8,-6]]},{"type":"Polygon","properties":{"name":"Dosso"},"id":"NE.DS","arcs":[[15,-1,16]]},{"type":"Polygon","properties":{"name":"Niamey"},"id":"NE.NI\t","arcs":[[-4]]},{"type":"Polygon","properties":{"name":"Tahoua"},"id":"NE.TH","arcs":[[-14,17,-17,-3,18,-10]]}]}},"arcs":[[[2592,2505],[-11,-100],[-19,-27],[-17,-7],[-6,-4],[-5,-7],[-7,-26],[-9,-11],[-10,-8],[-49,-31],[-5,0],[-17,0],[-8,0],[-7,-3],[-9,-5],[-9,-6],[-87,-97],[-18,-34],[-3,-8],[-4,-13],[-22,-128],[-5,-18],[-12,-20],[-117,-142],[-20,-16],[-106,-59],[-7,-1],[-9,3],[-66,37],[-10,4],[-8,0],[-7,-9],[-11,-26],[-8,-23],[-11,-71],[-3,-13],[-4,-12],[-9,-4],[-11,-1],[-43,0],[-5,-2],[-6,-4],[-4,-10],[-13,-40],[-6,-9],[-9,-5],[-19,-4],[-13,-5],[-2,-5],[-2,-4],[-1,-17],[-4,-20],[-4,-18],[-1,-10],[1,-4],[1,-5],[5,-15],[1,-5],[0,-5],[-6,-39],[-10,-34],[-12,-24],[-4,-6],[-4,-3],[-4,0],[-4,1],[-7,3],[-8,7],[-2,1],[-2,1],[-13,2],[-8,0],[-22,-7],[-55,-56],[-3,-2],[-6,-4],[-7,-2],[-4,-1],[-8,-1],[-7,2],[-15,5],[-4,0],[-4,-1],[-5,-2],[-9,-5],[-6,-7],[-8,-12],[-4,-8],[-2,-6],[-1,-6],[0,-4],[1,-5],[38,-115],[2,-1],[3,-1],[96,-13],[10,-4],[7,-6],[4,-14],[-1,-7],[-2,-4],[-11,-9],[-22,-24],[-3,-3],[-15,-9],[-9,-9],[-9,-10],[-4,-7],[-2,-6],[-1,-4],[-2,-11],[1,-10],[1,-11],[11,-54],[1,-10],[0,-11],[-1,-16],[-4,-19],[0,-22],[3,-58],[2,-16],[3,-10],[0,-23],[2,-9],[25,0],[1,-2],[3,-2],[4,1],[2,7],[1,4],[2,7],[2,5],[3,4],[6,2],[6,-2],[4,-8],[2,-12],[0,-22],[2,-24],[7,-19],[14,-8],[14,-4],[22,-18],[14,-7]],[[1701,595],[-7,-13],[-15,-1],[-7,-1],[-12,0],[-7,-1],[-7,-6],[-10,-16],[-5,-6],[-7,-2],[-7,5],[-7,-3],[-3,-5],[-2,-6],[-1,-7],[-2,-6],[-9,-19],[-6,-4],[-22,8],[-4,-1],[-8,-8],[-4,-2],[-3,0],[-5,4],[-3,1],[-22,-8],[-3,-2],[-6,-8],[-4,-3],[-4,0],[-2,4],[-1,4],[-2,2],[-7,1],[-6,1],[-5,-3],[-3,-10],[-3,-9],[-4,2],[-3,5],[-5,1],[-3,-3],[-5,-10],[-2,-2],[-8,-1],[-14,1],[-9,-2],[-15,-9],[-6,-15],[1,-19],[6,-47],[21,-79],[4,-9],[4,-6],[7,-7],[6,-4],[6,-2],[4,-4],[2,-11],[-1,-14],[-4,-2],[-7,3],[-6,0],[-5,-6],[-5,-13],[-4,-6],[-5,-2],[-6,1],[-6,-2],[-3,-11],[1,-9],[7,-15],[1,-8],[-33,37],[-50,92],[-44,81],[-47,87],[-28,50],[-12,30],[2,24],[9,11],[37,10],[3,2],[4,9],[4,3],[2,-1],[7,-5],[3,0],[38,4],[9,3],[4,9],[-1,19],[0,4],[2,9],[0,3],[-2,7],[-8,11],[-4,7],[-5,13],[-3,11],[-5,51],[-2,10],[-4,12],[-6,9],[-11,10],[-7,7],[-7,9],[-2,4],[-4,17],[-16,25],[-26,9],[-61,7],[-6,-4],[-11,-16],[-7,-6],[-5,1],[-4,3],[-5,-1],[-3,-4],[-4,-12],[-11,-21],[-7,-16],[-7,-15],[-11,-9],[-11,-2],[-80,9],[-65,8],[-21,7],[-18,13],[-43,48],[-35,39],[-52,57],[-16,18],[-47,51],[-37,42],[-36,40],[-20,12],[-45,5],[-18,14],[-6,13],[-1,16],[0,16],[-1,54],[0,79],[0,72],[8,34],[13,-3],[51,-27],[34,-11],[14,-8],[4,2],[7,29],[3,10],[3,4],[12,-4],[10,-12],[12,-8],[17,9],[-12,18],[-9,9],[-11,3],[-27,4],[-11,5],[-69,42],[-21,20],[-12,26],[-3,38],[-26,35],[-34,27],[-29,12],[-24,-3],[-11,1],[-12,8],[-8,9],[0,6],[2,3],[0,3],[0,5],[0,7],[-2,6],[-6,2],[-84,-4],[-17,8],[-9,21],[3,13],[6,17],[4,16],[-4,8],[-13,6],[-7,10],[-6,11],[-21,19],[-10,11],[-3,5],[-5,9],[-5,16],[-5,7],[-13,11],[-4,7],[0,8],[5,16],[0,7],[-7,10],[-11,7],[-10,10],[-5,15],[-2,15],[-6,7],[-8,5],[-6,9],[0,7],[5,14],[1,6],[-3,7],[-4,4],[-4,4],[-3,6],[-8,16],[-3,9],[2,10],[16,31],[3,10],[3,26],[2,8],[6,10],[1,7],[-2,5],[-27,47],[-91,108],[-8,11],[-19,41],[-4,42],[42,156],[-4,26],[-18,49],[1,24],[7,14],[9,9],[6,11],[-2,20],[-3,42],[0,20],[5,9],[84,-27],[21,0],[20,5],[41,19],[20,1],[98,-45],[9,1],[17,5],[18,10],[19,9],[96,4],[17,5],[16,9],[53,65],[41,50],[51,61],[43,52],[17,13],[21,7],[47,2],[61,3],[61,2],[61,3],[61,3],[61,2],[61,3],[61,3],[61,3],[61,2],[61,3],[61,3],[61,2],[61,3],[61,3],[62,2],[61,3],[31,2],[3,11],[0,31],[2,16],[1,8],[5,4],[10,4],[25,0],[75,-17],[119,-26],[65,-14],[4,-2],[11,-3],[6,98],[7,22],[55,44],[49,71],[24,16],[50,13],[24,16],[16,25],[1,6]],[[2352,3405],[5,-12],[141,-522],[-2,-118],[2,-37],[5,-17],[89,-194]],[[1261,1450],[20,3],[4,-12],[3,-15],[5,-13],[13,13],[11,10],[12,33],[8,37],[5,34],[2,26],[-2,22],[-10,8],[-15,-5],[-6,9],[1,26],[-6,3],[-29,-3],[-34,-2],[-30,9],[-25,0],[-22,-12],[-13,-21],[-3,-19],[1,-30],[12,-32],[14,-27],[19,-24],[22,-11],[23,-4],[20,-3]],[[9744,5332],[0,-7],[-3,-39],[-2,-38],[-3,-39],[-2,-38],[-3,-39],[-2,-39],[-3,-38],[-2,-39],[-3,-38],[-2,-39],[-3,-38],[-3,-39],[-2,-39],[-3,-38],[-2,-39],[-3,-38],[-2,-39],[-3,-39],[-2,-38],[-3,-39],[-3,-38],[-2,-39],[-3,-39],[-1,-21],[-2,-10],[-2,-9],[-8,-15],[-22,-30],[-35,-49],[-36,-50],[-35,-49],[-36,-49],[-35,-50],[-36,-49],[-35,-50],[-36,-49],[-35,-49],[-36,-49],[-35,-50],[-35,-49],[-36,-50],[-35,-49],[-36,-49],[-35,-50],[-25,-34],[-37,-51],[-34,-48],[-18,-33],[-19,-35],[-19,-34],[-19,-34],[-19,-35],[-19,-34],[-18,-35],[-19,-34],[-19,-35],[-19,-34],[-19,-35],[-19,-34],[-19,-34],[-19,-35],[-18,-34],[-19,-35],[-19,-34],[-19,-34],[-16,-45],[-21,-58],[-9,-26],[-3,-16],[-1,-18],[2,-18],[9,-36],[1,-17],[-6,-20],[-9,-6],[-12,-2],[-13,-4],[-6,-6],[-20,-29],[-13,-12],[-2,-4],[1,-4],[7,-8],[2,-5],[4,-33],[-1,-16],[-5,-15],[-21,-23],[-10,-3],[-15,-3],[-26,-3],[-23,-13],[-16,-10],[-21,-38],[0,-49],[12,-59],[9,-43],[7,-39],[4,-27],[5,-27],[4,-27],[5,-27],[4,-27],[5,-27],[4,-27],[5,-27],[5,-27],[4,-27],[5,-27],[4,-27],[5,-26],[4,-27],[5,-27],[4,-27],[-156,8],[-1,0],[-18,-4],[-6,-6],[0,-14],[-9,-9],[-25,-31],[-5,-8],[-3,-8],[0,-4],[3,-6],[1,-5],[-2,-6],[-4,-1],[-5,0],[-2,-1],[-6,-12],[1,-4],[9,-2],[-11,-19],[-16,-8],[-17,-4],[-17,-10],[2,7],[2,9],[-2,6],[-6,2],[-3,-4],[-5,-14],[-5,-6],[1,9],[-1,3],[-10,-4],[-12,-1],[-7,3],[3,9],[0,5],[-17,-2],[-16,-8],[-57,-37],[-17,-4],[-18,5],[-3,-14],[-5,-1],[-9,5],[-9,4],[0,-6],[5,-2],[4,-4],[4,-5],[4,-7],[-8,-9],[-18,-25],[0,-3],[1,-7],[-1,-2],[-2,0],[-5,1],[-2,-1],[-2,-2],[-9,-4],[-2,-3],[3,-10],[4,-6],[0,-3],[-9,-1],[-1,3],[-4,6],[-3,3],[-2,-3],[-1,-1],[-4,-14],[-17,-26],[-10,-10],[-14,-5],[-8,-4],[-4,-19],[-6,-5],[-9,3],[-6,5],[-6,8],[-7,7],[0,-14],[-2,-5],[-4,-6],[-4,-4],[-5,-2],[-2,5],[-3,-3],[-23,-29],[-2,-13],[-8,-16],[-5,-12],[11,-5],[-4,-19],[-4,-9],[-5,-7],[-5,-2],[-14,-4],[-3,-3],[-5,-45],[-3,-10],[-9,-6],[-10,3],[-12,6],[-15,3],[-17,1],[-23,1],[-10,4],[-6,-5],[-5,4],[-4,8],[-7,4],[-6,-1],[-3,-4],[-3,-4],[-3,-2],[-5,1],[-1,3],[0,5],[-2,5],[-8,6],[-32,14],[-10,-3],[-13,-12],[-9,-2],[-21,-2],[-37,12],[-13,8],[-29,30],[-88,71],[-70,37],[-191,63],[-308,-2],[-115,18],[-60,-7],[-18,-4]],[[6634,1416],[-2,4],[-20,97],[2,14],[5,20],[109,149],[5,9],[2,6],[2,7],[1,10],[0,23],[-1,17],[0,7],[3,7],[257,309],[13,11],[8,1],[9,-3],[25,-19],[8,-5],[5,0],[8,2],[115,47],[159,134],[8,6],[7,1],[52,-3],[9,1],[8,6],[42,39],[5,8],[-4,6],[-25,12],[-8,5],[-4,8],[-3,9],[-4,13],[-2,11],[2,20],[2,11],[4,10],[6,8],[17,14],[18,12],[11,1],[1,3],[-1,2446]],[[7488,4910],[13,8],[10,13],[128,112],[482,289],[1618,0],[5,0]],[[7488,4910],[-215,-100],[-258,-229],[-186,-72],[-1034,-868],[-222,-110],[-259,-186],[-116,-53],[-38,-5],[-115,3],[-12,-1],[-12,-3],[-50,-34],[-108,-2],[-253,50],[-25,-35],[-51,-187]],[[4534,3078],[-127,88],[-34,4],[-251,-13]],[[4122,3157],[-37,484],[13,137],[0,13],[-3,12],[-10,8],[-98,33],[-4,2],[-9,7],[-43,43],[-4,5],[-4,6],[-11,24],[-1,9],[-139,429],[-3,6],[-55,81],[-142,139],[-338,272],[-13,13],[-14,17],[-84,147],[-110,118],[-8,11],[-5,12],[-14,86],[-4,11],[-8,4],[-67,7],[-11,3],[-10,6],[-7,15],[-3,10],[-2,8],[0,5],[0,10],[3,10],[19,39],[2,10],[-7,101],[1,5],[5,17],[0,5],[1,5],[-1,5],[-1,9],[-4,13],[-3,19],[0,11],[0,5],[1,5],[5,21],[83,220],[-60,23],[-331,5],[-9,0]],[[2578,5878],[-1,2],[0,105],[0,104],[0,105],[-1,104],[120,31],[119,31],[119,30],[119,31],[63,16],[139,35],[138,36],[63,16],[82,21],[28,14],[28,24],[49,57],[40,46],[40,46],[40,46],[40,46],[40,46],[40,45],[39,46],[40,46],[40,46],[40,46],[40,46],[40,46],[40,46],[39,45],[40,46],[40,46],[37,42],[23,27],[49,54],[46,49],[45,49],[45,49],[45,50],[63,68],[82,65],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[44,34],[42,34],[44,34],[43,34],[43,34],[43,33],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,33],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,33],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,33],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[43,34],[56,-17],[56,-16],[56,-17],[56,-17],[55,-16],[56,-17],[56,-17],[56,-16],[56,-17],[55,-17],[56,-16],[56,-17],[56,-16],[55,-17],[56,-17],[56,-16],[64,-20],[74,-51],[36,-39],[79,-87],[79,-87],[79,-87],[79,-88],[29,-31],[9,-6],[10,1],[40,27],[108,73],[108,73],[108,73],[108,73],[1,0],[0,1],[8,-53],[7,-53],[8,-53],[7,-53],[8,-53],[7,-53],[8,-53],[8,-53],[7,-53],[8,-53],[7,-53],[8,-53],[8,-53],[7,-53],[5,-36],[6,-36],[4,-34],[1,-17],[0,-44],[1,-62],[1,-72],[1,-71],[1,-62],[0,-44],[0,-17],[1,-22],[2,-14],[10,-12],[30,-20],[12,-11],[22,-33],[15,-29],[10,-21],[11,-21],[11,-20],[10,-21],[11,-21],[10,-20],[11,-21],[11,-21],[10,-21],[11,-20],[10,-21],[11,-21],[11,-20],[10,-21],[11,-21],[10,-21],[11,-20],[-26,-18],[-15,-33],[-6,-39],[6,-38],[7,-22],[9,-18],[11,-16],[52,-52],[17,-24],[37,-52],[37,-51],[37,-52],[37,-51],[15,-21],[9,-19],[1,-14],[-5,-14],[-13,-30],[-25,-58],[-25,-59],[-26,-58],[-25,-58],[-9,-22],[-20,-67],[-2,-35],[-3,-38],[-2,-39],[-3,-39],[-3,-38],[-2,-39],[-3,-38],[-2,-39],[-3,-39],[-2,-38],[-3,-39],[-2,-38],[-3,-39],[-3,-39],[-2,-38],[-3,-39],[-2,-38],[-3,-39],[-2,-39],[-3,-38],[-2,-39],[-3,-38],[-3,-39],[-2,-38],[-3,-39],[-2,-39],[-3,-38],[-2,-39],[-3,-38],[-2,-39],[-3,-39],[-3,-38],[-2,-39],[-3,-38],[-2,-39],[-3,-38],[-2,-39],[-3,-39],[-2,-38],[-3,-39],[-2,-38],[-3,-32]],[[4534,3078],[40,-31],[9,-29],[3,-118],[3,-16],[25,-57],[7,-27],[21,-139],[3,-11],[6,-11],[11,-17],[7,-11],[13,-54],[9,-13],[11,-10],[54,-39],[9,-8],[5,-8],[3,-12],[3,-105],[1,-11],[4,-12],[8,-8],[31,-20],[10,-3],[8,0],[11,9],[58,67],[9,8],[11,3],[35,-2],[6,-1],[2,-3],[21,-43],[10,-15],[6,-5],[25,-15],[7,-3],[12,-7],[21,-22],[3,-2],[4,-1],[13,-1],[7,-4],[9,-8],[33,-40],[3,-2],[25,-16],[8,-6],[7,-8],[2,-5],[3,-7],[2,-9],[4,-29],[2,-6],[4,-9],[78,-71],[10,-13],[3,-13],[1,-15],[0,-26],[1,-11],[2,-10],[4,-17],[3,-30],[0,-29],[-1,-14],[-3,-12],[-8,-8],[-180,-119],[-4,-4],[-2,-3],[-2,-4],[-2,-5],[-3,-11],[-1,-5],[-1,-10],[1,-11],[2,-8],[5,-14],[9,-9],[11,-8],[21,-12],[10,-7],[6,-9],[0,-12],[-14,-65],[0,-13],[15,-119],[0,-15],[-4,-14],[-38,-93],[-3,-5]],[[5117,1282],[-1,0],[-19,7],[-9,6],[-21,22],[-18,14],[-15,18],[-7,8],[-17,8],[-161,30],[-21,-3],[-22,-12],[-230,-182],[-20,-8],[-22,0],[-66,16],[-14,-4],[-39,-59],[-30,-34],[-13,-9],[-4,-1],[-11,-2],[-47,-1],[-21,3],[-20,10],[-20,20],[-23,28],[-38,56],[-15,38],[-52,124],[-103,148],[-89,110],[-42,32],[-11,3]],[[3876,1668],[-1,14],[0,48],[1,14],[3,14],[8,13],[21,27],[7,14],[0,15],[-8,44],[0,13],[6,10],[9,10],[40,38],[7,7],[7,10],[3,3],[3,1],[3,2],[21,6],[6,3],[9,7],[2,3],[3,15],[6,90],[-1,42],[-3,8],[-4,23],[-3,19],[-2,9],[-19,62],[-4,22],[-1,26],[37,398],[-1,16],[2,16],[89,427]],[[6634,1416],[-307,-87],[-26,-14],[-120,-88],[-11,-15],[-3,-8],[-3,-21],[-3,-9],[-5,-6],[-2,-1],[-3,1],[-7,-3],[-12,-11],[-21,-26],[-109,-168],[-4,-7],[-8,-8],[-6,-6],[-5,-3],[-13,-1],[-134,21],[-12,-1],[-34,-13],[-23,0],[-184,29],[-22,3],[-167,65],[-23,17],[-11,17],[-18,40],[-13,18],[-27,27],[-15,9],[-17,5],[-8,0],[-16,-2],[-7,-3],[-7,-5],[-3,-2],[-2,0],[-6,3],[-5,4],[-63,75],[-16,25],[-8,10],[-8,5]],[[2828,1715],[-76,-24],[-34,-18],[-30,-27],[-99,-125],[-18,-11],[-19,-5],[-41,-2],[-1,-202],[-2,-20],[-20,-181],[-101,-208],[-41,-51],[-138,-137],[-3,-9],[7,-210],[-17,-111],[-1,-37],[16,-62],[3,-29],[-11,-28],[-11,-15],[-7,-12],[-2,-14],[3,-48],[2,-8],[4,-9],[2,-3],[3,-2],[15,-21],[7,-15],[3,-17],[-4,-18],[-8,-10],[-32,-26],[-5,5],[-6,13],[-5,4],[-2,7],[-1,7],[-3,6],[-3,14],[-2,7],[-3,3],[-4,3],[-4,5],[-21,40],[-5,6],[-7,6],[-23,11],[-29,23],[-7,3],[-6,6],[-8,1],[-9,-7],[-8,-5],[-9,3],[-8,7],[-5,7],[-9,14],[-15,32],[-4,15],[-3,19],[-2,18],[-2,5],[-8,8],[-2,5],[-109,130],[-26,50],[-6,16],[-2,4],[-6,2],[-21,3],[-7,4],[-7,5],[-5,7],[-4,19],[-5,10],[-6,9],[-13,9],[-31,36]],[[2592,2505],[43,-35],[14,-21],[48,-128],[6,-34],[26,-286],[2,-10],[60,-128],[36,-148],[1,0]],[[3876,1668],[-34,10],[-13,-4],[-36,-27],[-7,-2],[-4,3],[-4,4],[-6,4],[-179,93],[-179,93],[-20,6],[-93,-21],[-18,-12],[-7,-13],[-11,-31],[-9,-13],[-19,-18],[-7,-4],[-22,-6],[-91,5],[-64,-15],[-36,3],[-15,9],[-14,17],[-14,9],[-21,-3],[-125,-40]],[[2352,3405],[8,24],[5,33],[6,82],[4,16],[10,19],[36,48],[1,3],[0,2],[0,5],[0,1],[0,2],[0,1],[-1,1],[-7,25],[-3,23],[3,23],[56,180],[10,19],[12,17],[15,15],[27,18],[9,11],[5,20],[0,93],[0,73],[-1,113],[0,53],[2,8],[8,17],[3,9],[-4,83],[1,15],[4,15],[5,3],[6,0],[9,8],[0,89],[0,53],[-1,105],[0,104],[0,105],[-1,104],[0,105],[0,105],[0,58],[0,46],[0,105],[-1,104],[0,105],[0,105],[0,102]]],"transform":{"scale":[0.001581896267426743,0.0011822760442044297],"translate":[0.152941121000111,11.695773010000025]}};
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
