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
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = '__PRT__';
  Datamap.prototype.pryTopo = '__PRY__';
  Datamap.prototype.pyfTopo = '__PYF__';
  Datamap.prototype.qatTopo = '__QAT__';
  Datamap.prototype.rouTopo = '__ROU__';
  Datamap.prototype.rusTopo = '__RUS__';
  Datamap.prototype.rwaTopo = '__RWA__';
  Datamap.prototype.sahTopo = '__SAH__';
  Datamap.prototype.sauTopo = {"type":"Topology","objects":{"sau":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]]]},{"type":"Polygon","properties":{"name":"Najran"},"id":"SA.NJ","arcs":[[3,4,5,6]]},{"type":"Polygon","properties":{"name":"Ar Riyad"},"id":"SA.RI","arcs":[[-6,7,8,9,10,11,12,13]]},{"type":"MultiPolygon","properties":{"name":"Ash Sharqiyah"},"id":"SA.SH","arcs":[[[14]],[[-7,-14,15,16]]]},{"type":"Polygon","properties":{"name":"Al Madinah"},"id":"SA.MD","arcs":[[17,18,-10,19,20,21]]},{"type":"Polygon","properties":{"name":"Al Quassim"},"id":"SA.QS","arcs":[[-11,-19,22]]},{"type":"Polygon","properties":{"name":"Ha'il"},"id":"SA.HA","arcs":[[-12,-23,-18,23,24,25]]},{"type":"MultiPolygon","properties":{"name":"Tabuk"},"id":"SA.TB","arcs":[[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[-24,-22,33,34]]]},{"type":"Polygon","properties":{"name":"Al Hudud ash Shamaliyah"},"id":"SA.HS","arcs":[[-16,-13,-26,35,36]]},{"type":"Polygon","properties":{"name":"Al Jawf"},"id":"SA.JF","arcs":[[-25,-35,37,-36]]},{"type":"Polygon","properties":{"name":"Al Bahah"},"id":"SA.BA","arcs":[[38,39]]},{"type":"Polygon","properties":{"name":"`Asir"},"id":"SA.AS","arcs":[[-5,40,41,42,-39,43,-8]]},{"type":"MultiPolygon","properties":{"name":"Jizan"},"id":"SA.JZ","arcs":[[[44]],[[45]],[[46,47,-42]]]},{"type":"Polygon","properties":{"name":"Makkah"},"id":"SA.MK","arcs":[[-9,-44,-40,-43,-48,48,-20]]}]}},"arcs":[[[3377,336],[-6,0],[-4,2],[-4,8],[-3,5],[3,7],[6,10],[5,9],[7,-1],[4,-5],[8,-10],[-1,-3],[2,-9],[-4,-6],[-7,-5],[-6,-2]],[[1207,5450],[-2,-7],[-6,3],[-4,2],[-3,2],[-5,0],[-2,-2],[0,11],[3,8],[5,0],[4,-3],[6,-7],[4,-7]],[[573,6805],[2,-7],[-9,13],[-7,8],[0,3],[0,5],[-1,7],[3,0],[4,-7],[5,-9],[1,-3],[2,-6],[0,-4]],[[6102,458],[-54,-41],[-58,-44],[-14,-7],[-16,-3],[-62,4],[-7,0],[-6,5],[-40,72],[-35,62],[-31,55],[-18,13],[-105,-18],[-79,-14],[-115,15],[-90,12],[-118,15],[-100,13],[-22,10],[-77,57],[-27,7],[-80,1],[-11,0],[-59,1],[-96,0],[-11,-2],[-29,-15],[-14,-1],[-32,9],[-29,1],[-46,-6],[-37,-11],[-9,-1],[-20,8],[-9,1],[-7,-6],[-7,-16],[-8,-11],[-9,-6],[-12,3],[-18,12],[-8,1],[-10,-7],[-8,-11],[-6,-12],[-7,-10],[-11,-2],[-6,2],[-3,1],[-1,4],[-2,5],[1,12],[0,7],[-3,2],[-11,-4],[-8,-1],[-19,2],[-18,-2],[-8,0],[-10,4],[-20,20],[-24,35]],[[4303,678],[0,20],[13,63],[-1,34],[-9,39],[-2,15],[1,18],[4,25],[12,141],[-1,27],[-5,25],[-7,29],[-5,28],[1,15],[4,18],[9,23],[13,21],[76,103],[54,58],[15,20],[5,11],[6,13],[11,34],[7,15],[10,14],[11,10],[11,6],[33,9],[21,9],[22,14],[21,18],[9,11],[7,12],[6,12],[5,16],[3,17],[2,24],[-1,22],[-2,28],[-16,81],[-1,15],[4,17],[11,23],[11,12],[32,21],[7,8],[5,8],[3,14],[2,21],[0,79]],[[4720,1994],[132,-104],[34,-21],[26,-12],[44,-14],[123,-11],[1112,152],[62,22]],[[6253,2006],[-151,-1547],[0,-1]],[[4720,1994],[-8,8],[-187,217],[-45,97],[-28,40],[-7,16],[-4,20],[1,15],[18,109],[9,24],[28,56],[4,11],[4,13],[0,2],[0,12],[-1,12],[-3,14],[-6,15],[-39,54],[-28,48],[-15,30],[-27,39],[-69,78]],[[4317,2924],[-124,231],[-5,13],[-3,13],[-1,14],[1,12],[19,93],[3,27],[-6,106],[1,13],[4,12],[6,12],[14,24],[6,12],[5,13],[3,13],[1,14],[1,12],[-24,212],[0,27],[13,93],[0,2],[-8,10],[-9,6],[-10,4],[-56,13],[-11,1],[-10,-2],[-56,-19],[-11,-1],[-11,1],[-21,9],[-10,8],[-10,12],[-11,23],[-3,17],[0,15],[2,64],[7,28],[2,12],[-2,13],[-7,13],[-13,13],[-11,8],[-12,5],[-21,6],[-104,10],[-73,-1],[-17,3],[-11,4],[-10,6],[-10,8],[-9,9],[-7,10],[-5,9],[-61,180],[-14,90],[-4,17],[-13,33],[-25,100],[-9,19],[-9,13],[-10,10],[-18,12],[-5,6],[-6,9],[-3,13],[-2,40],[5,60]],[[3519,4811],[-1,59],[5,108],[9,48],[2,24],[-1,15],[-7,21],[0,5],[0,9],[3,11],[7,15],[22,35],[1,2],[7,19],[5,27],[0,22]],[[3571,5231],[9,25],[32,58],[6,8],[13,12],[11,6],[11,2],[10,-2],[51,-32],[21,-9],[33,-10],[86,-11],[24,0],[67,13],[23,-2],[37,-13],[9,0],[10,3],[11,7],[12,12],[9,16],[8,23],[0,17],[-3,15],[-12,26],[-5,13],[-2,13],[2,15],[7,18],[46,74],[44,55],[12,10],[11,7],[159,46],[19,10],[12,11],[25,29],[34,26],[10,13],[9,17],[18,43],[13,22],[7,9],[6,6],[8,6],[9,6],[11,4],[11,2],[22,1],[101,-17],[113,10],[43,-5],[10,2],[9,4],[5,10],[4,12],[2,13],[1,18],[-1,23],[-4,38],[-5,22],[-7,19],[-13,28],[-3,15],[2,18],[5,30],[-2,20],[-1,2],[-36,59],[-43,85],[-11,17],[-37,45],[-8,13],[-5,12],[-3,13],[0,14],[10,82],[0,28],[-4,29],[2,14],[9,15],[10,7],[12,5],[18,4],[6,4],[8,9],[35,60],[17,24],[22,24],[11,9],[12,8],[23,10],[11,7],[10,9],[6,10],[3,10],[2,8],[0,2],[0,10],[-1,11],[-3,13],[-4,14],[-6,13],[-8,13],[-10,12],[-19,20],[-21,18],[-31,16]],[[4773,6889],[-3,8],[-5,23],[-1,13],[1,13],[1,13],[5,19],[8,20],[13,26],[12,18],[15,17],[6,6],[2,1],[27,12]],[[4854,7078],[9,-9],[2,-3],[1,-2],[7,-11],[9,-7],[10,-6],[11,-1],[12,6],[10,7],[20,34]],[[4945,7086],[5,-3],[40,-36],[20,-22],[8,-14],[7,-15],[13,-55],[6,-16],[11,-18],[11,-12],[134,-93],[22,-8],[35,-3],[11,-3],[10,-6],[10,-11],[29,-43],[45,-51],[21,-17],[10,-6],[20,-5],[79,-3],[21,-5],[21,-8],[30,-21],[117,-101],[11,-6],[11,-4],[11,-2],[11,-1],[71,15],[11,0],[11,-5],[11,-8],[78,-92],[13,-24],[8,-12],[10,-6],[152,-74],[6,-5],[7,-8],[6,-11],[5,-12],[3,-12],[3,-20],[10,-851],[5,-29],[3,-10],[6,-12],[9,-12],[168,-148],[120,-147],[19,-30],[20,-41],[20,-56],[11,-45],[7,-77],[-2,-142],[-136,-1368],[-127,-1250]],[[7117,6971],[9,-5],[25,-8],[24,-9],[-8,-4],[-8,2],[-7,5],[-8,2],[-7,-2],[-8,-3],[-7,-6],[-5,-6],[-4,5],[-1,-1],[-2,0],[-4,3],[-2,1],[0,4],[6,4],[1,3],[-2,4],[-2,3],[-2,2],[-5,3],[-5,-1],[-5,-3],[-4,-1],[-6,-3],[-6,-8],[-6,-10],[-3,-10],[-1,17],[8,16],[14,12],[14,3],[6,-1],[4,-3],[7,-5]],[[4945,7086],[-6,8],[-13,22],[-4,13],[-2,12],[1,12],[1,10],[3,19],[12,35],[10,21],[80,115],[24,40],[167,372],[28,50],[37,49],[47,51],[66,43],[225,99],[6,9]],[[5627,8066],[8,2],[21,5],[21,5],[53,-7],[53,-8],[53,-8],[53,-8],[47,-7],[48,-7],[47,-7],[47,-8],[27,-4],[6,-12],[23,-45],[26,-85],[2,-16],[2,-34],[5,-20],[6,-19],[7,-14],[10,-11],[11,-9],[9,-11],[4,-17],[26,1],[84,1],[84,1],[85,1],[84,1],[11,-14],[6,-5],[12,-7],[2,-4],[5,-28],[0,-21],[-4,-15],[-11,5],[-3,-4],[0,-2],[-1,-3],[9,0],[8,2],[6,6],[3,10],[6,-5],[0,-5],[-6,-12],[-3,-17],[0,-7],[3,-15],[6,-13],[39,-51],[3,-8],[-7,-12],[-4,-12],[0,-13],[2,-13],[5,-10],[15,-25],[3,-6],[0,-8],[-1,-2],[8,-5],[16,-9],[5,-1],[16,1],[4,-2],[10,-6],[6,-1],[2,-2],[-1,-4],[-1,-4],[-2,-3],[-3,-2],[-3,0],[-4,2],[-8,-5],[-2,-4],[1,-9],[4,-8],[10,-12],[11,-10],[8,-5],[1,-2],[10,-19],[19,-23],[3,-6],[-5,-13],[0,-8],[0,-8],[2,-3],[-1,-4],[-5,-11],[-6,-10],[-6,-6],[3,8],[1,5],[-1,16],[1,9],[3,5],[2,5],[-3,9],[-7,-9],[-7,-23],[-8,-7],[8,27],[1,8],[-2,12],[-4,-1],[-4,-9],[-9,-44],[0,-11],[-1,-1],[-2,-4],[1,-4],[5,1],[3,3],[3,10],[4,4],[0,-28],[2,-7],[4,1],[4,6],[3,6],[3,-7],[1,-8],[-1,-11],[6,-2],[4,3],[4,6],[2,6],[1,-11],[-1,-4],[-3,-2],[2,-6],[0,-4],[-3,-2],[-5,-1],[4,-14],[2,-3],[-11,6],[-5,0],[-4,-6],[10,-5],[9,0],[7,6],[4,12],[3,0],[3,-9],[-5,-7],[-2,-13],[2,-10],[9,0],[3,4],[-2,5],[-4,4],[-1,4],[4,6],[5,3],[11,4],[9,1],[7,-4],[17,-19],[17,-10],[5,-8],[-9,-8],[6,-4],[6,1],[3,5],[-3,7],[8,-4],[9,-3],[18,-2],[4,2],[8,6],[4,1],[5,-1],[9,-3],[6,-1],[9,-3],[7,-8],[11,-19],[4,-3],[3,-3],[3,-2],[3,-5],[1,-5],[1,-11],[2,-5],[-6,-1],[-4,3],[-1,6],[1,9],[-3,0],[-10,-15],[-27,4],[-9,-11],[-3,0],[-4,11],[-8,0],[-18,-11],[4,-3],[11,-3],[5,-3],[4,-4],[3,-3],[3,-3],[6,-3],[3,-5],[3,-2],[2,1],[8,9],[0,2],[3,2],[1,4],[1,2],[4,-2],[3,-4],[5,-2],[-4,-9],[-4,-5],[-5,-3],[-4,-5],[-1,-7],[0,-17],[-2,-7],[5,2],[6,3],[5,5],[5,5],[6,3],[6,-3],[10,-6],[-4,-13],[1,-12],[4,-12],[2,-13],[-1,-27],[2,-12],[8,2],[0,-12],[3,-4],[5,1],[5,6],[-2,10],[4,6],[8,0],[7,-7],[3,4],[2,-7],[-1,-6],[-3,-7],[-1,-8],[-2,-5],[-4,-2],[-5,0],[-6,1],[4,-8],[12,-2],[4,-8],[4,3],[3,6],[6,13],[0,-3],[1,-1],[0,1],[2,-1],[-5,-12],[4,-1],[12,4],[8,-2],[13,-6],[7,-1],[-13,17],[-4,10],[8,8],[5,0],[5,-3],[4,-4],[5,-2],[4,2],[9,11],[-2,-10],[-4,-15],[-1,-10],[3,-14],[3,-8],[2,-4],[9,-5],[9,-12],[27,-51],[14,-21],[4,-4],[14,-7],[4,-4],[7,-9],[5,-4],[30,-16],[18,-17],[11,-1],[11,1],[12,-2],[14,-10],[14,-16],[24,-39],[8,-18],[34,-30],[8,-10],[2,-16],[-22,23],[-11,8],[-26,4],[-7,3],[-4,7],[-4,24],[-4,-4],[-5,-11],[-2,-10],[0,-8],[0,-8],[2,-7],[3,-6],[5,-6],[1,-3],[-2,-39],[1,-11],[13,-48],[5,-10],[8,-10],[8,-6],[41,-17],[14,-15],[8,-21],[4,-29],[0,-70],[-2,-15],[-5,-12],[-9,-7],[-1,9],[-3,4],[-5,-3],[-5,-7],[3,-16],[-1,-24],[-4,-25],[-4,-17],[-7,6],[-2,9],[0,10],[-1,10],[-3,7],[-4,6],[-5,4],[-4,4],[-2,3],[-3,0],[-1,1],[-1,18],[-1,4],[-2,5],[-4,6],[-5,7],[-7,5],[-5,-3],[-12,-28],[-4,-5],[-5,-3],[2,-9],[5,-8],[3,-3],[1,-5],[4,-9],[1,-6],[-2,-2],[-3,-1],[-3,-3],[-2,-5],[1,-9],[2,-9],[1,-9],[-4,-10],[8,-3],[7,5],[3,9],[-2,11],[5,-2],[3,-3],[6,-8],[2,-2],[2,1],[2,-1],[0,-5],[0,-3],[1,-2],[1,-1],[3,0],[12,-4],[5,-8],[2,-12],[6,-11],[0,-4],[-10,-12],[5,-30],[11,-33],[10,-21],[28,-42],[12,-24],[5,-30],[-3,0],[-8,30],[-3,5],[-6,2],[-7,4],[-6,5],[-6,10],[-7,8],[-7,1],[-2,-13],[4,-9],[12,-10],[4,-7],[2,7],[1,2],[3,0],[18,-45],[54,-85],[13,-13],[-2,8],[-3,10],[-1,8],[4,4],[5,3],[2,-2],[2,-14],[2,-3],[3,-2],[1,-1],[4,-9],[8,-5],[17,-6],[4,-6],[9,-29],[-4,-4],[6,-10],[7,-17],[5,-18],[2,-14],[0,-8],[-3,-14],[0,-8],[1,-9],[2,-5],[2,-5],[3,-11],[7,-15],[1,-10],[-3,-26],[4,-25],[4,-15],[5,-8],[3,13],[13,-13],[13,-20],[5,-10],[8,-10],[9,-42],[12,-9],[10,-11],[4,-24],[1,-39],[2,-8],[4,-11],[5,-10],[5,-6],[7,0],[10,12],[35,-70],[23,-31],[24,-12],[28,-5],[27,0],[25,10],[32,32],[1,-6],[24,5],[5,-4],[4,-7],[4,-3],[5,5],[1,-5],[-1,-6],[-2,-4],[-3,-2],[-3,-3],[1,-7],[3,-6],[1,-2],[-2,-21],[3,-3],[9,3],[6,6],[13,28],[7,8],[6,5],[4,7],[-1,15],[7,-4],[9,-1],[7,-2],[3,-8],[3,-9],[6,-1],[7,0],[7,-5],[0,-5],[-7,-4],[-10,-4],[-9,-6],[-3,-10],[-2,0],[-11,-14],[-2,-5],[-3,-9],[-2,-4],[-28,-25],[-4,-8],[-1,-3],[-7,-10],[-2,-6],[-1,-6],[-1,-14],[-1,-6],[0,-4],[0,-4],[0,-4],[-2,-1],[-5,0],[-2,-1],[-1,-2],[0,-13],[0,-7],[2,-3],[29,-4],[11,4],[6,4],[4,4],[4,3],[8,2],[31,-8],[9,-8],[13,-19],[21,-8],[3,-25],[0,-16],[-1,-41],[2,-16],[7,-15],[27,-43],[25,-39],[25,-40],[25,-39],[24,-40],[25,-39],[25,-39],[25,-40],[24,-39],[25,-39],[25,-40],[25,-39],[24,-39],[25,-40],[25,-39],[25,-40],[24,-39],[26,-40],[9,-11],[12,-4],[76,-13],[66,-11],[66,-11],[66,-10],[66,-11],[66,-11],[66,-11],[66,-11],[66,-11],[66,-11],[66,-10],[66,-11],[66,-11],[66,-11],[66,-11],[66,-11],[66,-11],[65,-10],[8,1],[31,51],[30,-62],[39,-79],[38,-80],[38,-79],[39,-79],[25,-52],[5,-14],[0,-15],[-18,-71],[-2,-10],[-3,-13],[-9,-35],[-14,-55],[-17,-72],[-21,-84],[-24,-94],[-25,-101],[-6,-25],[-20,-79],[-26,-105],[-25,-100],[-23,-95],[-21,-84],[-18,-72],[-14,-55],[-8,-35],[-4,-13],[-15,-61],[-71,-32],[-82,-36],[-81,-36],[-81,-36],[-81,-37],[-81,-36],[-82,-36],[-81,-36],[-81,-37],[-81,-36],[-82,-36],[-81,-36],[-81,-36],[-81,-37],[-82,-36],[-81,-36],[-81,-36],[-53,-24],[-75,-13],[-76,-14],[-76,-14],[-76,-13],[-76,-14],[-76,-14],[-76,-13],[-76,-14],[-76,-14],[-76,-13],[-76,-14],[-76,-14],[-76,-13],[-76,-14],[-76,-14],[-76,-13],[-76,-14],[-62,-11],[-44,-21],[-21,-14],[-68,-44],[-82,-53],[-90,-60],[-82,-53],[-61,-40],[-11,-9],[-36,-59],[-43,-69],[-75,-120],[-71,-114],[-46,-74],[-8,-19],[-23,-79],[-32,-113],[-14,-24]],[[2489,6530],[8,-27],[2,-12],[2,-16],[-1,-15],[-4,-23],[-2,-7],[-17,-38],[-6,-20],[1,-15],[5,-13],[9,-10],[10,-5],[11,-1],[23,5],[11,0],[10,-10],[5,-13],[1,-14],[-26,-213],[-1,-19],[2,-16],[15,-70],[9,-63],[-5,-169],[3,-17],[5,-16],[7,-11],[7,-10],[6,-5],[8,-5],[10,-4],[11,-2],[11,1],[11,2],[118,50],[24,5],[56,-1],[21,2],[10,2],[9,4],[6,3],[9,6],[9,8],[10,11],[35,52],[10,12],[13,10],[16,7],[14,4],[82,4],[132,-25],[41,-14]],[[3245,5819],[12,-5],[62,-18],[21,-9],[10,-8],[7,-12],[4,-16],[1,-15],[-9,-164],[2,-15],[4,-14],[10,-18],[10,-10],[11,-7],[61,-20],[8,-5],[6,-4],[0,-2],[9,-17],[8,-25],[25,-119],[9,-26],[6,-12],[8,-9],[41,-38]],[[3519,4811],[-62,11],[-30,-2],[-11,-5],[-9,-9],[-7,-12],[-2,-13],[1,-13],[12,-41],[3,-14],[1,-13],[-1,-28],[-4,-16],[-6,-16],[-12,-24],[-12,-14],[-12,-11],[-84,-46],[-62,-42],[-21,-20],[-14,-19],[-5,-15],[3,-14],[8,-11],[10,-9],[52,-35],[8,-10],[3,-14],[-5,-18],[-9,-12],[-11,-8],[-55,-25],[-13,-10],[-15,-15],[-66,-82],[-135,-132],[-19,-27],[-34,-65],[-12,-16],[-11,-7],[-12,-1],[-73,28],[-11,2],[-15,-3],[-19,-15],[-49,-51],[-10,-7],[-2,-2],[-12,-3],[-10,-2],[-11,0],[-31,6],[-2,1],[-10,7],[-5,11],[-2,12],[1,13],[5,25],[3,28],[-1,14],[-2,13],[-5,13],[-7,12],[-9,11],[-9,7],[-14,9],[-32,12],[-9,6],[-6,10],[-2,12],[3,13],[26,76],[2,12],[3,30],[0,20],[-2,11],[-3,12],[-6,12],[-8,8],[-10,4],[-11,1],[-44,-7],[-101,-39],[-36,-8],[-11,6],[-5,10],[-2,26],[-2,12],[-5,11],[-9,6],[-15,1],[-50,-12],[-19,-1],[-15,3],[-12,9],[-11,12],[-37,54],[-38,41],[-6,8],[-20,40],[-9,11],[-13,5],[-14,-2],[-34,-10],[-59,-5],[-15,-2]],[[1932,4475],[-1,13],[-2,18],[-3,14],[-1,11],[-8,10],[-3,7],[-2,11],[0,10],[-11,-7],[-5,3],[-3,0],[0,-10],[5,-6],[11,-5],[0,-5],[-15,2],[-11,12],[0,31],[-21,34],[-11,43],[-4,15],[-2,15],[-3,15],[-8,12],[-4,3],[-6,1],[-7,3],[-5,7],[-2,9],[-4,11],[-6,9],[-8,3],[-7,3],[-7,4],[-4,5],[-5,10],[-8,11],[-3,4],[-8,7],[-10,4],[-8,1],[-11,9],[-6,6],[-10,11],[-9,14],[-9,9],[-8,9],[-15,17],[-3,2],[-4,1],[-5,-2],[-3,-3],[-11,9],[-8,7],[-19,16],[-15,13],[3,8],[8,7],[12,2],[-5,6],[-7,-3],[-9,-5],[-3,8],[5,11],[2,10],[-5,2],[-3,-5],[-6,-1],[-3,-6],[3,-4],[2,-5],[0,-8],[1,-6],[-3,-4],[-11,5],[-14,-5],[-22,21],[-6,7],[-18,18],[-5,13],[-6,5],[-8,5],[-9,5],[-7,8],[-9,8],[-11,0],[-6,0],[-7,-6],[-1,-8],[2,-13],[-20,-1],[-5,9],[-14,8],[-11,-4],[-10,14],[-7,14],[-10,18],[-17,17],[-5,22],[4,13],[4,-2],[9,-7],[4,9],[-3,12],[-35,63]],[[1334,5186],[1,4],[6,37],[3,12],[5,11],[8,10],[10,6],[9,3],[39,0],[18,3],[11,4],[11,5],[12,9],[11,14],[13,20],[10,13],[10,7],[11,2],[10,0],[22,-5],[23,-1],[12,3],[11,6],[11,11],[10,16],[4,12],[2,9],[-6,209],[17,144],[-1,13],[-4,11],[-6,8],[-6,4],[-10,3],[-30,2],[-8,2],[-3,2],[-1,2],[-4,12],[-17,78],[-15,48],[-7,17],[-7,12],[-9,13],[-61,62],[-8,12],[-6,13],[-4,14],[-8,34],[-1,3],[-3,4],[-8,6],[-84,59],[-11,2],[-10,-4],[-17,-17],[-8,-3],[-3,8],[-3,11],[-5,26],[-7,26],[-27,67],[-4,13],[-1,13],[1,13],[2,13],[9,26],[29,57],[4,10],[2,14],[0,15],[-5,15],[-9,11],[-10,7],[-54,20],[-12,5],[-10,9],[-11,12],[-8,12],[-6,13],[-4,14],[-4,14],[-2,15],[-1,26],[10,87],[1,35],[-1,16],[-7,39],[-4,11],[-4,8],[-7,9],[-8,7],[-9,4],[-6,1],[-8,-1],[-31,-7],[-11,1],[-8,7],[-2,10],[3,11],[9,10],[10,6],[54,16],[122,69],[11,4],[13,0],[14,-4],[22,-10],[40,-31],[14,-7],[20,-4],[10,0],[11,2],[11,4],[89,57],[8,1],[9,-3],[12,-11],[7,-11],[4,-10],[14,-58],[9,-27],[9,-21],[27,-49],[10,-11],[14,-8],[21,-5],[48,-2],[10,-2],[10,-4],[8,-8],[4,-9],[1,-7],[0,-3],[0,-3],[0,-5],[0,-10],[4,-11],[8,-10],[29,-23],[8,-10],[3,-12],[0,-13],[-1,-13],[0,-12],[4,-10],[10,-3],[15,4],[12,10],[43,40],[6,4],[10,2],[12,-1],[16,-5],[35,-20],[11,-5],[11,-1],[12,6],[3,11],[-2,12],[-2,12],[1,12],[5,7],[9,-1],[11,-11],[6,-13],[7,-26],[11,-12],[17,-10],[60,-26],[58,-53],[18,-7],[23,-4],[48,0],[197,37],[11,-2],[11,-7],[8,-9],[16,-28]],[[3245,5819],[19,20],[19,8],[28,4],[17,5],[76,50],[18,10],[15,5],[45,5],[11,4],[9,9],[2,10],[-1,10],[-3,8],[-22,50],[-3,14],[-1,14],[2,14],[6,15],[12,15],[12,7],[10,1],[8,-3],[37,-17],[12,-3],[11,-1],[9,4],[6,9],[1,12],[0,9],[-1,6],[-8,52],[-1,12],[1,13],[2,13],[8,27],[10,26],[7,11],[9,5],[11,1],[11,-2],[12,1],[22,7],[10,6],[6,11],[3,14],[8,22],[14,28],[56,77],[125,121],[56,45],[109,55],[16,14],[10,14],[7,15],[20,50],[17,26],[23,27],[35,27],[181,110],[23,11],[11,3],[11,1],[11,-2],[10,-4],[11,-8],[18,-17],[34,-44],[60,-58],[21,-16],[12,-4],[49,-3],[32,-8],[10,0],[10,2],[8,7],[6,6],[37,60],[20,22]],[[2489,6530],[7,6],[8,14],[9,20],[27,103],[15,34],[21,35],[58,60],[10,13],[7,12],[4,13],[2,14],[-2,13],[-11,15],[-10,11],[-58,36],[-18,15],[-7,8],[-8,13],[-5,12],[-51,249],[-5,13],[-7,14],[-28,33],[-55,54],[-29,17],[-15,12],[-10,12],[-2,3],[-10,14],[-18,12],[-26,12],[-153,43],[-11,5],[-8,6],[-8,13]],[[2102,7489],[51,67],[11,10],[12,9],[179,100],[83,28],[176,118],[180,87],[10,1],[30,-8]],[[2834,7901],[55,-27],[27,-9],[11,0],[252,69],[34,5],[20,-1],[16,-3],[115,-44],[16,-3],[13,0],[12,2],[57,17],[52,4],[12,-1],[162,-45],[22,-10],[11,-8],[10,-10],[58,-82],[14,-14],[16,-12],[24,-10],[17,-3],[16,1],[14,4],[13,6],[39,25],[13,7],[14,4],[16,0],[10,-7],[4,-5],[1,-6],[3,-47],[1,-9],[3,-13],[8,-19],[10,-15],[17,-12],[13,-4],[12,-2],[48,5],[16,-1],[13,-5],[50,-31],[19,-8],[12,-1],[11,2],[19,11],[55,42],[14,7],[16,1],[12,-5],[11,-10],[9,-13],[80,-171],[40,-126],[16,-27],[11,-13],[13,-11],[17,-10],[12,-5],[147,-26],[16,-8],[22,-14],[11,-9],[78,-84],[13,-17],[6,-19]],[[1152,5776],[4,-12],[3,0],[2,5],[1,-3],[3,-22],[5,-4],[2,-3],[-1,-1],[-2,1],[-4,1],[0,-3],[2,-4],[-4,1],[-9,7],[-3,7],[1,5],[-4,0],[-6,-2],[-3,5],[-3,9],[-4,0],[-5,-4],[-1,4],[3,12],[5,6],[6,0],[6,-1],[6,-4]],[[1068,5770],[9,-6],[17,-9],[8,-2],[6,-1],[4,-3],[2,-5],[-10,0],[-1,-8],[4,-8],[5,2],[6,8],[7,6],[7,0],[2,-3],[-9,-5],[-4,-4],[-5,-7],[-4,-11],[-7,-7],[-10,8],[-9,13],[-9,8],[-19,25],[-1,1],[-2,4],[0,2],[1,0],[1,1],[-1,4],[-5,6],[-5,10],[0,4],[5,-1],[5,-5],[8,-13],[4,-4]],[[1084,5819],[-3,-3],[-5,2],[-6,7],[1,9],[6,6],[7,-1],[5,-7],[0,-7],[-5,-6]],[[1022,5837],[23,-19],[3,-5],[2,-7],[8,-6],[7,-3],[11,-8],[17,-17],[4,-5],[-1,-3],[-2,-2],[1,-2],[-3,1],[-7,7],[-6,5],[-5,1],[-2,4],[-3,7],[-4,3],[-3,-2],[-4,2],[-5,6],[-5,4],[-2,1],[-2,1],[-3,5],[0,6],[-4,2],[-7,1],[-1,2],[2,-1],[-1,3],[-4,7],[-7,6],[-9,-1],[-3,-3],[-3,-2],[-3,-1],[0,5],[5,9],[7,3],[9,-4]],[[1118,5849],[-1,-5],[-2,0],[-3,3],[-1,-1],[2,-5],[-1,-2],[-1,0],[3,-9],[4,-16],[-2,-6],[-6,10],[-3,2],[-2,7],[-1,18],[0,4],[0,7],[3,5],[5,2],[4,-2],[2,-6],[0,-6]],[[948,5875],[12,-16],[7,-5],[6,-1],[4,1],[1,-1],[1,-5],[1,-5],[5,-2],[4,0],[1,1],[-2,0],[0,3],[3,3],[3,-1],[8,-6],[-1,-3],[-3,-8],[-4,-3],[-3,2],[-6,6],[-38,23],[-10,3],[-3,-9],[-5,3],[-9,11],[-6,8],[-3,14],[4,11],[11,14],[6,8],[4,3],[0,-4],[-2,-7],[-8,-15],[0,-5],[4,-6],[3,-3],[3,0],[2,-1],[2,-4],[4,-3],[4,-1]],[[957,5932],[3,-4],[6,2],[2,-2],[-3,-5],[-5,-3],[-6,2],[-9,9],[-6,4],[-3,7],[-1,5],[-1,14],[1,26],[8,22],[12,14],[3,1],[-6,-7],[-6,-10],[-3,-11],[-2,-12],[4,-12],[9,-10],[4,-2],[3,0],[0,-5],[-4,-8],[-2,-8],[1,-4],[1,-3]],[[1334,5186],[-30,54],[-30,49],[-13,23],[-1,17],[2,5],[0,6],[-1,6],[-1,5],[-4,2],[-6,-8],[-5,0],[-8,6],[-6,10],[-8,23],[12,-1],[10,-2],[11,0],[12,5],[6,10],[1,32],[10,27],[-1,15],[-9,26],[-3,15],[3,38],[-1,14],[-3,14],[-4,12],[-5,12],[-9,13],[-6,6],[-5,5],[-4,5],[-5,12],[-4,5],[-9,9],[-10,12],[-8,15],[-6,14],[-1,6],[-1,14],[-1,6],[-3,6],[-7,9],[-2,6],[8,8],[-7,14],[-21,26],[-4,8],[-7,27],[-3,5],[-6,5],[-3,3],[-1,4],[1,8],[-2,3],[-4,8],[-6,18],[-4,7],[-6,6],[-14,7],[-6,4],[-19,36],[-12,18],[-10,1],[-1,-7],[3,-7],[2,-7],[-5,-3],[-6,2],[-15,12],[-7,3],[-4,4],[-11,16],[-3,6],[-1,4],[1,14],[-1,3],[-6,2],[-3,3],[-6,16],[0,15],[4,14],[10,14],[7,13],[1,18],[-2,18],[-4,14],[-11,15],[-15,9],[-17,5],[-16,2],[-17,7],[-11,18],[-30,87],[-11,22],[-21,33],[-35,104],[-37,81],[-23,35],[-28,29],[-12,18],[-8,27],[-14,30],[-9,40],[-9,-3],[-6,7],[-12,22],[-30,32],[-38,60],[-14,31],[-2,5],[0,6],[1,6],[5,9],[1,5],[-3,8],[-11,20],[-40,57],[-22,18],[-6,7],[-11,16],[-13,25],[-15,17],[-18,40],[-5,16],[-2,13],[0,23],[-3,12],[-4,8],[-15,20],[-9,17],[-12,39],[-10,16],[-4,4],[-10,4],[-4,3],[-2,5],[-3,8],[-4,12],[-2,18],[-5,9],[-25,33],[-7,16],[-5,6],[-7,4],[-23,21],[0,-4],[-3,0],[-6,9],[7,6],[10,6],[8,6],[6,-3],[-1,3],[-5,10],[-2,2],[-14,3],[-3,2],[-4,0],[0,-4],[-2,0],[-2,3],[-3,5],[-3,3],[-4,2],[-9,-1],[-4,1],[-5,7],[-23,19],[-4,-5],[-6,1],[-5,0],[1,-4],[2,-3],[2,-2],[-4,2],[-6,5],[-5,2],[-6,-3],[-5,-4],[-14,-5],[-4,-2],[-3,-4],[-1,-4],[-4,0],[0,4],[-3,0],[-6,-2],[-10,2],[-10,0],[-6,-9],[-1,3],[-1,0],[-2,2],[0,4],[4,0],[0,5],[-2,4],[2,4],[5,2],[4,2],[-4,3],[-5,0],[-5,-1],[-5,-2],[0,-4],[3,0],[0,-4],[-5,-3],[-3,-4],[-5,-11],[-1,2],[-2,1],[-1,1],[-2,1],[2,3],[3,4],[3,3],[5,3],[0,2],[0,3],[0,3],[-7,1],[-5,-2],[-4,-4],[-1,-7],[-2,1],[-1,1],[-1,-1],[-2,-1],[0,2],[0,4],[0,2],[-3,0],[0,-4],[-4,0],[-2,5],[-2,3],[-2,-1],[-3,-3],[-5,4],[-1,2],[-3,5],[-1,3],[-3,8],[-2,-2],[-1,-2],[-2,-2],[-2,-3],[-6,5],[-2,-2],[0,-7],[-2,-5],[-3,-2],[-7,-4],[-3,-2],[0,-4],[10,-9],[0,-5],[-3,0],[-1,-1],[-1,-2],[-1,-1],[-4,4],[-2,-11],[0,-8],[-3,-5],[-11,-2],[1,3],[1,0],[2,2],[-4,4],[-2,9],[-1,8],[0,16],[-4,4],[-11,-6],[2,8],[-3,4],[7,12],[4,5],[5,2],[0,3],[3,2],[4,5],[3,2],[-3,4],[1,3],[2,3],[2,1],[4,2],[0,-3],[-1,-1],[-1,0],[-1,0],[5,-3],[3,-2],[3,2],[2,7],[-3,0],[0,4],[-3,4],[0,4],[4,4],[5,1],[0,5],[-1,5],[4,29],[2,-1],[3,-2],[2,-1],[0,2],[0,7],[-3,-3],[-1,-1],[-3,4],[10,11],[10,20],[7,23],[5,30],[9,17],[4,19],[3,10],[14,28],[-4,29],[-1,30],[-7,28],[8,39],[7,21],[7,17],[0,4],[-3,0],[8,16],[1,8],[-3,7],[0,4],[6,19],[-1,5]],[[128,7944],[40,1],[17,4],[16,-1],[39,-11],[67,-8],[12,3],[8,5],[17,18],[16,10],[20,8],[98,22],[63,4],[37,8],[31,0],[93,-26],[11,-7],[21,-17],[16,-16],[122,-188],[3,-4],[3,-2],[20,-7],[11,-1],[8,0],[52,24],[114,29],[38,0],[27,-5],[72,-28],[39,-10],[82,-5],[13,3],[12,7],[7,11],[6,13],[19,58],[6,13],[7,12],[10,11],[31,24],[30,32],[10,5],[11,-2],[8,-9],[6,-13],[2,-14],[-5,-102],[1,-56],[4,-37],[5,-27],[7,-21],[6,-13],[7,-13],[9,-13],[31,-31],[22,-15],[52,-21],[30,-7],[94,-12],[18,1],[15,6],[13,8],[15,5],[11,-4],[16,-11],[10,-4],[9,-1],[21,0],[13,-38],[8,-9],[10,-9],[11,-2],[12,3],[12,5],[50,30],[13,5],[17,3],[12,-1],[8,-3],[7,-4],[19,-18]],[[2834,7901],[67,78],[8,13],[4,12],[3,9],[0,5],[12,211],[2,14],[4,13],[6,13],[10,13],[11,14],[52,46],[396,288],[40,36],[21,26],[8,13],[2,12],[-3,13],[-9,11],[-71,64],[-23,26],[-8,14],[-14,28],[-22,57],[-5,11],[-12,17],[-10,12],[-17,13],[-15,6],[-56,9],[-38,0],[-26,4],[-16,6],[-13,8],[-94,88],[-16,8],[-18,6],[-47,-1],[-28,-5],[-260,8],[-44,11],[-16,7],[-13,8],[-34,36],[-12,9],[-11,8],[-16,4],[-320,58],[-64,1],[-146,-25],[-211,-24],[-23,2],[-21,5],[-11,5],[-10,8],[-10,10],[-9,12],[-16,32],[-8,22],[-14,28],[-15,25],[-15,16],[-41,34],[-7,11],[-4,11],[-1,8],[-1,4],[-2,17],[-3,39],[2,21],[57,242]],[[1620,9765],[90,30],[107,35],[106,35],[107,36],[54,17],[17,8],[56,61],[9,8],[5,2],[1,0],[2,1],[1,1],[1,0],[94,-18],[94,-19],[94,-18],[94,-18],[38,-8],[162,-35],[26,-11],[26,-18],[49,-33],[41,-29],[42,-28],[42,-28],[41,-29],[42,-28],[42,-29],[41,-28],[42,-28],[42,-29],[41,-28],[42,-28],[41,-29],[42,-28],[42,-29],[41,-28],[42,-28],[42,-29],[32,-32],[40,-40],[40,-39],[40,-40],[40,-40],[45,-45],[45,-46],[45,-45],[9,-9],[36,-36],[50,-47],[42,-40],[42,-39],[42,-39],[42,-40],[54,-51],[55,-51],[54,-52],[54,-51],[23,-22],[32,-29],[54,-52],[54,-51],[55,-51],[45,-43],[45,-43],[46,-42],[45,-43],[36,-34],[3,-2],[3,-1],[3,-2],[3,-1],[44,-5],[38,-4],[38,-4],[37,-4],[38,-4],[49,-5],[48,-5],[49,-5],[49,-5],[48,-5],[49,-6],[49,-5],[48,-5],[36,-4],[37,-3],[36,-4],[36,-4],[50,-5],[21,5],[12,3]],[[128,7944],[0,3],[-8,3],[0,4],[7,14],[8,26],[3,27],[-5,16],[0,9],[5,12],[5,14],[9,56],[2,9],[6,14],[-1,4],[1,9],[4,5],[11,7],[-3,11],[-1,14],[2,9],[5,-3],[1,2],[0,2],[0,1],[3,-1],[-4,10],[-1,10],[2,10],[52,-11],[57,-12],[74,-14],[66,-14],[70,-14],[56,-11],[27,-6],[55,-11],[49,-10],[13,1],[12,5],[52,50],[50,49],[55,53],[37,35],[30,61],[30,58],[22,43],[26,52],[11,14],[13,8],[42,10],[42,10],[68,17],[68,16],[63,15],[56,14],[11,10],[21,60],[15,44],[17,48],[14,40],[7,11],[11,11],[51,33],[57,38],[35,22],[3,2],[1,1],[-24,32],[-52,71],[-52,70],[-52,71],[-52,71],[-2,2],[-1,2],[-2,2],[-1,2],[-62,77],[-61,75],[-1,1],[-61,77],[-62,77],[18,6],[100,34],[117,40],[118,41],[28,9],[89,31],[17,5]],[[3541,2701],[-23,-98],[1,-16],[3,-20],[12,-15],[6,-11],[2,-15],[-3,-16],[-11,-19],[-10,-12],[-57,-50],[-10,-12],[-7,-17],[-4,-17],[-3,-45],[-7,-32],[-47,-131]],[[3383,2175],[-14,-8],[-16,-3],[-44,0],[-10,-2],[-8,-5],[-5,-5],[-6,-9],[-12,-27],[-31,-102],[-11,-68],[-4,-12],[-6,-12],[-8,-9],[-10,-6],[-10,-4],[-11,-2],[-11,0],[-13,3],[-11,7],[-10,10],[-30,51],[-11,13],[-37,25],[-5,5],[-8,10],[-5,12],[-2,13],[-1,12],[3,53],[-1,13],[-9,41],[0,13],[5,66],[-1,13],[-2,14],[-5,12],[-6,10],[-4,5],[-2,2],[-36,13],[-9,6],[-7,11],[-4,11],[2,12],[6,12],[37,47],[10,11],[12,7],[15,6],[46,9],[11,4],[11,6],[12,13],[6,13],[13,41],[33,76],[4,17],[0,6],[-1,19],[-9,38],[-4,26],[0,14],[1,12],[2,11],[3,7],[4,10],[8,10],[9,9],[10,6],[12,1],[12,-2],[14,-9],[10,-10],[8,-13],[15,-53],[5,-12],[6,-11],[7,-8],[7,-2],[9,-1],[15,6],[23,12],[13,4],[15,2],[51,1],[10,4],[11,5],[44,32],[10,3],[12,-2],[9,-4],[27,-29]],[[4303,678],[-9,13],[-20,15],[-35,19],[-8,3],[-16,1],[-8,2],[-11,-2],[-10,-5],[-23,-18]],[[4163,706],[-40,76],[-8,13],[-10,11],[-36,16],[-9,9],[-7,12],[-15,40],[-7,14],[-12,15],[-37,38],[-7,16],[-3,16],[1,26],[-2,12],[-6,10],[-19,4],[-4,-1],[-22,-16],[-20,-19],[-8,-11],[-6,-12],[-11,-25],[-22,-105],[-4,-12],[-6,-10],[-9,-4],[-10,0],[-11,5],[-11,10],[-44,58],[-9,16],[-5,15],[-4,13],[-6,13],[-9,13],[-13,9],[-12,3],[-75,1],[-10,4],[-10,7],[-10,15],[-5,13],[-6,23],[-4,7],[-7,10],[-12,9],[-11,4],[-10,1],[-32,-5],[-9,3],[-8,9],[-4,18],[-1,14],[0,15],[10,76],[0,13],[-2,11],[-5,10],[-19,7],[-53,-5]],[[3417,1234],[17,80],[2,18],[-1,17],[-3,19],[-33,125],[-5,12],[-8,11],[-9,7],[-10,4],[-20,5],[-21,2],[-52,-1],[-9,3],[-9,7],[-8,10],[-6,13],[-4,13],[-2,13],[-3,27],[3,147],[2,12],[4,6],[7,-5],[9,-8],[9,-6],[9,0],[9,6],[24,22],[21,16],[11,5],[10,2],[10,0],[53,-7],[7,0],[7,2],[9,5],[9,8],[6,12],[5,12],[16,64],[0,16],[-3,16],[-20,42],[-3,13],[-1,17],[1,15],[14,83],[1,12],[0,13],[-4,14],[-5,13],[-7,10],[-6,6],[-7,3],[-9,2],[-20,-1],[-21,-11]],[[3541,2701],[8,-19],[49,-125],[8,-13],[9,-10],[10,-7],[10,-4],[14,1],[16,6],[25,19],[16,14],[121,137],[94,64],[13,14],[18,23],[12,10],[13,7],[18,5],[29,0],[7,2],[10,4],[29,15],[15,6],[20,3],[14,-1],[12,-3],[31,-13],[14,1],[16,7],[75,55],[50,25]],[[3477,242],[4,-3],[17,2],[5,-11],[10,-1],[10,4],[8,1],[5,-8],[0,-7],[6,0],[14,8],[-13,3],[-7,14],[6,12],[3,18],[3,6],[7,1],[3,-1],[4,-2],[13,-11],[1,-10],[6,-13],[-1,-7],[12,-2],[3,-13],[18,-10],[0,-9],[-1,-11],[-4,-14],[2,-10],[4,-19],[-5,-13],[0,-1],[-10,1],[-14,20],[-10,5],[-11,1],[-5,6],[14,7],[7,8],[-3,14],[-12,8],[-12,-3],[-14,-1],[-9,-3],[-9,-7],[-8,-5],[-10,4],[-10,13],[-8,9],[-11,4],[-12,11],[-12,12],[-5,13],[-4,19],[-8,8],[-8,0],[-6,1],[1,5],[0,13],[-7,12],[-4,12],[0,12],[7,-3],[3,-5],[5,-6],[19,-10],[10,-15],[5,-9],[2,-16],[0,-7],[8,-12],[8,-9]],[[3500,363],[0,-12],[-3,-14],[2,-12],[15,-5],[5,-14],[-20,0],[-6,-9],[3,-11],[12,-5],[6,-5],[9,-6],[3,-15],[0,-7],[-14,10],[-17,7],[-8,2],[-7,7],[-7,12],[-12,19],[-10,18],[-4,8],[6,6],[11,1],[8,3],[7,7],[4,11],[5,-1],[1,0],[3,13],[-4,15],[-6,4],[-7,3],[-6,1],[-11,3],[-5,1],[-2,3],[4,5],[5,2],[1,-6],[15,-1],[12,-7],[8,-12],[1,-2],[3,-17]],[[4163,706],[-19,-15],[-41,-46],[-23,-36],[-1,-3],[27,-11],[9,-9],[5,-14],[-2,-13],[-10,-6],[-11,-4],[-13,-6],[-10,-11],[-3,-12],[1,-15],[-3,-13],[-10,-25],[-3,-13],[2,-10],[4,-11],[3,-14],[0,-14],[-2,-12],[-8,-24],[-3,-16],[2,-11],[10,-25],[5,-23],[6,-5],[18,-7],[4,-5],[4,-7],[0,-8],[-2,-7],[-3,-3],[-5,-2],[-4,-4],[-7,-13],[1,-9],[5,-10],[2,-15],[1,-1],[-3,-12],[-8,-2],[-19,8],[-12,3],[-6,-4],[-3,-8],[0,-14],[-2,-12],[-13,-41],[-6,-11],[-10,-10],[-21,-16],[-7,-3],[-18,-4],[-5,-3],[-2,-8],[1,-10],[1,-10],[-4,-11],[-12,-11],[-17,-9],[-23,-10],[0,2],[0,23],[-4,6],[7,21],[-3,12],[-23,34],[-6,14],[-1,12],[0,28],[6,27],[0,12],[-9,2],[3,5],[-6,7],[-4,10],[-1,9],[5,4],[-3,7],[-14,15],[-3,5],[-6,11],[-11,16],[-3,3],[-15,11],[-5,0],[-5,-3],[-16,29],[6,28],[-3,10],[0,31],[-2,11],[-5,4],[-4,3],[-2,8],[-4,6],[-9,1],[-9,-1],[-7,1],[-6,6],[-5,11],[-6,17],[-2,10],[-2,22],[-2,8],[-5,5],[-21,12],[1,-11],[4,-10],[8,-18],[-10,-8],[5,-41],[-5,-12],[-3,13],[0,44],[-2,13],[-6,25],[-9,86],[-3,15],[-2,11],[3,32],[-1,13],[-3,14],[-3,6],[-5,3],[-5,0],[-4,1],[-2,3],[-1,6],[-3,7],[-51,57],[-4,1],[-2,-3],[-3,5],[-5,14],[-9,17],[-3,10],[-2,5],[-4,2],[-10,-2],[-5,1],[-2,8],[-3,5],[-20,28],[-1,-1],[-3,-2],[-4,-2],[-2,0],[-5,6],[-14,27],[-5,3],[-28,34],[-11,-5],[-17,16],[-11,-2],[-5,16],[-8,11],[-10,9],[-10,12],[-20,32],[-3,11],[1,8],[1,7],[0,5],[-6,2],[-4,2],[-1,5],[1,5],[-1,5],[-20,23],[-7,13],[4,12],[-3,4]],[[3334,1111],[9,27],[5,11],[7,10],[9,8],[30,21],[8,11],[6,10],[9,25]],[[3334,1111],[-5,9],[-4,7],[-1,8],[-2,4],[-4,2],[-3,4],[2,10],[-9,1],[-10,3],[2,3],[0,2],[2,2],[2,2],[-3,7],[-4,4],[-5,0],[-7,-3],[3,6],[2,6],[1,6],[-3,4],[3,9],[-3,4],[-6,1],[-7,-1],[2,9],[-2,12],[-4,12],[-4,9],[-2,7],[-3,24],[-1,5],[-1,6],[-1,34],[-1,4],[-2,2],[-2,2],[-3,1],[-3,2],[-1,5],[0,6],[-1,4],[-17,15],[-3,4],[0,7],[-3,8],[-3,6],[-8,5],[-2,3],[-3,3],[0,1],[-3,-1],[-5,-7],[-2,-1],[-5,3],[-5,4],[-5,5],[-4,6],[-13,36],[-5,10],[-6,8],[-3,7],[-1,9],[2,12],[11,42],[2,13],[1,5],[3,2],[0,4],[-4,9],[-2,0],[-11,7],[0,1],[-20,7],[-5,19],[0,4],[-9,16],[-2,2],[-1,6],[1,7],[3,13],[2,7],[3,5],[1,4],[1,12],[3,13],[6,16],[-4,9],[-9,8],[-10,5],[-20,7],[-9,8],[-4,17],[-7,14],[-2,6],[0,7],[4,14],[-1,6],[-2,12],[-1,6],[-2,6],[-9,6],[-2,6],[-2,13],[-5,7],[-7,5],[-13,13],[1,2],[0,8],[-1,6],[-4,10],[-1,5],[-1,7],[-3,10],[1,7],[3,7],[4,5],[3,5],[-4,5],[1,6],[-1,7],[-2,5],[-1,8],[-41,18],[-11,8],[-24,32],[-12,7],[0,4],[5,0],[11,-8],[3,26],[-1,32],[-3,13],[-22,40],[-9,8],[-25,4],[-9,-1],[-5,-6],[6,-16],[-7,8],[-6,13],[-4,13],[-1,5],[-7,6],[-19,35],[-15,12],[-3,4],[1,5],[6,16],[-3,12],[-6,6],[-14,8],[-18,14],[-4,2],[-5,9],[-4,2],[-4,3],[-12,21],[-4,2],[-12,4],[-4,0],[-8,3],[-10,7],[-22,22],[-17,25],[4,9],[-8,7],[-13,4],[-15,3],[-2,3],[-5,8],[-7,9],[-4,6],[0,3],[-5,4],[-15,17],[-8,5],[-10,0],[-12,-3],[-10,-4],[-4,-6],[-11,6],[-20,15],[-11,6],[1,-8],[3,-5],[3,-3],[4,-4],[3,-2],[4,-4],[3,-4],[-3,-2],[-8,3],[-47,36],[-6,7],[-7,4],[-9,3],[-9,6],[-7,19],[-8,10],[-26,25],[-13,16],[-28,57],[-9,10],[0,5],[5,0],[3,0],[3,3],[2,6],[-7,1],[-7,5],[-11,13],[-3,7],[-2,19],[-3,7],[-15,22],[-2,11],[8,15],[-17,7],[-6,1],[1,-5],[2,-4],[3,-2],[3,-2],[-9,4],[-10,7],[-7,10],[4,10],[-5,2],[-2,4],[1,5],[2,6],[3,-5],[3,-4],[5,-2],[6,-2],[-3,8],[0,3],[-1,4],[0,6],[-3,0],[-3,-1],[-3,2],[-7,11],[-2,1],[-1,-12],[-10,8],[-14,14],[-10,15],[1,15],[2,-3],[4,-4],[3,-2],[1,4],[-1,8],[-3,3],[-3,1],[-4,4],[-5,2],[-5,-1],[-5,-2],[-4,-2],[-1,3],[-13,26],[-3,9],[-1,11],[-1,15],[-1,6],[-7,5],[-1,6],[-1,8],[-1,2],[-3,2],[-20,17],[-6,8],[-3,17],[-4,13],[-1,7],[1,3],[4,8],[1,4],[-3,9],[-18,35],[-6,5],[-15,30],[37,41],[6,15],[0,21],[-3,18],[-7,10],[0,3],[5,6],[-1,8],[-8,21],[-6,-13],[-5,-2],[-4,7],[-4,13],[3,4],[-8,14],[-1,18],[0,20],[-1,18],[-5,17],[1,9],[9,4],[3,4],[2,9],[0,9],[-3,8],[-4,-13],[-3,-6],[-3,-3],[-7,0],[-1,3],[0,5],[-2,6],[-3,3],[-2,2],[-2,2],[-2,6],[-2,5],[0,11],[-2,5],[-1,1],[-5,4],[-1,2],[-2,4],[-1,3],[-16,25],[-13,38],[-9,53],[1,13],[12,5],[13,-20],[9,0],[2,14],[0,12],[1,7],[2,2],[7,6],[1,3],[1,12],[5,26],[1,12],[-3,0],[-7,-21],[-3,9],[1,7],[3,7],[2,9],[0,26],[4,17],[15,23],[5,27],[4,6],[4,5],[4,7],[7,18],[8,10],[1,3],[0,8],[-2,7],[-5,4],[-6,-2],[-3,-6],[-3,-18],[-3,-6],[-12,-3],[-1,18],[6,27],[-3,34],[3,36],[-3,17],[-4,9],[-13,22],[-13,35],[-9,19],[-3,10],[1,8],[12,14],[0,5],[-23,32],[-9,9],[-4,-3],[1,-3],[9,-11],[3,-6],[1,-7],[1,-6],[1,-7],[3,-6],[-3,-4],[-7,18],[-13,25],[-13,18],[-24,55],[0,8],[14,-9],[15,-42],[9,-4],[5,-3],[4,0],[4,5],[3,7],[-5,7],[-8,20],[-5,3],[-4,2],[-4,5],[-2,6],[-2,7],[-4,10],[-9,5],[-11,3],[-8,6],[-10,-3],[-7,11],[-9,27],[5,6],[4,8],[3,10],[1,9],[-2,18],[-2,10],[0,7],[-6,4],[-4,-10],[-6,14],[-8,14],[-9,21],[-8,12],[-4,14],[-6,10],[-1,8],[-4,11],[0,9],[-4,19],[-6,15],[-6,19],[-2,12]]],"transform":{"scale":[0.002106690690969092,0.00157519784757821],"translate":[34.57276451900023,16.37094468406555]}};
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
