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
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = {"type":"Topology","objects":{"nzl":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Manawatu-Wanganui"},"id":"NZ.MW","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Gisborne District"},"id":"NZ.GI","arcs":[[6,7,8]]},{"type":"Polygon","properties":{"name":"Hawke's Bay"},"id":"NZ.HB","arcs":[[9,-1,10,11,-7]]},{"type":"MultiPolygon","properties":{"name":"Auckland"},"id":"NZ.AU","arcs":[[[12]],[[13]],[[14]],[[15,16,17,18]],[[19]]]},{"type":"Polygon","properties":{"name":"Bay of Plenty"},"id":"NZ.BP","arcs":[[-8,-12,20,21]]},{"type":"Polygon","properties":{"name":"Canterbury"},"id":"NZ.CA","arcs":[[22,23,24,25,26]]},{"type":"MultiPolygon","properties":{"name":"Marlborough District"},"id":"NZ.MA","arcs":[[[27]],[[-27,28,29,30]],[[31]]]},{"type":"Polygon","properties":{"name":"Nelson City"},"id":"NZ.NE","arcs":[[32,33,-30]]},{"type":"Polygon","properties":{"name":"Tasman District"},"id":"NZ.TS","arcs":[[-33,-29,-26,34,35]]},{"type":"Polygon","properties":{"name":"Northland"},"id":"NZ.NO","arcs":[[-18,36]]},{"type":"Polygon","properties":{"name":"Taranaki"},"id":"NZ.TK","arcs":[[-5,37,38]]},{"type":"Polygon","properties":{"name":"West Coast"},"id":"NZ.WC","arcs":[[-35,-25,39,40,41]]},{"type":"Polygon","properties":{"name":"Otago"},"id":"NZ.OT","arcs":[[-24,42,43,-40]]},{"type":"MultiPolygon","properties":{"name":"Southland"},"id":"NZ.SO","arcs":[[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[58,-41,-44]]]},{"type":"MultiPolygon","properties":{"name":"Waikato"},"id":"NZ.WK","arcs":[[[59]],[[-21,-11,-6,-39,60,-16,61]]]},{"type":"MultiPolygon","properties":{"name":"Wellington"},"id":"NZ.WG","arcs":[[[62]],[[63,-3]]]},{"type":"MultiPolygon","properties":{"name":"Chatham Islands Territory"},"id":"NZ.CI","arcs":[[[64]],[[65]]]},{"type":"Polygon","properties":{"name":"Kermadec Islands"},"id":"NZ.","arcs":[[66]]},{"type":"MultiPolygon","properties":{"name":"Tokelau"},"id":"NZ.","arcs":[[[67]]]},{"type":"Polygon","properties":{"name":"Three Kings Islands"},"id":"-99","arcs":[[68]]},{"type":"Polygon","properties":{"name":"Antipodes Islands"},"id":"-99","arcs":[[69]]},{"type":"Polygon","properties":{"name":"Campbell Islands"},"id":"-99","arcs":[[70]]},{"type":"MultiPolygon","properties":{"name":"Auckland Islands"},"id":"-99","arcs":[[[71]],[[72]]]},{"type":"Polygon","properties":{"name":"The Snares"},"id":"-99","arcs":[[73]]}]}},"arcs":[[[9918,3054],[0,-11],[0,-8],[2,-3],[1,-5],[0,-4],[0,-2],[0,-2],[-1,-3],[0,-3],[0,-4],[0,-2],[1,-2],[1,-4],[-1,-6],[0,-7],[0,-13],[0,-3],[-1,-1],[-1,-3],[-1,-11],[-1,-2],[0,-2],[0,-2],[0,-3],[0,-4],[1,-5],[0,-5],[0,-2],[-1,-3],[0,-3],[-1,-29],[0,-15],[-1,-18],[0,-1],[0,-3],[1,-4],[0,-1],[2,1],[2,-10],[0,-1],[1,-1],[0,-1],[0,-3],[0,-3],[0,-3],[1,-3],[1,-6],[0,-4],[0,-4],[0,-6],[0,-12],[0,-7],[0,-8],[0,-6],[1,-6],[1,-5],[3,-1],[1,-3],[1,-6]],[[9930,2757],[0,-2],[-1,-5],[0,-1],[-1,2],[-1,-2],[-1,-16],[-2,-10],[0,-3],[0,-3],[0,-2],[0,-3],[-1,-6],[0,-1],[-1,0],[0,-1],[0,-2],[-1,-17],[-1,-7]],[[9920,2678],[-1,3],[0,8],[-3,3],[-4,1],[-5,-4],[-5,-4],[-4,-3],[-1,1],[-1,3],[0,1],[-2,-4],[-4,1],[-3,-4],[-1,0]],[[9886,2680],[1,9],[1,18],[1,15],[0,4],[1,5],[0,12],[0,6],[0,1],[0,1],[0,2],[1,1],[-1,4],[0,3],[0,4],[0,1],[1,4],[0,13],[0,9],[0,3],[0,2],[-1,5],[0,15],[-1,12],[0,6],[0,5],[-2,14],[-1,6],[-3,19],[-2,7],[-1,5],[-1,1],[-1,0]],[[9878,2892],[1,8],[0,4],[1,3],[1,5],[0,4],[1,2],[1,3],[-1,3],[0,5],[1,2],[1,2],[0,2],[0,3],[0,2],[0,10],[0,10],[0,7],[-1,7],[-1,7],[-1,7],[0,4],[0,5],[0,3],[0,2],[0,3],[0,2],[-2,6],[0,3],[1,3],[0,8],[1,5],[1,1],[0,1],[1,8],[2,20],[1,-1],[0,2],[0,4],[-1,3],[-2,3],[0,7],[0,5],[-1,2],[-1,4],[0,7],[0,7],[0,6],[-1,-3],[-1,7],[0,9],[0,8],[0,1],[1,1],[0,1],[1,2]],[[9881,3137],[1,4],[1,2],[0,2],[0,2],[0,8],[0,4],[0,3],[2,2],[1,2],[0,3],[1,0],[0,-1],[0,2],[1,1],[1,0],[1,-2],[1,1],[1,4],[0,2],[1,2],[0,3],[0,2],[1,3],[0,-3],[1,0],[1,3],[2,0],[1,-4],[1,-4],[1,2],[1,3],[0,-2],[0,-7],[-1,-6],[0,-7],[-1,-10],[-1,-9],[1,-7],[0,-4],[0,-6],[0,-7],[0,-5],[1,-4],[0,-4],[-1,-3],[0,-8],[1,-4],[1,1],[1,0],[0,-5],[-1,-7],[0,-4],[0,-5],[0,-4],[0,-4],[0,-11],[-1,-9],[0,-9],[0,-9],[2,-4],[3,0],[1,-1],[1,4],[1,2],[0,4],[0,3],[0,3],[0,3],[1,3],[1,3],[1,5],[0,2],[1,1],[2,0],[2,3],[1,-1]],[[9966,3096],[-1,9],[-1,1],[-3,17],[-5,33],[0,17],[-3,11],[0,-12],[-6,23]],[[9947,3195],[0,6],[0,8],[0,7],[2,9],[3,8],[1,7],[1,7],[0,8],[0,4],[0,4],[1,2],[1,0],[0,2],[1,4],[1,4],[0,1],[1,2],[0,3],[0,2],[0,5],[1,5],[0,9],[-1,5],[1,2],[1,-2],[1,-7],[1,-6],[1,-5],[1,10],[2,36],[1,18],[1,6],[1,9],[0,5],[-1,0],[-1,-4],[0,3],[0,6],[0,4],[0,8],[0,6],[0,2],[0,3],[0,2],[2,3],[0,6],[0,3]],[[9970,3415],[6,-1],[1,-2],[0,-2],[0,-2],[0,-2],[0,-1],[1,-3],[0,-2],[0,-1],[1,0],[1,0],[0,-1],[1,-3],[0,-1],[1,0],[1,-1],[0,-3],[1,-4],[0,-4],[0,-4],[0,-2],[-1,-6],[-1,-7],[0,-11],[-1,-5],[-1,-5],[0,-5],[-1,-14],[0,-4],[-1,-4],[0,-2],[0,-2],[0,-6],[1,-4],[0,-5],[0,-6],[-1,-3],[0,-3],[0,-3],[0,-10],[0,-5],[0,-4],[-1,-4],[0,-5],[1,-4],[0,-4],[0,-3],[0,-3],[0,-2],[0,-3],[0,-3],[-1,-5],[0,-3],[1,-1],[0,-1],[0,-3],[0,-3],[0,-2],[-1,-3],[0,-2],[0,-15],[0,-2],[-4,-22],[-2,-16],[-1,-2],[-1,7],[-1,1],[0,-2],[-1,-2],[0,-1],[-1,0],[0,-2],[0,-2],[0,-2],[1,-1],[0,-4],[0,-2],[0,-3],[0,-5],[0,-5],[0,-12],[-1,-14],[0,-6]],[[9966,3096],[0,-9],[0,-4],[0,-5],[0,-3],[-1,-3],[0,-5],[2,-1],[1,-3],[0,-6],[-1,-10],[-1,-11],[0,-7],[-1,-3],[0,-2],[0,-3],[-1,14],[0,7],[0,7],[0,3],[0,4],[0,3],[1,3],[0,3],[-1,1],[-1,-3],[0,1],[-1,3],[0,1],[-5,2],[-4,0],[-1,1],[0,2],[-1,-4],[-5,-16],[-4,-12],[0,-2],[0,-5],[-1,-5],[0,-5],[-1,-6],[-1,-7],[0,-3],[-1,-7],[0,-3],[0,-2],[0,-3],[0,-4],[0,-4],[0,-2],[0,-2],[1,-2],[0,-5],[0,-21],[0,-4],[0,-4],[1,-1],[0,-2],[1,-3],[0,-2],[0,-1],[1,0],[1,1],[1,-2],[0,-3],[-1,-4],[0,-6],[0,-2],[-1,-1],[0,-2],[-1,-1],[0,-3],[-1,-15],[0,-1],[0,-1],[1,-1],[-1,-2],[0,-1],[0,-1],[-1,-5],[-1,-20],[0,-9],[-1,-4],[0,-2],[0,-3],[0,-5],[0,-2],[0,-1],[0,-3],[0,-1],[-1,-8],[0,-9],[-1,-10],[-2,-7],[0,-1],[0,1],[0,2],[-1,1],[0,-1],[-1,-7],[0,-3],[0,-5],[0,2],[0,2],[1,1],[-2,-23],[0,-14]],[[9918,3054],[1,11]],[[9919,3065],[2,-12],[2,-4],[0,3],[0,5],[1,3],[1,1],[0,7],[-1,7],[2,11],[2,0],[1,1],[1,1],[-1,4],[0,6],[1,6],[1,9],[1,9],[0,7],[0,3],[0,2],[0,11],[1,6],[1,3],[0,3],[3,4],[1,-6],[1,-1],[1,0],[0,3],[1,3],[0,3],[0,4],[1,3],[0,3],[0,1],[1,-1],[0,2],[1,4],[1,3],[0,2],[0,2],[1,6],[0,1],[1,2]],[[9889,3592],[0,-3],[1,-4],[0,-2],[0,-2],[-1,-1],[0,1],[-1,-2],[-1,0],[-1,3],[0,2],[0,4],[-1,0],[0,-2],[0,-1],[0,3],[0,4],[0,3],[0,-1],[1,1],[1,-2],[0,-2],[0,-1],[1,2],[1,7],[1,3],[0,-1],[0,-2],[0,-4],[0,-1],[0,-1],[-1,-1]],[[9882,3666],[-1,-1],[-1,0],[0,1],[0,2],[0,2],[0,6],[0,3],[1,1],[0,-1],[0,-3],[1,-3],[0,-5],[0,-2]],[[9888,3716],[-1,0],[0,5],[0,4],[1,3],[0,-2],[0,-2],[1,-2],[0,-3],[-1,-2],[0,-1]],[[9893,3538],[-1,-5],[-1,4],[-1,-9],[0,-12],[0,-16],[-3,-2],[-3,-5],[-3,-5],[-3,-5],[-1,-7],[-2,-2]],[[9875,3474],[0,9],[-1,7],[0,9],[-1,2],[0,4],[-1,15],[0,6],[0,1],[1,-2],[1,3],[1,-1],[0,-2],[0,-3],[0,-2],[0,-1],[1,-18],[0,-8],[1,-5],[0,-3],[0,5],[0,6],[0,4],[0,1],[1,-1],[0,1],[1,2],[-1,0],[-1,1],[-1,2],[1,1],[1,9],[0,-1],[0,-5],[2,10],[0,3],[1,0],[1,-8],[0,-1],[1,1],[0,2],[0,4],[-1,2],[1,3],[-2,3],[0,3],[-1,-1],[0,3],[0,5],[-1,3],[0,-6],[-1,3],[0,5],[1,3],[0,2],[0,2],[1,3],[-2,2],[-2,-1],[-1,-2],[-1,-3],[0,-3],[0,-6],[0,-2],[-1,-3],[0,4],[-1,-4],[0,-3],[-1,-2],[-1,2],[0,4],[-1,26],[-1,22],[0,10],[-2,17],[-4,32],[0,10],[-1,11],[0,2],[1,2],[0,2],[0,-6],[0,-3],[0,-4],[0,6],[1,3],[0,1],[0,-2],[1,-7],[0,-4],[1,-7],[1,-2],[0,-1],[0,-2],[0,-3],[0,-2],[1,-3],[0,-2],[0,-1],[-1,0],[0,-1],[1,-2],[0,-2],[-1,-3],[1,0],[0,-1],[1,-2],[0,2],[0,3],[0,1],[0,-3],[0,-5],[0,-3],[1,5],[0,2],[0,4],[0,3],[0,2],[1,3],[0,2],[0,-1],[-1,-1],[0,5],[0,10],[0,2],[0,-3],[0,2],[0,11],[0,1],[0,1],[0,4],[0,2],[0,3],[0,2],[0,3],[0,4],[0,1],[-1,3],[0,-4],[-1,-2],[0,-1],[-1,-1],[-1,2],[-1,4],[0,7],[0,-2],[0,6],[1,0],[0,-1],[1,-1],[1,0],[0,1],[1,2],[0,3],[1,2],[0,2],[1,5],[0,1],[1,0],[0,1],[0,3],[0,1],[0,2]],[[9871,3716],[0,4],[3,15],[1,2]],[[9875,3737],[0,-2],[2,-16],[0,-7],[2,-5],[0,-2],[0,-2],[0,-3],[0,-1],[0,-1],[0,1],[0,-1],[0,-2],[0,-4],[0,-2],[1,-1],[1,-1],[-1,-1],[-2,1],[-1,-1],[0,-3],[1,-9],[0,-6],[0,-4],[0,-4],[0,-4],[0,11],[-1,4],[-1,2],[1,-10],[0,-4],[-1,0],[0,-2],[1,-1],[0,-1],[0,-2],[0,-3],[-1,-2],[0,-1],[0,-3],[0,-4],[1,-4],[0,-4],[0,-1],[0,-2],[0,-2],[1,0],[0,-1],[2,3],[0,-1],[0,-1],[-1,-5],[-1,-2],[-1,3],[0,-4],[1,-5],[1,-34],[0,1],[-1,2],[0,1],[-1,-3],[0,1],[0,2],[0,1],[0,2],[-1,1],[0,6],[-1,-3],[-1,-2],[0,-3],[0,-2],[1,1],[0,-1],[0,-1],[0,-2],[-1,-2],[1,-2],[0,-1],[0,-1],[0,-2],[0,-9],[0,-3],[1,-2],[0,1],[0,3],[0,3],[0,3],[0,-2],[0,3],[1,2],[0,2],[0,1],[1,0],[1,-2],[2,0],[0,-2],[0,-7],[0,-3],[0,-1],[0,-2],[0,-5],[0,-3],[0,-1],[1,3],[0,25],[1,-11],[0,-5],[0,-6],[1,1],[1,0],[0,2],[0,5],[-1,4],[1,1],[1,-1],[1,-1],[0,-5],[0,-11],[0,-4],[1,0],[0,2],[0,1],[1,3],[0,-1],[0,-1],[1,0],[1,3],[1,-4],[0,-1],[1,-8],[0,-3]],[[9897,3739],[0,-3],[0,-2],[1,-3],[1,-2],[0,-1],[0,-3],[0,-2],[0,-2],[0,-3],[-1,-3],[0,-2],[1,-4],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,-5],[0,-1],[0,-7],[-1,-2],[0,1],[0,3],[0,3],[-1,2],[0,-2],[-1,0],[0,2],[0,6],[0,2],[0,1],[-1,-1],[0,2],[0,1],[0,2],[0,1],[-1,-1],[-1,2],[0,5],[-1,5],[1,-6],[1,2],[0,3],[0,3],[0,2],[0,4],[0,2],[-1,2],[0,4],[1,0],[0,3],[0,4],[-1,4],[1,4],[1,0],[0,-2],[0,-2],[0,-3],[0,-1],[1,-4],[0,-2]],[[9919,3065],[1,14],[0,20],[-1,3],[0,-2],[-1,1],[-1,5],[-1,8],[-1,9],[0,3],[0,8],[1,5],[2,-5],[1,2],[0,3],[-1,9],[-1,8],[1,9],[0,10],[0,3],[-2,6],[-2,3],[0,5],[0,5],[1,1],[0,3],[0,3],[1,5],[1,-3],[0,-2],[1,-5],[0,-1],[1,0],[1,2],[0,1],[0,2],[1,1],[0,-1],[1,-2],[0,-2],[0,-3],[0,-2],[-1,-3],[0,-3],[0,-2],[0,-2],[1,0],[1,2],[0,5],[0,5],[1,2],[1,-5],[1,6],[1,18],[-1,9],[0,4],[-5,12],[0,3],[0,4],[-1,5],[0,6],[0,10],[-1,9],[0,5],[0,4],[-1,7],[-2,2],[-1,4],[-1,4],[0,6],[-1,3],[-1,0],[0,1],[0,3],[-1,10],[0,5],[0,5],[0,6],[-1,3],[0,18],[-1,16],[-1,7],[0,8],[0,7],[-1,6],[0,6],[1,3],[-1,4],[0,3],[0,4],[1,3],[0,-3],[1,-2],[0,3],[0,4],[0,4],[0,1],[1,6],[0,9],[1,3]],[[9911,3457],[0,-2],[1,-7],[0,-3],[0,-2],[0,-2],[0,-2],[0,-3],[0,2],[0,-1],[0,-3],[0,-2],[1,-1],[0,-1],[1,-2],[0,-3],[1,-2],[0,-3],[1,-7],[0,-3],[1,-5],[0,-2],[0,-4],[-1,5],[0,1],[-1,0],[-1,0],[0,3],[0,1],[1,2],[-1,5],[0,2],[-1,3],[0,3],[-1,0],[-1,-2],[0,-1],[0,-3],[0,-1],[0,-1],[0,-2],[0,-1],[0,-2],[0,-2],[1,1],[0,-1],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[0,-5],[0,-1],[0,-1],[1,0],[0,1],[0,1],[1,1],[0,-2],[0,-3],[0,-3],[1,-3],[0,2],[0,-2],[1,-2],[0,-1],[0,1],[1,2],[0,2],[0,-1],[1,-1],[0,-2],[0,-3],[0,-4],[0,-2],[1,1],[0,11],[-1,7],[0,3],[0,1],[1,-3],[1,-11],[1,-3],[0,-1],[2,-5],[1,-2],[0,-1],[1,-4],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[1,2],[5,-27],[2,-3],[1,-2],[2,-4],[2,-2],[1,-6],[3,-2],[1,-4],[-2,0],[0,-1],[0,-1],[2,-6],[0,-1],[0,-1],[1,1],[0,3],[0,3],[-1,3],[1,1],[0,-2],[0,-1],[1,-1],[2,0],[0,-1],[0,-3],[0,-1],[0,1],[1,1],[0,2],[0,1],[0,1],[1,2],[3,1],[0,3],[1,3],[2,8],[1,5],[0,2],[0,2],[0,6],[1,6],[0,2],[0,1],[1,4],[0,4],[1,9],[0,4],[1,3],[0,2],[0,3],[0,1],[3,5],[0,1],[1,1],[0,2],[1,7],[0,1],[2,1],[0,1],[0,3],[1,2],[-1,3],[0,3],[1,-1],[1,-1]],[[9859,2413],[-3,-14],[0,-8],[-1,-6],[0,-4],[0,-7],[0,-4],[0,-2],[0,-3],[-1,-3],[0,-1],[0,-4],[-1,-6],[0,-3],[-2,-5],[0,-3],[-1,-9],[0,-1],[-1,0],[0,-4],[0,-1],[-1,-2],[0,-1],[0,-2],[0,-4],[0,-2],[1,-3],[0,-3],[0,-1],[-1,-2],[0,5],[-1,1],[0,1],[0,-1],[-1,-3],[0,-1],[-1,-2],[-1,-11],[-1,-8],[0,-10],[-1,-9],[-1,-4],[0,-1],[0,-1],[1,-1],[-3,-28],[0,-8],[0,-5],[-1,-4],[-1,-2],[0,-3],[0,-4],[0,-3],[0,-1],[0,-1],[0,-3],[0,-2],[0,-1],[0,-1],[-1,-3],[0,-2],[0,-1],[-1,-5],[-1,-1],[-1,-4],[-1,-2],[0,-3],[0,-2],[0,-1],[-1,-6],[-4,-6],[-1,-2],[-1,-6],[-2,-10],[0,-4],[-1,-9],[-1,-7],[0,-1],[0,-4],[0,-3],[0,-5],[0,-6],[0,-12],[0,-1],[0,-3],[0,-5],[0,-14],[1,-14],[0,-3],[0,2],[-1,1],[0,-2],[0,-3],[1,-2],[2,-3],[-1,-2],[-2,-1],[-1,-1],[-1,-4],[1,-2],[0,-1],[1,-1],[1,5],[1,1],[1,0],[0,-4],[1,-3],[0,-2],[0,1],[0,6],[0,5],[1,-2],[0,-2],[0,-4],[0,-6],[0,-2],[1,1],[0,2],[0,2],[0,3],[1,1],[0,-1],[1,-1],[0,-1],[0,-4],[1,6],[0,1],[0,-4],[1,-3],[0,-1],[0,-3],[0,-2],[0,-2],[0,-1],[0,-1],[0,-2],[0,-2],[0,-1],[1,-6],[-1,-7],[0,-6],[0,-6],[0,3],[-1,-5],[-1,0],[0,-4],[0,-2],[0,2],[-1,0],[0,-2],[0,3],[0,5],[0,3],[0,4],[0,2],[0,1],[-1,3],[0,3],[0,3],[0,3],[0,1],[-1,-1],[0,-2],[0,-3],[1,-2],[-1,-6],[0,-6],[1,-6],[0,-8],[0,-1],[0,1],[-2,0],[-1,1],[0,5],[-1,-1],[0,1],[-1,5],[-1,7],[0,3],[1,4],[-1,0],[-1,-2],[-2,-2],[-1,-3],[-1,-1],[-3,-5],[-1,-1],[0,1],[0,2],[0,2],[1,1],[0,1],[5,8],[0,1],[0,2],[-1,3],[-1,0],[0,1],[0,1],[-1,3],[0,2],[-1,2],[-1,-1],[0,-2],[-1,-1],[-1,-2],[0,-6],[0,-6],[0,-6],[0,-3],[0,-1],[0,-2],[0,-2],[0,-1],[-3,-2],[-1,-1],[0,-4],[-2,-2],[0,-3],[-3,-8],[-5,-23],[-1,-1],[-1,0],[0,-1],[-3,-9],[-1,-1],[0,-1],[0,-2],[-1,-2],[0,-2],[-1,-1],[-1,-3],[0,-1],[0,-1],[-1,-4],[0,-1],[0,-2],[-1,-2],[0,-1],[-2,-11],[-1,-3],[0,2],[-1,-2],[0,-1],[0,-3],[0,-2],[-2,-16],[0,-3],[0,-13],[0,-4],[-1,-4],[0,-5],[0,-2],[0,-3],[0,-2],[-1,-1],[-1,-3],[1,-5],[0,-8],[0,-17],[0,-11],[0,-3],[0,-5],[0,-1],[-1,-2],[0,-2],[1,-1],[0,-6],[0,-7],[0,-14],[0,-4],[-1,-3],[0,-3]],[[9777,1736],[-1,1],[-3,7],[-5,8],[-3,-4],[-1,0],[-1,-2],[-1,-3],[-4,-23],[-3,-9],[0,3],[-1,6],[0,6],[0,6],[0,5],[-1,5],[0,2],[-1,0],[-3,-3],[-2,1],[-1,3],[0,4],[-1,8],[-1,13],[-1,17],[-1,8],[0,6],[-1,3],[-2,-2],[-2,10],[-1,6],[-1,-1],[0,2],[-1,4],[0,16],[-1,5],[0,5],[-1,2],[0,3],[0,6],[0,41],[0,5],[0,5],[1,4],[0,7],[1,4],[0,6],[1,7],[0,6],[0,12]],[[9735,1957],[2,11],[1,5],[1,7],[4,21],[1,8],[0,4],[1,6],[1,6],[0,6],[1,5],[0,5],[1,5],[2,12],[1,3],[3,6],[3,13],[2,3],[1,1],[0,-1],[1,0],[3,18],[5,23],[2,8],[1,5],[2,18],[1,4],[1,-1],[2,4],[1,2],[0,3],[0,2],[0,4],[1,4],[1,7],[0,3],[2,3],[1,0],[0,1],[0,1],[1,3],[1,2],[1,0],[0,-1],[1,2],[1,1],[2,1],[1,0],[0,1],[1,3],[0,2],[0,3],[0,7],[0,5],[1,3],[0,1],[1,3],[2,6],[0,4],[0,3],[1,4],[0,6],[1,3],[1,4],[1,1],[1,1],[0,2],[1,5],[1,9],[1,6],[0,2],[1,3],[0,4],[1,2],[0,3],[0,3],[2,8],[1,8],[1,2],[1,1],[0,2],[1,2],[0,3],[0,2],[0,5],[1,2],[0,2],[0,5]],[[9814,2341],[1,1],[0,2],[1,3],[1,9],[0,5],[1,13],[0,3],[0,2],[0,2],[1,0],[1,-1],[0,-1]],[[9820,2379],[0,-1],[1,-7],[0,-2],[1,0],[1,-3],[0,-1],[0,-3],[0,-4],[1,-5],[0,-3],[0,-3],[0,-3],[0,-4],[0,-2],[1,-1],[0,-1],[1,-2],[0,-5],[0,-3],[1,-3],[0,-1],[1,-6],[0,-3],[0,-3],[0,-3],[0,-2],[0,-1],[1,-1],[1,-4],[0,2],[2,4],[0,1],[1,2],[0,4],[1,5],[0,7],[0,3],[0,3],[0,3],[1,5],[1,4],[1,9],[1,3],[3,6],[0,3],[0,4],[0,3],[0,7],[1,12],[2,10],[1,2],[0,3],[1,1],[1,3],[0,2],[1,3],[0,2],[0,7],[1,3],[0,-1],[1,-3],[0,-3],[0,-1],[1,1],[0,2],[1,2],[2,3],[1,0],[0,-2],[1,-1],[0,-1],[1,0],[1,-1],[0,-1],[1,-6]],[[9868,2601],[-1,-3],[0,-7],[0,-3],[0,-1],[-1,0],[-1,0],[0,-1],[-1,-4],[0,-1],[-1,-1],[-1,1],[0,1],[0,1],[0,1],[1,0],[0,-1],[1,1],[1,11],[1,-3],[0,1],[1,4],[0,4],[-1,-1],[0,1],[-1,3],[1,0],[0,2],[1,2],[0,1],[0,-1],[0,-2],[0,-2],[1,-3]],[[9820,2379],[1,20],[3,22],[0,4],[0,12],[1,7],[1,9],[0,3],[0,3],[1,4],[1,9],[1,9],[1,8],[2,15],[1,8],[1,2],[1,0],[1,2],[0,4],[0,5],[0,6],[0,5],[0,3],[0,6]],[[9836,2545],[1,1],[1,4],[1,8],[3,23],[1,7],[1,7],[0,4],[1,8],[0,7],[0,4],[0,2]],[[9845,2620],[0,1],[1,-1],[0,-3],[0,-4],[0,-4],[1,0],[0,2],[0,-2],[1,1],[-1,6],[1,2],[0,2],[1,2],[0,2],[0,3],[0,1],[0,1],[-1,-5],[-1,1],[0,3],[0,1],[1,4],[0,1],[1,2],[0,1],[0,1],[2,2],[0,1],[0,6],[1,3],[0,-11],[1,-1],[0,1],[1,5],[0,2],[0,2],[0,1],[0,1],[0,1],[2,4],[1,0],[0,-1],[0,-6],[0,-1],[-2,2],[1,-3],[-1,-1],[0,-2],[0,-3],[-1,1],[0,-1],[0,-2],[0,-1],[0,-1],[0,-1],[0,-3],[-1,-2],[-1,0],[0,3],[-1,0],[0,-1],[-1,-2],[1,-4],[-1,-2],[0,-2],[0,-1],[1,-2],[0,-2],[-1,-3],[0,-2],[0,-2],[0,-2],[1,1],[0,4],[0,5],[0,1],[2,3],[1,0],[1,-3],[0,1],[-1,-1],[0,-1],[0,-2],[0,-2],[0,1],[-1,0],[0,1],[0,-2],[0,-1],[0,-1],[0,-1],[0,-2],[0,-1],[0,1],[-1,-6],[0,-1],[0,-1],[-1,-3],[1,0],[0,-2],[1,-2],[0,-3],[0,-3],[-1,-5],[0,-2],[0,-3],[-1,-3],[-1,-2],[0,-3],[0,-2],[0,-1],[3,10],[1,2],[0,2],[-1,1],[0,2],[1,1],[1,-1],[0,-1],[1,-1],[1,2],[1,1],[-1,1],[0,2],[2,-1],[0,2],[1,4],[-3,-1],[-1,0],[0,-1],[0,-1],[0,-1],[0,-1],[0,1],[-1,1],[1,3],[-2,-4],[-1,0],[0,7],[0,4],[1,2],[0,1],[0,2],[0,2],[0,1],[0,2],[1,0],[0,1],[0,1],[0,3],[1,-2],[0,-3],[-1,-4],[1,-7],[0,6],[0,4],[1,3],[1,0],[-1,4],[0,2],[0,5],[0,3],[0,3],[0,-2],[-1,-4],[0,-2],[0,1],[-1,6],[0,2],[1,0],[0,3],[0,2],[0,1],[0,-1],[0,5],[1,-1],[1,-7],[0,-2],[1,-2],[0,2],[1,4],[0,-3],[1,1],[0,4],[0,4],[0,-1],[1,-3],[0,-3],[0,-3],[0,-3],[0,-2],[0,-1],[-1,-1],[0,-2],[1,-2],[0,-2],[1,1],[0,3],[1,5],[1,7],[0,1],[0,-3],[0,-4],[-1,-14],[0,-3],[0,-4],[-1,-2],[0,1],[0,-2],[0,-2],[0,-1],[-1,-1],[0,3],[0,9],[0,1],[0,-2],[-1,-2],[0,-3],[0,1],[0,-1],[0,-3],[0,-3],[1,-4],[0,-2],[0,-3],[0,-1],[0,-1],[0,1],[-1,-2],[0,-2],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,-1],[0,-4],[-1,2],[0,-1],[-1,-2],[0,1],[-1,-1],[0,-2],[0,-2],[-1,-3],[1,0],[1,2],[0,1],[1,-1],[0,1],[1,2],[0,2],[1,-1],[1,3],[0,1],[1,-2],[0,-2],[1,-2],[1,2],[0,1],[1,1],[0,1],[1,6],[0,-6],[0,-5],[-1,-2],[0,-3],[0,-2],[-1,-2],[0,-3],[0,-1],[-1,-2],[0,-3],[-1,-1],[0,2],[1,5],[0,2],[-1,-3],[0,4],[-1,-4],[-1,-6],[0,-6],[0,-6],[-1,-6],[0,-2],[0,-5],[0,-7],[0,-3],[0,-4],[1,-3],[0,-3],[0,-2],[0,-2],[1,1],[0,5],[0,1],[-1,4],[0,4],[1,-2],[1,-16],[0,-4],[0,-3],[0,-2],[1,-4],[0,-3],[0,-12],[0,-1],[1,-4],[0,-3],[1,0],[0,1],[0,-5],[-2,-24],[0,-4],[-3,-21]],[[9855,2683],[0,-2],[0,-2],[0,-1],[0,-3],[-1,-1],[0,-3],[0,-5],[0,-3],[-1,0],[0,-1],[0,-2],[0,-2],[-1,-1],[0,-1],[0,-1],[0,-2],[0,-1],[-1,-1],[0,-2],[-1,0],[0,2],[0,1],[0,1],[0,1],[1,1],[0,2],[0,2],[0,3],[-1,-3],[0,-1],[0,3],[0,3],[0,3],[0,2],[1,-2],[0,-3],[0,-2],[1,0],[0,1],[0,2],[-1,2],[0,3],[0,4],[0,3],[0,9],[1,2],[0,-1],[0,-1],[0,-2],[0,-1],[0,3],[0,2],[1,1],[0,-1],[0,-3],[0,-4],[0,-4],[0,2],[1,2],[1,2],[-1,0],[0,4],[1,1],[0,3],[0,6],[0,2],[0,-3],[0,-4],[0,-3],[0,-6]],[[9836,2545],[-1,3],[-1,6],[0,6],[-1,2]],[[9833,2562],[1,1],[0,1],[1,6],[1,3],[1,4],[1,9],[2,11],[0,1],[1,4],[0,-2],[0,-2],[0,-2],[1,3],[0,2],[1,2],[0,6],[0,1],[1,0],[0,-1],[0,3],[0,2],[0,3],[1,3]],[[9814,2341],[-1,0],[0,-1],[-1,-1],[0,-1],[0,-2],[0,-1],[-1,1],[0,4],[-1,7],[0,6],[0,9],[0,4],[-1,3],[0,2],[-1,0],[-1,1],[0,1],[0,1],[0,1],[0,1],[-1,3],[0,2],[0,1],[-1,0],[-1,1],[0,3],[0,4],[0,4],[0,3],[0,3],[-1,2],[0,1],[0,1],[0,2],[-1,4],[0,4],[0,2],[0,11],[1,4],[0,3],[1,6],[0,6],[0,3],[0,2],[-1,3],[0,1],[0,2],[0,4],[1,2],[0,2],[0,3],[1,2],[0,1],[2,2],[0,1],[0,3],[0,3],[0,3],[0,2],[1,2],[1,1],[0,3],[0,5],[1,6],[0,9],[0,3],[0,2],[2,6],[0,3],[0,3],[0,2],[0,3],[0,1],[0,2],[0,1],[1,1],[1,-2],[1,0],[0,2],[1,2],[0,4],[0,3],[1,4],[0,4],[0,4],[0,3],[0,2],[0,1],[-1,3],[0,2],[1,2],[2,4],[1,7],[0,2],[0,2],[0,2],[-1,2],[-1,2],[-1,1],[0,2],[-1,8],[-1,1],[0,1],[0,1],[0,1],[-1,3],[0,2],[0,2],[0,2],[0,3],[-1,2],[0,1],[-1,0],[0,-1],[-1,0],[0,1],[-1,-1],[0,-5],[-1,2],[0,6],[0,4],[1,3],[0,1],[0,3],[0,2],[0,3],[0,3],[0,2],[-1,2],[0,3],[0,4],[0,3],[-1,5],[-1,3],[0,15],[0,2]],[[9807,2683],[1,2],[1,4],[0,1],[1,7],[3,22],[1,7],[2,2],[-1,-7],[0,-3],[0,-1],[1,2],[0,2],[0,1],[0,-1],[1,0],[0,2],[0,1],[0,3],[1,2],[0,2],[-1,3],[0,1],[0,-3],[0,-1],[-1,0],[1,9],[1,4],[6,2],[2,-2],[1,-3],[1,0],[0,-2],[-6,3],[-1,-1],[0,-2],[0,-4],[-1,-9],[0,-5],[0,-2],[0,-5],[0,-1],[-1,-1],[0,1],[0,-6],[0,-1],[1,-1],[0,-1],[0,-4],[0,-7],[0,-4],[0,2],[1,2],[0,-7],[1,-6],[2,-12],[1,-1],[0,1],[1,4],[0,1],[0,3],[0,1],[1,3],[0,-3],[1,3],[0,2],[1,-3],[0,-3],[0,-2],[0,-5],[0,-2],[0,-2],[0,-2],[0,-1],[0,1],[1,-1],[0,-4],[0,-1],[0,-10],[0,-4],[0,-2],[0,-1],[0,-3],[-1,-5],[-1,-3],[0,-1],[1,0],[0,1],[0,-11],[1,-4],[0,-3],[0,-3],[0,-3],[0,-4],[0,2],[0,2],[0,1],[-1,1],[0,-8],[0,-2],[1,-3],[0,-2],[0,-2],[0,3],[1,-3],[0,-9],[0,-7],[0,-1],[0,-2],[0,-1],[0,-2],[0,-3],[0,-2],[1,-1],[1,0]],[[9871,3716],[-1,-2],[0,-2],[-1,0],[0,-1],[0,-1],[-1,-4],[0,-1],[0,3],[-1,-2],[0,-4],[-1,-2],[-1,1],[0,1],[0,1],[0,4],[0,1],[1,-1],[0,-3],[1,5],[0,8],[1,5],[0,3],[0,1],[0,2],[0,4],[1,-2],[0,3],[0,3],[-1,1],[-1,2],[0,-7],[0,-7],[-1,-7],[0,-2],[0,4],[0,1],[-1,0],[0,2],[0,4],[-1,0],[0,1],[0,3],[0,3],[0,2],[0,5],[0,-2],[-1,-4],[0,6],[-2,-6],[1,-2],[0,-5],[0,-1],[1,0],[0,-1],[0,-1],[0,-3],[0,-3],[0,-2],[1,-1],[0,1],[0,3],[1,-2],[0,-5],[-1,-2],[0,-1],[0,-2],[0,-1],[-1,0],[0,4],[-1,0],[0,1],[-1,7],[0,3],[0,3],[-1,3],[0,1],[-2,0],[0,2],[0,2],[0,3],[-1,2],[0,1],[-1,2],[0,4],[0,9],[0,4],[-1,5],[0,7],[-1,3],[0,4],[1,6],[0,4],[0,5],[0,2],[-1,2],[0,1],[0,-3],[0,-2],[0,-2],[0,-1],[0,-5],[-1,-4],[0,-3],[1,-14],[1,-2],[0,-2],[0,-6],[1,-6],[0,-4],[0,-2],[0,-5],[0,-2],[1,-1],[0,-2],[0,-1],[1,-4],[0,-2],[0,-1],[0,-2],[2,-15],[0,-2],[1,1],[0,-3],[0,-2],[0,-3],[1,-3],[0,-5],[0,-5],[-1,-3],[-1,-4],[-1,0],[-1,8],[-1,22],[-4,32],[-1,14],[-6,56],[-6,56],[0,4],[0,4],[1,8],[0,4],[0,5],[0,5],[0,3],[1,-2],[0,3],[0,1],[0,-2],[1,-3],[0,-2],[0,-1],[1,1],[-1,8],[1,3],[0,-8],[0,4],[0,5],[1,4],[0,3],[1,-1],[0,-1],[0,2],[0,2],[0,4],[1,5],[-1,-2],[-1,1],[0,3],[0,1],[0,1],[0,1],[0,-2],[0,-8],[0,4],[-1,10],[0,-3],[0,-4],[0,-5],[0,-3],[0,-4],[0,-2],[-1,0],[-1,3],[0,-1],[0,-4],[0,-1],[0,-1],[0,-1],[-1,-1],[0,1],[0,4],[-1,-1],[0,-3],[0,-4],[0,-1],[-1,-1],[0,-2],[0,-1],[0,-2],[0,-17],[0,-2],[0,1],[-3,23],[0,6],[0,3],[1,8],[-1,0],[1,4],[0,2],[0,3],[-1,-1],[0,-4],[0,-5],[-1,-6],[0,2],[-1,7],[0,2],[0,2],[1,5],[0,3],[0,1],[-1,-4],[-1,1],[0,2],[-1,6],[-1,8],[0,3],[0,4],[0,1],[1,-1],[0,-1],[1,8],[1,11],[0,11],[0,12],[-1,14],[-1,4],[-1,11],[-1,5],[-1,15],[0,2],[-1,2],[-5,50],[-1,7],[-3,10],[0,1],[1,2],[0,4],[0,2],[0,4],[0,2],[0,-2],[1,-2],[2,-1],[0,-3],[1,3],[1,1],[0,4],[4,-2],[0,1],[0,1],[1,3],[1,-3],[-1,-3],[-1,-5],[1,-12],[-1,-3],[0,-2],[0,-1],[0,1],[-1,3],[0,2],[0,1],[0,1],[0,3],[0,1],[-1,2],[0,-1],[0,-6],[0,-5],[0,-1],[-1,2],[0,-2],[0,-2],[0,-1],[0,-1],[0,-2],[1,-5],[0,3],[0,2],[0,1],[1,1],[-1,-4],[0,-1],[0,-2],[1,-1],[0,1],[0,2],[0,-3],[0,-3],[0,-13],[0,-1],[1,1],[0,6],[0,6],[0,7],[0,5],[0,-3],[1,-11],[0,-13],[0,-9],[1,-7],[1,-7],[1,-8],[1,-9],[-2,11],[0,3],[0,-8],[1,-8],[4,-15],[0,-3],[-1,-4],[0,-2],[0,-3],[0,-9],[0,-1],[1,-2],[1,2],[0,3],[0,2],[0,1],[1,3],[0,6],[-1,11],[0,5],[1,2],[1,1],[0,2],[0,3],[0,3],[0,2],[0,2],[0,2],[1,0],[0,-2],[0,-3],[0,-2],[0,-2],[0,-3],[1,2],[0,1],[0,-3],[0,-1],[0,-4],[-1,-3],[-1,0],[0,-1],[0,-4],[0,-4],[0,-4],[0,-3],[1,-3],[0,-3],[1,-2],[0,-1],[2,1],[0,-1],[1,-5],[0,4],[0,1],[0,2],[-1,3],[0,2],[0,4],[0,4],[1,0],[0,-2],[0,-4],[1,2],[0,1],[0,-1],[1,-5],[0,-1],[1,0],[0,1],[0,1],[1,1],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[1,0],[0,-1],[0,-1],[0,-3],[0,-2],[-1,-2],[0,-3],[0,-2],[0,-2],[1,-6],[0,1],[0,1],[0,1],[0,2],[1,8],[0,1],[0,4],[0,1],[0,1],[0,1],[1,2],[1,-1],[0,-1],[0,-3],[1,-3],[1,-6],[0,-4],[1,-5],[0,-4],[1,-1],[2,1],[0,-1],[1,-3],[0,-5],[1,-6],[-2,-2],[0,1],[0,2],[0,2],[0,2],[0,-1],[-1,0],[0,3],[-1,-2],[0,-2],[0,-1],[1,-6],[-1,-1],[0,-3],[0,-2],[1,2],[0,-2],[1,0],[0,2],[0,-4],[0,-3],[0,-3],[0,-3],[0,-3],[1,-7],[0,-2],[0,-3],[0,-6],[1,0],[0,2],[0,4],[0,3],[1,-2],[0,-1],[0,1],[0,2],[0,1],[1,-1],[0,-1],[0,-1],[0,1],[0,2],[0,2],[0,1],[-1,1],[0,1],[-1,3],[0,3],[0,-1],[0,2],[1,1],[1,-2],[0,2],[0,1],[0,1],[1,-1],[0,-1],[0,1],[0,1],[0,1],[1,2],[0,6],[1,4],[0,-5],[0,-5],[0,-5],[0,-5],[0,-5],[0,-3],[1,0],[1,0],[0,-1],[-1,-3],[1,-7],[0,-3],[0,1],[-1,5],[-1,5],[0,2],[0,-5],[1,-15],[1,-4],[1,-1],[0,1],[0,-2],[0,-1],[1,-1],[0,-8],[0,-3],[-1,-1],[0,-3],[2,-8],[1,-9],[0,-6],[0,-7],[0,1],[-2,2],[0,-1],[0,-3],[1,-4],[0,-2],[0,-1],[1,-1],[0,-2],[0,-2],[-1,-2],[0,-1],[1,-7],[1,-2],[0,-3],[0,-5],[0,-3],[0,-8],[0,-1],[-1,2],[-1,4],[0,3],[0,4],[-1,1],[0,4],[-1,-2],[0,-1],[-1,0],[0,3],[0,-1],[0,-3],[0,-1],[-1,0],[0,1],[0,2],[0,4],[0,3],[0,3],[0,2],[-1,3],[0,-5],[0,-13],[0,-4],[0,-2],[0,-3],[0,-3],[0,-1],[1,-1],[0,2],[0,3],[0,3],[1,0],[2,-1],[0,-2],[1,-4],[0,-4],[-1,-5],[0,-4],[0,-3],[0,-6],[0,-6],[0,-4],[1,-2],[1,-7],[0,-1],[1,-1],[1,-1],[0,-3],[0,-2],[0,-2],[0,-2],[0,-6],[0,-3],[1,-2],[0,-1]],[[9878,2892],[-1,0],[-2,5],[-2,1],[-1,1],[0,3],[-3,17],[-1,5],[-2,16],[-1,7],[-1,5],[-2,3],[-4,5],[-2,4],[-4,17],[-1,7],[-1,9],[0,11],[0,10],[0,11],[0,11],[1,10],[1,6],[3,8],[7,29],[1,1],[4,-2],[1,3],[1,6],[3,22],[1,5],[0,8],[0,6],[0,2],[0,7],[1,2]],[[9874,3153],[2,-6],[2,-1],[1,1],[0,-1],[0,-2],[1,-4],[1,-3]],[[9735,1957],[-1,3],[-1,0],[0,-4],[-1,-5],[0,-4],[-1,-3],[-1,-4],[-1,-4],[-1,-4],[-1,-3],[-1,1],[-1,2],[-1,3],[0,-1],[-1,-3],[-2,-1],[-2,0],[-1,-1],[-1,-4],[-1,-6],[-1,-2],[0,-4],[-1,-7],[-1,-4],[-1,-3],[0,-4],[0,-5],[-1,-4],[0,-11],[-1,-6],[-1,-6],[-1,-3],[-2,-2],[-5,-15],[-4,-2]],[[9697,1841],[1,18],[0,4],[1,5],[-1,4],[0,5],[0,4],[-1,4],[-1,4],[-1,3],[-1,-1],[-2,-3]],[[9692,1888],[0,2],[-1,2],[0,1],[1,3],[1,2],[1,7],[2,7],[1,6],[1,7],[0,1],[0,3],[0,3],[0,2],[0,2],[1,2],[0,1],[0,1],[0,3],[0,2],[1,1],[1,0],[2,2],[0,3],[1,2],[0,2],[1,1],[0,-1],[1,1],[0,4],[1,-2],[0,-4],[1,-3],[1,-1],[2,3],[1,5],[2,10],[1,5],[1,3],[0,3],[2,5],[1,3],[0,2],[0,2],[0,2],[0,1],[1,3],[1,2],[1,8],[0,1],[1,2],[2,8],[1,2],[1,3],[0,3],[0,2],[1,2],[0,1],[0,1],[1,0],[1,0],[0,1],[1,3],[1,2],[1,4],[1,-1],[2,7],[0,1],[1,1],[1,9],[0,3],[0,2],[0,3],[1,4],[1,1],[0,2],[0,3],[0,5],[1,4],[0,3],[4,11],[0,4],[1,6],[0,1],[1,2],[0,4],[0,3],[0,2],[1,1],[1,4],[0,1],[1,0],[1,-3],[2,17],[-1,1],[-1,-5],[0,-6],[-1,-2],[0,10],[1,6],[1,3],[0,4],[0,2],[2,0],[1,2],[0,2],[0,2],[1,2],[0,3],[0,2],[1,-1],[0,4],[1,2],[1,4],[2,6],[1,5],[1,1],[1,0],[0,2],[0,2],[1,2],[1,3],[0,3],[1,9],[1,2],[0,2],[3,25],[0,2],[0,1],[1,2],[0,2],[1,3],[0,4],[0,2],[1,1],[0,1],[1,5],[0,8],[1,1],[2,25],[0,4],[1,4],[0,7],[0,5],[1,13],[1,10],[1,33],[0,9],[0,5],[0,5],[1,2],[1,7],[0,4],[0,6],[1,14],[0,4],[0,8],[1,8],[0,3],[0,-2],[-1,2],[0,1],[0,11],[1,2],[2,-2],[1,2],[1,0],[2,3],[2,11],[1,5],[0,1],[1,1],[0,-1],[0,1],[0,5],[1,1],[0,2],[0,1],[1,4],[1,14],[0,1],[0,1],[0,5],[0,1],[0,1],[1,2],[0,2],[0,2],[0,3],[0,3],[1,4],[1,3],[0,2],[0,2],[0,2],[0,2],[1,5],[0,2],[0,5],[0,6],[0,2],[0,-1],[0,1],[1,1],[0,1],[0,6],[-1,3],[0,25],[0,3],[1,5],[0,2],[-1,12],[0,24],[0,7],[0,4],[1,2],[0,1],[0,1],[1,5],[0,5],[0,2],[0,2],[1,1],[0,1],[0,1],[0,1],[0,1],[1,2]],[[9777,1736],[0,-4],[0,-3],[-2,-21],[-3,-18],[-2,-19],[0,-16],[-1,-5],[0,-6],[0,-3],[1,-2],[0,-5],[-1,-8],[-1,-3],[0,-2],[0,-3],[1,-2],[-1,-5],[-1,-3],[0,-3],[0,-6],[0,-2],[-1,-2],[-1,3],[0,-3],[1,-2],[0,-5],[-1,-2],[0,-1],[-1,0],[-1,-1],[0,-2],[1,-2],[0,-1],[0,-8],[0,-1],[-1,-1],[0,-1],[-1,-3],[0,-1],[0,1],[0,-2],[0,-3],[0,-1],[1,-1],[0,-2],[1,3],[0,-3],[1,-2],[1,-2],[0,-3],[-1,-3],[-1,-1],[-1,-2],[0,-5],[-1,-1],[0,-1],[0,-1],[-1,-6],[-1,-4],[0,-3],[0,1],[1,2],[1,4],[2,3],[0,2],[0,5],[1,3],[0,1],[0,1],[1,1],[0,3],[0,-3],[0,-4],[0,-12],[0,-3],[0,-1],[-1,0],[-1,0],[0,-2],[0,-1],[0,-2],[0,-1],[-6,-4],[-2,-4],[-2,-9],[-2,-13],[0,-5],[-1,-3],[0,-7],[0,-4],[0,-2],[0,-5],[-1,-4],[0,-4],[-1,-2],[-1,-3],[-1,-3],[-1,-4],[0,-4],[-1,-4],[-4,-15],[-1,-8],[0,-12],[0,-6],[0,-2],[-1,-2],[0,-3],[-1,-1],[0,1],[-1,2],[-1,0],[-1,-2],[0,-1],[0,-1],[2,0],[0,-8],[-1,-4],[-1,-2],[-1,-4],[-1,2],[-1,1],[0,-2],[-1,-2],[-1,-5],[0,-1],[0,-2],[0,-1],[0,-2],[-1,2],[-1,0],[-1,-5],[0,3],[-1,0],[0,1],[-1,0],[0,-2],[-1,-3],[0,-2],[-1,0],[-1,-1],[0,2],[0,5],[0,3]],[[9722,1358],[0,12],[0,5],[1,6],[0,4],[-2,9],[0,5],[0,6],[0,6],[0,5],[0,7],[0,6],[0,7],[1,14],[-1,13],[-1,6],[0,6],[0,8],[-1,7],[0,6],[-1,8],[0,6],[0,7],[0,5],[0,5],[-1,5],[0,3],[-1,8],[0,4],[0,4],[0,7],[0,7],[1,10],[2,20],[2,29],[1,6],[-1,10],[-2,16],[-1,4],[-2,-4],[-3,-26],[-1,-3],[-1,1],[-1,2],[-1,8],[-1,15],[-1,11],[-1,2],[-5,-13],[-2,-1],[-1,1],[-1,4],[-1,7],[0,6],[0,11],[-1,7],[0,7],[1,19],[0,5],[-2,4],[0,4],[-1,6],[-1,7],[0,7],[0,9],[0,9],[1,18],[0,8],[0,17],[1,8],[1,10],[1,7],[1,4],[0,4]],[[9673,1217],[-1,-1],[0,2],[0,3],[1,3],[1,0],[0,-3],[0,-2],[-1,-2]],[[9680,1229],[1,-2],[-1,-1],[0,-1],[0,-1],[0,2],[0,1],[0,1],[0,1]],[[9680,1318],[-1,0],[0,3],[0,3],[0,2],[1,0],[0,-2],[0,-4],[0,-2]],[[9704,1318],[0,-2],[0,3],[0,2],[0,2],[-1,3],[1,0],[0,1],[1,2],[0,3],[0,-5],[0,-5],[-1,-4]],[[9687,1339],[1,-2],[0,-3],[3,-20],[0,-2],[1,-2],[0,-2],[0,-3],[1,-1],[0,-2],[1,-3],[-1,-3],[1,-2],[0,-1],[-1,-2],[-3,2],[1,3],[-2,0],[-1,-1],[1,-5],[0,-2],[-2,-11],[1,1],[1,7],[1,2],[0,-1],[1,-3],[0,-1],[1,-3],[0,-2],[0,-1],[0,-1],[0,-1],[0,-1],[2,3],[0,1],[1,0],[0,-2],[0,-2],[0,-1],[1,-1],[-1,-2],[0,-6],[0,-1],[0,-1],[-1,1],[0,-2],[1,-5],[0,-2],[1,-1],[-1,-1],[0,1],[-1,3],[0,1],[-1,-2],[1,-5],[-1,-2],[-1,3],[1,-4],[-2,0],[-2,-1],[-1,-2],[-2,-9],[0,-4],[0,-2],[-1,0],[0,2],[-1,1],[0,2],[-1,-1],[-1,0],[0,3],[0,3],[0,2],[-1,-3],[0,-1],[-1,-1],[0,-6],[0,2],[-2,-7],[0,-1],[0,-3],[1,1],[2,3],[-1,-4],[0,-3],[-1,-5],[0,5],[-1,-3],[0,-3],[-1,-1],[-1,-2],[-1,0],[0,1],[0,4],[0,6],[0,6],[1,3],[0,2],[1,3],[1,2],[-1,2],[0,2],[1,3],[0,3],[0,3],[0,3],[0,2],[0,3],[0,3],[0,1],[1,3],[1,1],[0,-1],[0,-1],[1,0],[0,3],[0,5],[0,6],[0,5],[0,1],[1,0],[0,2],[1,5],[0,2],[0,3],[0,5],[0,5],[-1,8],[-1,3],[1,2],[0,1],[0,2],[0,2],[0,1],[0,1],[0,1],[0,1],[0,2],[0,1],[0,1],[0,6],[0,4],[1,1],[1,0],[1,-1],[0,-1],[0,1],[1,3],[1,-4]],[[9658,1370],[1,-2],[-1,3],[0,2],[1,-1],[-1,-2]],[[9650,1467],[-1,-1],[0,1],[0,3],[0,3],[1,2],[0,1],[0,-2],[1,-1],[-1,-2],[0,-4]],[[9647,1484],[0,-1],[-1,4],[0,1],[1,1],[0,-1],[0,-2],[0,-2]],[[9649,1500],[-1,-4],[-1,1],[0,1],[1,1],[0,1],[0,1],[0,1],[1,0],[0,-1],[0,-1]],[[9654,1554],[-3,-6],[-1,-1],[0,1],[-1,0],[1,1],[0,1],[1,2],[1,3],[2,0],[0,1],[0,-1],[0,-1]],[[9647,1550],[-1,-1],[0,1],[0,1],[0,2],[1,1],[0,2],[1,0],[0,-1],[0,-1],[0,-2],[-1,0],[0,-1],[0,-1]],[[9656,1553],[-1,0],[0,2],[0,1],[0,1],[0,2],[0,1],[2,-1],[0,-1],[0,-1],[0,-1],[-1,-3]],[[9653,1583],[0,-5],[0,-5],[0,-5],[0,-5],[0,-3],[-1,-2],[0,-1],[0,1],[0,3],[-1,1],[0,-4],[0,-1],[-1,0],[0,3],[0,4],[0,5],[0,2],[0,5],[-1,-1],[-2,-12],[0,-1],[-1,-2],[1,3],[0,5],[0,3],[1,2],[0,1],[0,3],[0,3],[0,1],[1,0],[2,4],[1,0],[1,-2]],[[9661,1657],[-1,-1],[-1,3],[0,2],[-1,1],[0,2],[0,3],[-1,3],[0,1],[0,1],[0,1],[1,2],[1,16],[0,-1],[0,-1],[1,-1],[0,-8],[0,-8],[1,-15]],[[9722,1358],[-1,0],[0,-1],[0,-5],[0,-2],[0,-1],[0,-1],[-1,-1],[-1,1],[0,2],[0,2],[-1,2],[0,-1],[0,-2],[0,-2],[0,-3],[-1,-3],[-1,2],[-1,2],[0,2],[-1,0],[-1,0],[0,3],[-1,14],[0,2],[0,3],[-1,-2],[-3,-3],[-1,0],[0,2],[0,1],[1,1],[0,1],[0,2],[-1,0],[-1,1],[0,-3],[0,-2],[0,-2],[0,-3],[0,-2],[0,-1],[-1,-2],[-5,2],[0,4],[1,1],[0,1],[0,1],[1,0],[0,-1],[1,-2],[1,-1],[0,1],[-1,4],[0,2],[-3,0],[-1,4],[-1,-4],[0,-4],[1,-6],[1,-4],[-1,0],[-1,7],[-1,2],[0,1],[0,2],[0,2],[-1,2],[0,1],[0,2],[0,3],[1,1],[0,-1],[0,-1],[0,-2],[1,2],[1,7],[0,6],[0,7],[0,5],[-1,0],[0,-5],[0,-6],[-1,-3],[-1,3],[0,10],[-2,16],[0,2],[-1,2],[-3,-3],[0,-1],[0,-3],[0,-3],[0,-1],[0,1],[-1,1],[0,1],[-1,-1],[-1,1],[0,-2],[-1,-3],[-1,1],[0,1],[-1,-3],[0,1],[-1,1],[0,3],[0,2],[-1,5],[0,1],[-1,2],[0,2],[0,1],[1,1],[0,1],[0,3],[-1,11],[-1,7],[0,4],[0,2],[-1,1],[-1,1],[-1,5],[-1,0],[-3,2],[0,-2],[0,-3],[0,-2],[-1,-4],[0,-3],[0,-3],[0,-3],[0,-3],[-1,-1],[-1,1],[0,-1],[-1,-3],[0,-1],[-1,0],[-1,3],[-1,0],[0,-1],[-1,-1],[0,-1],[0,1],[0,1],[0,1],[-1,0],[-1,5],[-1,0],[-1,0],[-2,3],[-4,-1],[-1,2],[-2,7],[-1,6],[0,2],[0,2],[1,2],[0,1],[1,7],[1,8],[1,10],[1,5],[0,2],[1,1],[1,6],[1,2],[0,2],[-1,-1],[-1,-6],[-2,-2],[0,-2],[-1,-3],[0,-3],[0,-1],[0,-2],[0,-2],[0,-1],[-1,-5],[0,-1],[0,2],[0,1],[0,2],[0,2],[0,2],[-1,-8],[0,-3],[-2,-2],[0,4],[0,4],[0,1],[0,-1],[0,7],[1,5],[0,3],[1,3],[2,3],[0,2],[1,5],[-1,-3],[-1,-2],[-1,1],[0,2],[0,1],[1,11],[0,2],[0,2],[0,2],[0,-1],[-1,-1],[0,-2],[0,-1],[0,-1],[0,-2],[0,-1],[-1,-2],[0,-1],[-1,-7],[0,-3],[0,-2],[-3,-5],[0,-1],[-1,-4],[0,-1],[0,1],[0,3],[-1,3],[0,2],[1,2],[-1,3],[0,5],[0,20],[1,5],[0,3],[2,1],[2,0],[0,-1],[0,-2],[0,3],[1,2],[2,0],[1,0],[1,4],[1,0],[1,0],[0,1],[1,2],[0,1],[1,3],[1,3],[0,3],[1,5],[-1,-3],[-1,-1],[-2,2],[-2,-4],[-1,1],[0,6],[1,3],[0,2],[2,2],[0,2],[-2,-2],[-1,1],[0,5],[0,5],[0,4],[1,2],[1,1],[1,4],[1,1],[1,-3],[1,-1],[1,4],[-1,-1],[-1,1],[0,3],[2,3],[1,4],[0,5],[-4,-11],[-2,-3],[-2,-5],[-1,-1],[-1,0],[0,1],[0,4],[0,4],[1,13],[0,13],[1,4],[1,4],[1,-4],[2,-5],[1,-1],[0,5],[-1,6],[0,2],[-1,-5],[0,2],[-1,3],[-1,2],[0,3],[0,2],[0,3],[0,4],[1,6],[1,2],[0,-4],[1,-3],[1,-3],[0,-1],[0,-2],[-1,-2],[0,-2],[1,1],[1,2],[1,0],[1,-4],[0,-2],[0,-2],[0,-3],[0,-2],[-1,-4],[0,-2],[0,-1],[1,1],[0,1],[0,2],[1,3],[0,3],[0,1],[1,-4],[0,-1],[0,-2],[1,-5],[0,-8],[0,1],[1,-2],[0,-1],[0,8],[-2,11],[-2,16],[0,3],[0,1],[3,5],[1,0],[0,-2],[1,-5],[0,-2],[1,-1],[1,1],[0,3],[-1,1],[-1,-1],[0,2],[0,2],[0,1],[0,5],[0,2],[0,1],[-1,0],[-1,-2],[-1,-2],[-2,-1],[0,2],[0,3],[-1,4],[0,5],[0,2],[-1,3],[0,10],[1,4],[0,2],[1,0],[1,-3],[1,-8],[0,-2],[1,-1],[0,2],[0,1],[-1,5],[-1,8],[-1,3],[1,10],[1,4],[0,-1],[1,-10],[0,-3],[0,-3],[0,-3],[1,-2],[0,3],[0,5],[0,2],[0,1],[2,-1],[0,2],[-2,4],[-1,2],[0,4],[0,3],[0,4],[0,4],[1,1],[0,-1],[1,-2],[1,-1],[0,-2],[1,-4],[1,-2],[0,3],[0,1],[-4,11],[0,2],[0,3],[0,3],[2,7],[0,2],[1,0],[0,1],[0,1],[0,2],[0,1],[2,8],[1,0],[0,-7],[0,-1],[1,-1],[0,-2],[0,-2],[0,-2],[0,-5],[0,-2],[0,-3],[0,-2],[0,-3],[0,-4],[1,-1],[1,1],[0,2],[-1,1],[0,2],[0,2],[0,1],[0,2],[0,3],[0,2],[0,4],[0,3],[-1,3],[0,3],[0,7],[0,3],[0,8],[1,5],[1,1],[1,-5],[0,-4],[0,-1],[0,-2],[-1,-3],[0,-4],[0,-3],[1,-3],[0,-2],[0,5],[0,3],[1,3],[0,4],[0,5],[-1,5],[0,4],[0,3],[0,1],[0,2],[0,1],[1,1],[0,-1],[1,-4],[0,-3],[1,-2],[0,-1],[0,2],[-1,7],[-1,4],[0,3],[0,3],[1,2],[1,2],[0,2],[0,3],[1,1],[0,1],[0,1],[1,1],[0,5],[1,2],[1,-1],[1,-7],[1,-3],[1,-2],[0,-10],[1,2],[0,4],[0,3],[-1,3],[0,1],[0,2],[-1,5],[0,1],[-1,0],[0,2],[0,2],[0,6],[0,6],[0,4],[0,2],[0,6],[3,15],[0,4],[1,5],[1,5],[0,7],[3,0],[0,1],[0,4],[0,3],[0,1]],[[9908,3625],[-1,0],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,1],[0,1],[0,3],[1,1],[0,-2],[0,-6],[1,-1],[0,-1],[0,-2],[0,-1]],[[9874,3153],[0,1],[0,1],[0,4],[0,3],[0,3],[0,4],[0,40],[1,8],[1,14],[0,8],[0,9],[0,14],[1,8],[0,4],[-1,4],[0,5],[0,3],[0,4],[1,-2],[1,1],[0,1],[0,-3],[0,-2],[0,-2],[1,-1],[0,3],[0,-2],[1,-3],[0,-1],[1,2],[-1,1],[0,3],[1,2],[0,-1],[1,1],[1,5],[-1,0],[0,-1],[0,-1],[0,2],[0,4],[-1,3],[-1,2],[0,-1],[-1,-3],[0,-2],[0,-1],[0,-1],[-1,1],[0,4],[1,3],[0,3],[0,2],[0,1],[1,1],[1,7],[0,2],[0,4],[0,4],[-1,0],[0,-3],[-1,-6],[0,-3],[-1,4],[0,4],[0,22],[1,10],[2,3],[1,1],[2,1],[0,2],[-1,2],[0,1],[0,2],[1,2],[0,3],[-1,4],[-1,-5],[0,-1],[0,-2],[0,-1],[-1,1],[0,-3],[-1,4],[-2,45],[-1,25],[-1,10],[0,3],[1,2],[0,2],[1,1],[0,1],[0,4],[1,6],[0,4],[1,2],[0,1],[0,1],[-1,1],[0,-1],[0,-1],[-1,-3],[0,-1],[-1,-10],[0,-1],[-1,4],[0,4],[-1,8]],[[9893,3538],[1,-2],[0,-4],[0,-5],[-1,-16],[0,-5],[1,-5],[0,-4],[1,-3],[1,-4],[1,0],[1,2],[1,3],[0,2],[1,1],[0,1],[0,1],[0,-1],[0,-3],[0,-5],[0,-4],[1,-3],[0,-1],[1,3],[-1,0],[0,3],[0,3],[0,7],[0,6],[0,3],[-1,7],[0,3],[0,12],[0,3],[0,2],[-1,14],[0,3],[0,2],[-1,3],[0,3],[-1,2],[0,2],[0,3],[0,2],[0,2],[0,2],[1,-1],[1,4],[-1,0],[-1,0],[0,2],[1,1],[0,1],[0,2],[0,1],[-1,1],[2,2],[0,3],[0,6],[0,-2],[0,-1],[-1,2],[0,2],[0,2],[0,3],[0,7],[0,6],[0,5],[0,5],[0,1],[-1,1],[0,2],[0,1],[0,4],[-1,2],[-1,3],[0,3],[-1,3],[0,3],[0,9],[0,3],[1,0],[1,0],[1,1],[0,-1],[0,-2],[0,-2],[0,-2],[0,-1],[1,-1],[0,-4],[1,5],[1,-4],[0,-6],[0,-6],[-1,-4],[1,-3],[1,0],[0,-1],[0,-6],[0,-6],[0,-3],[0,1],[0,2],[-1,0],[0,-2],[0,-3],[1,-1],[1,1],[0,-1],[0,-2],[0,-3],[0,-2],[0,-2],[0,-7],[1,5],[0,1],[0,1],[0,2],[0,1],[1,-1],[0,-1],[0,-1],[1,1],[1,4],[0,1],[1,-1],[0,-3],[1,1],[0,1],[0,-4],[0,-3],[0,-1],[-1,1],[0,-1],[-1,-7],[0,-2],[-1,-2],[0,-1],[-1,-4],[0,-5],[0,-2],[0,-2],[0,-1],[0,-2],[1,-2],[0,-2],[0,1],[0,2],[1,2],[-1,8],[1,3],[0,-3],[1,2],[1,-3],[0,-3],[0,-6],[0,-2],[1,-4],[0,-2],[0,-3],[0,-10],[0,-8],[0,-1],[0,-2],[0,-3],[0,-2],[0,-3],[0,-1],[0,1],[0,3],[1,1],[0,-4],[0,-6],[0,-6],[-1,-5],[0,-2],[1,-1],[0,-3],[0,-7],[0,-3],[0,1],[0,2],[-1,2],[0,3],[0,-6],[0,-5],[1,-4],[-1,-2],[1,-3],[0,-2],[1,-5],[0,-8],[0,-9],[0,-2]],[[9881,2658],[0,-1],[0,1],[0,1],[0,1],[0,1],[1,6],[0,1],[0,4],[0,1],[1,0],[0,-1],[0,-1],[-1,-5],[-1,-8]],[[9920,2678],[-1,-15],[0,-11],[-1,-4],[-1,-4],[-1,-4],[0,-5],[0,-5],[-1,-20],[-1,-9],[-3,-24],[-4,-22],[-1,-7],[-1,-6],[-2,-5],[-6,-29],[-2,-5],[-1,-2],[0,-7],[-1,-1],[-2,-1],[0,1],[-1,8],[0,2],[0,3],[0,3],[0,2],[-1,3],[0,3],[1,17],[0,2],[-1,2],[-3,8],[-1,0],[0,-1],[-1,-3],[-1,-9],[-1,-1],[-1,3],[0,3],[-1,1],[1,5],[0,4],[0,4],[0,5],[0,5],[0,9],[1,6],[-1,5],[-1,1],[0,-1],[-1,-1],[0,-3],[-1,-2],[0,-3],[0,-3],[1,-2],[1,-3],[-1,-5],[0,-2],[0,-1],[-1,1],[0,1],[0,-2],[-1,-2],[0,-1],[-1,2],[-2,4],[-1,7],[0,7],[0,5],[1,2],[1,1],[1,3],[1,8],[0,4],[1,9],[1,3],[0,1],[1,3],[0,-6],[1,2],[0,2],[0,2],[0,3],[-1,1],[0,3],[0,3],[0,1],[0,1],[1,4],[0,1],[1,1],[0,1],[0,3],[0,2],[1,2],[0,3],[0,5],[0,11],[1,3],[1,11],[1,8]],[[49,1876],[0,-2],[0,4],[-1,2],[0,1],[0,1],[1,2],[0,6],[0,2],[0,3],[-1,1],[0,1],[1,2],[0,2],[1,1],[0,-1],[1,-1],[0,-2],[0,-1],[0,-1],[0,-1],[1,-3],[-1,-4],[-1,-3],[0,-5],[-1,-4]],[[39,2017],[1,-1],[1,0],[2,-5],[1,-1],[6,3],[0,-2],[-1,-1],[0,-3],[0,-3],[-1,4],[-1,-4],[-1,-7],[-2,-14],[0,-4],[0,-4],[0,-2],[0,-1],[0,1],[0,2],[0,5],[0,3],[-1,2],[1,2],[0,4],[1,5],[0,4],[-1,5],[0,2],[-2,0],[-2,2],[0,-2],[0,-5],[0,-3],[3,-3],[-2,-10],[0,-3],[1,-8],[0,-3],[0,-3],[0,-3],[0,-3],[1,-3],[1,6],[0,-5],[0,-4],[0,-2],[1,-3],[0,-2],[1,-1],[0,-1],[0,-6],[0,-2],[-2,0],[0,-1],[-1,-1],[0,-2],[-1,-4],[-1,-3],[0,-5],[-1,0],[-1,0],[-1,1],[0,2],[0,4],[0,5],[-1,8],[0,2],[-1,0],[0,2],[0,1],[1,2],[2,8],[0,2],[0,2],[1,3],[0,4],[0,5],[-1,14],[-1,4],[0,3],[-1,1],[-1,-1],[0,-1],[0,1],[0,-2],[0,-3],[-1,0],[0,-1],[-1,2],[-2,-4],[-1,5],[0,4],[1,2],[1,3],[0,2],[0,2],[0,1],[0,1],[1,-4],[3,1],[0,3],[1,4],[0,4],[0,2],[1,1],[0,-2]],[[1,5293],[0,-1],[0,1],[0,3],[0,2],[-1,4],[0,1],[0,3],[1,-1],[0,-1],[1,-1],[0,-2],[1,-2],[0,-6],[0,2],[-1,-1],[0,-1],[0,-3],[-1,3]],[[190,9813],[0,1],[-1,2],[0,1],[0,2],[0,1],[0,-1],[0,-2],[1,-1],[0,-3]],[[9804,4189],[1,0],[0,-1],[0,-1],[-1,0],[0,-1],[0,-1],[0,-1],[1,0],[-1,-1],[0,1],[0,1],[0,1],[0,1],[-1,1],[1,1],[0,-1],[0,1]],[[9992,674],[0,-4],[0,-3],[0,-4],[-1,-4],[0,-4],[0,-1],[-1,0],[-1,1],[-1,3],[0,6],[1,3],[1,8],[0,2],[1,1],[0,-1],[1,-1],[0,-2]],[[9723,18],[1,-5],[0,-3],[-1,-1],[0,-3],[0,-3],[-1,-3],[-1,0],[-1,1],[0,2],[-1,2],[0,1],[-1,2],[0,1],[0,-2],[-1,4],[0,2],[0,2],[1,0],[1,-2],[0,-1],[1,5],[0,4],[0,4],[1,2],[0,3],[1,0],[0,-1],[0,-3],[0,1],[1,-2],[0,-2],[1,-1],[0,-4],[0,-1],[-1,1]],[[9636,394],[2,-3],[1,-2],[-1,-1],[-1,-1],[0,-2],[-1,0],[0,-2],[-4,2],[0,1],[0,1],[-1,2],[0,3],[-1,2],[0,3],[1,0],[0,-2],[1,-3],[2,2],[1,2],[0,1],[1,-3]],[[9639,470],[0,-3],[0,-1],[0,-1],[1,2],[0,-1],[0,-3],[1,-3],[0,-1],[-1,0],[-1,0],[0,-2],[0,-1],[0,-2],[0,-3],[-1,1],[0,1],[-1,-2],[1,-1],[0,-2],[0,-6],[0,1],[-1,1],[1,-4],[0,-1],[-1,-1],[0,-4],[0,1],[1,0],[0,-1],[1,-1],[-1,-2],[-2,1],[0,-1],[0,-1],[1,-3],[1,0],[0,-4],[-1,-4],[1,0],[1,0],[0,-2],[0,-2],[0,-2],[0,-2],[-1,0],[0,-2],[1,-1],[0,-2],[0,-1],[0,-4],[0,-4],[0,-2],[-1,1],[-1,3],[0,2],[-1,2],[-1,5],[0,-2],[0,-2],[-1,-2],[0,3],[0,3],[1,4],[-1,3],[0,2],[0,2],[-1,0],[0,-2],[0,-1],[1,-2],[0,-2],[-1,-1],[0,1],[-1,2],[0,-2],[1,-1],[0,-2],[0,-3],[0,-3],[0,-3],[0,-1],[-1,0],[-1,0],[0,2],[0,3],[-1,0],[0,-2],[-1,-5],[0,13],[1,9],[4,14],[0,4],[1,5],[0,7],[0,5],[0,6],[1,5],[-1,4],[1,1],[0,1],[1,-2],[1,2],[1,1],[0,-2]],[[9650,1046],[0,-2],[0,-5],[0,-2],[0,-2],[0,-2],[0,-3],[0,1],[0,1],[-1,3],[0,1],[-1,-1],[0,1],[2,9],[0,1]]],"transform":{"scale":[0.03570899895979599,0.004406149259926003],"translate":[-177.95799719999988,-52.600313270999976]}};
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
