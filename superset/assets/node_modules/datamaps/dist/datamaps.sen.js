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
  Datamap.prototype.sauTopo = '__SAU__';
  Datamap.prototype.scrTopo = '__SCR__';
  Datamap.prototype.sdnTopo = '__SDN__';
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = {"type":"Topology","objects":{"sen":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Sédhiou"},"id":"SN.KD","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Kédougou"},"id":"SN.TC","arcs":[[6,7,8]]},{"type":"Polygon","properties":{"name":"Kaffrine"},"id":"SN.","arcs":[[9,10,11,12,13,14,15]]},{"type":"Polygon","properties":{"name":"Saint-Louis"},"id":"SN.SL","arcs":[[16,17,18]]},{"type":"Polygon","properties":{"name":"Dakar"},"id":"SN.DK","arcs":[[19,20]]},{"type":"Polygon","properties":{"name":"Diourbel"},"id":"SN.DB","arcs":[[21,-15,22,23]]},{"type":"MultiPolygon","properties":{"name":"Fatick"},"id":"SN.FK","arcs":[[[24,25]],[[-14,26,27,28,-23]]]},{"type":"Polygon","properties":{"name":"Kaolack"},"id":"SN.","arcs":[[29,-26,30,-27,-13]]},{"type":"Polygon","properties":{"name":"Louga"},"id":"SN.LG","arcs":[[31,-16,-22,32,33,-18]]},{"type":"Polygon","properties":{"name":"Matam"},"id":"SN.SL","arcs":[[34,-10,-32,-17,35]]},{"type":"Polygon","properties":{"name":"Thiès"},"id":"SN.TH","arcs":[[-24,-29,36,-21,37,-33]]},{"type":"Polygon","properties":{"name":"Kolda"},"id":"SN.KD","arcs":[[38,-8,39,-1,40]]},{"type":"MultiPolygon","properties":{"name":"Ziguinchor"},"id":"SN.ZG","arcs":[[[41,-3]],[[42,-5]]]},{"type":"Polygon","properties":{"name":"Tambacounda"},"id":"SN.TC","arcs":[[-9,-39,43,-11,-35,44]]}]}},"arcs":[[[3562,2410],[-5,-100],[-14,-87],[-19,-87],[10,-80],[57,-54],[76,-20],[24,-53],[33,-121],[5,-73],[5,-54],[52,-47],[57,-53],[-4,-61],[4,-80],[34,-53],[28,-67],[0,-81],[0,-107],[-24,-73],[-14,-67],[13,-140]],[[3880,852],[-79,0],[-47,-9],[-42,-27],[-94,-93],[-99,-62],[-86,-88],[-5,-4],[-410,-264],[-56,-16],[-280,22]],[[2682,311],[0,1],[-7,13],[-50,102],[-16,49],[-30,59],[-23,68],[-5,60],[2,13]],[[2553,676],[25,-28],[14,-21],[19,-5],[104,-2],[10,-10],[21,-30],[8,-7],[14,3],[42,14],[18,16],[18,30],[23,18],[34,-20],[9,11],[11,7],[10,0],[22,-22],[10,2],[8,5],[9,-3],[13,-20],[11,-39],[8,-17],[11,-14],[11,-9],[15,-6],[20,-1],[18,5],[74,42],[30,42],[50,89],[19,19],[16,12],[12,16],[4,31],[-9,14],[-18,11],[-10,12],[14,18],[-16,52],[-14,69],[-6,71],[14,57],[19,16],[23,1],[25,-3],[22,3],[22,14],[16,16],[10,21],[7,27],[34,-44],[30,-13],[21,25],[4,63],[-25,-36],[-24,1],[-25,15],[-26,5],[-24,-15],[-40,-41],[-30,-8],[-16,0],[-24,-5],[-22,-16],[-10,-33],[0,-133],[18,-85],[3,-24],[1,-37],[-1,-18],[-5,-15],[-39,-47],[-13,-22],[-82,-103],[-21,-18],[-19,-2],[-17,11],[-15,16],[10,69],[-50,30],[-115,26],[-78,-68],[-29,-10],[-5,7],[-7,17],[-12,16],[-19,7],[-20,-5],[-28,-21],[-19,-5],[-19,7],[-25,17],[-40,38],[-2,11],[2,16],[1,15],[-6,6],[-22,4],[-11,5],[-7,5],[-11,19],[-22,61],[-6,7],[-7,5],[-6,7],[-7,49],[-8,26]],[[2458,965],[0,1],[-2,19],[3,32],[7,20],[13,141],[4,14],[8,15],[18,23],[4,12],[3,15],[2,47],[6,23],[-8,39],[-2,24],[1,26],[73,161],[66,186],[0,17],[-9,16],[-11,8],[-12,5],[-11,8],[-2,19],[8,27],[28,43],[16,36]],[[2661,1942],[43,-1],[61,0],[11,11],[3,162],[0,36],[3,161],[6,33],[19,14],[113,15],[73,32],[21,0],[109,-14],[27,3],[49,23],[37,28],[38,20],[51,-4],[177,-51],[60,0]],[[9151,2454],[4,-25],[14,-5],[43,-29],[13,-13],[6,-17],[10,-44],[7,-15],[20,-22],[9,-2],[9,13],[68,71],[4,44],[10,47],[16,38],[25,18],[23,-5],[12,-18],[9,-22],[16,-18],[16,-2],[31,9],[41,2],[8,-10],[-2,-33],[4,-22],[18,-3],[20,7],[12,8],[0,-50],[12,-44],[40,-77],[37,-44],[6,-22],[-2,-25],[-21,-41],[-6,-25],[5,-41],[16,-28],[19,-24],[15,-30],[1,-80],[8,-37],[29,-9],[22,-19],[19,-20],[21,-17],[26,-9],[17,-10],[-2,-16],[-9,-17],[-3,-13],[23,-45],[9,-27],[6,-15],[6,-7],[15,-9],[-3,-10],[-9,-10],[-5,-9],[-1,-19],[-3,-45],[-5,-23],[25,-6],[19,11],[12,26],[4,39],[14,-20],[7,-23],[4,-26],[3,-59],[-5,-14],[-11,-9],[-14,-15],[-7,-1],[-10,8],[-12,5],[-10,-7],[-1,-14],[7,-13],[10,-11],[3,-12],[-6,-24],[-10,-23],[-6,-24],[6,-37],[-3,-10],[-5,-9],[-4,-13],[1,-14],[6,-5],[8,-2],[4,-2],[2,-2],[6,-10],[7,-16],[5,-20],[4,-23],[1,-27],[-3,-25],[-12,-16],[0,-11],[17,-42],[3,-21],[-13,-30],[-22,-5],[-22,-10],[-17,-60],[-13,-12],[-10,-17],[2,-34],[6,-5],[12,-7],[13,-12],[8,-23],[0,-24],[-8,-72],[1,-24],[4,-16],[2,-16],[-4,-27],[-33,-21],[-12,-15],[18,-8],[12,-11],[18,-45],[14,-16],[-1,17],[9,24],[12,7],[10,-36],[4,-20],[10,-37],[3,-20],[13,28],[3,13],[21,-40],[-3,-53],[-11,-60],[-3,-61],[-45,3],[-107,53],[-54,7],[-140,-14],[-68,-18],[-125,-64],[-61,-14],[-133,8],[-33,10],[-98,57],[-3,4],[-3,2],[-11,0],[-7,-4],[-18,-17],[-62,-47],[-21,-6],[-35,5],[-98,45],[-40,-2],[-29,-20],[-54,-67],[-60,-47],[-274,-98],[-27,18],[-46,98],[-29,29],[-70,35],[-34,11],[-28,2],[-28,-8],[-31,-17],[-48,-36],[-12,-5],[-2,0],[-23,1],[-6,8],[-1,16],[-9,22],[-46,70],[-26,30],[-32,18],[-33,5],[-105,-8],[-34,6],[-9,19],[-7,22],[-26,17],[-48,5],[-16,9],[-17,21],[-3,20],[2,15],[1,9],[-40,49],[-64,45],[-59,-1],[-27,-91],[-5,-44],[-19,-22],[-27,-3],[-29,16],[-31,-5],[-28,4],[-24,18],[-19,37],[-7,44],[6,38],[24,77],[6,39],[2,46],[-7,43],[-21,31],[-25,5],[-28,-6],[-30,-1],[-29,20],[-15,-25],[-13,12],[-11,2],[-11,-3],[-15,0],[-20,-8],[-7,-2],[-7,5],[-16,23],[-9,6],[-12,-1],[-27,-10],[-14,-3],[-15,3],[-20,18],[-13,5],[-15,-2],[-48,-14],[-8,-3],[-4,-7],[-4,-5],[-10,-1],[-8,4],[-14,13],[-7,5],[-5,2]],[[6781,785],[5,35],[-13,44],[-21,14],[-10,-2],[-8,-6],[-13,-6],[-17,-5],[-37,0],[-21,5],[-17,8],[-21,15],[-13,13],[-11,19],[-3,14],[2,12],[8,20],[3,11],[3,84],[-1,14],[-5,14],[-4,20],[-11,17],[-4,16],[-1,14],[2,11],[4,11],[9,20],[4,10],[1,13],[-5,9],[-8,9],[-1,7],[6,2],[8,-2],[10,1],[6,5],[3,15],[-7,16],[-6,55],[-7,8],[-22,21],[-15,24],[-6,18],[-5,36],[-8,16],[-3,12],[2,10],[5,9],[4,13],[-8,71],[-2,8],[-8,5],[-10,3],[-10,7],[-4,9],[2,10],[5,10],[2,14],[-3,8],[-12,16],[-12,22],[-18,26],[-25,21],[-3,11],[0,14],[1,14],[-1,15],[-6,8],[-8,6],[-9,11],[-22,33],[-12,34],[-2,21],[-2,38],[-7,18],[-1,14],[1,13],[3,13],[0,36],[1,17],[-2,49],[-3,15],[-6,10],[-7,7]],[[6354,2131],[-1,20],[38,25],[1,121],[28,27],[-6,-38],[10,-17],[19,-7],[16,4],[9,27],[8,14],[24,16],[33,12],[20,-9],[-10,-49],[20,11],[14,54],[15,13],[66,0],[63,-17],[20,12],[17,14],[15,-3],[15,-37],[-16,-37],[-13,-20],[-7,-19],[1,-35],[7,-18],[4,-17],[1,-19],[5,-9],[13,1],[10,1],[5,-8],[4,-14],[11,-10],[11,-7],[8,-9],[1,-11],[-6,-21],[10,-22],[6,-31],[-7,-32],[-3,-29],[21,-25],[-66,-32],[0,-14],[33,-21],[6,-56],[-3,-69],[8,-58],[31,-50],[32,-11],[71,28],[46,24],[24,0],[48,-6],[43,-20],[28,-34],[29,0],[14,34],[14,20],[34,0],[38,26],[28,20],[91,0],[33,-20],[29,-40],[24,0],[38,-53],[43,-40],[33,-14],[14,34],[0,26],[15,20],[28,0],[24,14],[5,40],[14,20],[34,-7],[23,-13],[24,7],[0,40],[15,40],[38,33],[23,41],[-9,53],[0,54],[24,26],[33,7],[33,0],[29,20],[19,20],[24,-20],[24,-20],[38,-7],[52,20],[29,27],[19,47],[5,47],[19,33],[33,7],[10,34],[24,26],[42,14],[39,-14],[23,-40],[19,-20],[19,7],[10,40],[14,27],[10,53],[19,14],[52,-14],[43,0],[24,40],[-10,54],[-47,80],[-10,40],[24,34],[0,53],[38,20],[48,-40],[43,-47],[47,-33],[48,-40],[57,-20],[43,-20],[10,-47],[9,-54],[34,0],[42,40],[43,67],[58,20],[94,24]],[[4341,5317],[30,-36],[43,-28],[264,-107],[26,-14],[10,-15],[3,-28],[0,-26],[-3,-35]],[[4714,5028],[-2,-429],[37,-149],[21,-42],[9,-40],[7,-173],[15,-101],[3,-45],[0,-38],[-15,-94],[-7,-18],[-6,-12],[-16,-11],[-14,-7],[-7,-5],[-2,-4],[-6,-40],[1,-41],[-4,-27],[-3,-17],[-4,-11],[-96,-125],[-38,-42],[-8,-6],[-74,-25],[-16,-11],[-10,-2],[-21,-1],[-19,-5],[-17,-9],[-22,-33],[-20,-37],[-29,-70],[-6,-29]],[[4345,3329],[-31,34],[-60,27],[-164,10],[-96,50],[-35,3],[-118,-60],[-123,-107],[-34,-12],[-14,15],[-31,57],[-16,20],[-70,15],[-75,-39]],[[3478,3342],[-83,53],[-47,0],[-65,8],[-111,66],[-36,-74],[-29,-66],[-30,-17],[-41,25],[-47,66],[-24,66],[0,58],[18,58],[-6,58],[-71,58],[-59,83],[-17,49],[-6,58],[-24,42],[-70,16],[0,116],[0,149],[17,83],[42,124],[29,99],[2,220]],[[2820,4740],[43,46],[38,63],[64,101],[42,5],[37,27],[76,84],[34,38],[37,10],[79,16],[87,21],[60,21]],[[3417,5172],[49,74],[35,209]],[[3501,5455],[130,-107],[82,-42],[247,-68],[56,-7],[38,12],[31,17],[144,120],[28,18],[26,9],[20,-22],[38,-68]],[[6197,8732],[-68,-192],[-165,-91],[-24,-83],[-182,-223],[-259,-290],[-242,-256],[-65,66],[-124,83],[-135,99],[-71,133]],[[4862,7978],[-82,165],[-183,174],[-85,-8],[-130,95],[-28,13],[-929,2],[-12,-152],[-255,-24],[-18,15],[-334,519],[-33,43],[-21,17],[-10,-17],[-6,-8],[-27,-26],[-31,-22],[-7,-7],[-5,-8],[-7,-23],[-16,-39],[-12,-18],[-10,-11],[-307,-234],[0,-1],[-8,-6],[-57,-64],[-11,-17],[-4,-9],[-4,-11],[-5,-23],[-4,-11],[-8,-9],[-70,-50],[-17,-18],[-10,-28],[-21,-75],[-7,-16],[-12,-18],[-23,-5],[-25,-2],[-28,-6],[-23,-11],[-35,-35],[-30,-14],[-31,-7],[-263,-8],[-2,0]],[[1616,7980],[-3,7],[37,85],[16,126],[4,248],[10,27],[22,100],[28,92],[7,155],[12,45],[24,28],[60,20],[25,22],[10,23],[7,27],[67,386],[8,91],[12,43],[23,42],[30,40],[34,29],[37,10],[54,-14],[18,-2],[19,4],[16,11],[48,46],[19,12],[19,5],[21,-6],[15,-12],[12,-17],[19,-40],[28,-39],[33,-22],[36,-6],[39,8],[12,11],[11,8],[12,3],[14,-4],[21,-12],[10,-1],[12,3],[64,39],[23,4],[57,-19],[14,0],[40,10],[26,-2],[73,-33],[53,-4],[14,-5],[38,-25],[25,-9],[25,2],[24,11],[23,19],[36,45],[19,16],[25,6],[69,-20],[24,3],[20,13],[15,20],[40,77],[20,24],[23,14],[25,-3],[15,-17],[10,-23],[11,-21],[20,-12],[24,1],[22,8],[69,38],[25,8],[52,2],[77,-16],[26,1],[175,37],[34,18],[10,9],[7,13],[1,17],[-5,15],[-27,34],[-9,31],[3,29],[14,23],[23,8],[24,-9],[14,-22],[13,-27],[17,-21],[12,-6],[12,2],[11,7],[10,10],[8,14],[4,15],[5,31],[10,22],[17,15],[36,20],[19,-13],[21,-30],[2,-4],[12,-34],[17,-28],[30,-7],[49,16],[278,-27],[18,3],[55,20],[16,0],[15,-5],[45,-29],[18,-5],[18,1],[68,26],[17,1],[66,-19],[18,0],[17,2],[17,7],[16,10],[43,34],[15,9],[32,2],[103,-55],[13,-11],[6,-17],[0,-25],[-9,-44],[3,-17],[15,-9],[62,7],[16,-10],[6,-18],[2,-40],[8,-18],[17,-11],[39,-4],[18,-4],[14,-11],[27,-49],[12,-14],[38,-37],[55,-87],[97,-119],[54,-42],[11,-14],[28,-46],[14,-13],[32,-17],[15,-11],[10,-15],[1,-16],[-10,-35],[-3,-20],[3,-14],[16,-29],[7,-20],[1,-19],[-8,-41],[6,-37],[27,-20],[64,-25],[13,-11],[26,-27],[11,-15],[8,-19],[13,-61],[8,-22],[10,-20],[13,-17],[15,-12],[14,-5],[13,2],[13,6],[26,21],[27,27],[11,17],[28,56],[13,17],[13,10],[15,6],[15,1],[15,-3],[-3,-29],[-9,-38],[-8,-30],[6,-24]],[[629,5261],[-48,91],[-47,59],[-28,26],[-31,20],[-36,8],[-26,10],[-69,50],[-10,17],[-54,-1],[-47,8],[-40,-4],[-37,-36],[14,-22],[19,-8],[-12,-33],[-21,-13],[6,-8],[10,-16],[5,-7],[-10,-33],[-5,-2],[-6,-14],[-21,19],[-109,185],[-26,33],[268,98],[79,88],[228,132]],[[575,5908],[2,-3],[33,-102],[10,-42],[1,-12],[1,-54],[6,-21],[25,-59],[5,-20],[2,-21],[-30,-311],[-1,-2]],[[2279,6072],[52,62],[38,13],[398,4],[25,-7],[-1,-20],[1,-30],[2,-14],[3,-12],[5,-10],[6,-6],[7,-5],[12,-7],[5,-5],[5,-8],[10,-34],[4,-10],[6,-8],[7,-6],[41,-24],[27,-26],[5,-9],[4,-10],[2,-13],[2,-30],[7,-30],[29,-31],[42,18],[86,4],[45,-6],[7,-5],[16,-15],[13,-11],[24,-11],[15,-3],[108,13],[21,-2],[14,-5],[6,-9],[4,-11],[8,-137],[11,-50],[42,-63],[58,-48]],[[3417,5172],[-22,80],[-38,42],[-215,117],[-53,31],[-37,53],[-30,6],[-46,-22],[-34,-5],[-80,80],[-7,-7],[-21,-14],[-8,-7],[-6,-10],[-4,-10],[-3,-12],[-7,-194],[-5,-26],[-4,-12],[-4,-9],[-88,-119],[-7,-7],[-40,-26],[-55,-18],[-136,-20],[-23,0],[-177,43],[-23,10],[-16,9],[-18,25],[-21,19],[-15,11],[-54,24],[-54,8],[-17,-1],[-85,-25],[-11,0],[-12,3],[-14,11],[-9,9],[-13,16],[-7,8],[-16,4],[-138,11],[-72,-9],[-21,-10],[-20,-42]],[[1631,5187],[-34,14],[-82,50],[-19,17],[-5,8],[-4,11],[-2,12],[0,13],[7,16],[11,21],[24,35],[9,22],[4,20],[-1,14],[-3,13],[-4,10],[-5,9],[-7,6],[-16,10],[-6,7],[-5,8],[-3,10],[1,20],[2,18],[5,25],[1,10],[-1,10],[-4,10],[-5,7],[-6,8],[-7,6],[-16,9],[-6,7],[-4,11],[-2,14],[-3,26],[1,13],[4,24],[1,57],[-2,14],[-3,12],[-5,9],[-6,7],[-8,4],[-15,5],[-7,6],[-9,12],[-3,7],[-2,10],[8,51],[10,36],[15,33],[30,22],[391,153],[7,-4],[4,-5],[4,-5],[19,-16],[15,-7],[11,-3],[15,0],[23,4],[13,5],[7,3],[2,2],[1,1],[3,1],[6,0],[8,-3],[55,-60],[7,-6],[27,-14],[10,-8],[6,-11],[3,-12],[1,-13],[1,-12],[4,-12],[4,-9],[7,-7],[8,-5],[11,-4],[14,-3],[21,2],[19,7],[78,55],[14,14],[6,28]],[[2355,2917],[-66,0],[-101,1],[-100,1],[-101,0],[-101,1],[-101,0],[-101,1],[-101,0],[-1,1],[-16,33],[-8,24],[1,64],[28,36],[41,28],[41,45],[-9,6],[-16,17],[-9,6],[20,27],[15,35],[-2,28],[-33,5],[4,-36],[-8,-44],[-17,-31],[-24,2],[-11,-48],[-25,-32],[-32,-12],[-31,13],[-29,41],[-7,42],[13,90],[4,56],[4,23],[15,30],[57,93],[10,33],[10,-9],[25,-16],[9,-8],[-3,10],[-9,38],[57,14],[3,-45],[11,-43],[19,-25],[23,6],[-12,52],[-3,57],[-7,46],[-24,16],[8,31],[36,212],[2,37],[-35,-71],[-15,-45],[-13,-94],[-17,-57],[-21,-37],[-22,8],[-12,0],[-16,-30],[-29,-12],[-33,-6],[-32,-14],[-17,-20],[-6,-19],[-3,-19],[-8,-21],[-9,-11],[-18,-15],[-11,-12],[-16,-42],[-13,-16],[-16,11],[-5,22],[0,28],[-3,24],[-15,11],[-21,20],[-8,45],[2,48],[11,28],[-10,32],[-7,35],[-5,73],[1,39],[6,22],[10,15],[37,41],[19,10],[21,1],[48,-7],[23,-10],[15,-18],[-2,-30],[23,28],[18,33],[22,19],[37,-18],[0,50],[12,22],[21,14],[22,24],[-20,-10],[-22,-6],[-20,6],[-16,24],[73,63],[27,32],[42,71],[23,27],[52,21],[25,44],[20,10],[13,-9],[13,-16],[14,-10],[16,11],[10,10],[26,17],[1,1]],[[1890,4234],[104,-4],[9,-2],[9,-7],[9,-10],[47,-41],[22,-26],[11,-18],[11,-25],[7,-50],[1,-29],[-2,-25],[-5,-17],[-17,-34],[-6,-17],[1,-19],[33,-58],[21,-25],[10,-23],[18,-156],[1,-18],[-2,-17],[-5,-18],[-8,-17],[-18,-33],[-24,-28],[-9,-14],[-4,-16],[-2,-16],[-1,-33],[2,-19],[6,-20],[16,-23],[51,-59],[26,-21],[12,-12],[10,-19],[7,-30],[7,-74],[6,-33],[9,-22],[14,-23],[52,-65],[22,-40],[9,-45],[5,-15],[0,-1]],[[2820,4740],[-51,-44],[-121,5],[-79,5],[-34,-21],[-30,-42],[-34,-16],[-138,32],[-8,10],[0,12],[-15,2],[-83,-10],[-98,-29],[-52,-7],[-16,-11],[-19,-21],[-44,-72],[-82,-166],[-16,-77],[-23,-43]],[[1877,4247],[-77,4],[-44,23],[3,49],[-26,-18],[-10,-33],[5,-35],[19,-23],[-21,-15],[-16,2],[-17,8],[-19,5],[-13,-7],[-6,-17],[-3,-21],[-5,-18],[-42,-101],[-15,-24],[-16,-10],[-35,-12],[-20,-17],[-14,-26],[-20,-52],[-17,-23],[-36,-17],[-35,10],[-35,16],[-39,5],[38,94],[2,16],[27,11],[45,69],[-22,-9],[-21,-44],[-18,-11],[-36,-1],[-14,-5],[-12,-10],[19,-30],[-1,-20],[-28,-44],[-5,-18],[-4,-32],[-8,-20],[-32,-50],[-7,-20],[-8,-64],[8,-216],[-10,0],[-10,437],[-8,66],[-27,110],[-14,39]],[[1177,4148],[13,18],[45,21],[8,11],[2,12],[-4,9],[-6,10],[-4,11],[-1,19],[5,11],[42,48],[7,18],[0,14],[-5,9],[-7,7],[-6,7],[-5,10],[23,131],[82,322],[5,4],[8,3],[54,5],[9,3],[8,5],[6,7],[6,8],[16,27],[13,14],[8,5],[17,8],[14,12],[27,38],[42,77],[9,19],[11,47],[12,69]],[[3478,3342],[-69,-69],[-50,-75],[-18,-39],[-17,-48],[-13,-50],[-2,-15],[-4,-31],[-3,-91],[-26,-11],[-79,0],[-101,0],[-101,1],[-101,1],[-101,0],[-100,1],[-101,0],[-101,1],[-101,0],[-35,0]],[[1890,4234],[12,12],[-25,1]],[[4862,7978],[-129,-166],[-65,-58],[-83,-41],[-47,-25],[-12,-414],[-58,-124],[271,-190],[135,25],[-53,-314],[-29,-249],[69,-47],[-128,-52],[-183,-33],[-112,-58],[47,-223],[71,-215],[-59,-166],[-71,-66],[-23,-182],[-62,-63]],[[2279,6072],[-35,25],[-37,20],[-8,5],[-8,9],[-9,12],[-11,23],[-5,17],[-4,16],[-5,41],[-3,12],[-4,12],[-9,19],[-47,78],[-9,20],[-16,55],[-3,23],[-2,19],[1,20],[2,9],[3,59],[-4,30],[-7,24],[-6,15],[-5,9],[-14,43],[-5,9],[-6,4],[-9,-4],[-15,-15],[-6,-5],[-8,-1],[-7,5],[-6,13],[-5,30],[-10,108],[-2,12],[-3,10],[-7,8],[-9,6],[-16,2],[-9,-1],[-24,-8],[-20,-2],[-76,26],[-12,0],[-11,-4],[-7,-6],[-6,-8],[-5,-8],[-14,-28],[-16,-26],[-18,-36],[-11,-17],[-25,-44],[-10,-35],[-4,-25],[-6,-22],[-9,-19],[-73,-105],[-9,-19],[-21,-34],[-6,-7],[-7,-6],[-8,-2],[-8,2],[-8,7],[-7,12],[-8,19],[-2,37],[2,10],[3,7],[3,9],[3,9],[1,10],[-2,13],[-5,11],[-11,18],[-9,9],[-26,17],[-14,12],[-7,7],[-5,8],[-20,36],[-10,29],[-5,11],[-6,9],[-9,9],[-20,11],[-13,5],[-9,25],[-5,44],[8,96],[12,53],[29,79],[8,44],[0,15],[-1,13],[-8,26],[-7,17],[-49,53],[-8,6]],[[1300,7231],[107,193],[212,484],[8,23],[-3,24],[-8,25]],[[7869,6354],[4,-17],[170,-309],[12,-37],[7,-53],[0,-17],[-3,-20],[-124,-428],[-133,-277],[-20,-30],[-20,-14],[-244,-42],[-70,-2],[-438,111],[-18,-8],[-13,-9],[-426,-419],[-18,-11],[-444,-10],[-80,17],[-707,366],[-27,21],[-29,31],[-15,43],[-71,90],[-67,-29],[-24,-17],[-30,-35],[-48,-79],[-78,-75],[-201,-67]],[[6197,8732],[7,-7],[17,-9],[8,-7],[1,-4],[3,-8],[2,-3],[4,-3],[10,-6],[4,-3],[11,-13],[4,-2],[11,-3],[10,4],[45,32],[9,3],[31,0],[6,1],[12,5],[49,29],[86,25],[22,12],[9,4],[9,0],[11,-3],[3,-32],[-28,-69],[-3,-35],[17,-16],[59,32],[25,-1],[8,-12],[13,-31],[8,-13],[44,-41],[10,-16],[4,-18],[2,-40],[2,-18],[23,-76],[10,-24],[12,-22],[15,-20],[41,-42],[9,-18],[4,-19],[-1,-19],[-7,-39],[0,-18],[4,-16],[7,-13],[29,-47],[15,-35],[7,-39],[1,-44],[-4,-19],[-5,-20],[-4,-19],[2,-19],[9,-16],[11,-12],[25,-20],[13,-14],[11,-16],[18,-37],[7,-18],[2,-17],[-3,-17],[-24,-52],[-6,-19],[-2,-20],[3,-19],[15,-57],[24,1],[49,12],[24,-2],[11,-6],[30,-30],[12,-6],[38,-14],[20,-16],[17,-22],[12,-27],[4,-32],[-9,-86],[0,-20],[3,-19],[6,-21],[9,-10],[50,-17],[23,4],[24,21],[22,23],[24,18],[25,5],[26,-16],[10,-17],[5,-20],[7,-63],[5,-16],[16,-29],[8,-17],[3,-18],[0,-76],[6,-37],[14,-35],[19,-29],[97,-90],[21,-30],[10,-37],[-9,-32],[-26,-6],[-56,8],[-16,-17],[9,-28],[37,-51],[15,-15],[14,-7],[16,0],[34,9],[17,0],[17,-6],[15,-14],[8,-16],[4,-17],[0,-19],[-8,-58],[1,-18],[5,-20],[2,-6],[41,-18],[12,-17],[48,-63],[44,-26],[1,1]],[[1177,4148],[-16,42],[-14,24],[-21,14],[-43,13],[-16,20],[-8,33],[-14,123],[-11,39],[-13,28],[-30,43],[-14,11],[-11,3],[-7,9],[-3,30],[2,23],[9,45],[1,26],[-7,38],[-20,40],[-51,71],[-116,75],[-18,26],[-9,30],[-58,118],[-42,157],[-18,32]],[[575,5908],[15,9],[55,61],[258,420],[52,105],[113,171],[226,546],[6,11]],[[5932,2732],[21,13],[15,8],[18,3],[9,2],[6,8],[4,10],[2,12],[5,10],[6,6],[8,3],[17,-3],[18,0],[8,-4],[4,-8],[-1,-14],[-6,-23],[0,-22],[-1,-7],[-1,-4],[-7,-11],[-4,-9],[-3,-11],[0,-13],[4,-13],[11,-12],[10,-2],[8,3],[14,12],[9,4],[9,3],[10,-1],[9,-3],[24,-12],[17,-7],[5,-4],[2,-6],[-4,-12],[-4,-9],[-30,-40],[-4,-9],[-4,-11],[-2,-12],[0,-13],[0,-13],[0,-14],[-2,-13],[-5,-10],[-4,-9],[-5,-8],[-5,-9],[-2,-10],[4,-11],[10,-8],[10,-4],[11,-2],[10,0],[10,1],[40,10],[21,1],[9,-4],[5,-7],[0,-15],[-4,-11],[-14,-28],[-2,-9],[3,-11],[10,-9],[8,-7],[6,-10],[1,-18],[-2,-14],[-4,-25],[1,-13],[7,-13],[15,-16],[24,-11],[7,-7],[5,-12],[2,-19],[3,-17],[5,-14],[12,-12],[10,-2],[20,0]],[[6781,785],[-73,27],[-525,26],[-576,4],[-423,2],[-153,1],[-575,4],[-131,0],[-445,3]],[[3562,2410],[53,13],[53,27],[46,43],[34,59],[10,64],[6,141],[23,50],[36,52],[34,49],[37,20],[45,-40],[73,-94],[80,-80],[1,0],[0,-1],[106,-74],[55,-20],[62,-7],[25,-10],[54,-45],[30,-14],[33,-8],[18,-15],[32,-63],[46,-55],[54,-32],[59,-10],[60,10],[53,18],[18,-9],[47,-59],[15,-19],[22,-17],[23,-10],[51,-3],[22,-8],[18,-26],[12,-23],[16,-19],[17,-16],[59,-42],[43,-16],[43,-5],[93,11],[88,-23],[47,2],[35,25],[78,80],[25,15],[28,0],[70,35],[65,1],[65,24],[123,14],[80,49],[46,96],[7,117],[-39,108],[-17,18],[-36,30],[-12,14]],[[2682,311],[-16,2],[-129,-13],[-31,8],[-101,47],[-58,7],[-123,-30],[-11,-6],[-7,-8],[-7,-4],[-14,3],[-35,19],[-17,5],[-17,-5],[-112,-84],[-130,-96],[-49,-28],[-82,-1],[-85,-29],[-30,-2],[-220,21],[-60,-20],[-37,-36],[-10,29],[-8,30],[-7,47],[-10,15],[-25,24],[-37,50],[-17,30],[-7,29],[0,95],[4,21],[16,20],[3,20],[12,24],[81,67],[35,2],[51,-6],[54,46],[18,20],[9,19],[7,19],[11,22],[62,62],[30,-48],[23,-86],[22,-20],[1,36],[17,27],[28,12],[32,-10],[55,-43],[49,-18],[54,-35],[28,-3],[32,21],[39,66],[28,22],[38,-2],[32,-17],[32,-4],[38,31],[18,11],[13,-20],[10,-29],[9,-17],[126,65],[29,10],[39,3],[25,10],[22,21],[24,17],[35,-2],[29,-21],[43,-47]],[[2458,965],[-10,0],[0,-17],[-2,-9],[-18,-47],[-7,-14],[-6,-78],[-46,-40],[-66,-16],[-17,-10],[-34,-30],[-10,-6],[-17,3],[-39,14],[-62,0],[-18,-6],[-31,-19],[-17,-6],[-20,0],[-52,14],[-18,-5],[-22,-21],[-15,-5],[-6,-11],[-8,-25],[-11,-25],[-14,-16],[-67,30],[-54,42],[-25,29],[-11,31],[-6,5],[-15,7],[-15,10],[-8,16],[3,23],[10,20],[15,14],[16,5],[0,17],[-25,1],[-15,17],[-9,28],[-6,32],[-11,-188],[-12,0],[-22,40],[-59,71],[-8,45],[-19,-21],[-12,-26],[-15,-21],[-26,-9],[-19,6],[-13,15],[-7,25],[1,31],[23,59],[33,45],[21,52],[-10,80],[-7,-62],[-4,-17],[-9,-20],[-8,-10],[-7,-7],[-33,-41],[-13,-23],[-7,-30],[-2,-48],[12,-81],[-4,-37],[-49,-29],[-71,-82],[-54,-26],[-30,24],[-13,59],[-3,78],[9,80],[26,80],[42,45],[57,-26],[2,34],[-23,25],[-34,9],[-28,-13],[-34,-57],[-18,-18],[-21,6],[10,19],[3,19],[-3,20],[-10,19],[36,67],[7,34],[-8,40],[-13,0],[-7,-25],[-11,-11],[-10,8],[-5,35],[4,27],[10,30],[58,118],[6,29],[-2,29],[-8,54],[-1,26],[3,47],[16,95],[4,61],[-3,37],[-7,19],[3,53],[6,25],[10,19],[26,35],[5,22],[24,55],[56,18],[71,-1],[268,-4],[246,-3],[360,-4],[211,-3],[105,-1]],[[5932,2732],[-3,4],[-9,19],[-10,43],[-8,20],[-28,30],[-39,28],[-41,19],[-34,9],[-22,-5],[-33,-27],[-19,-12],[-17,-3],[-28,3],[-18,-1],[-32,-11],[-76,-53],[-93,-29],[-31,-18],[-90,-77],[-95,-47],[-29,-10],[-29,6],[-39,25],[-118,116],[-13,13],[-17,25],[-10,30],[-22,99],[-15,44],[-22,38],[-32,34],[-69,45],[-67,7],[-66,-24],[-100,-77],[-20,-9],[-22,12],[-67,55],[-11,17],[-32,148],[-14,42],[-21,39],[-26,30]],[[7869,6354],[17,3],[51,21],[25,5],[15,-7],[13,-17],[21,-37],[89,-72],[29,-29],[17,-14],[38,-12],[17,-13],[14,-21],[8,-23],[38,-182],[1,-24],[22,-18],[55,-89],[29,-33],[102,-66],[90,-96],[12,-67],[33,-39],[9,-32],[13,-26],[25,-15],[26,-7],[18,-1],[-9,-28],[-7,-16],[-3,-16],[4,-25],[11,-13],[16,-5],[13,-14],[-2,-38],[-9,-20],[-31,-42],[-12,-23],[-4,-24],[-1,-27],[-5,-25],[-12,-15],[-30,-25],[-10,-40],[3,-47],[20,-100],[4,-46],[-3,-99],[21,-6],[151,-76],[11,-30],[-7,-29],[-24,-12],[14,-31],[15,-28],[20,-23],[64,-32],[23,-21],[16,-33],[60,-192],[3,-51],[-12,-92],[-36,-175],[0,-95],[16,-59],[26,-36],[31,-31],[28,-47],[10,-43],[0,-46],[-10,-93],[-26,-102],[-54,-76],[-139,-107],[23,-26],[21,-45],[34,-89],[20,-82],[36,-77],[30,-46],[94,-94],[10,-16],[14,-34],[10,-15],[17,-11],[15,-3],[13,-7],[11,-27],[-4,-40],[-23,-123]]],"transform":{"scale":[0.0006158880462046191,0.00043862174307430336],"translate":[-17.536040818999936,12.305606588000103]}};
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
