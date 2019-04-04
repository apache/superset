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
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = {"type":"Topology","objects":{"prk":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]]]},{"type":"Polygon","properties":{"name":"Hwanghae-bukto"},"id":"KP.WB","arcs":[[31,32,33,34,35,36,37]]},{"type":"MultiPolygon","properties":{"name":"Hwanghae-namdo"},"id":"KP.WN","arcs":[[[38]],[[39]],[[40]],[[41]],[[-34,42]]]},{"type":"Polygon","properties":{"name":"P'yŏngyang"},"id":"KP.PY","arcs":[[-37,43]]},{"type":"Polygon","properties":{"name":"Hamgyŏng-bukto"},"id":"KP.HG","arcs":[[44,45,46,47,48]]},{"type":"Polygon","properties":{"name":"Kangwŏn-do"},"id":"KP.KW","arcs":[[49,-32,50,51]]},{"type":"Polygon","properties":{"name":"Chagang-do"},"id":"KP.CH","arcs":[[52,53,54,55,56]]},{"type":"Polygon","properties":{"name":"Hamgyŏng-namdo"},"id":"KP.HN","arcs":[[-47,57,-52,58,-54,59]]},{"type":"MultiPolygon","properties":{"name":"P'yŏngan-bukto"},"id":"KP.PB","arcs":[[[60]],[[61]],[[62]],[[63]],[[64]],[[-56,65,66]]]},{"type":"Polygon","properties":{"name":"P'yŏngan-namdo"},"id":"KP.PN","arcs":[[-51,-38,-44,-36,67,-66,-55,-59]]},{"type":"Polygon","properties":{"name":"Ryanggang"},"id":"KP.YG","arcs":[[-48,-60,-53,68]]},{"type":"MultiPolygon","properties":{"name":"Rasŏn"},"id":"KP.NJ","arcs":[[[69]],[[-45,70]]]}]}},"arcs":[[[2216,117],[2,-8],[-6,3],[4,5]],[[1582,122],[-5,-1],[-15,18],[-16,10],[5,1],[10,3],[24,-5],[-7,-12],[3,-7],[1,-7]],[[2630,189],[-21,-14],[-16,-5],[-9,3],[4,12],[8,8],[10,-7],[12,10],[12,2],[5,5],[0,-7],[-5,-7]],[[1726,207],[-3,-9],[1,15],[10,21],[14,9],[9,12],[13,-2],[-19,-20],[-7,-6],[-2,-8],[-11,-4],[-5,-8]],[[2408,238],[-6,-11],[-15,3],[-4,9],[7,14],[15,6],[3,-8],[0,-13]],[[1162,450],[-11,-2],[-1,7],[-3,11],[2,7],[6,1],[8,-8],[-1,-16]],[[944,723],[0,-19],[-6,3],[-1,11],[7,5]],[[1221,1845],[6,-5],[12,6],[7,-3],[-6,-23],[-13,-19],[-36,-26],[-7,5],[0,15],[8,12],[9,0],[5,-6],[4,2],[10,11],[2,8],[-12,-3],[-17,2],[-4,10],[4,8],[6,4],[1,7],[-3,10],[0,11],[10,-5],[14,-21]],[[5125,2895],[-14,-1],[-19,10],[14,1],[19,-2],[0,-8]],[[5272,2905],[-21,-7],[-3,1],[7,10],[0,14],[2,6],[12,1],[13,-6],[2,-18],[-12,-1]],[[794,3254],[-15,-7],[-1,12],[6,5],[11,8],[9,-6],[-10,-12]],[[876,3329],[-10,-8],[-5,3],[-1,6],[5,4],[-6,6],[1,15],[15,-1],[12,-4],[1,-3],[7,-4],[-19,-14]],[[646,3351],[-5,-3],[-9,13],[3,8],[8,-9],[3,-9]],[[641,3400],[-4,-8],[-4,0],[-6,15],[11,11],[9,-18],[-6,0]],[[1392,3437],[-4,-11],[-4,11],[8,0]],[[910,3455],[17,-10],[-5,1],[-7,3],[-5,6]],[[1551,3467],[-11,-15],[-11,4],[-14,14],[1,8],[13,6],[4,-9],[18,-8]],[[1451,3497],[6,-1],[10,0],[-8,-12],[-3,2],[-11,-10],[-7,-18],[-6,12],[-13,6],[9,12],[9,5],[14,4]],[[1433,3525],[15,-3],[15,2],[3,-16],[1,-6],[-17,-1],[-9,9],[-16,6],[2,8],[6,1]],[[817,3529],[-11,-26],[-1,13],[4,14],[8,-1]],[[851,3643],[-14,-8],[7,21],[7,-13]],[[1077,3661],[-1,-12],[-2,0],[-14,12],[3,1],[7,6],[7,-7]],[[858,3682],[-5,-17],[-11,3],[3,14],[13,0]],[[972,3689],[-5,-11],[-21,13],[10,5],[16,-7]],[[379,3762],[-8,0],[-6,7],[9,2],[5,-9]],[[486,3832],[-8,-16],[-6,12],[20,14],[17,11],[11,-2],[-8,-10],[-13,-8],[-13,-1]],[[218,4123],[-12,-23],[-16,5],[-3,33],[13,4],[18,-19]],[[199,4156],[-8,-8],[-18,7],[-7,8],[3,8],[14,0],[16,-15]],[[145,4223],[-21,-17],[19,24],[2,-7]],[[230,4261],[-24,-18],[10,27],[11,16],[3,-25]],[[6187,4355],[-10,-13],[-15,-7],[-22,-4],[-42,2],[-8,10],[3,8],[17,1],[-5,13],[3,9],[9,0],[12,-7],[5,1],[3,-6],[6,-2],[7,9],[9,6],[6,-25],[6,9],[3,9],[5,4],[6,8],[6,-2],[0,-10],[-4,-13]],[[4269,2612],[7,-69],[11,-30],[15,-21],[10,-9],[2,-3],[6,-13],[4,-9],[2,-9],[1,-9],[-2,-13],[-4,-16],[-10,-26],[-13,-24],[-26,-32],[-9,-7],[-9,-6],[-10,-4],[-9,-2],[-73,-5],[-10,-3],[-9,-4],[-10,-7],[-9,-7],[-9,-9],[-6,-9],[-6,-10],[-2,-15],[0,-19],[4,-35],[0,-49],[-4,-38],[-4,-20],[-5,-15],[-22,-39],[-52,-75],[-29,-58],[-14,-18],[-9,-9],[-19,-15],[-20,-11],[-91,-27],[-10,-5],[-9,-6],[-8,-9],[-5,-9],[-3,-15],[0,-3],[9,-17],[33,-47],[6,-12],[4,-14],[2,-23],[-2,-13],[-3,-12],[-4,-9],[-6,-20],[-4,-20],[0,-9],[1,-28],[9,-37],[11,-23],[103,-172],[6,-12],[1,-13],[6,-11],[11,-11],[9,-4],[12,-4],[13,-5],[14,-9],[18,-16],[13,-3],[8,1],[17,14],[7,4],[9,2],[9,1],[6,-8],[1,-13],[-10,-28],[-8,-13],[-7,-13],[-2,-10],[5,-14],[4,-7],[12,-17],[2,-10],[-1,-12],[-9,-20],[-8,-21],[4,-26],[26,-35],[9,-5],[1,-1],[13,-6],[26,-3],[6,-8],[4,-8],[4,-8],[14,-23],[0,-1]],[[4205,934],[-31,-74],[-26,-28],[-59,-44],[-27,-26],[-132,-193],[-61,-47],[-40,-15],[-28,-3],[-19,-13],[-8,-45],[11,-161],[-1,0],[-17,-25],[-6,-28],[-15,-3],[-33,-19],[-42,-25],[-27,6],[-215,133],[-12,11],[-38,62],[-4,3]],[[3375,400],[9,16],[4,8],[2,11],[-3,10],[-9,10],[-9,7],[-8,12],[-2,18],[6,60],[3,13],[4,9],[3,11],[-1,15],[-11,21],[-6,30],[13,30],[-18,40],[5,48],[-5,14],[-7,8],[-10,12],[-1,14],[5,22],[8,12],[20,12],[8,8],[8,8],[7,5],[7,-1],[4,-6],[8,-27],[4,-9],[6,-7],[5,-2],[7,4],[2,10],[1,19],[-5,13],[-12,21],[-11,28],[-10,19],[-14,18],[-9,9],[-9,7],[-9,5],[-80,33],[-44,24],[-35,13],[-20,4],[-35,-1],[-67,-13],[-8,-4],[-9,-5],[-48,-38],[-10,-7],[-9,-2],[-10,1],[-19,6],[-10,0],[-10,-3],[-9,-6],[-9,-8],[-15,-18],[-13,-6],[-16,-2],[-49,11],[-15,0],[-10,-4],[-37,-19],[-57,-14],[-13,-1],[-16,1],[-24,5],[-13,7],[-9,9],[-5,9],[-3,9],[-14,74],[-5,18],[-9,11],[-43,34],[-11,14],[-8,12],[-2,10],[-3,9],[-19,23],[-7,19],[-8,11],[-9,4],[-9,-1],[-8,-4],[-8,-6],[-9,-3],[-35,7],[-12,-1],[-25,-10],[-22,4],[-4,6],[3,7],[7,6],[3,5],[2,7],[-3,9],[-9,9],[-19,17],[-31,15],[-11,11],[0,6],[12,8],[8,7],[6,8],[5,9],[2,8],[-2,8],[-3,5],[-27,34],[-4,6],[-3,6],[-2,8],[-3,19],[-1,30],[1,10],[1,10],[4,10],[2,9],[-2,10],[-12,25],[-13,21],[-4,16],[-7,15],[-12,19],[-6,13],[-3,12],[3,40],[-1,10],[-3,10],[-8,19],[-2,10],[0,51],[-5,23],[-8,8]],[[2213,1786],[16,5],[-14,14],[-18,29],[-10,9],[-1,0]],[[2186,1843],[-19,55],[-3,49],[-3,14],[-5,10],[-29,28],[-17,21],[-7,15],[-3,12],[2,24]],[[2102,2071],[45,15],[111,71],[50,23],[41,5],[101,-5],[24,-6],[156,-77],[8,-7],[8,-8],[7,-8],[4,-9],[1,-10],[-2,-30],[4,-10],[9,-9],[59,-27],[26,-16],[61,-26],[39,-8],[23,2],[33,7],[12,5],[11,7],[9,8],[26,38],[8,9],[13,9],[16,7],[60,16],[9,4],[9,8],[6,9],[4,9],[1,9],[-1,62],[-1,9],[-2,9],[-3,9],[-5,9],[-56,78],[-5,5],[-8,6],[-37,19],[-19,12],[-8,8],[-6,9],[-4,9],[-3,10],[-2,9],[0,10],[4,38],[2,10],[3,11],[7,12],[14,14],[8,3],[11,-10],[12,-2],[17,9],[11,12],[14,6],[7,11],[13,1],[8,-3],[48,-7],[7,-3],[10,-13],[18,-15],[5,-6],[20,-11],[28,-9],[11,6],[11,0],[30,-6],[11,-3],[49,-21],[10,-6],[9,-5],[7,-3],[14,-7]],[[3353,2352],[109,-35],[17,-1],[25,1],[10,8],[7,8],[4,8],[1,7],[1,6],[0,7],[-1,13],[-4,16],[-6,19],[-11,18],[-1,12],[3,15],[19,22],[12,8],[12,3],[10,-4],[77,-47],[20,-3],[26,0],[56,6],[22,8],[12,9],[-2,9],[-3,8],[-6,10],[-12,13],[-13,19],[-6,11],[-5,10],[-9,30],[-5,9],[-6,9],[-36,34],[-7,10],[-5,9],[-7,20],[-5,11],[-21,30],[-4,9],[-3,11],[-2,10],[0,14],[4,16],[11,24],[14,12],[13,2],[11,-6],[24,-30],[9,-8],[10,-7],[12,-5],[12,-3],[25,-1],[22,3],[74,19],[12,0],[12,-2],[12,-5],[18,-10],[23,-19],[10,-7],[11,-4],[49,-8],[23,-9],[22,-12],[80,-63],[21,-13],[33,-5],[86,11]],[[1697,123],[-26,-26],[-41,-25],[-12,-12],[-22,-15],[-32,-6],[-9,14],[46,52],[22,10],[16,-6],[3,13],[4,16],[8,1],[4,2],[2,5],[6,4],[11,1],[45,20],[14,4],[-39,-52]],[[1456,208],[-13,-2],[-8,16],[-2,10],[8,5],[30,22],[28,9],[7,1],[4,-7],[3,-8],[-4,-4],[-8,-2],[-21,-20],[-24,-20]],[[1284,279],[-4,-13],[-4,0],[-5,0],[-16,-17],[-15,-5],[-17,0],[-11,5],[0,9],[7,4],[7,7],[8,5],[11,-3],[10,-4],[4,1],[2,8],[1,4],[-4,9],[4,12],[16,-3],[6,-19]],[[1036,1599],[26,-44],[5,-20],[-66,17],[-31,13],[-29,22],[-35,-26],[-14,17],[7,31],[58,36],[18,4],[8,-18],[25,-8],[18,-10],[10,-14]],[[3375,400],[-6,5],[-29,-4],[-32,-10],[-121,-62],[-31,-11],[-35,-4],[-56,2],[-34,-7],[-31,-20],[-14,-14],[-2,-6],[3,-7],[5,-29],[10,-39],[9,-20],[-1,-26],[-5,-26],[-5,-14],[-74,14],[-20,76],[-16,36],[-23,-2],[-14,5],[-6,42],[-5,86],[-45,-31],[-21,1],[-8,37],[-10,22],[-23,24],[-25,19],[-16,6],[-24,-19],[10,-23],[22,-20],[12,-9],[3,-19],[14,-50],[4,-27],[-13,12],[-16,12],[-18,9],[-15,5],[-19,3],[-10,-1],[-8,1],[-16,11],[-25,27],[-77,115],[-7,19],[-9,13],[-36,8],[-10,7],[-4,14],[-1,21],[3,35],[-7,8],[-23,2],[-16,4],[-27,17],[-15,5],[-64,3],[-27,5],[-62,28],[-39,9],[-39,0],[-27,-13],[-2,-30],[29,-31],[38,-25],[30,-10],[53,7],[15,-10],[-10,-37],[16,7],[16,4],[15,-2],[16,-9],[-18,-24],[-14,-27],[29,0],[12,4],[12,10],[10,-14],[-18,-18],[-19,-14],[-22,-11],[-25,-7],[-25,1],[-18,13],[-18,18],[-23,18],[-5,-43],[15,-44],[6,-42],[-28,-36],[23,-22],[10,-5],[-6,-18],[-10,-7],[-31,-1],[-7,-5],[3,-12],[9,-21],[5,-27],[0,-17],[-10,-7],[-17,1],[-15,3],[-14,7],[-13,13],[6,4],[1,2],[1,2],[3,6],[-18,10],[-17,1],[-13,-9],[-4,-22],[-11,-1],[-20,4],[-13,14],[11,30],[-37,-33],[-19,-46],[-25,-43],[-56,-21],[-54,-2],[-28,-5],[-12,-11],[-7,-31],[-17,-26],[-22,-8],[-19,20],[21,97],[23,43],[41,-12],[84,37],[-24,14],[-53,-10],[-27,10],[19,27],[33,25],[37,18],[32,7],[76,-18],[29,9],[5,47],[-25,-10],[-21,4],[-17,13],[-11,20],[45,49],[2,20],[-41,8],[-30,10],[-13,20],[-15,11],[-33,-16],[5,-7],[4,-12],[3,-6],[-40,0],[-18,-4],[-17,-9],[30,-11],[39,-21],[28,-27],[-2,-32],[-29,24],[-41,18],[-43,7],[-34,-9],[7,-14],[10,-11],[11,-8],[15,-7],[-49,-39],[-29,-18],[-28,-7],[1,4],[-2,8],[-4,9],[-7,5],[-95,0],[19,28],[67,41],[21,35],[-12,32],[-67,36],[4,34],[-31,-6],[-17,-27],[-14,-35],[-17,-29],[-24,-17],[-25,-8],[-29,0],[-89,14],[-17,6],[-42,33],[-16,5],[-34,3],[-25,11],[-10,23],[10,40],[-38,-23],[-14,-4],[6,32],[13,20],[21,10],[29,3],[19,7],[39,28],[21,3],[21,-8],[41,-25],[28,-5],[24,1],[22,6],[18,12],[14,19],[-11,14],[-17,-12],[-17,-3],[-17,7],[-33,28],[-7,2],[-5,6],[-9,24],[-4,36],[14,14],[64,1],[68,13],[18,-7],[6,-16],[4,-18],[8,-12],[33,-2],[11,63],[31,16],[-13,29],[-26,11],[-61,0],[-28,4],[-53,18],[-24,4],[-25,-5],[-75,-35],[-74,-14],[-22,-12],[-116,66],[-51,51],[-30,13],[-14,-33],[-17,-13],[-39,-10],[-71,-8],[-180,33],[-15,20],[9,21],[38,15],[73,5],[30,16],[13,37],[10,5],[65,14],[11,14],[25,46],[16,16],[36,7],[25,-17],[39,-60],[16,7],[96,63],[-40,16],[-81,-12],[-43,29],[-22,25],[-4,15],[-1,31],[16,118],[6,19],[68,101],[11,21],[19,56],[18,20],[12,5],[8,-3],[5,-13],[-4,-28],[20,21],[26,42],[22,45],[7,32],[-10,19],[-28,20],[-5,19],[2,22],[4,16],[-2,15],[-23,19],[5,15],[21,1],[31,-17],[17,11],[13,3],[9,-18],[23,-24],[33,29],[36,18],[39,-25],[10,20],[-1,35],[5,28],[-17,16],[-12,22],[-3,23],[10,17],[22,-8],[17,-30],[13,-27],[35,6],[6,14],[-8,27],[2,25],[15,-6],[7,-18],[15,-9],[26,7],[24,3],[36,22],[12,1],[17,-13],[35,-12],[16,16],[13,6],[17,19],[24,16],[35,14],[43,-2],[15,-1],[36,-10],[18,-3],[4,6],[3,14],[7,14],[18,6],[69,-40],[7,-18],[4,-35],[10,-10],[18,3],[8,18],[5,20],[6,9],[16,-5],[15,-12],[11,-15],[5,-12],[16,-26],[38,-20],[42,-9],[15,4]],[[2102,2071],[-12,34],[-9,7],[-14,9],[-20,10],[-11,8],[-7,10],[-5,12],[-4,19],[0,14],[3,12],[5,9],[7,7],[8,5],[47,16],[16,10],[8,12],[8,17],[24,85],[1,12],[-1,8],[-10,33],[-8,17],[-11,15],[-8,28],[-7,104],[0,7],[2,8],[3,6],[6,8],[112,85],[3,2],[6,3],[6,6],[1,3],[1,4],[-1,3],[-1,2],[-1,2],[-6,5],[-12,6],[-23,17],[-3,3],[-2,4],[-1,3],[0,4],[2,11],[2,4],[6,29],[1,8],[0,10],[-1,6],[-2,6],[-15,41],[-13,22],[-2,6],[-1,8],[1,8],[1,3],[1,3],[2,3],[8,8],[5,5],[64,20],[46,29],[11,11],[6,3],[6,3],[8,1],[9,-4],[14,-9],[48,-40],[2,-2],[6,-11],[1,-2],[12,-20],[5,-7],[5,-5],[6,-3],[9,-4],[47,-12],[5,-3],[5,-6],[9,-11],[4,-6],[2,-6],[5,-12],[9,-28],[3,-20],[2,-6],[4,-10],[3,-2],[5,-1],[9,1],[4,2],[2,4],[0,3],[0,13],[-5,28],[-1,8],[1,8],[0,4],[4,14],[5,12],[3,6],[10,12],[11,10],[6,4],[6,3],[29,6],[8,1],[8,-1],[11,-4],[12,-6],[13,-13],[24,-27],[6,-5],[61,10],[17,8],[6,5],[4,3],[3,3],[2,3],[2,8],[3,7],[3,3],[3,3],[4,1],[4,0],[13,-2],[8,-2],[8,-7],[8,-10],[16,-24],[5,-13],[4,-9],[1,-9],[1,-4],[2,-4],[3,-4],[4,-4],[6,-3],[13,-2],[51,3],[8,-5],[33,-32],[18,-14],[4,0],[9,-1],[46,6],[15,-1],[9,-2],[5,-6],[5,-10],[8,-24],[1,-12],[0,-11],[-3,-10],[-2,-8],[1,-12],[1,-6],[2,-6],[5,-11],[17,-22],[38,-37],[10,-6],[66,-12],[11,-3],[4,-3],[7,-11],[39,-83],[1,-1],[9,-14],[9,-20],[4,-22],[4,-75]],[[9617,9135],[-5,-86],[-24,-95],[-66,-29],[-114,-29],[-84,-8],[-6,-51],[36,-36],[-12,-73],[-84,-95],[-42,-88],[16,-114]],[[9232,8431],[3,-26],[-7,-110],[-9,0],[-13,5],[-18,-9],[-21,-26],[5,-3],[5,-12],[-11,-8],[-14,2],[-26,20],[-21,10],[-42,0],[-30,-22],[-8,-35],[-1,-14],[-23,-3],[-4,-15],[-7,-12],[-13,-46],[-4,-30],[-11,-5],[-19,40],[-18,-6],[-3,-38],[-29,-15],[10,-8],[8,-10],[14,-20],[-16,-5],[-11,-8],[-16,-26],[5,4],[-4,-18],[-7,-23],[-4,-8],[-6,-35],[-16,-13],[-12,5],[-14,17],[-37,14],[-26,-13],[-10,-40],[-10,-48],[1,-62],[-23,-61],[-22,-19],[-4,-31],[-15,-12],[-25,37],[-20,-1],[-60,-35],[-18,-53],[-20,-65],[-13,-23],[-41,-16],[-37,-48],[-12,-60],[-21,-78],[-32,-50],[18,-44],[-4,-31],[-8,-29],[11,-55],[34,-40],[31,-27],[20,-17],[33,3],[12,-27],[22,-27],[17,-12],[10,-1],[23,4],[9,-3],[15,-19],[-2,-6],[-8,-8],[-5,-25],[-3,-6],[-12,-41],[-1,-10],[-25,-18],[-17,-42],[-61,-236],[-12,-83],[26,-70],[-10,-25],[-3,-30],[1,-61],[12,-84],[6,-18],[28,-32],[22,-14],[-14,-10],[-10,-41],[6,-14],[-29,-35],[5,-37],[-19,-44],[-13,-25],[-17,2],[-11,19],[-22,-7],[-33,-6],[-29,5],[-28,-6],[-25,5],[-18,-5],[-41,3],[-27,-21],[-4,-35],[-30,-5],[-21,-22],[-19,-7],[-45,4],[-77,-24],[-58,-38],[-58,-29],[-18,-21],[-18,-30],[-26,-58],[-12,-26],[-11,5],[-15,14],[-13,27],[-12,19],[-27,2],[-30,-7],[-24,-17],[-8,-20],[-10,-19],[0,-10],[1,-12],[-8,-14],[-2,-11],[-4,-23],[-7,-11],[-4,-18],[-5,-12],[-13,-13],[-7,-11],[-1,-19],[-2,-46],[-17,-6],[-1,-2]],[[7627,5415],[-81,5],[-28,7],[-26,15],[-17,25],[-4,33],[6,27],[-2,26],[-23,29],[-62,46],[-29,28],[-19,34],[-5,24],[-1,47],[-3,24],[-9,20],[-13,19],[-28,32],[-20,29],[-10,30],[3,29],[20,27],[10,26],[-14,30],[-17,31],[-4,31],[16,31],[35,54],[9,35],[-1,51],[-11,47],[-38,90]],[[7261,6397],[21,50],[-16,50],[-25,50],[-7,55],[11,26],[34,49],[6,30],[-9,29],[-18,21],[-22,19],[-19,19],[-67,102],[-24,59],[-11,63],[17,61],[40,38],[46,34],[30,48],[-2,53],[-24,54],[-38,45],[-41,25],[-81,8],[-21,11],[-7,21],[12,18],[18,20],[10,25],[-3,22],[-23,35],[-8,21],[-4,25],[-1,64],[3,26],[9,49],[-2,21],[-12,16],[-14,1],[-37,-12],[-13,3],[-7,13],[-2,16],[0,33],[-3,17],[-5,16],[-19,49],[-4,18],[-4,41],[21,6],[40,-16],[21,2],[16,11],[11,17],[18,37],[28,29],[69,38],[28,27],[18,41],[4,16]],[[7199,8162],[32,-7],[56,17],[23,74],[14,25],[32,9],[37,4],[27,12],[42,40],[15,24],[2,34],[37,-20],[26,-2],[22,13],[43,46],[46,37],[29,29],[12,10],[11,11],[5,10],[-8,17],[-35,3],[-9,13],[4,22],[13,9],[17,6],[13,8],[5,16],[-1,15],[3,14],[19,12],[-12,12],[-12,7],[-14,5],[-15,1],[0,14],[50,0],[15,10],[10,28],[-3,10],[-10,5],[-8,7],[-1,17],[5,16],[7,12],[11,8],[82,16],[11,5],[6,33],[12,28],[18,8],[17,-23],[22,12],[-13,16],[-8,17],[3,13],[18,5],[17,-5],[14,-24],[22,-8],[14,4],[16,11],[20,9],[23,0],[75,-57],[10,-15],[43,-22],[10,-14],[5,-19],[13,-7],[16,3],[13,11],[8,19],[2,18],[4,14],[38,13],[10,21],[2,25],[-6,23],[65,-5],[58,-14],[49,9],[40,62],[7,68],[-3,73],[7,64],[41,40],[0,11],[-26,6],[-7,25],[15,26],[39,8],[-7,28],[11,16],[13,12],[-2,15],[-18,16],[-16,7],[-10,12],[-3,35],[2,24],[7,21],[18,39],[25,48],[8,26],[7,57],[54,132],[11,20],[8,19],[2,43],[6,20],[17,14],[47,4],[21,9],[-14,5],[-12,8],[-9,10],[-7,14],[17,7],[28,17],[18,3],[21,-3],[11,-9],[47,-56],[15,-14],[22,-9],[19,-2],[60,2],[73,29],[42,9],[18,-17],[-5,-25],[-12,-30],[-17,-27],[-19,-14],[64,-27],[82,2],[70,-11],[27,-67],[-22,-159],[1,-72],[30,-65],[84,-78],[12,-32],[105,-82],[17,-4],[13,1],[12,-1],[11,-9],[4,-15],[-6,-36],[8,-20],[32,-23]],[[4972,3242],[-10,-15],[-9,-9],[-72,-26],[0,-13],[17,-9],[37,-9],[18,-9],[19,13],[25,7],[21,-8],[9,-30],[-10,-14],[-49,-10],[-15,-8],[-8,11],[-9,8],[-9,5],[-11,1],[-15,-4],[1,-10],[7,-13],[2,-11],[-18,-50],[-12,-52],[-10,-54],[16,-35],[17,-38],[23,-15],[18,-8],[32,-34],[17,-10],[31,5],[6,16],[-4,19],[0,12],[27,3],[32,-72],[31,-20],[116,11],[38,-11],[17,-14],[14,-17],[15,-15],[22,-6],[105,1],[23,-3],[16,-15],[36,-59],[48,-65],[10,-19],[9,-27],[24,-32],[52,-51],[5,-24],[6,-7],[15,12],[10,6],[8,-6],[6,-12],[5,-29],[8,-14],[11,-11],[15,-5],[28,-15],[52,-80],[30,-33],[118,-27],[183,-217],[23,9],[70,36],[19,6],[47,-71],[12,-11],[26,-14],[15,-13],[19,-34],[0,-6],[2,-28],[-1,-33],[6,-34],[1,-1],[-87,-43],[-42,-32],[-10,-24],[3,-32],[13,-65],[-6,-66],[-21,-58],[-29,-52],[-36,-49],[-82,-82],[-98,-61],[-106,-36],[-105,-8],[-162,9],[-102,-20],[-21,5],[-19,18],[-19,28],[-13,8],[-297,-25],[-91,-26],[-46,-4],[-147,42],[-190,-16],[-49,5],[-99,-10],[-103,-40],[-98,-59],[-85,-67],[-9,-11],[-19,-23],[-21,-50]],[[4269,2612],[19,78],[30,43],[12,8],[52,25],[9,8],[4,9],[-4,16],[-5,12],[-50,55]],[[4336,2866],[19,14],[3,13],[0,11],[-11,32],[-5,30],[4,16],[9,10],[45,12],[13,6],[17,14],[7,12],[3,13],[1,24],[2,13],[10,40],[8,59],[5,16],[8,14],[10,11],[15,13],[12,8],[11,5],[11,3],[12,1],[56,-9],[78,11],[51,-2],[76,-14],[74,10],[39,-2],[12,2],[10,0],[10,-1],[21,-9]],[[4297,7641],[-5,-11],[-28,-48],[-24,-50],[-10,-57],[1,-45],[7,-41],[8,-28],[3,-13],[0,-16],[-14,-28],[-24,-16],[-27,-12],[-23,-17],[-16,-26],[-10,-21],[-14,-16],[-28,-6],[-44,6],[-20,-4],[-17,-20],[-4,-24],[4,-30],[9,-28],[11,-20],[28,-22],[27,1],[56,23],[14,3],[17,1],[14,-6],[8,-15],[-3,-14],[-20,-21],[-5,-13],[4,-12],[28,-43],[11,-30],[8,-32],[10,-65],[17,-36],[51,-39],[11,-30],[-4,-18],[-6,-12],[1,-12],[19,-20],[16,-20],[6,-23],[9,-52],[19,-36],[29,-24],[89,-54],[20,-7],[47,-4],[60,-16],[21,3],[31,18],[19,24],[16,28],[22,28],[34,23],[45,14],[44,0],[34,-22],[13,-35],[8,-48],[3,-50],[-2,-40]],[[4901,6365],[-7,-70],[-22,-45],[-77,-79],[-25,-50],[-12,-67],[8,-65],[33,-41],[59,-27],[19,-22],[2,-38],[-8,-25],[-12,-21],[-16,-16],[-19,-11],[-67,-19],[-120,-66],[-33,-43],[-23,-110],[-28,-43],[-19,-9],[-68,-8],[-29,-8],[-23,-11],[-20,-16],[-24,-21],[-47,-31],[-38,-19],[-19,-32],[10,-69],[-2,-53],[-28,-39],[-37,-37],[-29,-45],[-9,-31],[-7,-34],[-3,-34],[1,-26]],[[4162,4984],[-2,0],[-36,-75],[-23,-27],[-58,-45],[-12,-14],[-8,-11],[-12,-42],[-10,-25],[-11,-12],[-12,-6],[-25,-3],[-23,-4],[-12,-5],[-13,-6],[-21,-15],[-15,-16],[-19,-24],[-13,-12],[-12,-7],[-34,-7],[-14,-4],[-14,-8],[-98,-65],[-17,-14],[-12,-13],[-5,-10],[-3,-11],[-6,-36],[-3,-15],[-9,-19],[-12,-9],[-11,-6],[-46,-2],[-18,-8],[-91,-60],[-19,-8],[-12,1],[-12,2],[-11,3],[-67,43]],[[3311,4389],[-59,27],[-30,8],[-143,16],[-32,13],[-68,42],[-22,20],[-66,79],[-102,89],[-41,52],[-27,27],[-13,6],[-10,2],[-20,-2],[-21,5],[-15,10],[-18,13],[-14,6],[-13,2],[-23,-1],[-22,-4],[-22,-9],[-21,-12],[-12,-4],[-15,-1],[-23,3],[-15,6],[-12,7],[-24,22],[-180,111],[-49,43],[-12,14],[-6,12],[2,10],[7,10],[8,9],[6,9],[2,11],[-2,10],[-7,9],[-64,63],[-5,10],[-3,9],[-2,10],[0,11],[3,10],[12,21],[3,11],[7,52],[1,3],[2,5],[17,26],[5,10],[3,10],[3,10],[0,11],[-3,9],[-12,24],[-2,7],[-9,42],[-7,13],[-10,7],[-11,0],[-25,-6],[-14,0],[-16,6],[-11,8],[-48,58],[-14,13],[-13,10],[-109,58]],[[1855,5580],[6,26],[11,9],[27,-5],[14,9],[6,12],[0,26],[5,14],[14,22],[15,11],[20,4],[64,2],[20,7],[11,21],[3,41],[7,37],[18,12],[23,-6],[21,-17],[12,-16],[3,-5],[91,1],[21,13],[-14,28],[-44,50],[59,70],[32,21],[4,3],[47,8],[14,6],[7,12],[6,13],[10,8],[15,1],[13,-3],[66,-28],[15,2],[63,41],[19,9],[26,3],[16,-9],[18,-19],[19,-13],[21,10],[22,16],[48,6],[19,9],[12,19],[-8,9],[-21,2],[-25,-3],[18,28],[27,8],[29,5],[27,17],[31,45],[9,23],[-4,16],[10,15],[12,10],[15,7],[17,5],[-4,24],[15,20],[23,20],[18,26],[-22,35],[37,31],[174,95],[22,18],[15,22],[38,82],[18,20],[39,36],[17,22],[36,77],[17,24],[76,84],[49,34],[44,-1],[-5,-8],[-3,-7],[-4,-6],[-9,-6],[0,-13],[53,14],[0,48],[-21,59],[-11,47],[10,24],[53,79],[25,84],[29,52],[6,25],[-6,25],[-17,25],[1,23],[54,53],[25,44],[24,5],[55,-3],[16,9],[50,42],[24,13],[-21,17],[-22,12],[-20,14],[-12,23],[27,9],[24,0],[23,-8],[22,-14],[46,-46],[27,-17],[11,17],[20,47],[86,33],[20,49],[14,21],[33,21],[33,9],[15,-13],[2,-41],[8,-11],[20,1],[34,-6],[29,-21]],[[7627,5415],[-8,-15],[-7,-20],[-55,-65],[-58,-73],[-73,3],[-84,-26],[-117,-116],[-61,-49],[-46,-9],[-26,-23],[-50,-15],[-26,-1],[-19,-21],[-47,7],[-52,-15],[-28,-38],[-20,0],[-2,18],[-29,-13],[-27,-30],[-4,-49],[19,-10],[43,-16],[6,-18],[11,-14],[-8,-28],[3,-45],[-21,-8],[-14,-12],[-11,-12],[-9,-7],[-11,1],[-21,9],[-30,2],[-17,-12],[-53,-26],[-11,-29],[-12,-14],[-27,-15],[-47,-2],[-21,-19],[-27,-28],[-21,-10],[-37,-15],[-30,6],[-42,-5],[-41,-56],[-16,-72],[-39,9],[-34,60],[-26,22],[-41,-17],[-14,-22],[11,-50],[-15,-4],[-33,4],[-16,0],[-17,-6],[-27,-16],[-15,-3],[-12,4],[-5,9],[-7,8],[-204,33],[-7,-8],[-2,-28],[-5,-10],[-12,-10],[-16,-8],[-14,-4],[-11,-9],[-25,-42],[-11,-13],[-15,-5],[-36,23],[-25,-43],[1,-33],[-11,-78],[-15,-17],[-143,-14],[23,-18],[-4,-19],[-49,-23],[-54,7],[-48,-17],[-25,-59],[-26,-18],[-22,26],[-38,19],[-26,-39],[-22,-7],[-26,-19],[-22,-23],[-19,-43],[-44,-27],[-10,-15],[-3,-14],[-13,-29],[-4,-16],[1,-16],[7,-28],[3,-44],[6,-20],[9,-9],[15,2],[38,-17],[27,-36],[7,-42],[-58,-81],[-26,-78],[23,-125],[43,-187],[-1,-52],[-12,-19],[-17,-8],[-18,6],[-16,21],[-1,25],[9,28],[24,51],[-53,70],[-6,26],[-14,20],[-18,6],[-20,-13],[-46,-41],[-4,-5]],[[4336,2866],[-33,16],[-7,3],[-8,1],[-23,1],[-43,-8],[-12,0],[-11,2],[-10,5],[-8,9],[-2,11],[3,14],[8,22],[1,13],[-1,15],[-7,19],[-7,13],[-10,9],[-9,5],[-11,3],[-12,1],[-11,0],[-11,-4],[-11,-6],[-16,-17],[-9,-5],[-9,1],[-7,7],[-4,9],[-5,21],[-3,9],[-5,10],[-6,9],[-8,7],[-7,5],[-5,2],[-7,2],[-5,1],[-22,1],[-11,-2],[-11,-3],[-50,-24],[-9,-2],[-9,0],[-12,1],[-11,4],[-11,6],[-10,10],[-8,10],[-6,10],[-4,10],[1,23],[4,32],[33,123],[23,57],[2,12],[0,14],[-7,20],[-9,12],[-10,10],[-11,7],[-38,34],[-16,18],[-6,11],[-4,9],[0,16],[3,19],[14,34],[11,18],[12,13],[9,7],[9,11],[4,14],[1,22],[-1,14],[-4,12],[-11,29],[-1,13],[2,14],[11,19],[60,61],[4,8],[2,9],[-4,13],[-5,5],[-8,3],[-11,1],[-12,3],[-9,5],[-4,11],[3,16],[21,39],[25,36],[5,9],[5,11],[21,69],[8,16],[9,13],[9,8],[10,6],[11,6],[21,8],[86,20],[99,0],[23,-4],[21,-8],[9,-5],[9,-8],[7,-9],[20,-31],[8,-7],[6,-2],[9,0],[10,4],[9,7],[14,16],[9,6],[11,3],[62,5],[10,4],[9,7],[7,9],[5,9],[9,19],[4,11],[2,12],[-2,19],[-6,17],[-46,79],[-7,16],[-19,74],[-4,25],[-1,10],[2,11],[6,8],[10,4],[11,3],[9,4],[5,10],[0,13],[-4,19],[0,14],[4,11],[6,8],[6,6],[106,79],[16,19],[5,9],[3,11],[1,11],[0,11],[-8,13],[-15,15],[-58,33],[-15,13],[-8,18],[-7,27],[-6,53],[0,2],[4,12],[9,20],[2,10],[1,10],[-1,9],[-3,10],[-8,12],[-74,67],[-13,9],[-21,9],[-28,8],[-21,4],[-140,-4]],[[4901,6365],[63,-14],[65,-4],[30,10],[17,22],[9,32],[7,37],[25,56],[40,15],[104,-20],[56,-26],[20,-45],[-2,-61],[-10,-72],[-7,-26],[-12,-21],[-17,-15],[-22,-7],[-47,-4],[-20,-10],[6,-22],[39,-57],[4,-48],[-25,-43],[-96,-69],[-21,-20],[-12,-21],[3,-23],[21,-9],[27,-7],[21,-19],[9,-24],[9,-50],[7,-23],[63,-102],[17,-22],[17,-11],[17,-8],[19,-15],[14,-28],[9,-69],[9,-30],[12,-18],[14,-11],[16,-6],[19,-4],[49,-1],[19,-8],[-10,-20],[-16,-22],[0,-19],[7,-20],[3,-27],[-4,-25],[-9,-16],[-29,-30],[-12,-23],[-5,-22],[-2,-51],[2,-36],[10,-19],[18,-5],[27,8],[100,53],[140,104],[21,24],[13,29],[9,30],[10,25],[15,21],[22,16],[120,40],[24,2],[22,-5],[19,-14],[40,-36],[44,-20],[44,6],[40,37],[61,87],[24,25],[72,58],[18,24],[8,22],[8,72],[9,22],[24,38],[10,22],[9,33],[5,32],[4,67],[5,33],[20,63],[4,31],[-12,50],[-19,58],[-8,51],[25,27],[50,2],[56,-4],[54,3],[45,20],[19,24],[28,52],[17,24],[26,15],[63,21],[19,20],[6,23],[5,32],[2,32],[-1,23],[5,23],[23,2],[64,-18],[18,0],[38,10],[23,2],[23,-6],[161,-68],[59,-33],[42,-46]],[[609,3285],[-7,-2],[-9,6],[-5,16],[0,15],[14,5],[16,14],[3,-15],[1,-3],[4,-6],[2,-21],[-19,-9]],[[761,3436],[-11,-12],[-21,2],[-7,8],[6,16],[-3,9],[9,11],[9,15],[17,4],[5,-12],[0,-21],[-4,-20]],[[740,3550],[10,-13],[-4,-17],[-13,-17],[-18,-11],[-21,0],[-26,17],[-64,-17],[-4,-5],[-7,4],[2,12],[11,9],[15,8],[26,22],[6,-3],[21,3],[39,10],[27,-2]],[[1035,3471],[-33,-37],[-29,-5],[-37,-18],[28,48],[20,-8],[11,21],[-22,20],[4,8],[17,2],[1,8],[4,9],[-8,7],[0,32],[25,13],[-1,28],[18,15],[-2,16],[29,3],[42,-17],[-6,-12],[-20,-9],[16,-40],[21,-41],[-33,-18],[-45,-25]],[[25,3972],[-2,-6],[-5,0],[-3,4],[-8,2],[-6,1],[-1,1],[0,7],[2,8],[3,6],[7,7],[-2,8],[4,0],[4,3],[-3,4],[4,2],[5,3],[5,0],[3,-4],[4,-3],[2,-8],[6,-1],[0,-6],[0,-4],[5,0],[-1,-5],[-1,-6],[-6,-1],[-4,-5],[-8,0],[-4,-7]],[[3311,4389],[-21,-32],[-1,-2],[-4,-13],[-3,-22],[-2,-22],[2,-11],[4,-11],[33,-52],[5,-11],[2,-11],[1,-12],[0,-11],[-2,-11],[-9,-10],[-16,-10],[-35,-13],[-109,-54],[-245,-61],[-12,-1],[-12,3],[-11,3],[-10,5],[-22,13],[-9,8],[-37,38],[-9,3],[-9,0],[-10,-11],[-6,-10],[-4,-12],[-1,-10],[-2,-7],[-4,-3],[-9,-6],[-20,-10],[-18,-19],[-18,-30],[-13,-15],[-30,-24],[-27,-28],[-11,-9],[-14,-7],[-49,-9],[-9,-10],[-3,-6],[0,-6],[-1,-5],[-3,-11],[-7,-12],[-51,-63],[-73,-48],[-95,-44],[-27,-8],[-27,1],[-32,5],[-13,-1],[-12,-4],[-31,-25],[-78,-43],[-90,-35],[-81,-11],[0,-1]],[[1911,3555],[-10,23],[-23,-17],[-161,-79],[-34,-11],[-13,-8],[-14,-4],[-14,9],[-40,48],[-7,4],[-14,17],[-27,7],[-15,13],[23,34],[-104,0],[5,-12],[11,-29],[5,-11],[-68,0],[-15,4],[-5,10],[-1,12],[-6,13],[-9,15],[-3,12],[-6,7],[-19,3],[-24,-5],[-15,-1],[-19,6],[-12,8],[-34,29],[-7,9],[-4,12],[-12,3],[-13,0],[-13,4],[-43,43],[-17,2],[-14,-32],[-18,13],[-21,6],[-17,11],[-14,56],[-17,23],[-24,18],[-26,15],[-24,8],[-34,5],[-13,4],[-6,17],[-44,4],[-16,11],[-6,43],[-16,23],[-9,-20],[-1,-19],[5,-17],[10,-15],[8,-21],[-6,-22],[-1,-23],[-9,-16],[1,-19],[19,-6],[-6,-29],[-19,-1],[-17,-13],[7,-19],[15,-20],[-14,-5],[-29,10],[-33,-18],[-31,-29],[-39,-18],[-14,-33],[-4,-8],[-21,14],[0,8],[2,6],[6,12],[-11,3],[-5,3],[-5,5],[-7,21],[27,30],[6,34],[19,12],[8,27],[-5,26],[-11,1],[-13,-8],[-11,-1],[-6,9],[-10,22],[-6,9],[-14,9],[-14,3],[-10,5],[-4,15],[1,16],[7,30],[2,18],[-7,9],[-28,15],[-7,15],[6,38],[-2,14],[-14,5],[-55,2],[-131,24],[-7,-3],[-6,-6],[-5,-4],[-8,1],[-6,6],[-6,15],[-4,3],[-6,8],[-6,34],[-5,11],[-10,4],[-42,7],[-21,40],[-11,13],[-11,11],[-10,8],[-10,5],[16,23],[21,10],[21,6],[16,12],[10,27],[11,91],[35,47],[43,-6],[49,-18],[52,14],[-31,15],[-72,4],[-34,7],[-29,22],[-11,31],[-6,34],[-17,29],[25,23],[219,194],[7,4],[16,3],[9,6],[2,7],[3,21],[4,10],[25,21],[62,37],[25,26],[24,15],[77,16],[30,14],[16,31],[13,43],[16,39],[24,16],[35,8],[32,20],[76,71],[52,63],[11,23],[7,11],[16,-13],[15,-20],[4,-9],[12,-6],[15,-4],[37,-4],[42,7],[31,-2],[30,2],[23,7],[8,19],[-12,23],[-17,23],[-19,23],[0,26],[15,23],[38,14],[37,12],[25,14],[38,16],[28,16],[31,21],[44,19],[54,16],[40,17],[21,7],[13,13],[10,19],[10,21],[24,9],[23,3],[23,-10],[21,-7],[30,10],[12,1],[13,-5],[19,-17],[10,-5],[34,-1],[6,14],[-3,24],[0,1]],[[2186,1843],[-15,5],[-32,1],[-16,8],[-70,84],[-25,18],[-19,4],[-37,0],[-18,9],[-10,12],[-40,70],[2,9],[-1,2],[-14,-3],[-4,-8],[-6,-16],[-11,-13],[-21,-2],[14,-9],[12,-11],[9,-14],[-22,-14],[-47,-22],[-25,6],[-15,26],[-11,0],[-9,-25],[-14,-7],[-41,6],[-3,6],[-3,11],[-6,9],[-9,0],[-8,-12],[3,-11],[9,-11],[8,-6],[0,-11],[-23,-8],[-25,0],[-23,9],[-20,17],[-9,21],[5,16],[31,34],[-11,6],[-10,8],[3,9],[4,9],[-8,22],[-18,18],[-25,5],[9,-45],[-22,-60],[-44,-3],[-17,24],[-7,23],[-24,11],[-18,15],[-12,49],[9,32],[7,31],[5,70],[2,32],[18,45],[14,44],[26,37],[17,31],[-4,20],[21,29],[33,53],[29,37],[12,32],[17,26],[31,0],[38,-2],[30,8],[-79,11],[4,14],[6,14],[0,13],[-7,11],[3,12],[-1,15],[3,14],[6,8],[2,8],[-11,9],[15,17],[16,7],[38,1],[18,6],[-6,13],[-12,17],[-5,16],[23,36],[33,15],[37,-1],[34,-12],[-10,29],[-13,14],[-4,17],[59,103],[20,19],[-24,3],[-20,15],[-8,24],[11,33],[-8,7],[-13,19],[16,-5],[6,-3],[8,-6],[33,18],[13,14],[8,20],[-32,0],[-95,14],[-30,12],[4,27],[36,51],[-17,1],[-16,-2],[-16,-5],[-14,-7],[6,49],[22,28],[29,22],[27,29],[9,22],[6,26],[11,21],[43,17],[13,19],[3,25],[-1,2]],[[4297,7641],[51,-39],[15,2],[6,-25],[34,-48],[12,-24],[-26,3],[-16,-9],[-6,-18],[7,-27],[14,-19],[23,-14],[48,-18],[-5,-8],[-7,-18],[26,-4],[80,-29],[21,-18],[-33,-12],[-33,-18],[-29,-25],[-20,-35],[11,-1],[14,-4],[11,-6],[10,-17],[12,3],[21,12],[14,-3],[8,-9],[6,-9],[8,-4],[12,9],[20,38],[11,7],[22,-9],[35,-24],[21,-5],[15,3],[11,6],[10,1],[12,-10],[1,-13],[-10,-12],[-13,-9],[-9,-4],[27,-12],[29,-8],[60,-6],[14,3],[27,10],[12,1],[15,-5],[11,-9],[9,-8],[6,-5],[34,-2],[24,9],[22,12],[26,8],[26,-6],[27,-14],[27,-7],[26,13],[3,-42],[21,-20],[60,-15],[51,-33],[12,-5],[14,6],[17,25],[7,1],[42,-15],[145,-4],[40,12],[29,-18],[30,-4],[26,11],[10,31],[15,13],[34,10],[62,9],[47,-39],[15,7],[13,13],[14,19],[16,-21],[2,-33],[-3,-34],[6,-20],[13,-4],[15,5],[26,13],[-5,-42],[26,-19],[37,1],[25,20],[22,-11],[-22,-27],[65,-6],[61,53],[157,263],[23,73],[-30,40],[-3,34],[-19,38],[-28,31],[-41,18],[-59,44],[-41,35],[-7,41],[-16,40],[-73,127],[-9,36],[-52,15],[-15,26],[-12,30],[-30,160],[1,28],[21,26],[31,8],[70,2],[249,63],[157,-12],[36,-11],[31,-23],[72,4],[53,-24],[22,-3],[63,23],[15,-3],[17,-11],[14,6],[22,30],[15,13],[16,6],[115,-8],[41,8],[18,33],[148,-7],[102,-26]],[[9364,8400],[-21,-20],[-8,10],[-3,9],[-1,7],[-3,0],[-5,3],[4,10],[15,19],[18,-13],[4,-25]],[[9617,9135],[1,0],[23,10],[5,28],[-24,29],[19,29],[25,18],[27,1],[23,-21],[5,-20],[9,-74],[8,-35],[19,-38],[2,-8],[3,-20],[6,-9],[7,-6],[6,-9],[26,-69],[19,-26],[28,-21],[35,-11],[27,-26],[16,-33],[6,-45],[0,-48],[4,-25],[15,-17],[42,-30],[-7,-12],[-44,-11],[-54,-16],[-23,-4],[-20,-17],[-10,-1],[2,34],[-2,21],[-4,11],[-20,19],[-19,13],[-45,6],[-33,17],[-13,16],[-46,7],[-23,-9],[6,-24],[-20,-19],[-25,-5],[-13,17],[-20,11],[-18,1],[0,-17],[-2,-16],[-18,-13],[-16,-17],[4,-25],[0,-13],[7,-13],[13,-1],[10,-5],[0,-21],[-8,-13],[-12,3],[-23,26],[-16,-4],[-11,-23],[14,-22],[-17,-5],[-11,-25],[-25,-3],[-7,-43],[-18,-12],[-19,-3],[2,27],[12,40],[-13,32],[-20,2],[-66,-60],[-35,-43],[-21,-14],[-20,-2]]],"transform":{"scale":[0.0006489294725472561,0.0005335198838883855],"translate":[124.21131598900004,37.67560455900012]}};
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
