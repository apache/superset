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
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = {"type":"Topology","objects":{"per":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Callao"},"id":"PE.","arcs":[[[0]],[[1,2]]]},{"type":"Polygon","properties":{"name":"Lambayeque"},"id":"PE.LB","arcs":[[3,4,5,6]]},{"type":"MultiPolygon","properties":{"name":"Piura"},"id":"PE.PI","arcs":[[[7]],[[8,-7,9,10,11]]]},{"type":"Polygon","properties":{"name":"Tumbes"},"id":"PE.TU","arcs":[[-11,12]]},{"type":"Polygon","properties":{"name":"Apurímac"},"id":"PE.AP","arcs":[[13,14,15]]},{"type":"Polygon","properties":{"name":"Arequipa"},"id":"PE.AR","arcs":[[16,17,18,19,20,21,-15]]},{"type":"Polygon","properties":{"name":"Cusco"},"id":"PE.CS","arcs":[[22,23,-17,-14,24,25,26]]},{"type":"Polygon","properties":{"name":"Madre de Dios"},"id":"PE.MD","arcs":[[27,-23,28,29]]},{"type":"Polygon","properties":{"name":"Callao"},"id":"PE.CL","arcs":[[30,31,32,-18,-24,-28]]},{"type":"Polygon","properties":{"name":"Moquegua"},"id":"PE.MQ","arcs":[[33,34,-19,-33]]},{"type":"Polygon","properties":{"name":"Tacna"},"id":"PE.TA","arcs":[[-32,35,-34]]},{"type":"Polygon","properties":{"name":"Ancash"},"id":"PE.AN","arcs":[[36,37,38,39]]},{"type":"Polygon","properties":{"name":"Cajamarca"},"id":"PE.CJ","arcs":[[40,-4,-9,41,42]]},{"type":"Polygon","properties":{"name":"Huánuco"},"id":"PE.HC","arcs":[[43,44,45,46,-37,47,48]]},{"type":"Polygon","properties":{"name":"La Libertad"},"id":"PE.LL","arcs":[[-41,49,50,-48,-40,51,-5]]},{"type":"Polygon","properties":{"name":"Pasco"},"id":"PE.PA","arcs":[[52,53,-46,54]]},{"type":"Polygon","properties":{"name":"San Martín"},"id":"PE.SM","arcs":[[-49,-51,55,56]]},{"type":"Polygon","properties":{"name":"Ucayali"},"id":"PE.UC","arcs":[[57,-29,-27,58,-55,-45,59]]},{"type":"Polygon","properties":{"name":"Amazonas"},"id":"PE.AM","arcs":[[-56,-50,-43,60,61]]},{"type":"Polygon","properties":{"name":"Loreto"},"id":"PE.LO","arcs":[[-60,-44,-57,-62,62]]},{"type":"Polygon","properties":{"name":"Ayacucho"},"id":"PE.AY","arcs":[[-25,-16,-22,63,64,65]]},{"type":"Polygon","properties":{"name":"Lima Province"},"id":"PE.LR","arcs":[[66,-3,67,68]]},{"type":"Polygon","properties":{"name":"Huancavelica"},"id":"PE.HV","arcs":[[-65,69,70,71]]},{"type":"MultiPolygon","properties":{"name":"Ica"},"id":"PE.IC","arcs":[[[72]],[[73]],[[-64,-21,74,75,-70]]]},{"type":"Polygon","properties":{"name":"Junín"},"id":"PE.JU","arcs":[[-59,-26,-66,-72,76,-53]]},{"type":"Polygon","properties":{"name":"Lima"},"id":"PE.LR","arcs":[[-54,-77,-71,-76,77,-69,78,-38,-47]]}]}},"arcs":[[[3281,3402],[3,-4],[-8,2],[-10,-1],[-10,5],[-15,6],[-9,9],[-5,8],[8,2],[9,-3],[30,-19],[7,-5]],[[3337,3417],[-14,3],[-34,2],[7,10],[9,8],[8,9],[3,13]],[[3316,3462],[1,0],[22,-11],[4,-13],[-2,-14],[-4,-7]],[[1491,6744],[10,-7],[9,1],[8,3],[8,3],[13,2],[8,-1],[5,-3],[3,-5],[0,-2],[4,-5],[17,9],[9,6],[10,3],[8,0],[7,-3],[5,-3],[5,-3],[15,-5],[19,-4],[11,-3],[8,-4],[3,-5],[0,-6],[-2,-6],[-3,-5],[-5,-5],[-46,-29],[-5,-5],[-2,-5],[0,-7],[3,-6],[8,-5],[11,-2],[11,-4],[4,-5],[-1,-7],[-7,-15],[-27,-20],[-64,-8],[-18,-5],[-13,-4],[-9,-5],[-12,-8],[-8,-7],[-7,-8],[-3,-7],[0,-6],[3,-5],[12,-13],[3,-5],[1,-6],[-2,-6],[-8,-14],[5,-25],[4,-4],[7,-4],[8,0],[8,1],[9,-1],[11,-4],[7,-6],[5,-6],[13,-28],[15,-22],[11,-8],[11,-5],[18,1],[19,0],[23,-9],[39,-5],[7,-3],[7,-6],[2,-6],[0,-6],[-1,-7],[-2,-6],[-4,-4],[-7,-4],[-14,-4],[-10,-5],[-26,-26],[-17,-9],[-20,-5],[-14,-5],[-6,-4],[-4,-6],[2,-44],[-2,-8],[-2,-4],[-5,-4],[-5,-1],[-10,-1]],[[1572,6186],[-21,13],[-74,14],[-12,0],[-7,-2],[-5,-2],[-133,-89],[-20,-16]],[[1300,6104],[1,2],[2,14],[-15,14],[-84,57],[-41,28],[-9,12],[-43,25],[-11,17],[-3,17],[-12,18],[-19,16],[-13,9],[-90,50],[-40,17],[-102,41],[-128,44],[-134,47]],[[559,6532],[17,10],[27,22],[67,70],[5,6],[9,22],[5,8],[13,14],[95,77],[10,5],[10,3],[245,49],[28,13],[6,4],[5,9],[4,16],[-3,57],[-13,54],[3,12],[5,2],[4,0],[20,-10],[35,-22],[48,-25],[8,-6],[12,-12],[4,-7],[5,-6],[4,-5],[11,-9],[7,-6],[2,-6],[-2,-5],[-4,-5],[-4,-4],[-7,-10],[-2,-5],[-1,-4],[0,-3],[2,-5],[3,-5],[7,-4],[13,-2],[22,-1],[10,-3],[10,-3],[11,-7],[7,-6],[5,-5],[10,-16],[6,-4],[8,-3],[16,-1],[8,-1],[17,2],[17,4],[10,0],[10,0],[32,-7],[9,-3],[6,-4],[15,-17]],[[394,6479],[-9,-1],[-11,0],[-2,5],[3,6],[-3,8],[-7,5],[6,4],[3,8],[9,19],[8,-3],[-5,-4],[-5,-9],[4,-8],[7,-5],[0,-7],[-1,-9],[3,-9]],[[1663,7303],[-21,-14],[-5,-7],[-4,-13],[-4,-8],[-7,-2],[-10,-2],[-9,-5],[-14,-21],[-8,-8],[-14,-8],[-21,-16],[-6,-9],[-1,-7],[19,-32],[2,-7],[0,-9],[-1,-14],[2,-7],[6,-5],[8,-2],[7,-4],[5,-6],[7,-75],[-4,-11],[-11,0],[-8,2],[-8,1],[-14,1],[-8,-2],[-3,-1],[-12,-19],[-2,-4],[0,-2],[0,-3],[2,-6],[5,-8],[1,-3],[0,-3],[1,-11],[-6,-30],[-12,-36],[1,-9],[2,-6],[11,-16],[2,-6],[0,-13],[0,-1],[3,-5],[3,-5],[1,-1],[1,-1],[9,-6],[11,-7],[7,-22],[-9,-8],[-7,-3],[-8,-3],[-9,-5],[-28,-20],[-14,-6]],[[559,6532],[-77,26],[-50,16],[-49,33],[-58,28],[-69,27],[-69,37],[-24,20],[-16,32],[2,22],[0,24],[-1,5],[16,9],[5,11],[4,4],[18,0],[8,13],[1,8],[7,8],[14,-1],[16,-17],[22,-7],[30,-8],[25,-2],[29,19],[31,39],[6,51],[-19,42],[-40,60],[-24,18],[-74,50],[-13,11],[-18,3],[-10,-2],[-19,9],[-17,18],[-20,16],[-16,17],[4,5],[5,4],[10,3],[7,11],[-3,7],[-7,5],[1,7],[11,2],[-3,10],[-4,12],[7,8],[13,-2],[14,6],[13,-9],[23,1],[12,12],[4,19],[-17,26],[-27,19],[-24,13],[-19,19],[-13,16],[-27,25],[-63,47],[-27,23],[4,7],[10,4],[12,8],[-3,11],[-6,12],[6,28],[1,9],[-5,9],[-7,12],[-5,10],[3,8],[8,5],[6,3],[5,3],[6,6],[11,19],[0,12],[-11,31],[3,11],[9,13],[11,12],[9,7],[69,32],[18,13],[14,18],[12,9],[15,3],[14,3],[8,6],[1,1]],[[218,7785],[1,-1],[51,-33],[15,-6],[39,-7],[63,3],[23,-1],[26,-5],[76,-20],[10,0],[4,0],[5,2],[6,4],[16,14],[99,60]],[[652,7795],[-1,-10],[4,-7],[13,-12],[4,-7],[0,-5],[-3,-11],[0,-5],[17,-24],[27,-2],[35,7],[36,3],[-9,-12],[-104,-96],[-3,-9],[7,-12],[11,-6],[35,-14],[13,-3],[14,0],[6,0],[8,5],[32,12],[61,32],[13,9],[5,9],[9,19],[6,8],[7,4],[8,2],[9,2],[32,3],[2,1],[5,-6],[13,-3],[16,-2],[14,-3],[14,-9],[26,-19],[16,-8],[21,-8],[21,-2],[20,0],[21,-3],[20,-13],[16,-17],[20,-14],[29,-3],[53,11],[28,11],[28,3],[22,-8],[40,-27],[6,-2],[11,-6],[5,-2],[19,1],[16,-7],[5,-5],[-2,-8],[-18,-22],[-1,-12],[23,-23],[9,-33],[21,-27],[2,-11],[6,-11],[14,-8],[16,-6],[14,-7],[4,-4],[5,-11],[4,-5],[7,-3],[16,-4],[7,-3],[10,-11],[9,-11],[11,-10],[18,-3],[37,1]],[[218,7785],[12,16],[42,45],[25,17],[30,17],[32,12],[12,8],[5,11],[2,13],[5,11],[15,19],[21,19],[28,16],[125,51],[23,15],[33,34],[5,12],[7,1],[8,1],[7,3],[12,3],[55,-1],[15,2],[16,5],[13,7],[5,10],[3,6],[10,12],[3,6],[1,6],[5,-2],[13,-5],[30,-5],[11,-6],[-2,-10],[-4,-11],[1,-12],[5,-3],[13,-3],[5,-4],[2,-5],[0,-6],[-1,-10],[-6,-15],[-1,-4],[6,-4],[7,-2],[7,-2],[2,-5],[0,-6],[5,-10],[1,-6],[-1,-6],[-5,-10],[-2,-5],[0,-6],[1,-4],[5,-10],[1,-6],[-3,-4],[-3,-4],[-2,-4],[4,-11],[16,-17],[7,-11],[1,-5],[0,-10],[2,-5],[7,-5],[7,-4],[5,-3],[-1,-6],[-12,-9],[-62,-20],[-11,-9],[-11,-13],[-14,-11],[-16,-6],[-15,2],[-33,12],[-17,4],[-16,1],[-16,-1],[-14,-3],[-12,-6],[-9,-9],[-9,-13],[-7,-14]],[[6414,2685],[28,-6],[7,-3],[5,-2],[6,2],[6,3],[5,2],[15,-4],[12,-8],[14,-4],[18,7],[14,9],[6,2],[10,2],[3,-1],[8,-3],[5,0],[4,1],[2,0],[24,13],[11,3],[26,2],[21,0],[5,-2],[1,-5],[3,-5],[5,-5],[4,-2],[32,0],[30,-3],[25,-9],[53,-28],[57,-22],[9,-1],[6,-2],[7,-8],[8,-1],[32,-2],[31,-6],[4,-2],[4,-2],[5,-2],[11,-1],[32,0],[11,-3],[9,-7],[16,-17],[-6,-4],[10,-7],[14,-7],[30,-12],[12,-2],[40,2],[4,-3],[25,-13],[6,-1],[7,-5],[42,-26],[12,-12],[8,-13],[18,-22],[3,-6],[14,-15],[11,-16],[0,-95],[-24,-58],[-8,-10],[-5,-4],[-5,-4],[-27,-12],[-6,-4],[-6,-4],[-19,-17],[-19,-13],[-7,-7],[-22,-29],[-7,-5],[-28,-5],[-11,-4],[-13,-2],[-17,-1],[-9,-4],[-5,-4],[-5,-6],[-6,-6],[-13,-7],[-14,-4],[-18,-3],[-11,-4],[-8,-4],[-8,-6],[-5,-5],[-5,-6],[-2,-5],[0,-6],[2,-5],[12,-15],[3,-5],[1,-6],[-1,-14],[-3,-13]],[[6995,2001],[-66,-12],[-16,-2],[-14,2],[-9,2],[-8,3],[-12,2],[-14,1],[-25,-1],[-13,2],[-11,2],[-7,3],[-7,2],[-17,4],[-12,-1],[-14,-6],[-22,-13],[-19,-20]],[[6709,1969],[-52,16],[-9,5],[-26,13],[-19,7],[-16,8],[-23,8],[-6,-5],[-7,-9],[-5,-4],[-9,-2],[-10,-1],[-13,1],[-9,0],[-8,-2],[-11,-8],[-6,-3],[-8,-1],[-13,-1],[-17,-3],[-33,-7],[-19,-3],[-19,-1],[-8,0],[-10,1],[-12,3],[-19,5],[-8,1],[-8,0],[-5,-3],[-3,-6],[-3,-5],[-4,-5],[-4,-5],[-17,-11],[-5,-5],[-7,-10],[-5,-4],[-7,-3],[-8,-2],[-24,-1],[-22,-4],[-14,-2],[-11,8],[-31,58],[-1,3],[8,1],[18,-1],[9,2],[6,6],[19,46],[-2,12],[-12,16],[-19,23],[-1,10],[5,33],[6,38],[-1,21],[-4,23],[0,9],[-1,7],[-4,9],[-25,28],[-19,17],[-6,8],[-6,11],[-10,23],[-7,36],[-89,115],[-4,12],[34,6],[9,3],[4,3],[0,8],[-17,14],[-17,20],[-5,4],[-6,3],[-7,3],[-7,1],[-13,2],[-8,3],[-6,6],[-11,17],[-3,8],[-3,38],[-8,20],[-1,20],[-9,11],[-2,5],[-3,19],[1,7],[4,8],[17,15],[6,10],[-11,12],[-2,5],[2,5],[7,9],[6,12],[3,5],[5,4],[8,2],[9,-1],[9,-4],[11,-7],[10,-12],[15,-10],[138,-59],[12,-6],[32,-22],[23,-8],[75,-7],[8,-2],[16,-4],[10,-1],[13,0],[10,-1],[28,-4],[8,0],[8,3],[5,5],[7,16],[4,6]],[[6995,2001],[-2,-10],[-4,-10],[0,-5],[2,-5],[5,-5],[49,-42],[19,-7],[50,-9],[53,9],[21,2],[20,3],[17,4],[19,7],[8,0],[11,-1],[7,-3],[6,-4],[4,-4],[9,-17],[4,-5],[4,-5],[5,-4],[7,-3],[7,0],[8,2],[21,20],[1,5],[1,5],[2,6],[9,12],[2,5],[0,11],[0,5],[-2,6],[-4,5],[-9,9],[-3,5],[1,5],[2,6],[4,5],[6,3],[7,2],[8,0],[6,-2],[5,-1],[5,-3],[17,-11],[38,-37],[15,-15],[10,-17],[4,-5],[5,-4],[8,-4],[10,-3],[16,-3],[11,-1],[9,-2],[3,-4],[-1,-5],[-3,-5],[-5,-4],[-6,-4],[-15,-5],[-6,-3],[-4,-4],[-1,-6],[8,-28],[1,-5],[-2,-4],[-2,-5],[-7,-9],[-2,-6],[10,-6],[20,-7],[100,-17],[8,-3],[9,-4],[8,-1],[7,1],[21,11],[13,4],[8,2],[18,2],[9,0],[19,-1],[10,0],[9,1],[7,2],[6,4],[2,5],[-2,4],[-3,5],[-2,5],[1,5],[5,2],[10,-1],[25,-13],[12,-2],[18,2],[11,-2],[12,-5],[46,-28],[8,-3],[11,-2],[9,0],[7,3],[23,15],[6,3],[7,3],[8,1],[7,0],[9,-1],[7,-3],[7,-3],[6,-4],[6,-6],[6,-10],[2,-6],[-1,-7],[-3,-12],[-3,-23],[3,-5],[5,-5],[12,-4],[22,-5],[13,-5],[22,-12],[12,-8],[17,-16],[14,-9]],[[8146,1640],[3,-17],[-6,-36],[2,-9],[4,-6],[6,-5],[5,-7],[1,-5],[0,-4],[-2,-7],[-3,-18],[2,-7],[3,-6],[26,-22],[10,-7],[33,-18],[6,-5],[8,-9],[2,-8],[0,-7],[-4,-5],[-20,-23],[-2,-5],[-1,-4],[0,-7],[2,-5],[5,-4],[7,-5],[8,-7],[12,-20],[8,-9],[33,-16],[4,-14],[-3,-13],[-7,-17]],[[8288,1283],[-11,-119],[-9,-31],[-21,-17],[-35,-23],[-5,-5],[-6,-7],[-3,-6],[0,-5],[0,-4],[7,-18],[2,-7],[-1,-11],[-5,-6],[-6,-4],[-28,-8],[-5,-1],[-6,1],[-6,3],[-11,8],[-6,3],[-8,1],[-8,-1],[-17,-3],[-9,-1],[-27,-1],[-8,-1],[-40,-12],[-9,-4],[-13,-8],[-37,-38],[-25,-17],[-6,-6],[-1,-6],[6,-25],[0,-6],[-2,-16],[-2,-7],[-5,-4],[-7,-3],[-27,-6],[-18,-6],[-40,-24],[-6,-7],[-9,-9],[-2,-7],[0,-5],[3,-12],[5,-12],[15,-20],[10,-18],[49,-25],[6,-4],[6,-7],[-3,-4],[-5,-5],[-3,-5],[-19,-48],[-3,-5],[-3,-4],[-21,-18],[-8,-11],[-7,-17],[-9,-9],[-14,-8],[-29,-15]],[[7783,557],[-7,11],[-14,7],[-12,3],[-31,3],[-19,5],[-7,3],[-14,8],[-13,6],[-4,1],[-131,22],[-30,9],[-26,14],[-36,29],[-20,12],[-43,17],[-17,5],[-18,3],[-49,3],[-7,2],[-4,5],[1,12],[-1,6],[-11,7],[-32,12],[-7,5],[-8,9],[-19,6],[-38,6],[-19,8],[-4,9],[1,11],[-7,11],[-44,34],[-18,8],[-9,2],[-8,0],[-6,1],[-7,3],[-9,8],[-5,4],[-8,1],[-5,1],[-17,8],[-8,3],[-33,3],[-46,14],[-82,-1],[-71,17],[-84,41],[-136,32],[-27,19],[-34,12],[-30,14],[-14,3],[-31,0],[-14,3],[-12,5],[-12,3],[-12,-4],[-7,7],[-10,23],[-7,5],[-8,3],[-23,3],[-44,15],[-48,7],[-93,22],[-61,6],[-19,-9],[0,13],[-14,8],[-8,6],[-5,3],[-29,6],[-56,18],[-24,9],[-49,24],[-55,26],[-23,14],[0,6],[4,7],[-6,8],[-8,8],[-25,7],[-66,25],[-13,2],[-34,3],[-13,6],[-10,8],[-3,6],[-10,4],[-19,4],[-30,-4],[-28,5],[-27,6],[-35,16],[-3,3],[-2,11],[-2,5],[-5,5],[0,7],[-5,8],[-20,5],[-39,8],[-113,33],[-55,21],[-76,21],[-17,15],[-87,30],[-22,12],[-11,2],[-11,-1],[-6,-2],[-5,1],[-13,6],[-9,7]],[[4948,1584],[45,47],[5,8],[5,10],[6,9],[29,35],[19,11],[167,71]],[[5224,1775],[2,-7],[1,-5],[3,-5],[6,-4],[8,-4],[22,-5],[60,-7],[59,-14],[30,-3],[7,-2],[6,-3],[2,-5],[-2,-5],[-3,-5],[2,-9],[7,-10],[18,-19],[8,-11],[5,-9],[2,-7],[5,-5],[9,-5],[30,-7],[16,-7],[0,-12],[2,-5],[3,-5],[5,-4],[26,-20],[7,-3],[7,-3],[8,-2],[18,-4],[15,-1],[8,0],[11,2],[18,5],[20,7],[19,9],[7,2],[7,0],[7,-5],[3,-5],[1,-15],[1,-2],[1,-2],[4,-4],[5,-3],[4,-4],[1,-6],[-6,-24],[0,-5],[1,-6],[3,-4],[8,-2],[13,1],[60,21],[8,4],[6,6],[9,16],[32,33],[6,4],[10,3],[14,2],[84,-1],[81,8],[36,2],[35,5],[92,29],[24,-7],[7,-2],[15,-4],[59,-4],[33,0],[-1,5],[-4,11],[-2,23],[4,16],[4,5],[8,2],[8,0],[18,-1],[17,-3],[24,-5],[7,-1],[6,1],[6,2],[5,4],[9,9],[26,34],[6,5],[46,30],[10,8],[8,22],[3,27],[6,21],[4,9],[1,6],[-1,7],[-5,7],[-11,10],[-6,11],[7,25],[4,6],[8,9],[5,3],[5,3],[7,3],[15,4],[10,2],[10,0],[35,-3],[10,0],[10,1],[18,3],[7,3],[5,3],[1,5],[-7,13],[-2,17]],[[7236,3836],[-3,-33],[-14,-29],[-102,-131],[-14,-29],[-4,-22],[-10,-34],[-8,-15],[-5,-20],[0,-8],[13,-46],[3,-5],[2,-3],[3,-3],[14,-9],[64,-28],[57,-18],[11,-6],[8,-9],[7,-12],[22,-56],[7,-9],[8,-7],[10,-5],[22,-7],[23,-3],[12,-1],[11,-1],[7,-2],[9,-4],[9,-8],[6,-7],[18,-25],[26,-41],[12,-25],[5,-18],[0,-13],[-14,-24],[-3,-9],[0,-14],[5,-10],[8,-8],[20,-28],[13,-14],[23,-12],[21,-6],[148,-32],[18,-1],[14,0],[41,3],[16,-1],[10,-1],[9,-3],[19,-10],[14,-5],[84,-22],[120,-22],[13,-5],[98,-43],[12,-2],[26,-2],[22,1],[221,-27],[99,4],[16,4],[9,6],[0,6],[-6,6],[-20,8],[-10,5],[-8,6],[-4,7],[4,8],[8,3],[12,1],[25,-1],[36,-6],[43,3],[25,-1],[26,-4]],[[8678,2902],[-21,-61],[-2,-20],[12,-32],[1,-7],[-1,-6],[-6,-14],[-20,-32],[-12,-12],[-47,-33],[-22,-13],[-16,-12],[-12,-11],[-23,-28],[-75,-121],[-13,-15],[-10,-5],[-22,-4],[-64,-8],[-12,-4],[-7,-28],[-3,-28],[-15,-45],[5,-8],[8,-7],[10,-6],[8,-13],[1,-12],[-18,-72],[-6,-13],[-13,-20],[-27,-67],[-3,-5],[-4,-3],[-8,-4],[-41,1],[-7,-3],[-7,-4],[-15,-25],[-5,-16],[4,-9],[8,-10],[1,-6],[-2,-5],[-4,-4],[-8,-5],[-6,-3],[-14,-9],[-10,-8],[-8,-4],[-8,-4],[-8,-1],[-22,-1],[-14,-2],[-6,-8],[1,-5],[2,-6],[4,-4],[18,-19],[14,-11],[7,-4],[8,-2],[8,0],[10,0],[11,-1],[17,-5],[6,-7],[2,-6],[-9,-26],[0,-7],[3,-10],[9,-18],[2,-10],[-1,-8],[-18,-19],[-6,-10],[-1,-17],[12,-11],[0,-3],[1,-2],[-4,-8],[-3,-8],[-2,-11],[1,-8],[3,-6],[5,-5],[7,-10],[7,-13],[5,-19],[-2,-43],[-2,-8],[-5,-5],[-6,-2],[-12,-3],[-5,-2],[-10,-5]],[[6414,2685],[-6,5],[-21,14],[-38,16],[-6,4],[-3,7],[-15,11],[-20,24],[-41,35],[-23,13],[-25,6],[-4,3],[-17,21],[-11,6],[-27,11],[-14,4],[0,4],[11,11],[-15,43],[7,9],[4,2],[-2,4],[-6,3],[-7,2],[-7,2],[-3,6],[-12,28],[-5,9],[-6,4],[-4,4],[-8,20],[-2,20],[-3,7],[-12,12],[-6,10],[-7,19],[-6,7],[-39,27],[-13,5],[-1,-3],[-3,-5],[0,-3],[-12,6],[-43,39],[-6,15],[-4,8],[-9,3],[-14,3],[-3,6],[4,15],[-1,10],[-3,4],[-5,3],[-8,8],[-4,6],[-4,15],[-5,6],[-31,25],[-21,26]],[[5829,3310],[80,1],[28,2],[93,18],[26,6],[7,3],[6,3],[11,8],[4,5],[15,20],[6,11],[3,12],[1,12],[-2,24],[0,4],[4,12],[2,5],[77,77],[2,5],[12,46],[0,10],[-1,6],[-2,5],[-3,4],[-4,3],[-21,12],[-14,5],[-7,3],[-24,4],[-31,9],[-8,2],[-10,0],[-18,0],[-7,1],[-5,2],[-1,6],[3,5],[6,3],[27,12],[73,41],[46,45],[35,52],[7,16]],[[6245,3830],[23,-3],[35,8],[21,2],[57,0],[102,9],[31,6],[25,6],[7,4],[6,4],[28,27],[6,3],[9,2],[8,-4],[5,-4],[3,-7],[2,-6],[3,-5],[4,-5],[11,-8],[4,-4],[1,-11],[4,-5],[20,-11],[32,-7],[7,-2],[19,-11],[11,-3],[25,1],[9,-1],[9,1],[7,2],[8,4],[8,3],[15,1],[8,-3],[4,-5],[2,-6],[5,-5],[6,-2],[9,0],[7,-3],[19,-9],[8,-3],[10,-2],[34,-5],[28,3],[8,3],[7,3],[5,4],[7,3],[7,4],[20,5],[7,3],[30,18],[14,7],[29,8],[55,11],[6,2],[7,-1],[14,-6],[10,-4],[9,1],[20,4],[10,0],[8,-1],[13,-4]],[[9770,2898],[-499,-170],[-13,-2],[-21,3],[-532,178],[-13,2],[-14,-7]],[[7236,3836],[0,1],[0,12],[3,16],[5,12],[8,13],[58,71],[3,9],[1,7],[-7,9],[-43,37],[-1,6],[1,5],[8,6],[14,4],[29,-1],[17,-3],[14,-4],[32,-18],[6,-2],[20,-3],[110,3],[19,3],[8,2],[350,123],[69,14],[15,5],[31,13],[45,26],[41,17],[49,27],[13,6],[20,10],[75,62],[25,25],[10,18],[6,19],[8,76],[4,12],[11,24],[12,11],[25,16],[104,52],[1,1]],[[8455,4578],[-1,-46],[0,-69],[0,-70],[0,-69],[-1,-70],[0,-69],[0,-70],[0,-69],[-1,-44],[68,37],[17,2],[21,-12],[36,-29],[20,-13],[36,-12],[40,-4],[41,1],[39,5],[32,8],[192,66],[33,-1],[15,-3],[15,0],[33,1],[21,-1],[13,-4],[30,-13],[26,-3],[98,7],[15,-1],[3,-3],[3,-3],[3,-4],[2,-3],[3,-3],[3,-4],[3,-3],[3,-4],[82,-98],[83,-99],[82,-99],[83,-99],[82,-99],[82,-99],[83,-99],[82,-99],[20,-23],[4,-5],[-8,-3],[-5,-5],[-4,-10],[-7,-9],[-9,-8],[-11,-7],[-24,-8],[-11,-7],[-7,-7],[-1,-9],[7,-6],[26,-4],[8,-6],[-19,-25],[-6,-5],[-65,-12],[-16,-7],[-12,-11],[-10,-16],[-18,2],[-9,-10],[-9,-14],[-24,-13],[-5,-12],[0,-23],[10,-54]],[[9770,2898],[2,-8],[-6,-65],[2,-22],[11,-43],[-9,-106],[3,-13],[-5,-13],[-7,-13],[-7,-7],[-17,-13],[-6,-6],[-2,-7],[2,-7],[0,-7],[-7,-6],[-9,-1],[-24,3],[-11,-1],[-11,-12],[16,-16],[43,-23],[9,-8],[0,-6],[-4,-7],[-3,-9],[1,-7],[10,-21],[14,-14],[3,-18],[0,-20],[5,-18],[10,-10],[43,-19],[8,-7],[5,-9],[4,-19],[20,-36],[4,-19],[-16,-11],[-53,-5],[-27,-5],[-20,-9],[-4,-10],[-1,-10],[1,-21],[6,-10],[11,-11],[3,-11],[-16,-10],[-51,-19],[-15,-8],[-31,-24],[-6,-2],[-14,-2],[-4,-3],[-3,-9],[2,-25],[-4,-6],[-17,0],[-18,2],[-16,-1],[-10,-10],[-5,-70],[-11,-16],[-13,-5],[-43,-8],[-18,-7],[-7,-8],[-1,-9],[3,-45],[-2,-4],[-13,-21],[-3,-10],[5,-9],[17,-11],[13,-8],[45,-47],[13,-9],[47,-23],[13,-9],[20,-18],[18,-13],[-1,-10],[-13,-6],[-18,1],[-16,-1],[-10,-21],[-27,-6],[-15,-10],[-13,-11],[-4,-9],[9,-16],[0,-5],[-6,-2],[-22,-5],[-8,-3],[-10,-10],[-4,-10],[-2,-11],[-4,-11],[-51,-52],[-7,-16],[4,-17],[10,-16],[33,-56],[34,-56],[34,-57],[33,-56],[18,-30],[27,-23],[15,-8],[17,-7],[19,-5],[20,0],[9,3],[16,8],[8,2],[9,-1],[25,-5],[23,5],[17,-7],[33,-24],[41,-11],[18,-8],[8,-15],[-18,-19],[-89,-23],[-26,-9],[-21,-17],[-7,-10],[-1,-11],[1,-32],[-2,-17],[4,-9],[21,-20],[-10,-8],[-13,-11],[-13,-7],[-46,-16],[-15,-2],[-28,-2],[-13,-5],[-7,-8],[-15,-30],[-11,-11],[-80,-57],[-21,-30],[-9,-8],[-34,-13],[-5,-4],[-3,-5],[3,-3],[6,-2],[3,-3],[-3,-9],[-17,-13],[-21,-5],[-23,-3],[-22,-6],[-24,-11],[-43,-26],[-5,-1],[-13,-1],[-4,-1],[-8,-12],[-13,-30],[-13,-14],[1,0]],[[9224,573],[-2,0],[-9,-3],[-27,-3],[-5,0],[-5,0],[-6,1],[-6,4],[-13,10],[-3,4],[-8,11],[-3,1],[-4,2],[-8,1],[-5,-1],[-4,0],[-6,-2],[-12,-3],[-5,0],[-4,0],[-7,2],[-24,11],[-8,4],[-7,1],[-3,1],[-7,1],[-4,1],[-17,8],[-27,17],[-17,8],[-4,2],[-2,0],[-2,1],[-1,0],[-7,1],[-6,2],[-18,17],[-43,54],[-51,51],[-15,25]],[[8819,802],[-2,7],[-2,8],[0,4],[2,15],[3,4],[6,6],[10,3],[8,2],[24,3],[9,2],[8,3],[21,15],[31,17],[6,9],[-19,18],[-49,5],[-9,2],[-11,5],[-14,8],[-40,28],[-14,14],[-11,13],[-5,5],[-8,4],[-34,13],[-11,8],[-10,18],[-13,33],[-13,20],[-1,4],[1,11],[4,12],[12,19],[1,6],[-3,7],[-7,7],[-31,12],[-10,7],[-4,11],[2,18],[0,16],[-3,9],[-4,7],[-9,6],[-11,3],[-16,0],[-12,-1],[-30,3],[-50,20],[-25,-6],[-9,-4],[-12,-5],[-10,-4],[-24,-6],[-14,0],[-22,3],[-19,6],[-46,21],[-1,1],[-7,3],[-17,5],[-17,-2]],[[8819,802],[-18,-29],[-20,-9],[-12,0],[-12,1],[-11,4],[-8,5],[-7,7],[-20,31],[-6,7],[-8,4],[-19,6],[-15,1],[-15,0],[-11,-1],[-20,-9],[-18,-13],[-5,-6],[-5,-6],[0,-7],[-3,-8],[-10,-15],[-4,-8],[-2,-11],[4,-13],[1,-2],[0,-1],[7,-11],[2,-7],[0,-7],[-1,-7],[-9,-9],[-23,-21],[-63,-49],[-40,-11],[-17,-4],[-14,-4],[-11,-6],[-6,-4],[-9,-10],[-8,-11],[-14,-15],[-34,-28],[-3,-5],[-8,-25],[-3,-8],[-5,-8],[-10,-11],[-6,-7],[-5,-3],[-32,-20],[-9,-7],[-6,-6],[-14,-27],[-5,-5],[-6,-4],[-13,-4],[-10,-3],[-71,-18],[-31,-13],[-29,-15],[-7,-5],[-6,-4],[-4,-5],[-13,-17],[-9,-9]],[[8030,297],[-22,17],[-12,6],[-39,11],[-29,14],[-16,6],[-17,2],[-26,-2],[-4,-2],[0,6],[5,7],[11,10],[4,13],[-3,11],[-4,11],[-7,55],[-4,10],[-11,21],[-3,19],[-4,2],[-5,1],[-6,3],[-21,19],[-28,13],[-2,1],[-4,6]],[[9224,573],[41,-4],[13,-3],[31,-16],[16,-11],[12,-10],[8,-16],[3,-19],[-2,-39],[0,-1],[-101,-65],[-36,-17],[-36,-4],[-37,4],[-33,-1],[-25,-18],[-6,-23],[9,-19],[13,-19],[7,-23],[2,-14],[4,-10],[18,-19],[6,-11],[2,-10],[-2,-10],[-48,-72],[-17,-18],[-15,-10],[-31,-18],[-37,-29],[-14,-8],[-18,-4],[-23,-1],[-19,-4],[-56,-21],[-19,-4],[-41,-2],[-85,5],[-41,-2],[-20,-7],[-19,12],[-40,16],[-49,24],[-24,10],[-28,10],[-29,10],[-39,14],[-39,25],[-3,3],[-4,6],[-5,3],[-3,1],[-8,1],[-5,1],[-46,28],[-13,6],[-28,5],[-10,6],[-11,22],[-7,11],[-12,4],[-12,4],[-34,17],[-16,5],[-46,10],[-16,2],[-41,26],[-17,7],[-11,7],[-2,1]],[[3173,5354],[4,-6],[2,-6],[5,-18],[8,-14],[1,-4],[1,-27],[4,-7],[9,-5],[20,-7],[8,-6],[24,-22],[5,-7],[0,-8],[-4,-7],[-2,-6],[5,-9],[13,-12],[44,-28],[11,-4],[38,-8],[6,-8],[29,-17],[26,-25],[9,-5],[10,-4],[42,-8],[5,-2],[3,-4],[2,-4],[3,-3],[6,-1],[10,-12],[18,-7],[40,-9],[23,-8],[21,-11],[13,-9],[-3,-18],[-5,-6],[-6,-5],[-13,-6],[-61,-41],[-8,-9],[-80,-126],[0,-28],[-11,-18],[-60,-49],[-11,-11],[-7,-10],[0,-6],[0,-5],[4,-6],[18,-17],[25,-41],[11,-22],[0,-33],[5,-20],[4,-8],[5,-6],[12,-7],[7,-2],[9,-2],[9,-2],[10,-2],[10,-5],[3,-5],[1,-5],[-3,-5],[-14,-21],[-2,-6],[-5,-27],[3,-29]],[[3482,4397],[-138,-39],[-35,-15],[-4,-5],[-2,-6],[-4,-27],[-2,-6],[-8,-12],[-17,-16],[-40,-27],[-20,-10],[-80,-31],[-28,-34],[-26,-12],[-40,-11],[-13,-1],[-48,1],[-14,1],[-4,4],[-1,5],[2,6],[-1,6],[-2,6],[-5,11],[-2,5],[-1,6],[0,5],[2,6],[5,11],[2,6],[-1,5],[-5,7],[-8,4],[-22,6],[-8,4],[-14,11],[-9,2],[-9,0],[-19,-2],[-11,1],[-14,3],[-6,4],[-2,5],[2,4],[2,2],[12,6],[19,9],[12,7],[5,5],[4,4],[7,11],[4,9],[-8,11],[-3,3],[-12,9],[-44,3],[-10,-1],[-9,-3],[-4,-4],[-2,-22],[-2,-6],[-11,-22],[-2,-6],[1,-5],[3,-9],[1,-3],[-1,-5],[-3,-7],[-7,-10],[-6,-7],[-7,-4],[-7,-2],[-14,-4],[-4,-1],[-22,-12]],[[2724,4224],[-17,20],[2,6],[-10,14],[-16,8],[-21,12],[2,8],[-9,13],[-14,13],[-12,10],[-2,5],[7,6],[-2,6],[-9,6],[-30,13],[-1,10],[-1,15],[-14,8],[-7,5],[-2,9],[-6,11],[4,7],[-8,7],[-3,8],[-16,11],[-33,21],[-7,11],[-6,6],[0,6],[7,0],[5,4],[-2,6],[-7,7],[3,3],[-2,7],[0,4],[-13,12],[-3,13],[-4,6],[-7,7],[-3,6],[-8,2],[-2,3],[-5,0],[-1,4],[1,2],[5,4],[-1,6],[0,6],[0,7],[-4,8],[-5,5],[-2,10],[4,11],[7,7],[0,17],[-31,19],[-26,20],[-5,13],[-13,10],[-6,10],[-8,5],[-10,11],[-12,10],[-3,16],[5,16],[-15,5],[-3,9],[0,8],[-7,8],[-5,13],[6,7],[10,7],[-6,9],[-11,0],[-16,8],[-4,15],[3,9],[6,5],[5,3],[-9,2],[-7,6],[-7,3],[-4,7],[-10,3],[-11,-1],[-7,-3],[-18,14],[-1,5],[-1,6],[-8,4],[-6,4],[7,4],[7,4],[9,1],[6,11],[2,11],[-8,13],[-14,6],[-16,3],[-12,-3],[-6,-3],[-3,-4],[4,-4],[0,-7],[4,-11],[-1,-7],[-9,2],[-10,15],[-15,12],[-12,8],[1,6],[-3,3],[4,3],[12,-3],[19,-4],[4,4],[4,7],[0,11],[-6,13],[-9,8],[-10,6],[-11,1],[-14,-2],[-7,4],[-8,9],[2,9],[5,9],[4,5],[-7,5],[-19,5],[-1,6],[7,-1],[4,3],[0,9]],[[2125,5119],[14,2],[7,5],[4,4],[8,19],[8,46],[17,23],[30,15],[112,26],[43,21],[19,3],[19,2],[21,0],[3,0],[6,1],[25,33],[-3,10],[-6,10],[-2,5],[1,6],[6,7],[25,21],[28,34],[2,5],[1,5],[1,5],[1,5],[3,5],[17,18],[2,5],[2,9],[4,6],[6,7],[122,70],[13,11],[9,10],[13,26],[5,7],[7,5],[13,0],[10,-1],[9,-2],[18,-3],[20,-1],[13,2],[15,3],[24,7],[20,4],[28,8],[13,7],[15,5],[-4,-10],[4,-10],[9,-10],[12,-10],[-5,-5],[-1,-7],[3,-7],[4,-6],[11,-12],[57,-36],[17,-5],[8,-2],[5,-3],[9,-7],[50,-54],[56,-48],[15,-19],[7,-15],[0,-20]],[[2644,6185],[12,-8],[4,-11],[14,-15],[10,-38],[4,-8],[7,-5],[9,-4],[7,-6],[4,-9],[2,-4],[5,-2],[7,-2],[5,-3],[6,-6],[0,-4],[-3,-4],[0,-14],[1,-3],[4,-5],[5,-2],[5,0],[5,-1],[1,-6],[0,-19],[6,-20],[16,-11],[20,-9],[19,-11],[5,-9],[8,-10],[-23,3],[-9,0],[-26,-3],[-9,0],[-10,-1],[-11,-2],[-42,-19],[-4,-7],[1,-5],[4,-12],[2,-12],[-1,-14],[-6,-17],[-9,-17],[-6,-4],[-8,-2],[-31,1],[-10,-1],[-44,-12],[-10,-1],[-11,2],[-6,3],[-11,9],[-6,3],[-10,0],[-10,-4],[-35,-25],[-32,-17],[-11,-3],[-21,-2],[-8,-3],[-14,-1],[-4,8],[-2,20],[-2,5],[-3,3],[-8,3],[-16,2],[-13,4],[-13,7],[-6,5],[-5,6],[-8,3],[-8,2],[-33,-4],[-35,5],[-17,7],[-24,15],[-34,14],[-11,3],[-14,1],[-25,-1],[-13,-1],[-9,-2],[-15,-6],[-5,0],[-5,2],[-20,8],[-30,7],[-9,0],[-4,0],[-19,-9],[-32,-9],[-14,-1],[-20,1],[-2,0],[-4,-1],[-15,-4],[-14,-6],[-5,-3],[-7,-6],[-3,-5],[-2,-3],[-3,-9],[-1,-3],[-2,-3],[-3,-2],[-3,-1],[-3,-2],[-2,-2],[-10,-13],[-5,0],[-7,2],[-40,21],[-4,5],[-2,9],[2,7],[7,14],[1,4],[0,6],[-1,6],[-3,5],[-23,27],[-1,4],[-2,5],[-7,7],[-13,8],[-42,25],[-19,9],[-26,4],[-12,1],[-51,13],[-33,6],[-14,6],[-6,3],[-5,5],[-2,4],[5,15],[7,5],[8,8],[8,10],[7,11],[2,6],[1,6],[-2,8],[-2,5],[-13,15],[9,83]],[[1663,7303],[19,0],[14,-1],[26,-6],[14,-3],[8,1],[13,2],[8,-1],[8,-3],[9,-4],[15,-10],[22,13],[21,15],[6,11],[8,27],[9,9],[16,3],[20,0],[19,3],[8,11],[-4,13],[-18,24],[0,15],[9,15],[14,14],[36,23],[33,13],[73,20],[8,4]],[[2077,7511],[11,-19],[31,-40],[14,-50],[10,-21],[18,-17],[11,-15],[3,-7],[6,-30],[0,-9],[-1,-8],[-6,-10],[-7,-5],[-14,-7],[-4,-5],[-20,-40],[-4,-14],[-1,-10],[1,-10],[3,-9],[16,-29],[3,-18],[11,-56],[-5,-49],[1,-10],[2,-4],[2,-5],[0,-4],[-3,-5],[-8,-10],[-13,-10],[-4,-2],[-4,-3],[-40,-42],[-1,-1],[-18,-20],[-4,-3],[-2,-1],[-11,-3],[-3,-2],[-1,-3],[1,-4],[1,-2],[2,-1],[9,-3],[4,-1],[1,-3],[-1,-3],[-9,-10],[-2,-1],[-2,-1],[-7,-2],[-4,-2],[-3,-2],[-3,-3],[-2,-3],[-6,-11],[0,-8],[2,-16],[6,-8],[16,-14],[4,-4],[5,-7],[4,-5],[13,-21],[6,-6],[53,-37],[4,-4],[2,-3],[3,-9],[2,-2],[3,-3],[6,-3],[11,-5],[11,-1],[7,0],[10,0],[5,0],[10,-4],[17,-12],[36,-15],[21,-10],[8,-9],[11,-22],[28,-30],[32,-48],[20,-15],[45,-15],[24,-15],[38,-9],[11,-6],[4,-4],[8,-15],[1,-3],[22,-13],[9,-10],[32,-59],[43,-49],[7,-11],[3,-11],[1,-25],[-3,-3],[-5,-2],[-6,-2],[-2,-6],[2,-3],[11,-7],[3,-5],[-1,-10],[-5,-11],[-2,-12],[9,-15],[2,-14],[2,-5],[10,-7]],[[4255,5335],[-17,-42]],[[4238,5293],[4,-21],[11,-16],[35,-36],[6,-10],[3,-9],[12,-95],[2,-5],[1,-3],[4,-3],[4,-1],[7,-2],[8,-2],[7,-3],[8,-5],[8,-7],[16,-20],[3,-6],[3,-11],[0,-7],[-1,-7],[-1,-6],[-1,-8],[2,-10],[6,-18],[4,-10],[6,-6],[6,-4],[20,-9],[12,-8],[5,-4],[37,-50],[10,-7],[11,-6],[26,0],[19,2],[19,7],[8,3],[95,54],[9,3],[21,2],[17,3],[37,10],[16,6],[11,6],[17,18],[24,18],[6,5],[12,21],[7,10],[19,18],[4,5],[9,17],[5,6],[6,7],[19,16],[48,51],[27,22],[39,27],[19,9],[40,13],[8,3],[69,40],[12,6],[57,15],[23,5],[18,2],[73,-4],[9,-1],[8,-3],[14,-5],[6,-4],[5,-4],[4,-4],[4,-5],[6,-12],[3,-12],[2,-5],[0,-6],[-3,-6],[-4,-5],[-15,-8],[-44,-15],[-8,-4],[-5,-4],[-4,-5],[-2,-6],[-4,-54],[-6,-18],[-20,-31],[-13,-14],[-4,-5],[-2,-6],[-2,-6],[1,-7],[8,-24],[1,-6],[-1,-14],[-9,-25],[-22,-46],[-8,-24],[-1,-4],[1,-5],[2,-7],[12,-21],[12,-13],[13,-11],[104,-104]],[[5373,4745],[-178,-57],[-167,-20],[-7,-1],[-92,10],[-14,0],[-12,-1],[-151,-49],[-23,-5],[-62,-9],[-50,-4],[-96,3],[-58,-4],[-13,-2],[-20,-5],[-13,-4],[-24,-11],[-17,-11],[-8,-9],[-8,-14],[-6,-25],[-2,-15],[1,-11],[29,-99],[18,-28],[-7,-9],[-22,-10],[-110,-34],[-33,16],[-38,10],[-153,8],[-6,1],[-8,2],[-5,3],[-10,12],[-6,8],[-10,7],[-6,4],[-13,6],[-32,9],[-32,3],[-96,1],[-45,-7],[-9,-3],[-9,-6],[-51,-49],[-20,-11],[-54,-24]],[[3625,4311],[-14,1],[-6,1],[-29,13],[-7,11],[-3,13],[-4,6],[-8,5],[-17,3],[-11,1],[-11,-1],[-9,1],[-8,2],[-8,7],[-4,5],[-4,18]],[[3173,5354],[50,2],[73,-1],[18,2],[14,3],[11,5],[38,8],[14,1],[8,-1],[3,-2],[5,-4],[8,-14],[6,-25],[4,-6],[7,-5],[10,-1],[10,2],[13,1],[33,-7],[12,1],[9,3],[14,14],[8,12]],[[3541,5342],[67,10],[26,-2],[27,-6],[67,-10],[18,-4],[110,-12],[30,1],[24,3],[7,6],[6,6],[7,11],[5,25],[-2,40],[3,12],[4,6],[7,5],[13,5],[11,0],[7,-3],[13,-17],[3,-6],[2,-6],[-1,-11],[3,-6],[4,-5],[17,-10],[2,-2],[2,-3],[2,-9],[4,-5],[7,-6],[11,-6],[5,-5],[4,-6],[4,-11],[2,-5],[2,-6],[13,-23],[4,-22],[5,-6],[6,-6],[11,-5],[8,-3],[22,-1],[22,12],[10,8],[6,10],[26,31],[12,9],[7,6],[39,15]],[[2644,6185],[15,3],[34,5],[18,4],[13,2],[13,1],[17,-3],[24,-5],[18,-1],[45,4]],[[2841,6195],[10,-7],[8,-8],[10,-14],[19,-41],[9,-6],[41,-20],[9,-6],[6,-8],[0,-10],[-2,-8],[-20,-29],[1,-13],[5,-18],[22,-34],[19,-19],[14,-10],[23,-11],[6,-6],[21,-23],[22,-17],[8,-8],[1,-11],[-1,-8],[-18,-30],[-3,-14],[0,-18],[5,-23],[4,-11],[6,-11],[14,-21],[32,-31],[5,-8],[3,-8],[1,-17],[-2,-6],[-1,-3],[-7,-7],[-2,-4],[-1,-2],[0,-2],[4,-4],[5,-4],[15,-10],[4,-5],[3,-6],[5,-6],[10,-5],[20,-4],[16,1],[12,2],[14,6],[16,0],[12,-2],[85,-16],[27,-9],[35,-7],[15,-5],[35,-14],[6,-3],[51,-42],[4,-9],[4,-12],[17,-124],[3,-8],[3,-5],[12,-11]],[[2125,5119],[0,3],[-5,14],[-6,8],[-9,12],[-6,8],[-12,9],[-16,16],[-38,33],[2,6],[0,5],[6,4],[9,5],[2,15],[-3,13],[1,8],[-5,14],[-8,22],[-23,22],[-24,21],[-32,20],[-18,10],[-24,6],[-12,7],[-10,8],[5,7],[8,-1],[4,-1],[10,5],[4,11],[0,11],[-49,49],[-2,12],[-19,18],[3,8],[-25,20],[-84,50],[0,13],[-47,22],[-92,47],[-41,32],[-25,26],[-9,22],[-39,30],[-10,6],[-7,6],[4,4],[9,2],[10,6],[1,11],[-10,13],[-28,31],[-57,53],[-21,18],[-2,13],[-4,10],[1,5],[9,7],[3,7],[-9,16],[-9,14],[0,10],[-13,25],[-25,19],[-31,22],[-11,8],[4,9]],[[5397,4090],[-140,-1],[-75,14],[-32,11],[-12,5],[-58,33],[-42,17],[-30,9],[-9,3],[-11,0],[-14,0],[-14,-3],[-17,-6],[-10,-6],[-12,-8],[-11,-4],[-122,-21],[-27,-9],[-28,-3],[-77,-1],[-68,-12],[-176,-38],[-189,-2],[-5,0],[-4,1],[-6,3],[-5,4],[-9,9],[-4,4],[-8,1],[-10,-3],[-53,-27],[-21,-6],[-19,-3],[-19,0],[-33,3],[-7,2],[-6,2],[-4,1],[-5,0],[-4,0],[-3,-6],[-2,-12],[3,-30],[5,-19],[1,-9],[-7,-21],[-102,-11],[-19,0],[-45,3]],[[3832,3954],[1,7],[0,8],[-8,14],[-12,7],[-37,16],[-5,5],[-2,5],[-2,7],[3,30],[-5,48],[-11,12],[-24,18],[-16,17],[-9,35],[-4,8],[-7,10],[-22,25],[-6,10],[-14,42],[-7,11],[-20,22]],[[5373,4745],[20,-16],[8,-9],[18,-26],[31,-57],[5,-18],[-3,-21],[0,-19],[12,-25],[39,-47],[10,-15],[1,-14],[-11,-80],[1,-8],[3,-9],[24,-42],[7,-8],[14,-23],[10,-26],[2,-2],[5,-3],[8,-3],[57,-15],[12,-4],[8,-5],[7,-7],[5,-7],[0,-6],[-5,-6],[-10,-3],[-35,-8],[-35,-14],[-13,-7],[-33,-23],[-18,-10],[-45,-32],[-42,-24],[-33,-13]],[[2841,6195],[-13,7],[-6,5],[-7,7],[-4,9],[-1,12],[3,17],[22,48],[9,53],[0,31],[5,19],[6,8],[6,6],[21,9],[15,-2],[22,-7],[23,-10],[12,-3],[13,-3],[13,-1],[43,3],[16,0],[22,-2],[13,0],[54,10],[15,5],[13,8],[10,14],[6,10],[6,17],[5,9],[10,9],[16,11],[69,41],[20,18],[0,17],[-21,41],[-4,12],[-10,13],[-20,22],[-17,14],[-14,7],[-26,10],[-41,11],[-101,19],[-32,6],[-22,8],[-12,8],[-20,19],[-20,33],[-75,96],[-8,24],[15,15],[4,8],[1,12],[0,9],[-13,53],[0,8],[2,7],[5,9],[23,23],[30,17]],[[2922,7074],[16,-14],[35,-17],[21,-9],[93,-25],[51,-18],[30,-18],[7,-7],[19,-15],[41,-23],[31,-12],[23,-3],[164,-6],[27,-5],[18,-6],[20,-9],[41,-21],[22,-18],[13,-17],[25,-55],[19,-25],[24,-18],[24,-11],[15,-5],[22,-5],[16,-1],[15,1],[23,3],[22,8],[116,56],[23,5],[14,-1],[16,-2],[13,-5],[12,-6],[18,-14],[19,-18],[62,-45],[14,-7],[16,-6],[29,-7],[17,-1],[16,1],[32,5],[72,3],[52,-2],[97,-14],[43,-7],[49,-14],[25,-10],[54,-37],[6,-6],[16,-20],[5,-7],[3,-7],[1,-7],[1,-7],[-23,-157],[1,-20],[0,-5],[-16,-44],[-3,-7],[-5,-7],[-41,-42],[-16,-22],[-6,-6],[-8,-5],[-11,-4],[-12,-1],[-12,1],[-10,4],[-9,5],[-69,59],[-20,12],[-24,10],[-16,5],[-30,6],[-19,2],[-22,0],[-17,-2],[-16,-3],[-11,-3],[-16,-10],[-25,-26],[-40,-58],[-13,-29],[-1,-5],[1,-4],[7,-15],[6,-9],[5,-11],[2,-20],[-11,-119],[5,-32],[10,-27],[17,-36],[192,-280],[26,-55],[4,-18],[0,-14],[-4,-9],[-6,-8],[-7,-8],[-75,-62],[-6,-9],[-5,-10],[-7,-27],[-7,-30],[-22,-53]],[[5811,5903],[-27,-8],[7,-9],[32,-13],[103,-75],[22,-10],[25,-7],[29,-6],[24,-13],[7,-22],[-8,-21],[-26,-11],[-26,6],[-12,1],[-1,-10],[8,-27],[5,-7],[24,-13],[34,-9],[30,-11],[13,-17],[5,-13],[26,-24],[9,-13],[0,-10],[-4,-20],[2,-11],[10,-12],[23,-21],[7,-15],[4,-22],[5,-10],[11,-8],[63,-23],[9,-5],[12,-12],[8,-5],[8,-2],[17,-1],[7,-2],[11,-8],[6,-10],[0,-11],[-7,-25],[0,-10],[6,-9],[33,-30],[15,-9],[16,-6],[46,-7],[15,-6],[14,-9],[8,-10],[14,-23],[61,-61],[12,-7],[29,-13],[11,-8],[21,-22],[5,-9],[9,-46],[-4,-16],[-6,-11],[-9,-7],[-35,-19],[-1,-15],[-5,-7],[-10,-4],[-13,-3],[-11,-1],[-10,-4],[-8,-8],[-13,-18],[-19,-17],[-41,-28],[-17,-19],[317,-1],[96,-13],[4,-1],[7,-4],[5,-1],[3,0],[6,3],[3,1],[16,-2],[32,-7],[33,-11],[15,-3],[35,-3],[48,2],[16,-2],[15,-5],[22,-14],[15,-6],[7,-1],[10,1],[8,0],[4,-5],[1,-5],[-1,-16],[2,-11],[8,-10],[21,-17],[5,-10],[-3,-10],[-9,-21],[9,-21],[56,-23],[16,-22],[3,-6],[6,-11],[2,-6],[-2,-7],[-12,-10],[-5,-6],[-1,-11],[2,-9],[-1,-10],[-9,-12],[43,0],[141,0],[140,0],[141,0],[141,0],[30,0],[14,2],[8,5],[3,4],[4,3],[12,1],[8,-2],[6,-4],[6,-2],[11,0],[16,6],[27,15],[39,8],[10,11],[8,13],[10,11],[13,7],[53,16],[49,9],[14,8],[6,6],[10,14],[6,6],[10,6],[20,8],[9,5],[23,23],[12,10],[40,15],[16,8],[30,21],[16,8],[52,20],[15,11],[28,23],[16,10],[15,5],[16,2],[33,2],[1,-7],[-1,-1],[-8,-10],[-2,-9],[-4,-7],[-15,-4],[2,-2],[2,-4],[2,-2],[-10,-2],[-7,-5],[-2,-7],[11,-13],[-7,-1],[-11,1],[-4,1],[-21,-1],[-4,0],[8,-10],[5,-18],[5,-10],[9,-8],[24,-13],[9,-8],[5,-11],[-1,-10],[-6,-10],[-10,-9],[-3,-3],[-1,-7],[-4,-3],[-5,0],[-8,3],[-4,0],[-8,-3],[-8,-4],[-6,-5],[-5,-6],[-7,-22],[0,-32],[0,-24]],[[6245,3830],[-17,8],[-17,14],[-12,16],[-16,33],[-2,6],[0,6],[17,72],[-1,20],[0,3],[-27,39],[-28,34],[-30,25],[-12,7],[-12,7],[-8,2],[-8,2],[-37,5],[-17,4],[-18,6],[-11,1],[-10,-6],[-31,-37],[-60,-57],[-10,-7],[-11,-5],[-12,-4],[-11,-3],[-24,-1],[-36,4],[-11,-1],[-12,-2],[-25,-3],[-12,0],[-12,-1],[-43,-8],[-14,-6],[-13,-2],[-17,-1],[-46,2],[-14,-2],[-12,-4],[-11,-5],[-15,-5],[-33,-6],[-23,1],[-15,4],[-11,5],[-22,22],[-4,7],[-8,20],[-14,51]],[[4238,5293],[80,26],[32,18],[24,19],[25,14],[55,25],[15,10],[11,9],[9,9],[11,9],[14,4],[17,1],[13,-3],[11,-4],[10,-4],[58,-34],[12,-5],[16,-4],[18,0],[10,5],[3,8],[-3,8],[-5,7],[-41,33],[-14,14],[-5,7],[-8,21],[0,12],[2,9],[8,11],[11,7],[14,7],[12,3],[9,0],[10,0],[19,1],[7,4],[7,7],[4,7],[2,9],[4,9],[7,10],[11,7],[7,0],[10,-2],[13,-5],[100,0],[38,6],[20,6],[15,5],[45,22],[27,9],[65,15],[179,21],[20,4],[50,19],[15,6],[10,8],[8,7],[5,8],[2,9],[3,49],[-13,49],[3,34],[-1,20],[-19,73],[-8,15],[-5,8],[-4,9],[0,10],[7,12],[9,7],[11,3],[12,1],[31,-3],[76,-32],[37,-8],[54,-1],[21,-2],[40,-7],[129,-33],[36,-12],[10,-4],[10,-6],[7,-6],[2,0],[1,0]],[[2077,7511],[22,10],[7,8],[1,11],[-1,11],[2,10],[12,13],[12,10],[2,9],[-19,8],[-10,10],[-6,20],[-1,21],[7,11],[14,9],[7,10],[8,24],[48,70],[8,24],[-1,32],[4,9],[8,6],[9,2],[10,0],[10,2],[11,5],[3,2],[0,4],[8,40],[6,11],[8,10],[5,3],[9,3],[7,2],[19,13],[5,11],[-10,35],[-1,7],[1,3],[4,1],[10,1],[6,3],[0,6],[-3,11],[0,19],[1,11],[6,11],[14,22],[1,2],[11,23],[6,23],[0,6],[-5,11],[0,3],[8,11],[14,2],[16,-1],[34,-7],[10,-5],[6,-8],[11,-35],[8,-10],[10,3],[13,7],[14,2],[12,4],[7,11],[-1,15],[-10,8],[-13,6],[-9,10],[0,12],[10,8],[28,14],[10,10],[25,32],[11,9],[38,22],[80,74],[58,35],[15,5],[30,7]],[[2787,8394],[13,-59],[18,-43],[3,-10],[2,-45],[2,-10],[3,-7],[39,-47],[23,-38],[9,-21],[9,-49],[15,-33],[3,-8],[-1,-8],[-2,-13],[-1,-18],[1,-15],[4,-11],[3,-8],[4,-5],[34,-33],[6,-8],[8,-12],[3,-9],[7,-35],[5,-15],[5,-7],[4,-8],[-2,-7],[-11,-16],[-7,-20],[-9,-95],[3,-35],[-4,-39],[-6,-16],[-6,-10],[-18,-23],[-23,-38],[-21,-24],[-5,-4],[-12,-7],[-15,-11],[-14,-13],[-14,-15],[-19,-32],[-6,-19],[-3,-29],[0,-14],[2,-11],[4,-8],[8,-16],[9,-28],[11,-78],[18,-51],[56,-86]],[[2787,8394],[22,6],[99,24],[100,24],[99,24],[100,24],[99,24],[99,24],[100,24],[99,24],[73,17],[12,5],[35,15],[45,24],[47,25],[47,25],[47,24],[47,25],[47,25],[48,25],[47,25],[47,25],[39,32],[40,32],[39,31],[40,32],[39,32],[40,32],[39,32],[39,31],[32,26],[44,28],[12,10],[6,5],[11,19],[11,32],[24,64],[24,65],[23,64],[24,64],[10,27],[5,5],[22,-14],[11,-9],[5,-5],[8,-5],[18,0],[33,3],[37,0],[8,0],[-1,4],[-5,5],[-8,5],[-6,6],[-2,5],[2,10],[0,5],[-36,82],[1,7],[5,10],[1,5],[0,6],[-3,10],[-1,5],[3,7],[9,4],[9,3],[8,5],[1,5],[-1,4],[-2,4],[0,5],[2,21],[-3,10],[-9,10],[-3,1],[-8,-3],[-4,1],[-3,2],[-4,6],[-3,3],[-31,16],[-3,4],[-5,1],[-10,0],[-8,1],[-9,4],[-14,9],[-23,22],[-15,23],[-25,62],[-9,8],[-13,5],[-16,4],[-10,3],[-17,11],[-9,4],[-8,1],[-17,-1],[-7,1],[-8,6],[-7,10],[-4,13],[4,9],[12,3],[14,-3],[14,-4],[13,-2],[14,1],[11,0],[11,-1],[55,-21],[21,-1],[21,9],[7,1],[27,-3],[12,0],[11,3],[10,3],[18,9],[9,8],[12,3],[13,7],[9,8],[4,7],[3,11],[8,5],[12,2],[16,-1],[35,-7],[17,-6],[15,-8],[31,-29],[9,-6],[7,-2],[14,0],[7,-2],[5,-2],[32,-25],[11,-5],[17,-5],[27,-4],[13,-4],[8,1],[9,4],[19,22],[10,2],[16,-10],[11,-11],[27,-38],[-21,-11],[-6,-8],[14,-3],[8,-1],[15,-3],[20,-1],[5,-1],[3,-3],[6,-3],[4,-2],[2,-3],[5,-2],[11,0],[4,1],[5,2],[6,3],[9,1],[7,-4],[23,-26],[33,-24],[21,-11],[47,-20],[10,-6],[10,-8],[7,-8],[4,-1],[11,0],[4,-2],[2,-6],[1,-6],[1,-5],[38,-56],[-2,-4],[-10,-6],[-4,-5],[0,-10],[5,-8],[27,-21],[6,-2],[7,-2],[14,0],[6,-2],[-6,-9],[4,-6],[9,-6],[4,-7],[-5,-6],[-11,0],[-13,2],[-9,-2],[-6,-6],[5,-5],[20,-9],[8,-7],[11,-25],[18,-16],[21,-8],[47,-6],[48,-13],[21,1],[13,16],[9,-6],[18,-38],[4,-5],[6,-3],[10,-3],[5,1],[4,2],[8,3],[3,3],[3,3],[4,2],[7,-4],[0,-5],[-7,-9],[1,-5],[11,-4],[25,4],[13,-3],[4,-5],[12,-22],[15,-16],[7,-5],[11,-5],[21,-5],[13,-2],[9,0],[14,5],[12,14],[12,3],[7,-10],[11,-8],[15,-6],[18,-2],[9,-2],[15,-8],[19,-4],[4,-4],[2,-6],[5,-9],[2,-6],[1,-2],[3,-1],[11,1],[3,0],[2,-4],[2,-5],[1,-12],[1,-4],[4,-4],[4,-4],[13,-3],[-4,-6],[-12,-11],[7,-8],[29,-9],[9,-10],[17,-8],[6,-6],[1,-6],[0,-5],[1,-8],[8,-22],[0,-11],[-20,-8],[-6,-8],[-9,-18],[-2,-21],[16,-14],[51,-21],[1,-2],[3,-8],[1,-2],[3,0],[9,1],[11,-1],[9,0],[10,-1],[10,-4],[19,-12],[8,-1],[6,6],[12,9],[13,1],[26,-5],[5,2],[3,14],[8,0],[21,-16],[8,-4],[7,-2],[7,-3],[5,-6],[-5,-20],[4,-8],[18,-15],[5,-9],[-2,-5],[-8,-14],[-1,-8],[3,-8],[6,-7],[13,-14],[6,-11],[4,-12],[6,-12],[11,-6],[-23,-27],[-8,-12],[-29,-18],[-7,-6],[-2,-3],[-1,-6],[1,-5],[8,-8],[1,-4],[3,-2],[11,-6],[2,-3],[4,-16],[2,-4],[13,-6],[34,-6],[7,-5],[5,-12],[11,7],[9,12],[2,6],[54,-21],[3,-3],[11,-7],[14,-25],[7,-9],[7,-4],[7,0],[33,5],[11,3],[10,6],[22,6],[20,6],[13,-3],[21,-10],[2,7],[4,5],[6,4],[10,3],[4,-4],[3,-5],[2,-5],[3,-15],[5,-1],[13,3],[10,7],[21,29],[10,9],[14,-1],[14,-6],[36,-20],[15,-3],[81,-9],[7,-4],[4,-6],[10,-7],[14,-5],[15,-3],[18,1],[31,6],[19,2],[7,1],[2,4],[-1,11],[4,2],[20,3],[8,1],[51,-8],[12,2],[35,28],[22,13],[22,6],[26,0],[49,-5],[14,3],[10,6],[4,12],[6,5],[37,20],[28,30],[4,5],[8,1],[46,20],[17,5],[6,-3],[-1,-19],[7,-9],[15,2],[27,9],[18,-2],[16,-7],[15,-8],[16,-6],[46,-6],[8,-5],[4,-10],[1,-23],[6,-8],[12,-4],[6,6],[8,20],[11,8],[8,-2],[14,-17],[19,-16],[3,-6],[-2,-4],[-11,-7],[-3,-4],[8,-12],[27,4],[57,19],[6,-7],[15,2],[16,6],[12,3],[8,-1],[10,-5],[8,-2],[9,1],[15,8],[22,8],[15,26],[18,6],[22,3],[11,-1],[19,-8],[10,-1],[10,0],[7,3],[-8,14],[-1,13],[8,7],[23,0],[33,-10],[20,-3],[16,5],[24,-10],[41,-30],[28,-12],[29,-7],[14,-3],[21,-2],[4,-2],[2,-5],[0,-16],[3,-1],[25,-14],[5,-6],[1,-5],[0,-8],[1,-7],[6,-3],[32,0],[6,3],[1,5],[-1,6],[2,5],[14,6],[10,-4],[10,-8],[12,-4],[14,-2],[15,-3],[13,-5],[10,-5],[5,-6],[3,-6],[4,-4],[9,-4],[9,1],[18,5],[9,2],[17,0],[17,-1],[10,-6],[-4,-11],[-4,-2],[-13,-4],[-4,-2],[0,-5],[4,-5],[5,-4],[4,-2],[19,4],[16,7],[15,3],[18,-6],[10,-10],[11,-23],[9,-10],[14,-4],[14,5],[13,2],[16,-8],[2,-6],[0,-5],[1,-5],[7,-3],[7,1],[4,5],[4,6],[5,5],[16,7],[8,-4],[10,-24],[5,-8],[7,-7],[9,-4],[4,-1],[0,-1],[-17,-19],[-62,-67],[-62,-67],[-62,-67],[-62,-67],[-62,-67],[-62,-66],[-62,-67],[-62,-67],[-27,-29],[34,-2],[108,-39],[8,-4],[42,-7],[21,0],[21,6],[31,19],[17,7],[22,2],[30,-7],[30,-15],[26,-19],[19,-19],[10,-19],[4,-19],[8,-18],[21,-15],[80,-28],[24,-14],[16,-12],[14,-14],[22,-31],[2,-15],[-7,-15],[-14,-12],[-27,-14],[-11,-1],[-11,2],[-10,5],[-9,7],[-5,4],[-3,13],[-9,10],[-16,4],[-17,-1],[-15,-5],[-10,-10],[-13,-21],[-15,-9],[-9,8],[-6,8],[-6,6],[-6,1],[-7,-1],[-7,2],[-39,21],[-8,7],[-1,10],[7,21],[-2,11],[-6,8],[-9,7],[-10,2],[-14,-15],[-10,1],[-20,13],[-13,3],[-11,1],[-12,-2],[-12,-4],[-33,-18],[-11,-2],[-9,3],[-2,8],[-4,8],[-12,4],[-13,-5],[-5,-9],[-3,-10],[-7,-6],[-38,15],[0,8],[3,10],[-1,8],[-13,2],[-13,-3],[-7,-7],[-9,-16],[-8,-5],[-14,0],[-50,10],[-8,-1],[-37,-13],[-11,-6],[-2,-7],[7,-14],[-3,-5],[-12,-3],[-12,-4],[-6,-8],[-4,-9],[-8,-9],[-24,-16],[-10,-9],[-7,-11],[-16,-11],[-17,10],[-12,11],[-4,-13],[-15,-8],[-41,11],[-20,-5],[-10,-12],[-8,-3],[-12,1],[-6,4],[-9,13],[-5,3],[-13,-5],[-12,-13],[-10,-8],[-22,17],[-18,2],[-19,-3],[-13,-7],[-2,-7],[2,-5],[0,-6],[-8,-7],[-3,0],[-4,2],[-5,1],[-5,-2],[-7,-6],[-3,-2],[-11,-3],[-6,3],[-5,6],[-8,4],[-11,1],[-36,-4],[-24,0],[-12,-1],[-11,-4],[-5,-4],[-5,-12],[-5,-4],[-6,1],[-20,3],[-11,-1],[-36,-11],[3,12],[-8,-2],[-16,-11],[-10,-2],[-7,-1],[-6,2],[-8,6],[-13,6],[-8,-1],[-9,-5],[-15,-1],[-9,2],[-18,5],[-8,1],[-7,-2],[-2,-4],[-1,-4],[-3,-2],[-5,-1],[-65,-5],[-14,-3],[-20,-10],[-38,-25],[-23,-5],[-13,-7],[-7,-4],[-7,-1],[-8,2],[-7,3],[-6,0],[-6,-5],[-15,-20],[-9,-7],[-15,-9],[-43,-17],[-40,-20],[-15,-6],[-14,-3],[-10,-1],[-30,3],[-9,-1],[-4,-4],[-2,-4],[-5,-3],[-32,-6],[-9,-7],[-6,-29],[-8,-9],[-13,-7],[-17,-6],[-4,0],[-11,-1],[-4,-1],[-2,-3],[0,-3],[0,-3],[-1,-2],[-4,-5],[-3,-5],[-4,-3],[-12,0],[-15,-2],[-14,-4],[-12,-7],[-20,-14],[-22,-7],[-10,-7],[-3,-6],[-1,-5],[-2,-5],[-8,-5],[-7,-1],[-43,0],[-16,3],[-15,1],[-10,-5],[-10,-9],[-14,-4],[-32,-5],[-4,1],[-10,2],[-4,0],[-2,-3],[-1,-8],[-1,-2],[-11,-4],[-6,-1],[-11,-1],[-19,-3],[-3,-8],[6,-10],[7,-8],[4,-8],[5,-33],[-2,-9],[-7,-8],[-8,-7],[-6,-8],[-6,-23],[-3,-9],[-23,-34],[-7,-17],[3,-18],[7,-18],[0,-15],[-13,-51],[-8,-16],[-11,-15],[-83,-75],[-27,-18],[-45,-69],[-17,-19],[-13,-20],[0,-25],[7,-14],[38,-29],[5,-10],[8,-44],[5,-12],[17,-25],[5,-13],[0,-11],[-4,-13],[-12,-22],[-19,-23],[-22,-15],[-27,-10],[-35,-6],[-56,-1],[-17,-4],[-28,-17],[-31,-13],[-54,-32],[-64,-25],[-39,-22],[-22,-9],[-11,-6],[-9,-14],[-8,-7],[-33,-14],[-9,-7],[-4,-9],[-2,-30],[-19,-49],[-12,-16],[-4,-13],[4,-8],[3,-5],[54,-54],[8,-23],[7,-10],[2,-10],[-9,-11],[-13,-6],[-16,-1],[-31,1],[-20,-1],[-14,-3],[-29,-12],[-17,-5],[-15,1],[-32,8],[-17,0],[3,-10],[22,-26],[5,-14],[-4,-9],[-6,-8],[-1,-12],[-10,-12],[-10,-3]],[[5224,1775],[27,47],[1,9],[1,18],[-3,20],[-2,6],[-4,6],[-14,13],[-11,16],[-15,11],[-7,16],[-2,16],[-3,10],[-4,7],[-5,5],[-5,3],[-35,16],[-7,5],[-8,8],[0,7],[5,15],[-3,5],[-5,4],[-7,4],[-8,5],[-9,9],[-7,5],[-7,5],[-8,1],[-9,1],[-7,-2],[-7,-3],[-19,-18],[-5,-3],[-7,-3],[-8,-2],[-41,-5],[-7,1],[-3,4],[-2,14],[-10,23],[16,22],[0,5],[-1,7],[-8,10],[-5,4],[-6,4],[-33,15],[-7,5],[-6,6],[6,10],[6,8],[9,8],[30,39],[4,10],[-4,10],[-14,22],[0,9],[3,8],[3,6],[8,9]],[[4955,2291],[8,11],[19,8],[33,10],[132,18],[42,-1],[13,0],[6,4],[6,7],[4,10],[8,65],[-6,28],[-19,37],[-28,43],[-5,17],[3,42],[-4,9],[-6,7],[-3,3],[-5,3],[-6,4],[-13,6],[-5,4],[-5,5],[-3,4],[-3,7],[-1,2],[-4,3],[-12,6],[-22,8],[-7,3],[-4,4],[-3,4],[22,51],[4,4],[5,2],[40,7],[30,8],[8,1],[8,-1],[7,-3],[5,-5],[11,-16],[4,-4],[9,-3],[12,-2],[22,-2],[12,-2],[10,-4],[16,0],[28,19],[4,5],[-2,2],[-12,3],[-10,1],[-10,2],[-7,2],[-19,15],[-5,5],[3,5],[10,6],[38,14],[11,8],[13,16],[4,4],[6,2],[6,-1],[14,-5],[8,-1],[9,1],[17,2],[9,1],[16,0],[28,4],[11,3],[14,6],[6,7],[2,7],[-1,5],[-2,5],[-7,10],[-5,12],[0,7],[0,6],[2,6],[2,6],[5,5],[5,3],[7,4],[7,2],[10,1],[12,-1],[17,-6],[25,-12],[6,-2],[5,-1],[6,6],[-1,13],[-3,9],[-22,38],[-20,13],[5,18],[0,5],[-3,17],[5,3],[3,1],[2,0],[11,-1],[2,1],[1,2],[0,3],[0,2],[0,3],[1,2],[5,6],[1,2],[0,4],[0,6],[-1,7],[-3,6],[-18,24],[-4,8],[-1,5],[3,6],[1,6],[1,11],[-2,6],[-5,9],[-8,9],[-40,33],[-15,16],[-4,5],[-9,16],[-2,2],[-4,3],[-6,2],[-11,2],[-7,0],[-5,0],[-7,-3],[-4,-1],[-4,-1],[-5,0],[-8,4],[-5,3],[-29,30],[18,30],[21,46],[5,7],[7,6],[28,19],[52,26]],[[5492,3381],[15,-11],[3,-4],[5,-7],[3,-10],[2,-2],[2,-2],[3,-2],[6,-2],[27,-7],[8,-3],[6,-2],[15,-12],[13,-7],[11,-7],[7,-4],[8,-2],[34,-7],[6,0],[8,0],[14,3],[12,5],[19,13],[11,5],[7,2],[6,1],[7,-1],[13,-2],[12,-4],[3,-2],[6,-2],[11,-1],[34,3]],[[3586,3183],[-10,15],[17,14],[7,20],[-7,21],[-27,16],[-23,27],[-75,29],[-45,13],[-9,0],[-3,3],[-14,9],[-5,5],[-1,8],[2,4],[3,4],[1,6],[-12,22],[-28,14],[-20,4]],[[3316,3462],[-4,36],[-6,13],[-6,16],[-4,6],[-12,12],[-4,12],[4,13],[-12,13],[1,5],[14,-1],[9,7],[-4,11],[-19,25],[-1,6]],[[3272,3636],[1,0],[22,10],[20,5],[3,1],[-1,3],[-2,3],[1,4],[2,5],[9,4],[6,5],[7,8],[8,18],[2,2],[4,1],[10,-1],[6,-2],[6,-3],[6,-3],[11,-7],[3,-4],[1,-2],[-4,-5],[-2,-7],[-6,-9],[1,-12],[3,-3],[3,-2],[16,-3],[7,1],[6,-1],[2,-1],[0,-7],[6,-13],[8,-6],[5,-3],[4,-3],[9,-4],[5,2],[7,4],[5,4],[10,3],[12,-1],[16,-4],[21,-1],[8,-3],[2,-2],[-4,-5],[-21,-18],[-5,-2],[-9,-1],[-6,0],[-5,0],[-5,-2],[-4,-4],[-1,-8],[-4,-5],[-9,-6],[-4,-2],[-1,-4],[0,-6],[2,-6],[4,-2],[8,0],[9,0],[2,-4],[1,-3],[-4,-4],[-3,-2],[-2,-2],[-1,-9],[0,-4],[0,-2],[0,-3],[0,-4],[-3,-5],[3,-7],[2,-2],[3,-1],[3,1],[7,0],[6,1],[22,6],[13,2],[6,2],[5,5],[6,3],[9,2],[5,2],[31,21],[9,9],[6,0],[10,-4],[7,-4],[18,-13],[3,-3],[2,-4],[12,-12],[2,-5],[1,-4],[-7,-7],[-14,-7],[-6,-1],[-6,-1],[-9,-4],[-2,-5],[1,-17],[3,-2],[3,-2],[5,0],[8,-1],[15,-9],[12,-7],[11,-10],[2,-4],[-2,-1],[-22,8],[-4,0],[-6,-3],[-8,-3],[-3,-7],[5,-6],[9,-7],[4,-5],[1,-7],[5,-7],[6,-6],[6,-2],[3,-3],[13,-17],[7,-5],[8,-5],[2,-3],[2,-4],[-2,-4],[-1,-5],[-6,-13],[-8,-8],[-3,-5],[-3,-4],[-4,-3],[-3,-4],[-3,-3],[-3,-6],[-1,-9],[2,-2],[3,-2],[3,-2],[1,-1],[-2,-3],[-4,-3],[-6,-4],[-44,-12],[-7,-15],[0,-6],[1,-6],[-1,-6],[-4,-7],[-10,-6],[-6,-3],[-6,-2],[-6,-2]],[[4955,2291],[-15,14],[-17,9],[-14,6],[-11,2],[-10,2],[-23,0],[-22,4],[-36,26],[-43,20],[-14,9],[-11,4],[-7,2],[-30,2],[-11,1],[-15,4],[-11,5],[-14,7],[-9,3],[-46,13],[-9,6],[-7,6],[-7,10],[-3,4],[2,6],[7,9],[2,5],[-2,5],[-12,14],[-2,5],[-2,5],[2,7],[12,9],[25,32],[-1,8],[-3,6],[-8,10],[-15,25],[9,8],[11,8],[8,10],[23,39],[-4,6],[-8,3],[-8,2],[-29,2],[-17,2],[-41,12],[-26,4],[-16,1],[-17,0],[-54,-2],[-22,3],[-5,4],[-4,5],[-1,6],[2,6],[3,5],[8,10],[14,13],[3,6],[3,6],[3,13],[2,6],[5,4],[7,3],[15,5],[7,4],[5,7],[4,12],[0,9],[0,7],[-11,30],[1,8],[5,6],[6,3],[30,10],[8,4],[8,6],[8,12],[4,7],[1,4],[-1,2],[-2,2],[-5,6]],[[4507,2925],[10,20],[9,33],[6,10],[7,6],[27,11],[34,22],[21,19],[18,24],[0,16]],[[4639,3086],[0,6],[3,11],[4,6],[4,4],[9,3],[7,2],[8,2],[6,5],[5,8],[6,13],[6,6],[8,7],[60,41],[10,5],[14,3],[11,2],[10,2],[8,6],[23,24],[19,7],[50,8],[-7,2],[-1,0],[-3,2],[-6,7],[-1,2],[-3,13],[-8,10],[-1,2],[-2,6],[2,1],[4,1],[12,2],[17,4],[8,4],[6,5],[5,4],[27,36],[2,6],[0,7],[-3,12],[-2,6],[-4,5],[-5,4],[-19,10],[-9,9],[-4,5],[-2,5],[-1,6],[3,5],[5,3],[18,11],[4,4],[3,4],[5,7],[4,4],[6,2],[8,-2],[6,-3],[14,-15],[6,-3],[6,-3],[5,-3],[11,-3],[16,-4],[11,-1],[13,0],[19,2],[31,7],[10,0],[12,-1],[10,-3],[11,-2],[12,0],[18,0],[39,7],[5,3],[4,2],[5,8],[5,5],[5,4],[3,1],[4,2],[5,0],[8,0],[32,-5],[20,-2],[15,-5],[35,-19],[24,0],[4,0],[8,-3],[51,-34],[41,-22]],[[4079,2212],[-3,-4],[-9,1],[-13,6],[-10,4],[0,6],[6,2],[14,-2],[5,-6],[2,-5],[8,-2]],[[3869,2449],[-7,-1],[-9,0],[-7,1],[2,6],[7,5],[2,6],[8,-1],[2,-3],[6,-2],[0,-6],[-4,-5]],[[4948,1584],[-15,11],[-9,5],[-15,3],[-16,2],[-12,3],[-5,9],[-4,2],[-14,2],[-1,4],[1,2],[11,4],[16,3],[3,7],[-12,12],[-23,10],[-32,9],[-21,14],[15,0],[9,3],[4,5],[-1,7],[-4,5],[-5,5],[-39,24],[-16,5],[-41,4],[-11,6],[-7,9],[-7,13],[-37,36],[-6,11],[-6,5],[-28,13],[-9,6],[-1,3],[1,18],[-3,4],[-35,18],[-65,21],[-21,8],[-17,6],[-19,8],[-34,19],[-40,13],[-2,3],[-7,3],[-8,2],[-6,1],[-9,2],[-6,5],[-5,6],[-5,6],[-6,3],[-6,3],[-33,11],[-11,8],[2,13],[-2,12],[-2,13],[-10,12],[-14,13],[-8,3],[-3,6],[4,5],[6,9],[-4,5],[-9,12],[-18,6],[-26,12],[-10,6],[-15,14],[-11,8],[-8,2],[-19,2],[-8,2],[-5,4],[-9,17],[22,2],[6,5],[2,5],[-6,7],[-7,10],[-5,6],[-6,12],[-10,10],[-12,4],[-13,3],[-7,7],[-4,9],[-6,7],[-10,4],[-28,7],[-1,-12],[-15,-17],[-16,19],[7,14],[-1,20],[-7,13],[9,4],[0,9],[10,4],[-5,6],[2,4],[2,6],[-7,6],[-5,10],[9,2],[2,13],[-5,10],[-14,6],[-2,7],[0,3],[3,5],[1,3],[-4,4],[-9,1],[-5,-3],[-2,-8],[-6,-5],[-10,3],[-13,-2],[-15,6],[-16,0],[0,14],[2,8],[11,18],[8,7],[-4,7],[8,4],[14,-2],[14,8],[14,0],[10,-1],[4,-6],[-8,-8],[-2,-8],[8,-4],[10,-3],[15,-8],[6,5],[1,12],[4,12],[12,24],[7,16],[-1,11],[3,15],[9,18],[9,17],[14,46],[-6,40],[-6,20],[-20,39],[-22,20]],[[4021,2740],[37,18],[13,13],[29,37],[7,6],[113,62],[8,7],[5,5],[11,18],[6,7],[6,2],[5,1],[3,-1],[1,0],[3,-2],[38,-12],[19,-3],[53,1],[75,7],[11,3],[22,10],[21,6]],[[4639,3086],[-44,23],[-30,10],[-6,3],[-4,7],[-1,9],[6,17],[12,19],[4,11],[7,49],[-9,20],[-11,8],[-56,81],[-10,10],[-2,10],[15,20],[-4,10],[-4,4],[-38,21],[-61,16],[-21,9],[-7,3],[-7,3],[-63,19],[-10,1],[-16,-1],[-11,-1],[-38,-12],[-14,-2],[-8,0],[-11,7],[-8,6],[-29,48],[-27,14],[-15,7],[-7,4],[-4,5],[-6,17],[-6,7],[-35,24],[-5,5],[-3,8],[-1,22],[-7,24],[0,25],[-1,7],[-5,5],[-8,4],[-18,3],[-10,-1],[-12,-6],[-6,1],[-9,7],[-8,5],[-19,7],[-9,5],[-7,8],[-13,11],[-26,55],[-2,12],[-10,12],[-39,26],[-8,24],[-6,55],[4,38]],[[4021,2740],[-20,18],[-26,17],[-50,45],[-63,56],[-26,19],[-6,14],[-12,12],[-8,24],[4,19],[-4,22],[-12,14],[-9,7],[-54,31],[-15,13],[-34,45],[-7,7],[1,15],[-1,5],[-6,5],[-12,9],[-25,23],[-34,15],[-16,8]],[[3272,3636],[-2,5],[-9,13],[-11,11],[-12,4],[-10,3],[-9,5],[-14,12],[-2,4],[5,5],[0,5],[-3,4],[-14,11],[-10,14],[-7,6],[-7,2],[-8,2],[-6,4],[-10,10],[-14,6],[-34,10],[-26,15],[-122,44],[-20,11],[-11,6],[2,7],[-2,12],[-4,11],[6,3],[-2,5],[6,5],[7,0],[10,-2],[7,3],[9,2],[4,9],[-1,14],[-11,13],[-8,8],[4,6],[-16,13],[4,5],[-8,10],[3,5],[-6,10],[-15,13],[3,4],[9,5],[-8,11],[-6,9],[1,7],[-6,11],[-9,10],[-11,10],[-13,12],[2,9],[-20,11],[-14,9],[0,8],[4,5],[-14,13],[1,4],[-23,14],[-12,6],[-4,7],[-5,6],[-6,4],[-17,11],[-33,38]]],"transform":{"scale":[0.001265457050305029,0.0018310484543392366],"translate":[-81.33755752899992,-18.337746206937936]}};
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
