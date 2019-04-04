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
  Datamap.prototype.srbTopo = {"type":"Topology","objects":{"srb":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Južno-Backi"},"id":"RS.JC","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Južno-Banatski"},"id":"RS.JN","arcs":[[6,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Srednje-Banatski"},"id":"RS.SD","arcs":[[-10,11,12,-1,13,14]]},{"type":"Polygon","properties":{"name":"Pirotski"},"id":"RS.PI","arcs":[[15,16,17,18]]},{"type":"Polygon","properties":{"name":"Borski"},"id":"RS.BO","arcs":[[19,20,21,22]]},{"type":"Polygon","properties":{"name":"Zlatiborski"},"id":"RS.ZL","arcs":[[23,24,25,26,27]]},{"type":"Polygon","properties":{"name":"Zapadno-Backi"},"id":"RS.ZC","arcs":[[-4,28,29]]},{"type":"Polygon","properties":{"name":"Severno-Backi"},"id":"RS.SC","arcs":[[30,-5,-30,31]]},{"type":"Polygon","properties":{"name":"Severno-Banatski"},"id":"RS.SN","arcs":[[-14,-6,-31,32]]},{"type":"Polygon","properties":{"name":"Branicevski"},"id":"RS.BR","arcs":[[-22,33,34,-7,35]]},{"type":"Polygon","properties":{"name":"Sremski"},"id":"RS.SM","arcs":[[-2,-13,36,37,38]]},{"type":"Polygon","properties":{"name":"Moravicki"},"id":"RS.MR","arcs":[[39,-24,40,41]]},{"type":"Polygon","properties":{"name":"Nišavski"},"id":"RS.NS","arcs":[[-17,42,43,44,45,46]]},{"type":"Polygon","properties":{"name":"Podunavski"},"id":"RS.PD","arcs":[[47,48,49,-8,-35]]},{"type":"Polygon","properties":{"name":"Pomoravski"},"id":"RS.PM","arcs":[[-21,50,-46,51,52,53,-48,-34]]},{"type":"Polygon","properties":{"name":"Pomoravski"},"id":"RS.RN","arcs":[[-45,54,55,56,-52]]},{"type":"Polygon","properties":{"name":"Raški"},"id":"RS.RS","arcs":[[-53,-57,57,-25,-40,58]]},{"type":"Polygon","properties":{"name":"Toplicki"},"id":"RS.TO","arcs":[[-44,59,60,-55]]},{"type":"Polygon","properties":{"name":"Grad Beograd"},"id":"RS.BG","arcs":[[-9,-50,61,62,63,-37,-12]]},{"type":"Polygon","properties":{"name":"Kolubarski"},"id":"RS.KB","arcs":[[-63,64,-41,-28,65]]},{"type":"Polygon","properties":{"name":"Macvanski"},"id":"RS.MA","arcs":[[-64,-66,-27,66,-38]]},{"type":"Polygon","properties":{"name":"Šumadijski"},"id":"RS.SU","arcs":[[-49,-54,-59,-42,-65,-62]]},{"type":"Polygon","properties":{"name":"Pcinjski"},"id":"RS.PC","arcs":[[67,68]]},{"type":"Polygon","properties":{"name":"Jablanicki"},"id":"RS.JA","arcs":[[-16,69,-69,70,-60,-43]]},{"type":"Polygon","properties":{"name":"Zajecarski"},"id":"RS.ZJ","arcs":[[71,-18,-47,-51,-20]]}]}},"arcs":[[[3066,8858],[-27,-5],[-27,-13],[19,-56],[12,-52],[-7,-55],[-39,-64],[-52,-45],[-3,-17],[46,-7],[71,3],[25,-9],[11,-29],[-10,-14],[-23,-18],[-23,-27],[-10,-37],[10,-29],[24,-27],[226,-156],[56,-57],[-67,-122],[30,-39],[82,-61],[37,-38],[-24,-17],[-16,-24],[-13,-25],[-14,-21],[40,-49],[118,-73],[25,-62],[16,-63],[-5,-34],[-66,-31],[-13,-35],[-5,-41],[-9,-32]],[[3461,7377],[-50,40],[-84,48],[-90,24],[-291,-24],[-54,5],[-137,31],[-28,-38],[-3,-3],[-1,-3],[0,-3],[2,-4],[5,-4],[10,-8],[4,-4],[1,-4],[-1,-3],[-2,-2],[-5,-4],[-11,-6],[-23,-12],[-7,-3],[-8,-3],[-9,-2],[-32,-4],[-11,-2],[-16,-3],[-41,-5],[-17,1],[-4,1],[-10,4],[-4,1],[-35,1],[-38,2],[-5,1],[-9,1],[-21,2],[-42,0],[-40,0],[-19,-1],[-9,-1],[-21,-5],[-5,-1],[-5,1],[-4,2],[-4,3],[-19,25],[-26,25],[-24,-17],[-13,-9],[-6,-3],[-6,-3],[-8,-1],[-32,-2],[-8,-1],[-6,-3],[-13,-6],[-17,-6],[-47,-13],[-140,1],[-30,0],[-9,-1],[-10,-1],[-34,-8],[-8,0],[-7,0],[-25,6],[-35,9],[-25,6],[-9,1],[-29,2],[-10,1],[-5,2],[-11,4],[-17,12],[-5,2],[-6,2],[-7,1],[-16,3],[-6,1],[-6,2],[-6,5],[-12,10],[-2,1],[-56,4],[-10,1],[-6,2],[-5,2],[-13,9],[-5,2],[-6,1],[-3,0],[-9,-1],[-12,-4],[-5,-2],[-5,-3],[-3,-4],[-1,-5],[2,-6],[2,-2],[-28,-30],[-4,-4],[-6,-5],[-3,-2],[-2,-1],[-2,-1],[-2,0],[-2,-1],[-2,0],[-2,0],[-2,1],[-4,1],[-12,5],[-2,1],[-2,1],[-1,1],[-2,2],[-4,6],[-2,3],[-2,1],[-3,3],[-7,4],[-3,3],[-17,17],[-15,16]],[[1326,7455],[28,20],[6,60],[-26,51],[-46,16],[-37,47],[-485,94],[-90,33],[-63,55],[-6,24],[-2,28],[-8,25],[-24,10],[-100,0],[-48,8],[-42,23],[-36,33],[-31,40],[128,43],[21,26],[-14,30],[-47,37],[-22,17],[-16,47],[32,63],[20,-2]],[[418,8283],[0,-3],[-1,-6],[1,-4],[3,-5],[14,-9],[11,-9],[6,-4],[5,-1],[5,0],[6,2],[18,12],[5,2],[5,1],[8,1],[7,-1],[6,-1],[5,-2],[21,-15],[23,-11],[6,-2],[7,-2],[17,1],[7,-1],[5,-1],[4,-2],[3,-3],[3,-4],[5,-17],[3,-4],[3,-3],[4,-3],[9,-5],[5,-2],[8,-2],[19,-1],[27,1],[9,1],[9,1],[15,7],[8,2],[7,0],[5,0],[6,-2],[43,-17],[10,-5],[6,-7],[4,-7],[1,-5],[0,-7],[1,-6],[2,-3],[5,-6],[4,-3],[4,-2],[5,0],[6,1],[12,3],[9,2],[29,2],[9,2],[17,5],[13,5],[6,2],[7,1],[8,0],[10,-1],[7,-1],[7,1],[4,1],[4,2],[3,3],[1,4],[1,12],[4,7],[3,5],[5,4],[5,3],[7,1],[7,-1],[8,-4],[24,-20],[10,-13],[5,-5],[6,-4],[11,-4],[4,0],[7,0],[8,2],[16,6],[8,2],[9,1],[19,0],[20,0],[10,-1],[16,-3],[44,-9],[2,7],[7,17],[1,5],[0,7],[-1,6],[-4,7],[-4,6],[-14,15],[-3,6],[-1,5],[1,13],[-1,5],[-4,14],[-1,6],[1,11],[1,5],[3,5],[3,2],[30,15],[42,15],[15,3],[12,1],[-1,30],[-1,4],[-5,7],[-1,3],[-4,27],[43,10],[21,5],[6,2],[6,3],[15,9],[10,3],[9,2],[7,0],[5,-1],[12,-3],[31,-15],[4,-2],[17,-12],[5,-2],[5,-2],[6,-1],[7,0],[5,1],[11,4],[25,11],[14,8],[4,3],[3,3],[9,14],[12,14],[3,4],[2,4],[1,6],[3,18],[1,5],[4,8],[4,4],[5,5],[6,3],[5,1],[5,1],[26,-2],[16,1],[17,4],[4,2],[4,2],[4,4],[3,5],[1,7],[2,22],[2,14],[-1,6],[-1,3],[-8,11],[-7,14],[-1,4],[-1,6],[1,5],[3,5],[11,14],[5,5],[19,13],[3,4],[2,4],[7,18],[22,32]],[[1791,8695],[33,-14],[20,-8],[13,-7],[22,-14],[6,-4],[11,-5],[11,-4],[22,-4],[18,-5],[7,-2],[10,-4],[8,-4],[36,-18],[19,-12],[36,6],[14,3],[6,2],[6,2],[14,8],[5,2],[17,7],[17,6],[9,5],[4,3],[2,4],[2,4],[1,5],[0,6],[-1,6],[-3,8],[-2,14],[-1,14],[1,7],[1,7],[8,19],[8,12],[9,12],[14,15],[3,6],[3,7],[2,16],[-6,5],[-5,4],[-2,4],[-1,5],[2,3],[9,11],[8,13],[2,7],[0,8],[-2,8],[-10,15],[-11,22],[42,20],[13,4],[23,5],[20,6],[8,2],[9,0],[37,1],[17,1],[9,1],[20,7],[26,6],[8,3],[23,16],[8,5],[4,1]],[[2453,8979],[34,2],[10,1],[16,3],[19,2],[28,0],[18,-1],[9,-2],[28,-7],[8,-2],[38,-2],[9,-2],[27,-8],[23,-4],[12,-4],[28,-14],[11,-4],[10,-1],[19,-1],[117,-1],[18,-1],[26,-6],[8,-1],[10,-4],[10,-5],[7,-4],[10,-8],[12,-12],[11,-9],[13,-9],[16,-9],[4,-3],[4,-5]],[[6075,6579],[-99,-4],[-120,-29],[-113,-43],[-82,-47],[-22,-26],[-17,-28],[-21,-23],[-31,-9],[-61,3],[-32,-2],[-23,-10],[-61,-36],[-99,-12]],[[5294,6313],[-114,-13],[-257,-112],[-137,-30],[-76,10]],[[4710,6168],[-76,9],[-52,28],[-52,43],[-86,95],[-31,26],[-66,30],[-27,24],[-13,30],[0,29],[25,124],[-5,31],[-31,13],[-69,9],[4,40],[9,10],[3,6],[2,5],[0,5],[-2,6],[-4,5],[-5,6],[-12,10],[-15,16],[-19,15],[-14,8],[-7,4],[-5,2],[-21,5],[-12,3],[-25,11],[-30,9],[-11,5],[-14,7],[-21,16],[-13,10],[-5,6],[-12,14],[-3,5],[-2,6],[0,5],[2,14],[0,6],[-1,6],[-3,5],[-3,4],[-5,4],[-5,2],[-3,1],[-22,1],[-8,1],[-6,2],[-8,2],[-13,7],[-22,16],[-14,11],[-5,6],[-5,6],[-3,6],[-3,11],[-3,5],[-4,5],[-6,4],[-21,13],[-17,9],[-33,18],[-7,4],[-9,8],[-7,8],[-4,8],[-2,7],[-3,15],[-2,7],[-10,20],[-2,6],[0,6],[2,5],[7,11],[1,5],[0,6],[-2,4],[0,1]],[[3744,7185],[14,24],[19,13],[12,12],[17,8],[5,4],[23,25],[3,5],[2,6],[1,5],[0,5],[-2,5],[-7,7],[-3,4],[1,5],[4,6],[11,10],[5,3],[4,2],[17,5],[5,1],[6,4],[6,6],[3,4],[2,6],[-1,5],[-3,4],[-12,12],[-13,14],[-2,5],[-1,2],[3,6],[5,6],[21,20],[4,6],[6,10],[9,15],[7,9],[23,24],[4,6],[6,17],[3,5],[3,5],[5,3],[5,2],[4,0],[5,0],[5,-3],[2,-3],[2,-3],[1,-12],[2,-3],[3,-3],[4,-3],[5,-1],[7,-1],[7,1],[5,1],[5,2],[9,4],[9,4],[4,0],[5,0],[7,-2],[21,-14],[10,-3],[8,-1],[7,2],[6,4],[5,5],[8,8],[3,5],[4,17],[9,20],[3,5],[4,4],[9,4],[9,3],[14,3],[5,0],[7,-1],[7,-2],[33,-14],[9,-1],[9,-1],[28,-2],[9,-2],[17,-5],[33,-12],[21,-9],[15,-8],[14,-12],[8,-4],[45,-21],[6,-1],[7,-2],[5,-5],[5,-5],[11,-15],[25,-26],[18,-15],[4,-2],[5,-3],[5,0],[5,0],[4,2],[8,4],[4,3],[3,4],[3,4],[6,23],[8,14],[1,6],[0,12],[2,4],[2,3],[3,3],[12,8],[6,4],[5,2],[5,1],[16,3],[5,1],[9,4],[4,3],[4,4],[10,13],[4,4],[5,2],[19,6],[35,7],[8,4],[12,8],[4,4],[7,9],[7,6],[29,22],[9,5],[36,16],[-31,18],[-29,18],[-3,3],[-2,3],[1,3],[2,3],[5,4],[7,2],[40,10],[16,6],[7,3],[22,11],[27,17],[33,18],[51,27],[12,6],[15,5],[8,1],[9,1],[37,1],[9,0],[9,2],[27,7],[9,1],[19,1],[10,-1],[9,-2],[20,-6],[7,0],[50,7],[3,4],[14,15],[6,19],[1,2]],[[5246,7835],[114,-38],[25,-15],[20,-17],[22,-15],[28,-5],[23,9],[39,31],[25,5],[39,-22],[83,-90],[39,-35],[80,-42],[43,-13],[102,-2],[257,-60],[68,-28],[62,-37],[60,-54],[22,-20],[11,-33],[-9,-32],[-31,-20],[-30,-1],[-25,-9],[-21,-16],[-18,-21],[3,-4],[2,-15],[0,-19],[-2,-13],[-6,-10],[-21,-19],[-7,-10],[-10,-36],[-1,-18],[-8,-12],[-30,-19],[-25,-7],[-62,-3],[-24,-9],[-17,-20],[-12,-26],[5,-22],[33,-6],[41,-2],[7,-13],[-6,-17],[2,-13],[56,-29],[116,-15],[60,-22],[85,-25],[35,-23],[19,-41],[-6,-49],[-34,-22],[-99,-20],[-67,-8],[-141,5],[-64,-17],[-32,-21],[-22,-28],[-9,-35],[41,-13],[1,0]],[[3744,7185],[-3,3],[-22,12],[-21,13],[-8,4],[-12,4],[-10,4],[-10,2],[-19,0],[-30,-4]],[[3609,7223],[-120,132],[-28,22]],[[3066,8858],[50,9],[28,9],[38,28],[-2,17],[-19,15],[-17,25],[-3,38],[29,18],[5,3],[13,9],[19,-5],[10,-2],[11,-1],[52,-3],[30,-5],[19,-1],[19,0],[38,0],[19,1],[30,4],[29,3],[18,3],[33,4],[7,-1],[5,0],[20,-4],[7,-2],[13,-6],[7,-1],[3,0],[7,2],[15,6],[14,3],[9,2],[5,-1],[3,-1],[4,-3],[3,-5],[2,-7],[2,-15],[2,-7],[9,-22],[7,-23],[8,-12],[8,-11],[10,-20],[4,-5],[13,-13],[8,-11],[2,-5],[5,-17],[4,-5],[5,-4],[6,-3],[3,-1],[17,0],[7,0],[11,-3],[5,-2],[9,-6],[12,-9],[13,-9],[4,-4],[1,-4],[-1,-3],[-4,-4],[-16,-11],[-11,-10],[-4,-5],[-1,-5],[0,-13],[-1,-5],[-3,-5],[-6,-3],[-5,-2],[-6,0],[-7,-1],[-7,1],[-13,4],[-5,0],[-7,0],[-5,-3],[-10,-12],[-5,-2],[-11,-5],[-13,-10],[-7,-3],[-19,-6],[-11,-2],[-4,1],[-9,6],[-3,8],[1,7],[4,6],[7,7],[2,11],[0,5],[-2,2],[-4,0],[-26,-13],[-11,-12],[-2,-21],[13,-16],[17,-3],[14,-10],[9,-8],[5,-8],[1,-6],[-1,-5],[-2,-3],[-3,-4],[-6,-3],[-5,-2],[-6,0],[-24,-2],[-5,-1],[-4,-2],[-5,-4],[-2,-5],[-5,-22],[-5,-12],[-3,-7],[14,-5],[24,-4],[4,-2],[3,-2],[11,-12],[4,-4],[7,-3],[21,-6],[5,-1],[6,0],[5,1],[11,3],[16,4],[30,9],[15,4],[25,3],[14,3],[6,1],[20,9],[11,3],[9,1],[28,1],[66,-1],[18,0],[9,-1],[9,-2],[28,-8],[8,-1],[8,0],[17,0],[13,2],[31,6],[-14,14],[-6,7],[-4,7],[-5,10],[-3,4],[-17,15],[-4,9],[-7,17],[-12,15],[-3,6],[0,5],[0,3],[4,15],[2,5],[8,12],[6,17],[5,6],[9,7],[28,13],[13,5],[6,3],[12,11],[19,13],[16,12],[6,4],[4,1],[6,1],[7,0],[7,-1],[10,-3],[24,-8],[10,-3],[8,-1],[8,-1],[15,1],[21,3],[19,1],[9,1],[5,1],[4,2],[3,3],[1,5],[-2,14],[-1,16],[0,15],[0,16],[2,7],[8,25],[8,18],[6,7],[7,7],[26,15],[3,5],[2,5],[0,5],[-1,4],[-7,14],[-5,9],[-12,9],[-6,6],[-3,5],[0,3],[1,3],[5,3],[11,4],[6,3],[5,4],[3,3],[0,1]],[[4344,9038],[6,-17],[24,-29],[55,-52],[23,-35],[29,-19],[32,-5],[33,7],[30,18],[14,30],[21,21],[27,9],[30,-12],[20,-25],[-1,-23],[-9,-24],[-6,-26],[2,-132],[-7,-36],[-9,-22],[-27,-46],[-19,-64],[9,-41],[71,-90],[31,-59],[-6,-36],[-35,-26],[-55,-33],[16,-35],[35,-17],[43,-10],[40,-15],[35,-26],[79,-86],[156,-105],[93,-91],[37,-22],[85,-29]],[[8937,1616],[-2,1],[-40,5],[-11,2],[-18,3],[-9,3],[-19,6],[-9,1],[-9,1],[-19,-1],[-29,-4],[-9,0],[-18,0],[-9,0],[-8,2],[-20,6],[-7,2],[-22,3],[-6,2],[-5,2],[-13,7],[-4,2],[-17,6],[-14,6],[-9,7],[-9,9],[-12,8],[-4,5],[-8,14],[-4,5],[-3,2],[-9,4],[-15,5],[-8,3],[-7,3],[-25,15],[-18,12],[42,7],[28,6],[11,4],[7,3],[6,4],[5,5],[2,4],[1,5],[-2,5],[-3,5],[-4,5],[-7,6],[-12,8],[-26,14],[-7,3],[-30,12],[-6,2],[-7,2],[-8,0],[-19,-1],[-5,0],[-6,2],[-7,3],[-13,8],[-21,9],[-18,9],[-48,18],[-23,8],[-10,3],[-9,1],[-9,0],[-10,0],[-9,-1],[-14,-3],[-7,0],[-6,2],[-7,3],[-8,5],[-11,11],[-6,4],[-7,4],[-9,3],[-9,2],[-29,3],[-12,3],[-6,3],[-20,10],[-7,4],[-5,4],[-3,5],[-1,5],[1,4],[4,5],[33,20],[5,5],[5,6],[5,4],[4,3],[16,7],[7,2],[18,5],[5,2],[5,4],[11,11],[17,12],[3,2],[1,3],[0,2],[-3,4],[-25,17],[-15,9],[-16,13]],[[8186,2130],[0,4],[6,20],[3,4],[3,4],[5,3],[14,7],[16,6],[18,6],[7,3],[13,8],[40,16],[24,10],[-33,51],[-5,5],[-8,7],[-3,4],[0,1],[5,11],[0,4],[-2,4],[-3,2],[-16,10],[-6,3],[-7,3],[-7,1],[-3,0],[-8,-2],[-15,-6],[-9,-1],[-10,-1],[-10,0],[-9,2],[-10,3],[-10,4],[-6,4],[-5,5],[-13,15],[-5,3],[-4,2],[-4,0],[-9,0],[-7,0],[-6,1],[-5,2],[-7,3],[-12,7],[-17,12],[-16,14],[-9,6],[-4,2],[-6,2],[-22,4],[-7,1],[-6,3],[-23,11],[-21,14],[-5,3],[-52,17],[14,24],[15,25],[12,15],[3,5],[0,5],[-5,19],[1,5],[2,4],[4,4],[13,9],[3,4],[3,4],[4,9],[3,3],[4,4],[8,3],[7,2],[16,-1],[4,1],[4,1],[5,3],[3,4],[5,9],[1,5],[0,2],[-4,10],[-1,3],[-1,12],[-1,4],[-1,3],[-5,3],[-17,8],[-10,5],[-5,4],[-4,5],[-2,5],[0,5],[3,12],[0,6],[-2,5],[-9,20],[-2,7],[-4,30],[-6,25],[30,8],[26,7],[10,2],[7,1],[5,-1],[20,-3],[25,-4],[23,-2],[8,-1],[11,-4],[7,-3],[22,-13],[7,-3],[11,-4],[22,-3],[11,-3],[6,-3],[15,-8],[4,-2],[15,-5],[7,-1],[7,0],[16,0],[18,3],[19,1],[49,1],[10,0],[9,1],[24,6],[6,1],[4,3],[4,3],[3,4],[4,16],[9,20],[1,5],[0,6],[-2,13],[0,5],[1,5],[3,6],[7,9],[2,4],[1,4],[-1,14],[-4,31]],[[8435,2913],[55,-17],[6,-2],[12,-8],[9,-5],[11,-4],[21,-5],[24,-9],[11,-2],[7,0],[14,2],[7,0],[9,-3],[5,-2],[13,-8],[57,-33],[2,2],[6,2],[8,1],[23,-1],[8,1],[5,0],[5,2],[7,4],[6,6],[9,12],[12,22],[4,3],[3,2],[4,1],[6,-1],[4,-1],[3,-2],[7,-7],[5,-6],[12,-18],[6,-7],[25,-17],[13,-15],[9,-6],[20,-8],[16,-7],[5,-1],[24,-1],[8,-1],[42,-8],[7,0],[5,0],[4,1],[4,3],[2,3],[-1,3],[-1,5],[-7,16],[-1,3],[1,5],[3,6],[6,5],[13,11],[36,27],[10,5],[29,9],[5,2],[6,4],[5,4],[13,13],[11,13],[10,10],[12,10],[18,16],[2,2],[17,17]],[[9212,2961],[14,-12],[23,-6],[46,1],[24,-2],[39,-13],[12,-7],[21,-11],[173,-134],[31,-34],[8,-20],[8,-47],[7,-20],[15,-17],[59,-45],[64,-67],[33,-26],[43,-20],[119,-20],[40,-14],[4,-29],[4,-33],[-25,-84],[-45,-84],[-49,-58],[-20,-11],[-41,-15],[-20,-14],[-12,-18],[-18,-46],[-12,-20],[-102,-74],[-32,-35],[0,-1],[-32,-9],[-67,-12],[-28,-13],[-17,-22],[-15,-32],[-42,-123],[-15,-29],[-2,-3],[-28,-27],[-74,-24],[-73,-14],[-182,38],[-66,-7],[-33,-17],[-12,-15]],[[8746,4525],[1,1],[1,1],[-4,11],[-2,4],[-3,4],[-5,4],[-12,5],[-5,3],[-2,4],[-1,5],[0,5],[2,7],[0,6],[-1,5],[-7,16],[-3,10],[-1,5],[1,4],[1,3],[3,3],[4,2],[8,4],[16,5],[6,4],[4,3],[13,15],[12,10],[6,7],[6,7],[4,8],[1,4],[0,5],[-2,4],[-12,18],[-9,18],[-7,7],[-5,4],[-4,2],[-5,1],[-30,3],[-25,6],[-25,6],[-16,5],[-5,2],[-4,3],[-3,3],[-11,18],[-8,8],[-6,5],[-27,14],[-6,3],[-12,3],[-17,2],[-19,0],[-18,0],[-9,-1],[-8,-1],[-10,-3],[-9,-4],[-6,-4],[-13,-11],[-6,-3],[-7,-2],[-7,0],[-8,0],[-7,1],[-27,7],[-8,2],[-46,2],[-8,2],[-19,5],[-7,1],[-9,0],[-7,0],[-6,1],[-5,2],[-7,3],[-6,4],[-35,25],[-23,14],[-13,13],[-14,16],[-7,-9],[-5,-8],[-6,-13],[-3,-12],[-3,-6],[-4,-5],[-14,-16],[-6,-10],[-3,-3],[-9,-7],[-8,-4],[-6,-4],[-3,-3],[-19,-24],[-3,-5],[-1,-6],[2,-6],[4,-5],[3,-3],[10,-6],[18,-7],[8,-4],[5,-3],[5,-4],[3,-5],[3,-6],[1,-15],[-1,-23],[-2,-17],[0,-4],[1,-4],[2,-3],[16,-13],[4,-6],[2,-5],[5,-16],[2,-4],[3,-4],[17,-14],[4,-5],[2,-5],[1,-6],[-1,-6],[-3,-13],[-1,-5],[-1,-6],[1,-5],[2,-8],[1,-6],[0,-5],[-2,-5],[-4,-7],[-4,-5],[-4,-3],[-5,-2],[-5,-1],[-14,-2],[-12,-3],[-9,-3],[-4,-2],[-4,-4],[-3,-6],[-4,-16],[-2,-5],[-5,-6],[-5,-6],[-19,-15],[-5,-6],[-8,-12],[-6,-16],[-4,-7],[-4,-5],[-5,-6],[-17,-15],[-4,-5],[-8,-15],[-8,-16],[-2,-5],[0,-5],[5,-20],[0,-15],[-2,-7],[-5,-13],[-2,-5],[-7,-12],[-3,-5],[-5,-4],[-4,-2],[-30,-11],[-19,-4],[-5,-1],[-5,-3],[-2,-3],[-5,-8],[-10,-17],[-3,-5],[-3,-9],[-3,-14],[-10,5],[-16,9],[-18,14],[-6,2],[-14,4],[-43,14],[-13,4],[-13,6],[-10,5],[-3,3],[-4,4],[-2,5],[-4,17],[-3,10],[-2,4],[-9,9],[-2,4],[-1,4],[0,12],[-2,5],[-3,5],[-15,16],[-4,6],[-7,16],[-3,5],[-4,4],[-4,2],[-5,1],[-7,1],[-7,0],[-12,-1],[-5,-1],[-5,-3],[-13,-19],[-5,-5],[-8,-8],[-4,-2],[-6,-2],[-7,0],[-24,6],[-5,2],[-5,2],[-13,7],[-11,4],[-10,1],[-19,2],[-10,1],[-5,1],[-6,2],[-7,4],[-20,10],[-4,2],[-5,4],[-16,17],[-13,10],[-9,5],[-21,7],[-5,3],[-3,3],[-4,8],[-8,10],[-15,14],[-5,4],[-4,1],[-5,2],[-22,3],[-17,5],[-9,2],[-7,0],[-17,-3],[-34,-10],[-9,-1],[-10,-1],[-10,1],[-10,1],[-6,1],[-5,2],[-19,8],[-11,3],[-8,0],[-7,0],[-10,-3],[-18,-7],[-8,-1],[-6,0],[-6,0],[-30,6],[-14,2]],[[7071,4460],[1,30],[2,11],[2,5],[5,5],[5,4],[10,6],[4,3],[2,4],[2,5],[1,7],[2,21],[2,8],[5,3],[4,2],[12,2],[10,4],[7,3],[6,4],[5,4],[4,5],[1,5],[1,8],[1,5],[1,4],[15,29]],[[7181,4647],[3,0],[8,1],[5,1],[21,6],[8,0],[8,0],[18,-2],[7,0],[6,1],[5,1],[6,4],[8,5],[16,16],[6,4],[26,15],[12,6],[14,6],[17,6],[11,4],[5,1],[9,1],[10,1],[49,-1],[19,1],[9,1],[6,2],[5,2],[4,3],[7,6],[12,14],[4,5],[1,3],[-1,5],[-3,5],[-18,13],[-3,4],[-2,4],[-2,6],[-3,22],[-2,6],[-5,9],[-1,5],[1,3],[2,4],[5,4],[12,8],[6,5],[5,7],[2,5],[0,6],[0,6],[-3,8],[-2,13],[-1,24],[2,12],[4,13],[1,7],[0,6],[0,6],[-4,10],[-9,16],[-4,9],[-1,4],[0,5],[1,4],[3,3],[9,10],[2,3],[0,4],[0,3],[-3,5],[-4,2],[-4,3],[-9,2],[-6,0],[-5,-1],[-10,-3],[-5,-3],[-6,-4],[-6,-4],[-16,-17],[-10,-8],[-5,-4],[-6,-3],[-4,0],[-4,0],[-6,3],[-6,5],[-10,9],[-16,10],[-3,3],[-3,4],[-1,5],[0,11],[3,14],[2,7],[0,7],[0,7],[-2,7],[-4,9],[0,3],[0,8],[3,12],[0,5],[-6,20],[0,5],[1,12],[-1,6],[-6,12],[-6,8],[-23,19],[-8,5],[-11,3],[-15,3],[-9,3],[-13,9],[-6,2],[-7,2],[-7,1],[-8,0],[-8,-1],[-34,-8],[-28,-5],[-7,14],[-12,19],[-2,5],[0,6],[3,5],[8,10],[3,5],[1,6],[-1,5],[-4,6],[-7,8],[-22,13],[-4,3],[-3,4],[-2,4],[-2,7],[-1,13],[1,14],[2,7],[4,7],[6,6],[6,4],[17,7],[6,3],[5,5],[3,5],[5,7],[2,6],[2,28],[2,7],[2,4],[3,3],[4,3],[9,5],[4,1],[8,1],[7,0],[7,-1],[23,-8],[5,-1],[7,1],[4,1],[4,3],[4,3],[2,3],[12,21],[3,3],[5,4],[8,5],[5,5],[6,6],[7,10],[3,3],[9,7],[6,3],[6,2],[5,1],[8,0],[17,-3],[8,0],[16,0],[7,0],[5,1],[5,2],[4,4],[4,4],[10,20],[2,5],[0,5],[-2,7],[-4,11],[-11,20],[-2,6],[0,5],[0,6],[1,6],[2,4],[3,4],[10,10],[2,3],[2,5],[5,17],[3,9],[3,4],[9,10],[2,4],[1,4],[1,12],[1,8],[-1,8],[-3,7],[-4,7],[-6,7],[7,6],[7,5],[7,3],[13,3],[15,2],[4,1],[4,1],[4,4],[1,4],[1,12],[1,5],[4,6],[9,10],[21,19],[20,14],[23,19],[32,26],[38,30],[45,21],[1,0]],[[7708,5977],[9,-32],[13,-19],[25,-18],[28,-13],[22,-16],[26,-74],[42,-31],[54,-17],[52,-5],[58,11],[31,25],[275,372],[14,40],[36,20],[100,17],[47,22],[84,69],[26,15],[59,-2],[45,-7],[35,-16],[168,-139],[83,-50],[81,-30],[191,-18],[35,-19],[122,-102],[-14,-46],[-43,-33],[-54,-19],[-46,-6],[-52,9],[-88,45],[-51,16],[-50,1],[-48,-11],[-36,-25],[-14,-43],[-8,-44],[-19,-24],[-32,-11],[-85,-3],[-22,-5],[-17,-12],[-10,-23],[-6,-35],[-1,-33],[7,-20],[51,-36],[11,-17],[2,-19],[-6,-40],[3,-20],[42,-73],[65,-67],[81,-52],[92,-31],[100,-11],[46,-16],[19,-35],[-10,-122],[13,-37],[2,-2],[-103,-36],[-21,-17],[-37,-46],[-39,-34],[-6,-3],[-3,-16],[3,-13],[4,-8],[4,0],[-25,-76],[-5,-28],[3,-25],[15,-54],[1,-22],[-29,-39],[-43,-7],[-50,3],[-49,-13],[-28,-32],[-18,-37],[-28,-26],[-53,-1],[-38,-5]],[[2940,4697],[4,-9],[15,-27],[3,-9],[-1,-6],[-4,-6],[-16,-17],[-7,-12],[-2,-6],[1,-5],[1,-5],[7,-13],[1,-7],[-1,-3],[-3,-4],[-10,-9],[-2,-3],[-2,-5],[-1,-3],[1,-3],[2,-5],[5,-4],[5,-5],[21,-12],[6,-4],[4,-5],[3,-5],[0,-5],[-2,-5],[-7,-10],[-5,-4],[-17,-14],[-3,-3],[-3,-5],[-8,-20],[-1,-3],[1,-3],[1,-3],[5,-3],[19,-5],[4,-2],[3,-3],[0,-4],[-2,-3],[-7,-9],[-2,-3],[-1,-4],[1,-5],[3,-5],[5,-4],[7,-4],[40,-20],[10,-2],[11,-1],[8,-17],[9,-14],[3,-7],[-1,-5],[-2,-5],[-4,-4],[-7,-8],[-5,-3],[-15,-7],[-5,-4],[-2,-3],[-1,-4],[0,-5],[2,-5],[3,-5],[25,-28],[4,-3],[23,-13],[14,-10],[29,-13],[26,-8],[40,-14],[-29,-6],[-19,-3],[-18,0],[-28,2],[-5,-1],[-6,-1],[-6,-3],[-9,-8],[-3,-3],[-6,-10],[-5,-5],[-17,-13],[-3,-4],[-5,-9],[-5,-13],[-1,-6],[1,-5],[1,-6],[5,-6],[8,-7],[4,-2],[17,-6],[4,-2],[3,-4],[3,-5],[1,-5],[0,-6],[-1,-5],[-3,-7],[-1,-8],[1,-3],[3,-4],[17,-19],[5,-3],[16,-8],[9,-7],[7,-8],[3,-8],[1,-5],[-1,-3],[-1,-4],[-5,-4],[-8,-6],[-5,-5],[-3,-4],[-3,-6],[-1,-5],[0,-3],[6,-17],[2,-6],[0,-6],[-2,-14],[-1,-9],[1,-5],[5,-12],[-1,-12],[2,-4],[2,-4],[5,-4],[5,-3],[16,-8],[18,-10],[15,-7],[32,-10],[5,-4],[1,-3],[1,-4],[1,-17],[2,-4],[5,-10],[1,-3],[-1,-7],[-2,-5],[-9,-14],[-7,-16],[-3,-4],[-2,-4],[-10,-9],[-3,-3],[-1,-5],[0,-3],[2,-4],[5,-5],[5,-4],[26,-15],[9,-7],[2,-4],[2,-4],[1,-5],[-1,-4],[-2,-7],[-2,-3],[-5,-6],[-3,-5],[-3,-6],[-5,-14],[-2,-5],[-3,-4],[-3,-3],[-6,-5],[-7,-3],[-5,-1],[-5,0],[-7,2],[-13,5],[-24,12],[-7,3],[-8,2],[-12,2],[-33,4],[-7,0],[-17,-5],[-8,0],[-12,2],[-8,6],[-1,0],[-3,0],[-7,1],[-3,-1],[-1,0],[-1,-1],[0,-1],[0,-2],[0,-2],[0,-2],[1,-1],[1,-2],[6,-7],[0,-32],[-2,-16],[0,-5],[3,-11],[-1,-4],[-3,-5],[-5,-5],[-6,-4],[-6,-3],[-5,-3],[-13,-3],[-10,-1],[-7,0],[-5,1],[-11,3],[-13,5],[-6,2],[-7,0],[-5,0],[-6,-1],[-6,-3],[-14,-9],[-35,-26],[-13,-9],[-12,-5],[-18,-6],[-5,-3],[-4,-3],[-38,-32],[-10,-17],[-4,-4],[-4,-2],[-18,-5],[-23,-7],[-7,-1],[-10,2],[-9,4],[-16,12],[-34,20],[-39,19],[-5,-16],[-1,-7],[0,-8],[1,-6],[1,-4],[8,-14],[2,-5],[0,-6],[-2,-3],[-2,-4],[-3,-3],[-5,-2],[-18,-8],[-6,-4],[-4,-5],[-3,-5],[0,-4],[2,-5],[13,-16],[8,-15],[4,-6],[11,-9],[13,-8],[7,-4],[12,-3],[9,-1],[20,-2],[9,-1],[9,-2],[21,-9],[4,-3],[4,-4],[3,-5],[4,-10],[3,-5],[4,-4],[4,-1],[5,-2],[8,-1],[28,0],[18,-2],[23,-5],[4,-2],[6,-4],[5,-6],[3,-7],[4,-21],[3,-5],[3,-5],[10,-8],[2,-3],[3,-5],[0,-6],[-6,-19],[0,-7],[1,-7],[1,-7],[16,-26],[9,-12],[5,-5],[10,-9],[3,-4],[-1,-2],[-2,0],[18,-23],[19,-18],[11,-13],[4,-5],[6,-16],[2,-5],[5,-6],[5,-5],[19,-16],[24,-24],[3,-5],[2,-5],[0,-7],[1,-5],[3,-5],[11,-15],[6,-13],[4,-5],[20,-19],[4,-5],[1,-5],[0,-5],[-2,-5],[-3,-4],[-7,-5],[-4,-4],[-2,-4],[0,-3],[0,-5],[4,-7],[3,-5],[7,-6],[10,-7],[16,-8],[7,-4],[18,-15],[4,-3],[7,-2],[4,-1],[5,1],[6,2],[18,8],[5,2],[15,1],[28,2],[9,2],[17,5],[19,7],[9,2],[10,0],[40,1],[9,1],[10,1],[27,7],[28,4],[8,2],[14,5],[6,2],[3,0],[7,-1],[18,-5],[5,-2],[5,-4],[7,-6],[13,-10],[3,-6],[3,-6],[1,-9]],[[3436,2700],[-18,-18],[-27,-29],[-7,-15],[-10,-15],[-6,-15],[-10,-20],[-1,-7],[-2,-25],[-3,-6],[-3,-4],[-9,-6],[-22,-12],[-17,-9],[-16,-9],[-4,-3],[-3,-4],[-2,-4],[0,-2],[1,-5],[7,-21],[3,-5],[4,-4],[5,-2],[17,-5],[5,-3],[6,-3],[6,-4],[6,-7],[8,-15],[4,-5],[7,-3],[10,-4],[15,-3],[5,-2],[5,-2],[18,-13],[7,-3],[14,-4],[6,-3],[6,-4],[4,-5],[7,-10],[5,-7],[6,-7],[8,-8],[-40,-6],[-32,-2],[-14,-3],[-6,-2],[-19,-8],[-23,-8],[-5,-2],[-13,-7],[-11,-4],[-9,-1],[-9,0],[-30,0],[-29,0],[-27,3],[-5,0],[-4,-1],[-5,-3],[-19,-19],[-4,-5],[-7,-9],[-5,-4],[-18,-12],[-5,-4],[-4,-4],[-3,-5],[0,-5],[3,-5],[8,-12],[2,-5],[0,-6],[-1,-5],[-2,-3],[-2,-4],[-4,-2],[-5,-2],[-4,-1],[-7,0],[-14,3],[-7,0],[-12,-2],[-7,-2],[-15,-7],[-20,-6],[-5,-2],[-7,-4],[-5,-4],[-13,-13],[-15,-19],[-9,-13],[-10,-17],[-2,-4],[-10,-10],[-5,-8],[-15,-30],[-1,-6],[-3,-21],[-3,-6],[-4,-6],[-10,-8]],[[2921,1999],[-83,63],[-145,80],[-24,18],[-19,25],[-13,26],[-18,20],[-30,8],[-23,-9],[-57,-45],[-28,-13],[-82,-6],[-80,4],[-56,17],[-50,31],[-44,45],[-71,100],[-19,1],[-20,-15],[-31,-9],[-52,4],[-107,25],[-50,20],[-42,30],[-74,75],[-5,4],[-86,55],[-24,29],[-42,71],[-29,34],[-142,114],[-101,116],[-41,23],[-331,114],[-63,42],[-40,67],[-1,73],[48,59],[54,0],[29,43],[22,56],[34,42],[26,6],[62,-7],[28,1],[29,12],[56,34],[26,6],[40,-19],[41,-40],[35,-49],[20,-43],[19,-22],[20,21],[30,56],[30,2],[91,-28],[19,9],[5,11],[-6,11],[-18,13],[-12,26],[-3,36],[5,36],[10,31],[62,46],[-4,67],[-58,141],[-48,84],[-247,203],[-130,159],[-73,72],[-83,49],[-29,13],[28,21],[5,18],[-11,31],[-1,19],[14,24],[20,14],[50,12],[35,2],[32,-9],[62,-33],[62,-44],[31,-15],[35,1],[36,8],[128,7],[138,-10],[59,4],[57,16],[100,56],[41,35],[20,41],[-18,48],[-30,20],[-22,-5],[-14,-16],[-9,-7],[-22,14],[-40,37],[-79,34],[-14,16]],[[1621,4712],[17,3],[10,3],[6,4],[6,6],[20,28],[6,7],[7,6],[5,3],[5,2],[22,4],[5,1],[24,9],[6,1],[7,1],[5,-1],[19,-4],[10,-3],[13,-2],[7,0],[10,3],[5,2],[6,4],[4,5],[8,15],[12,15],[3,6],[0,7],[-1,8]],[[1868,4845],[21,3],[9,1],[7,-1],[6,-1],[5,-1],[24,-9],[20,-4],[4,-2],[3,-2],[12,-14],[16,-13],[5,-2],[6,-2],[29,-6],[5,0],[15,-3],[11,-2],[10,-4],[4,-3],[7,-4],[16,-14],[6,-4],[7,-4],[11,-2],[21,1],[9,-2],[4,-2],[4,-3],[12,-13],[15,-10],[7,-6],[7,-9],[5,-10],[4,-7],[3,-4],[18,-14],[8,-9],[4,-7],[1,-5],[0,-6],[-4,-9],[-1,-4],[1,-3],[4,-7],[3,-3],[4,-2],[5,-2],[10,-1],[19,-2],[15,0],[7,1],[5,1],[5,2],[4,3],[3,3],[2,4],[2,6],[1,7],[0,14],[-3,14],[-9,25],[-17,30],[-5,7],[-8,7],[-7,3],[-9,5],[-13,6],[-13,9],[-4,3],[-2,3],[-1,3],[0,3],[2,3],[3,3],[6,3],[11,5],[10,2],[7,1],[8,0],[7,-1],[5,-1],[5,-2],[5,-3],[15,-13],[9,-6],[17,-7],[18,-8],[6,-1],[6,1],[3,3],[15,12],[5,4],[9,3],[13,3],[5,1],[4,2],[4,4],[3,5],[5,16],[2,4],[3,3],[4,2],[5,1],[7,0],[48,-3],[15,-3],[6,-2],[13,-6],[16,-9],[3,-2],[2,-4],[1,-5],[-1,-4],[-4,-5],[-6,-5],[-4,-3],[-1,-4],[0,-3],[2,-6],[3,-5],[4,-5],[10,-9],[11,-9],[4,-3],[5,-2],[19,-5],[16,-7],[17,-7],[6,-3],[12,-8],[4,-2],[8,-2],[30,-3],[18,-2],[9,-2],[6,21],[2,5],[2,3],[3,5],[2,3],[1,1],[2,1],[1,1],[4,2],[6,2],[4,2],[2,1],[7,5],[4,2],[31,18],[7,-8],[3,-3],[7,-4],[6,-1],[5,-1],[28,-1],[10,-2],[4,-1],[14,-8],[7,-2],[36,-17]],[[418,8283],[143,-16],[70,51],[-27,37],[-31,13],[-35,5],[-40,14],[-25,16],[-10,11],[-8,13],[-15,20],[-22,12],[-21,-4],[-21,-11],[-42,-17],[-24,-21],[-32,-18],[-44,-1],[-24,17],[-48,58],[-20,12],[8,22],[3,47],[10,48],[29,22],[26,14],[67,68],[13,22],[-14,36],[-35,23],[-41,17],[-33,20],[-20,32],[-10,77],[-12,39],[-70,63],[-17,22],[-37,28],[-9,16],[4,11],[9,10],[5,15],[7,70],[77,5],[30,5],[18,16],[-7,20],[-26,21],[-50,29],[22,18],[19,14],[42,20],[-14,39],[148,-8],[47,-16],[13,5],[3,8],[-5,11],[-19,22],[-2,9],[2,10],[8,9],[57,30],[61,-7],[43,9],[3,75],[37,48],[56,17],[55,-14],[35,-50],[0,-1],[54,-23],[212,-16],[67,9],[27,26],[12,31],[17,32],[28,15]],[[1095,9614],[5,-6],[6,-5],[17,-11],[5,-4],[4,-5],[6,-14],[4,-6],[17,-20],[4,-4],[4,-1],[20,-1],[5,-1],[3,-2],[3,-3],[1,-4],[-1,-3],[-5,-16],[0,-6],[1,-6],[17,-35],[1,-2],[-1,-4],[-1,-3],[-2,-4],[-3,-4],[-5,-5],[-9,-5],[-6,-5],[-6,-7],[-3,-7],[-2,-6],[0,-6],[1,-6],[2,-5],[4,-6],[13,-16],[8,-16],[9,-17],[4,-11],[1,-14],[2,-25],[-2,-19],[1,-5],[4,-12],[1,-5],[1,-6],[-2,-13],[0,-6],[1,-5],[4,-6],[5,-5],[12,-11],[15,-15],[21,-18],[9,-6],[28,-12],[12,-6],[11,-8],[15,-15],[8,-6],[24,-18],[2,-2],[4,-6],[15,-15],[6,-6],[3,-6],[0,-5],[-8,-18],[0,-5],[1,-4],[2,-4],[12,-10],[4,-4],[4,-5],[1,-5],[0,-13],[1,-5],[4,-5],[6,-4],[34,-18],[21,-12],[24,-12],[13,-8],[5,-3],[10,-3],[5,-1],[5,0],[5,1],[7,3],[11,8],[5,5],[13,14],[11,8],[6,4],[7,4],[6,2],[6,1],[7,0],[8,0],[6,-1],[5,-2],[8,-4],[13,-9],[27,-21],[11,-5],[23,-8],[16,-7],[9,-5],[-10,-10],[-28,-23],[-7,-6],[-5,-5],[-3,-6],[-1,-5],[1,-4],[3,-9],[3,-5],[5,-5],[6,-5],[27,-15],[13,-5],[29,-6],[9,-3],[9,-6],[7,-7],[8,-14],[13,-15],[2,-4],[2,-5],[0,-6],[-3,-6],[-6,-4],[-22,-10],[-31,-15]],[[2485,9946],[3,-2],[4,-4],[6,-7],[2,-3],[1,-6],[-1,-5],[-5,-13],[-7,-7],[-15,-10],[-22,-13],[-7,-4],[-5,-4],[-6,-7],[-2,-5],[0,-6],[1,-6],[7,-25],[3,-6],[8,-14],[1,-6],[0,-5],[-4,-11],[0,-6],[0,-18],[-1,-14],[-3,-7],[-16,-22],[-2,-7],[-3,-14],[-3,-7],[-6,-7],[-6,-4],[-6,-4],[-21,-8],[-6,-4],[-7,-6],[-9,-9],[-7,-9],[-6,-11],[-4,-5],[-13,-13],[-2,-3],[-1,-2],[-2,-15],[-9,-14],[-1,-5],[0,-13],[-1,-5],[-7,-14],[0,-5],[5,-30],[5,-15],[1,-12],[0,-7],[-1,-5],[-9,-23],[0,-7],[2,-17],[4,-8],[4,-7],[6,-18],[3,-8],[1,-6],[-2,-5],[-1,-3],[-3,-2],[-6,-2],[-13,-4],[-7,-3],[-14,-10],[-10,-4],[-16,-8],[-15,-6],[-17,-6],[51,-55],[15,-19],[4,-5],[6,-17],[2,-6],[5,-6],[15,-16],[4,-5],[1,-5],[-3,-20],[1,-12],[1,-5],[2,-4],[4,-8],[3,-3],[6,-4],[5,-1],[6,0],[15,0],[25,2],[26,-51],[9,-11],[15,-14],[2,-4],[2,-4],[0,-5],[-3,-14],[0,-6],[2,-6],[8,-18],[2,-9]],[[1095,9614],[21,11],[44,7],[89,1],[41,10],[24,20],[18,25],[20,23],[30,10],[27,3],[21,6],[40,24],[18,18],[12,19],[17,17],[64,25],[-7,21],[-18,24],[-4,20],[35,29],[56,28],[60,19],[45,6],[51,-1],[140,20],[52,-2],[50,-12],[53,-24],[148,-69],[42,-7],[201,61]],[[2485,9946],[37,11],[97,16],[154,-11],[101,-41],[69,5],[61,23],[24,2],[39,-7],[13,-8],[25,-25],[18,-7],[18,2],[61,21],[43,-13],[131,-82],[152,-138],[29,-38],[51,-117],[37,-41],[41,-22],[95,-31],[45,-23],[127,-86],[44,-15],[92,-8],[46,-13],[37,-27],[80,-106],[17,-12],[42,-21],[17,-15],[8,-22],[5,-51],[3,-8]],[[7181,4647],[-22,9],[-25,14],[-7,1],[-8,0],[-27,-10],[-7,-1],[-7,-1],[-5,1],[-12,2],[-16,6],[-13,6],[-14,13],[-13,13],[-5,4],[-4,2],[-12,2],[-25,3],[-7,0],[-5,-1],[-5,-2],[-18,-10],[-14,-6],[-7,-1],[-12,-2],[-10,1],[-14,5],[-19,5],[-4,2],[-6,3],[-5,4],[-2,4],[-5,18],[-3,5],[-4,4],[-27,16],[-8,3],[-11,4],[-12,3],[-12,2],[-8,0],[-18,-2],[-15,0],[-7,1],[-27,6],[-10,1],[-9,0],[-9,-2],[-14,-4],[-6,-2],[-3,0],[-7,1],[-7,2],[-25,9],[-19,2],[-11,3],[-9,5],[-4,3],[-2,4],[-3,8],[-7,17],[-4,14],[-1,4],[-5,4],[-8,5],[-15,6],[-6,4],[-6,6],[-11,11],[-9,6],[-18,11],[-33,23],[-17,17],[-12,11],[-15,-5],[-15,-2],[-13,-1],[-6,0],[-6,1],[-5,2],[-17,8],[-6,4],[-15,14],[-6,4],[-5,2],[-10,4],[-5,1],[-6,1],[-49,-4],[-9,-1],[-6,-2],[-6,-2],[-7,-4],[-5,-4],[-4,-4],[-5,-9],[-4,-4],[-3,-1],[-29,0],[-9,0],[-20,-2],[-8,0],[-7,0],[-5,2],[-9,4],[-4,3],[-4,6],[-1,4],[2,4],[12,12],[5,6],[7,17],[9,14],[1,5],[-1,5],[-2,4],[-4,4],[-5,3],[-5,1],[-20,3],[-7,1],[-9,4],[-6,4],[-8,12],[-12,15],[-4,6],[-1,5],[0,5],[2,8],[0,5],[-1,5],[-4,8],[-5,8],[-5,5],[-7,4],[-26,16],[-54,34],[-10,-21],[-8,-13],[-4,-6],[-6,-20],[-5,-8],[-7,-7],[-19,-16],[-3,-2],[-4,-1],[-4,0],[-7,1],[-19,8],[-6,2],[-13,3],[-24,2],[-8,1],[-5,2],[-5,2],[-5,2],[-9,8],[-10,10],[-4,6],[-2,5],[-4,16],[-3,5],[-3,2],[-28,16],[-24,11],[-6,2],[-8,2],[-23,2],[-7,1],[-7,2],[-5,3],[-10,7],[-6,3],[-9,2],[-9,1],[-12,0],[-32,-5]],[[5529,5208],[-34,15],[0,17],[16,0],[0,16],[-16,0],[0,19],[42,-3],[19,14],[-8,21],[-37,18],[12,32],[-11,15],[-19,10],[-15,14],[-6,26],[2,14],[9,16],[12,30],[10,42],[17,38],[37,23],[68,1],[-8,19],[-14,14],[-20,10],[-24,9],[18,52],[18,-10],[7,1],[7,5],[16,4],[-13,5],[-7,6],[-10,5],[-18,3],[10,40],[5,12],[-15,0],[-18,-9],[-11,24],[-18,29],[-37,8],[0,18],[34,24],[16,25],[-1,32],[-16,40],[-19,33],[-19,16],[-30,4],[-49,1],[6,48],[-52,61],[31,29],[-12,13],[-36,27],[-19,11],[4,11],[8,31],[6,11],[-27,3],[-17,13],[-8,23],[-1,26]],[[6075,6579],[1,-1],[44,-24],[42,-67],[39,-14],[205,-17],[148,9],[48,-10],[42,-30],[21,-41],[14,-45],[23,-46],[89,-67],[118,-27],[124,1],[109,17],[88,28],[42,9],[40,-7],[218,-85],[77,-10],[24,-17],[68,-123],[5,-18],[4,-17]],[[3609,7223],[16,-18],[27,-98],[-57,-61],[-71,-42],[-14,-42],[-18,0],[30,-58],[38,-51],[14,-14],[-106,-25],[-54,-9],[-29,-1],[-8,0],[-10,-3],[-7,-3],[-15,-9],[-16,-8],[-18,-13],[-31,-18],[-5,-3],[-7,-2],[-7,-1],[-19,0],[-19,1],[-20,3],[-7,0],[-6,-1],[-5,-2],[-6,-2],[-10,-8],[-5,-4],[-1,-4],[-1,-4],[-1,-15],[-1,-5],[-7,-26],[-8,-13],[-27,-40],[-3,-18],[-2,-19],[-2,-6],[-3,-5],[-9,-11],[-4,-5],[-2,-7],[-1,-7],[-1,-27],[-2,-7],[-2,-4],[-3,-3],[-9,-6],[-8,-4],[-17,-6],[-17,-4],[-7,0],[-10,1],[-6,0],[-5,-1],[-4,-2],[-5,-3],[-7,-8],[-2,-3],[-2,-7],[0,-8],[0,-7],[2,-7],[3,-4],[3,-4],[9,-6],[9,-4],[17,-6],[19,-4],[4,-2],[4,-4],[2,-5],[0,-5],[-5,-12],[-2,-5],[-4,-4],[-3,-2],[-15,-7],[-3,-3],[-1,-4],[1,-2],[13,-13],[2,-4],[0,-5],[-1,-4],[-6,-14],[-6,-9],[-10,-30],[-117,-45],[-44,-29],[-50,-44],[-80,-52]],[[2726,6108],[-80,-24],[-48,41],[25,29],[142,49],[49,26],[-66,18],[-166,-1],[-59,29],[-40,33],[-64,35],[-120,45],[-124,2],[-40,14],[-21,17],[-11,19],[-10,21],[-16,22],[-10,48],[22,57],[105,157],[13,33],[-4,26],[-19,8],[-65,7],[-53,22],[-42,5],[-23,7],[-69,-55],[-8,1],[-20,2],[-50,1],[-20,-1],[-9,0],[-10,-2],[-17,-5],[-42,-16],[-23,-8],[-10,-2],[-7,-1],[-8,0],[-8,0],[-18,3],[-23,3],[-13,2],[-15,6],[-6,4],[-23,16],[-5,3],[-6,3],[-7,1],[-4,0],[-7,-1],[-7,-3],[-10,-5],[-6,-4],[-10,-8],[-11,-11],[-10,-7],[-6,-3],[-5,-2],[-6,0],[-4,1],[-10,3],[-5,2],[-6,4],[-5,6],[-7,15],[-10,16],[-7,16],[-4,5],[-9,9],[-13,9],[-28,15],[-7,3],[-11,3],[-8,1],[-8,0],[-5,-1],[-25,-25],[5,-21],[-27,-21],[-36,-4],[-75,20],[-38,2],[40,-32],[43,-22],[-5,-13]],[[1237,6755],[-9,8],[-1,-3],[-6,-2],[-25,-2],[-24,6],[-48,35],[-22,0],[-20,-8],[-22,-2],[-107,17],[-24,-4],[-43,-13],[-24,0],[-12,12],[-9,21],[-15,15],[-31,-5],[-216,-118],[-39,-11],[-50,-5],[-77,-18],[-52,74],[-7,51],[65,27],[33,-7],[48,-40],[35,-3],[29,13],[23,21],[38,48],[23,11],[27,9],[18,18],[-10,39],[-22,18],[-50,-14],[-26,18],[-5,26],[8,31],[12,30],[5,24],[-3,27],[-20,75],[-9,61],[-7,24],[-19,32],[-18,16],[-24,18],[-19,20],[-3,23],[37,24],[135,-10],[52,8],[10,41],[-31,48],[-17,37],[53,10],[29,-12],[45,-49],[26,-19],[47,-13],[51,-3],[101,10],[12,6],[8,12],[9,11],[17,6],[11,-5],[20,-22],[11,-6],[209,7],[8,6]],[[4289,4123],[-58,-31],[-7,-4],[-20,-19],[-10,-8],[-14,-8],[-5,-4],[-6,-7],[-5,-4],[-20,-12],[-4,-3],[-3,-4],[-1,-5],[1,-5],[3,-5],[9,-10],[3,-5],[1,-5],[0,-5],[-1,-4],[-3,-4],[-3,-3],[-37,-26],[-10,-4],[-13,-4],[-8,-5],[-5,-4],[-2,-3],[-4,-10],[-2,-3],[-10,-10],[-1,-3],[-1,-5],[2,-8],[11,-20],[4,-8],[1,-4],[0,-5],[-2,-4],[-9,-8],[-6,-4],[-12,-7],[-10,-4],[-11,-4],[-10,-2],[-7,1],[-21,4],[-5,0],[-6,0],[-5,-1],[-10,-3],[-17,-10],[-5,-2],[-13,-3],[-23,-3],[-17,-5],[-6,-2],[-4,-2],[-4,-4],[-7,-7],[-2,-4],[-10,-22],[-4,-7],[42,-18],[6,-3],[5,-4],[3,-4],[2,-6],[0,-5],[-3,-14],[-1,-14],[1,-7],[3,-11],[12,-25],[1,-5],[0,-10],[-3,-11],[-8,-18],[-4,-4],[-4,-3],[-7,-3],[-9,-1],[-9,2],[-4,1],[-7,3],[-5,3],[-11,10],[-5,4],[-7,2],[-4,0],[-4,0],[-5,-3],[-11,-11],[-4,-3],[-7,-3],[-9,-3],[-9,0],[-9,1],[-20,5],[-7,1],[-7,0],[-5,-1],[-5,-2],[-6,-4],[-10,-7],[-10,-6],[-26,-10],[-14,-7],[-5,-4],[-3,-5],[0,-2],[1,-3],[14,-21],[7,-9],[4,-4],[7,-6],[4,-4],[2,-4],[-1,-5],[-2,-4],[-4,-4],[-3,-1],[-3,-8],[-3,-14],[-1,-8],[0,-8],[3,-14],[0,-6],[-1,-5],[-3,-5],[-21,-28],[-8,-15],[-3,-5],[-9,-8],[-13,-8],[-45,-21],[-24,-8],[-14,-7],[-4,-2],[-4,-3],[-2,-4],[1,-3],[4,-4],[13,-10],[10,-13],[5,-4],[19,-12],[27,-20],[6,-4],[7,-3],[12,-3],[4,-1],[6,-4],[3,-3],[3,-3],[7,-9],[6,-7],[5,-5],[19,-12],[32,-31],[5,-7],[5,-11],[3,-5],[4,-5],[5,-4],[15,-10],[4,-4],[4,-4],[2,-7],[1,-7],[0,-7],[-1,-7],[-5,-15],[-3,-14],[-2,-7],[-7,-11],[-3,-5],[0,-2],[1,-5],[4,-8],[2,-11],[1,-6],[5,-6],[10,-9],[3,-5],[1,-5],[-1,-5],[-3,-5],[-15,-16],[-3,-5],[-1,-5],[4,-7],[4,-4],[5,-4],[5,-2],[17,-5],[3,-1],[1,-1],[0,-3],[-2,-6],[-6,-16],[0,-9],[1,-5],[3,-4],[8,-8],[12,-9],[4,-4],[2,-3],[0,-3],[-1,-3],[-3,-2],[-6,-5],[-7,-7],[-1,-4],[-1,-4],[0,-10],[-2,-4],[-3,-3],[-5,-3],[-4,-1],[-5,-1],[-21,0],[-5,-1],[-6,-2],[-6,-2],[-5,-3],[-9,-8],[-4,-5],[-9,-19],[-13,-14],[-11,-16],[-7,-7],[-12,-9],[-4,-2],[-22,-9],[-13,-7],[-15,-8],[-4,-2],[-3,-3],[-3,-5],[-2,-18],[-13,-37],[-5,-2],[-7,0],[-6,0],[-5,1],[-6,4],[-8,5],[-6,3],[-20,6],[-5,2],[-5,5],[-12,9],[-15,8],[-4,5],[-9,13],[-9,13],[-25,24]],[[2940,4697],[31,-1],[10,0],[10,-2],[29,-8],[23,-4],[6,-2],[6,-2],[19,-8],[7,-2],[5,-1],[5,1],[4,1],[3,2],[0,3],[0,3],[-11,26],[-1,5],[0,6],[2,5],[4,4],[5,2],[5,1],[51,8],[4,-1],[10,0],[5,1],[5,2],[5,3],[12,13],[10,8],[7,3],[5,2],[6,1],[8,0],[25,-2],[7,0],[8,0],[21,5],[5,1],[7,0],[26,-6],[7,0],[7,0],[18,4],[8,3],[22,9],[11,3],[9,1],[9,1],[46,0],[8,1],[5,1],[4,2],[4,4],[2,5],[4,10],[2,6],[3,3],[7,7],[6,4],[5,3],[18,7],[19,8],[29,8],[7,4],[10,8],[4,5],[2,3],[-1,8],[-3,12],[1,5],[3,4],[5,4],[16,9],[6,2],[6,2],[8,2],[7,0],[17,-2],[5,1],[5,1],[6,3],[3,2],[3,3],[3,5],[3,7],[0,5],[-2,13],[0,6],[2,9],[4,9],[4,4],[4,4],[4,2],[5,1],[22,2],[5,1],[4,2],[4,4],[3,5],[5,22],[7,13],[8,13],[5,4],[17,20],[13,13]],[[3812,5094],[9,-11],[19,-18],[2,-4],[2,-4],[0,-6],[-2,-3],[-7,-19],[-1,-6],[5,-16],[4,-17],[7,-19],[4,-9],[5,-9],[9,-13],[4,-5],[5,-4],[7,-2],[9,-1],[13,0],[1,-3],[0,-6],[-1,-7],[-5,-20],[-1,-6],[2,-5],[4,-5],[6,-3],[5,-2],[6,-2],[8,-1],[24,-1],[8,-1],[7,-2],[6,-3],[13,-11],[6,-4],[17,-7],[14,-9],[4,-2],[4,-5],[2,-5],[5,-22],[1,-4],[5,-6],[20,-17],[9,-8],[6,-13],[8,-14],[3,-7],[1,-14],[-2,-26],[1,-2],[2,-4],[3,-4],[6,-4],[9,-4],[14,-4],[10,-4],[18,-10],[15,-7],[16,-6],[30,-10],[12,-6],[7,-4],[14,-10],[5,-4],[4,-5],[6,-11],[4,-4],[6,-5],[16,-10],[6,-5],[32,-32],[-9,-6],[-12,-9],[-9,-9],[-6,-10],[-4,-4],[-4,-1],[-4,-1],[-4,1],[-5,2],[-7,3],[-6,4],[-13,8],[-4,1],[-4,1],[-4,0],[-6,-3],[-3,-3],[-1,-3],[-1,-11],[-2,-4],[-2,-4],[-8,-5],[-18,-10],[-13,-9],[-6,-6],[-9,-12],[-6,-12],[-1,-5],[0,-6],[2,-7],[0,-5],[-1,-6],[-3,-5],[-6,-4],[-21,-12],[-22,-15],[-8,-4],[-9,-4],[-28,-11],[5,-5],[8,-8],[11,-7],[10,-4],[5,-5],[2,-3],[3,-10],[1,-27],[1,-2],[2,-5],[4,-4],[13,-8],[19,-9],[11,-4],[15,-3],[11,-4],[7,-3],[10,-7],[11,-13],[8,-9],[7,-14],[6,-9],[11,-14],[7,-13],[5,-6],[19,-14],[16,-13]],[[8186,2130],[-18,-20],[-16,-15],[-7,-5],[-5,-2],[-5,-2],[-41,-5],[-7,0],[-7,1],[-6,2],[-13,5],[-17,5],[-8,1],[-8,0],[-17,-3],[-15,-1],[-14,12],[-22,22],[-6,5],[-13,10],[-13,9],[-7,3],[-6,2],[-20,5],[-11,3],[-8,5],[-13,8],[-5,3],[-17,6],[-5,2],[-12,8],[-16,8],[-5,4],[-22,18],[-13,13],[-12,11],[-9,9],[-4,4],[-5,4],[-6,3],[-17,7],[-7,4],[-5,4],[-5,7],[-7,14],[-3,3],[-3,1],[-4,0],[-6,-1],[-12,-7],[-5,-1],[-5,-1],[-6,1],[-6,1],[-6,3],[-10,6],[-4,3],[-11,11],[-5,4],[-4,1],[-5,1],[-7,-1],[-5,-1],[-5,-1],[-7,-3],[-26,-17],[-6,-3],[-8,-3],[-8,-3],[-10,-1],[-19,-2],[-27,-14],[-78,77],[-29,-25],[-34,-14],[-20,-9],[-16,-6],[-17,-5],[-9,-2],[-8,0],[-46,0],[-19,-1],[-41,-3]],[[7151,2292],[-3,0],[-6,1],[-6,2],[-6,3],[-6,5],[-4,5],[-1,5],[1,5],[3,4],[4,2],[14,6],[3,2],[4,4],[1,3],[0,4],[-2,3],[-16,16],[-19,23],[-6,6],[-28,22],[-6,6],[-10,13],[-13,11],[-3,4],[-2,5],[-1,5],[1,5],[2,4],[3,4],[9,5],[19,10],[5,4],[4,4],[2,4],[0,4],[-2,5],[-12,13],[-4,6],[-3,7],[-12,36],[-6,-3],[-7,-2],[-6,-1],[-5,0],[-6,1],[-23,5],[-8,0],[-7,-1],[-14,-2],[-7,1],[-9,2],[-4,3],[-4,3],[-7,8],[-5,5],[-6,3],[-7,2],[-4,0],[-5,-1],[-5,-3],[-8,-8],[-2,-3],[-2,-7],[-1,-7],[-2,-20],[-3,-15],[-1,-5],[0,-6],[1,-5],[5,-13],[2,-9],[0,-3],[0,-4],[-2,-3],[-3,-3],[-4,-2],[-6,-3],[-4,-1],[-7,1],[-5,2],[-6,3],[-25,17],[-24,11],[-8,5],[-9,6],[-9,5],[-6,2],[-9,2],[-30,5],[-3,-1],[-5,0],[-9,2],[-7,2],[-7,4],[-12,6],[-5,3],[-3,4],[-6,9],[-4,7],[-1,6],[0,5],[2,6],[2,3],[6,8],[5,5],[15,10],[6,6],[1,3],[0,3],[-2,5],[-5,4],[-4,2],[-4,2],[-7,2],[-23,3],[-5,2],[-5,2],[-4,3],[-6,7],[-2,3],[-6,10],[-5,8],[-10,9],[-3,4],[-2,5],[-3,12],[-4,8],[-2,4],[-10,10],[-2,4],[-1,3],[0,6],[1,3],[3,4],[9,10],[6,7],[8,13],[7,13],[1,6],[3,34],[-41,-12],[-16,-4],[-9,-1],[-18,-1],[-27,0],[-18,1],[-8,2],[-19,6],[-7,2],[-25,5],[-7,1],[-8,0],[-16,0],[-24,-4],[-8,0],[-6,2],[-6,4],[-14,17],[-24,29]],[[6339,2876],[11,4],[19,5],[26,5],[6,2],[5,2],[14,7],[5,2],[16,6],[4,2],[4,4],[3,4],[3,11],[3,5],[4,4],[26,16],[5,3],[6,3],[5,1],[6,0],[20,-1],[4,0],[6,2],[6,4],[22,25],[4,5],[2,5],[1,6],[-1,12],[-1,5],[-2,4],[-3,4],[-14,13],[-6,7],[-6,9],[-5,7],[-5,16],[-2,6],[-12,15],[-2,5],[0,4],[2,5],[8,13],[3,7],[1,5],[-7,25],[1,5],[3,4],[3,4],[13,10],[3,3],[9,13],[14,13],[2,4],[2,4],[2,6],[1,6],[-1,11],[-2,5],[-2,4],[-3,4],[-4,3],[-22,14],[-14,14],[-12,8],[-6,5],[-3,5],[-1,5],[0,5],[1,7],[-1,5],[-1,4],[-3,3],[-5,4],[-14,6],[-9,4],[-4,4],[-3,3],[-3,4],[-2,6],[-2,10],[-3,7],[-4,7],[-6,8],[-16,3],[-10,5],[-7,2],[-11,4],[-36,9],[0,3],[-5,11],[-2,6],[2,4],[3,4],[4,3],[22,13],[-2,26],[4,14],[7,9],[9,6],[12,6],[-13,4],[-8,5],[-11,5],[-18,2],[11,28],[-1,22],[-10,20],[-15,18],[-15,0],[4,41],[2,4],[2,3],[4,2],[4,2],[5,0],[6,0],[19,-4],[6,0],[7,2],[12,4],[6,3],[6,4],[5,4],[3,3],[2,3],[1,5],[-6,24],[-7,19],[-3,5],[-3,4],[-4,4],[-7,3],[-7,1],[-16,2],[-7,2],[-9,3],[-5,3],[-4,3],[-4,3],[-2,4],[-2,7],[-3,14],[-2,7],[-3,7],[-4,7],[-6,8]],[[6331,3845],[30,19],[15,9],[6,2],[15,5],[9,4],[10,5],[13,8],[5,2],[20,5],[10,4],[22,16],[7,3],[16,7],[6,4],[7,5],[5,3],[5,2],[12,2],[23,2],[8,1],[19,6],[8,1],[7,1],[15,-1],[8,-1],[19,-7],[7,-1],[16,-1],[7,0],[8,2],[20,7],[25,7],[16,6],[16,8]],[[6766,3980],[39,-42],[5,-5],[7,-4],[30,-14],[10,-6],[7,-6],[15,-16],[27,-25],[-24,-16],[-7,-3],[-20,-4],[-5,-2],[-7,-3],[-3,-3],[-3,-3],[-4,-8],[0,-3],[0,-4],[3,-3],[4,-2],[4,-2],[18,-6],[6,-4],[6,-5],[10,-12],[10,-10],[2,-4],[1,-4],[0,-5],[-1,-4],[-3,-3],[-8,-6],[-12,-7],[-11,-7],[-5,-3],[-2,-3],[0,-4],[1,-3],[1,-2],[5,-14],[4,-15],[2,-41],[1,-7],[2,-6],[4,-5],[17,-13],[3,-4],[2,-4],[1,-6],[4,-17],[2,-5],[4,-6],[24,-21],[4,-5],[7,-10],[6,-7],[6,-5],[22,-12],[11,-8],[11,-8],[4,-4],[8,-9],[6,-10],[1,-5],[1,-6],[-2,-12],[0,-5],[1,-4],[3,-4],[7,-5],[22,-12],[11,-8],[7,-4],[5,-2],[5,-2],[7,-1],[8,0],[7,1],[20,3],[46,3],[5,-1],[5,-1],[17,-10],[12,-6],[7,-2],[6,0],[5,0],[7,2],[21,5],[5,1],[7,0],[17,-3],[10,-4],[7,-3],[5,-5],[8,-12],[15,-31],[5,-16],[9,-16],[4,-4],[6,-5],[29,-17],[9,-7],[3,-3],[14,-18],[6,-7],[36,4],[15,2],[17,6],[18,8],[6,2],[5,1],[5,0],[6,-2],[18,-8],[6,-1],[12,-2],[8,1],[7,1],[10,3],[4,3],[4,2],[3,4],[0,3],[-2,3],[-2,3],[-5,2],[-17,7],[-5,3],[-6,3],[-19,17],[-25,19],[-4,3],[-2,3],[-1,4],[-2,11],[-3,11],[0,4],[8,19],[2,3],[5,4],[10,2],[19,2],[8,0],[8,-2],[9,-5],[38,-31],[-1,-1],[0,-4],[3,-6],[5,-6],[7,-6],[11,-8],[24,-11],[12,-8],[12,-7],[4,-4],[2,-3],[0,-4],[1,-8],[-1,-3],[-1,-4],[-7,-9],[0,-2],[0,-2],[1,-3],[4,-4],[13,-10],[12,-9],[12,-8],[4,-4],[1,-4],[-5,-9],[0,-2],[0,-3],[2,-5],[4,-6],[6,-4],[6,-4],[11,-3],[5,0],[6,0],[8,2],[16,6],[7,1],[7,0],[13,-1],[19,-4],[7,-1],[15,-6],[18,-10],[5,-3],[5,-1],[22,-5],[9,-4],[9,-5],[22,-17],[6,-4],[16,-6],[5,-2],[24,-6],[32,-6],[8,-1],[7,0],[7,1],[30,6],[5,1],[22,12],[5,1],[12,1],[8,0],[7,-2],[19,-6],[27,-8],[9,-3],[7,-4],[5,-3],[3,-3],[3,-5],[1,-5],[0,-2],[0,-6],[11,0],[9,-2],[8,-2],[7,-4],[27,-21],[6,-2],[4,0],[6,1],[5,4],[3,3],[12,14],[9,14],[9,10],[4,3],[4,2],[5,2],[4,1],[7,-1],[7,-2],[20,-10],[9,-5],[16,-12],[11,-4],[14,-3],[11,-4],[7,-4],[6,-4],[6,-6],[9,-12],[5,-14],[2,-9],[-2,-9],[-5,-14],[-2,-6],[-4,-5],[-11,-12],[-2,-3],[-2,-6],[-1,-5],[1,-5],[2,-10],[0,-7],[-2,-5],[-7,-10],[-2,-3],[1,-5],[1,-1]],[[5529,5208],[44,-60],[39,-12],[0,-19],[-51,-17],[0,-18],[11,-12],[4,-7],[-4,-10],[-11,-21],[7,-6],[3,-2],[2,-2],[6,-9],[-51,0],[51,-36],[-25,-6],[-12,-19],[-1,-6]],[[5541,4946],[-15,7],[-12,10],[-4,2],[-9,4],[-12,4],[-9,1],[-24,2],[-8,1],[-6,2],[-5,2],[-12,8],[-6,3],[-5,1],[-3,0],[-7,-1],[-19,-6],[-5,-1],[-8,0],[-19,2],[-23,1],[-25,13],[-51,25],[-11,3],[-24,3],[-7,2],[-16,5],[-9,5],[-16,12],[-15,9],[-5,4],[-4,6],[-1,6],[-4,26],[0,31],[-46,-17],[-12,-4],[-19,-3],[-19,-7],[-9,-1],[-28,-3],[-9,-1],[-19,-6],[-8,-1],[-7,0],[-5,0],[-5,2],[-13,6],[-7,3],[-6,1],[-5,1],[-7,1],[-10,-1],[-7,1],[-5,1],[-5,2],[-4,2],[-12,9],[-13,9],[-10,4],[-10,4],[-8,1],[-8,0],[-8,0],[-27,-4],[-29,-2],[-1,15],[-1,7],[-5,16],[1,5],[2,4],[4,4],[11,9],[5,6],[2,4],[-1,3],[-1,3],[-3,3],[-6,3],[-7,4],[-17,5],[-8,2],[-36,5],[-46,3]],[[4655,5236],[0,19],[-1,8],[-3,11],[-3,7],[-6,9],[-2,7],[-1,7],[1,7],[2,7],[2,3],[7,7],[21,15],[14,9],[5,4],[1,3],[1,3],[-1,5],[-4,5],[-6,3],[-5,2],[-5,1],[-8,0],[-7,-1],[-20,-6],[-6,0],[-6,0],[-4,1],[-7,3],[-7,6],[-24,24],[-13,15],[-8,11],[-3,5],[-2,6],[-1,8],[1,6],[4,5],[5,5],[12,9],[21,13],[5,5],[5,5],[2,6],[3,21],[1,7],[3,5],[4,4],[4,2],[23,6],[15,5],[9,1],[9,1],[10,-1],[10,-1],[5,-1],[44,-16],[7,-2],[6,0],[4,1],[7,3],[6,5],[29,25],[4,6],[2,5],[1,6],[-1,6],[-1,5],[-2,4],[-3,4],[-13,14],[-10,17],[-5,10],[-9,12],[-5,5],[-6,4],[-29,17],[-40,36],[-21,10],[-19,6],[-13,2],[-4,2],[-5,3],[-7,12],[-2,6],[0,19],[-1,4],[-4,6],[-15,17],[-32,27],[10,6],[24,13],[5,3],[15,13],[6,5],[7,3],[26,7],[20,8],[6,2],[6,2],[23,3],[6,1],[5,2],[5,4],[4,4],[0,5],[-2,7],[-10,18],[-3,5],[-3,3],[-3,3],[-6,4],[-17,6],[-6,3],[-6,4],[-4,4],[-2,4],[0,2],[3,4],[4,4],[4,5],[1,5],[-1,8],[-4,9],[-6,8],[-17,14],[-4,5],[-3,5],[-1,6],[0,6],[1,11],[4,6],[5,6],[8,7],[40,81]],[[7071,4460],[-3,-1],[-1,-1],[-2,-4],[1,-6],[11,-15],[4,-9],[1,-4],[-1,-5],[-1,-3],[-3,-5],[-4,-5],[-6,-4],[-28,-16],[-12,-10],[-14,-9],[-5,-5],[-2,-3],[-2,-4],[-1,-12],[-3,-6],[-4,-6],[-5,-6],[-6,-5],[-26,-21],[-2,-1],[-3,-5],[0,-6],[3,-5],[11,-14],[2,-3],[0,-5],[-1,-4],[-3,-5],[-12,-12],[-3,-3],[-7,-3],[-4,-1],[-21,0],[-10,-3],[-6,-2],[-19,-7],[-24,-7],[-11,-5],[-9,-5],[-4,-2],[-5,-7],[-8,-14],[-2,-6],[-1,-14],[1,-7],[2,-6],[4,-6],[4,-4],[26,-19],[6,-5],[5,-5],[3,-6],[0,-4],[-3,-5],[-5,-4],[-13,-9],[-4,-4],[-3,-4],[-2,-5],[-1,-12],[-1,-4],[-2,-3],[-33,-31],[-24,-15],[-4,-4],[-7,-7],[-3,-7]],[[6331,3845],[-9,-12],[-5,-4],[-5,-4],[-5,-2],[-5,-1],[-10,1],[-5,0],[-4,-1],[-4,-2],[-17,-11],[-5,-1],[-12,-3],[-22,-8],[-8,-4],[-17,-11],[-7,-2],[-19,-3],[-39,2],[-15,13],[-26,91],[18,16],[-57,1],[-4,-2],[-11,3],[-8,1],[-9,0],[-8,0],[-35,-6],[-44,-14],[-29,-5],[-15,-3],[-7,0],[-12,2],[-15,6],[-5,2],[-7,4],[-5,5],[-2,3],[-2,3],[-1,5],[1,4],[3,4],[8,9],[5,8],[1,6],[0,5],[-3,10],[0,6],[2,4],[10,17],[7,13],[1,5],[0,12],[-2,13],[-1,5],[1,5],[2,4],[7,11],[0,2],[-1,4],[-2,3],[-3,4],[-6,4],[-9,5],[-20,10],[-6,-30],[-1,-4],[-1,-1],[-1,-1],[-2,-1],[-2,-1],[-32,-13],[13,-30],[2,-7],[1,-14],[0,-14],[-1,-7],[-2,-6],[-9,-20],[-2,-6],[-3,-17],[-2,-5],[-5,-5],[-6,-4],[-15,-6],[-5,-2],[-19,-3],[-5,-2],[-6,-3],[-13,-13],[-11,-9],[-7,-4],[-29,-15],[-20,-14],[-6,-3],[-5,-1],[-8,0],[-7,1],[-5,1],[-5,3],[-18,13],[-7,3],[-7,2],[-24,4],[-4,0],[-4,-1],[-4,-4],[-2,-4],[0,-5],[1,-13],[-1,-5],[-5,-11],[-3,-8],[0,-6],[1,-5],[3,-13],[0,-14],[2,-8],[5,-15],[20,-45],[-22,10],[-33,13],[-9,4],[-10,6],[-12,10],[-5,3],[-24,9],[-14,9],[-5,2],[-5,1],[-7,0],[-19,-2],[-9,0],[-19,0],[-9,1],[-10,2],[-22,11],[-5,1],[-14,2],[-37,1],[-9,1],[-8,2],[-20,6],[-9,2],[-19,3],[-8,2],[-13,5],[-7,1],[-3,0],[-6,-1],[-12,-5],[-10,-5],[-4,-1],[-3,-1],[-6,1],[-15,4],[-13,4],[-7,4]],[[5101,3791],[-34,30],[-10,13],[-7,6],[-6,5],[-12,7],[-4,2],[-4,5],[-4,8],[-1,6],[-1,21],[-1,7],[-2,6],[-4,8],[-9,10],[-5,8],[-3,12],[-6,15],[-1,5],[-3,27]],[[4984,3992],[12,0],[20,-1],[10,-2],[16,-4],[5,-1],[3,1],[6,2],[4,4],[3,3],[5,16],[5,9],[5,7],[8,6],[14,8],[22,10],[12,4],[21,1],[8,2],[22,10],[13,8],[8,7],[10,11],[6,6],[6,4],[8,5],[5,4],[3,7],[2,7],[-1,13],[-1,7],[-2,6],[-16,19],[-9,10],[-5,7],[-7,18],[0,5],[3,5],[4,5],[10,7],[7,3],[18,7],[14,7],[6,2],[6,1],[9,0],[5,-1],[11,-2],[13,-4],[3,13],[1,11],[-1,7],[-10,26],[0,4],[1,3],[4,3],[16,5],[6,3],[16,9],[4,3],[3,3],[2,4],[1,6],[-1,5],[-2,4],[-2,4],[-12,13],[-5,10],[-4,5],[-4,5],[-18,14],[-3,4],[-2,3],[0,6],[0,5],[3,5],[5,5],[6,3],[12,4],[4,2],[21,17],[6,3],[7,3],[3,0],[12,0],[20,-1],[7,0],[10,3],[4,2],[5,3],[3,5],[4,7],[2,5],[0,6],[-1,12],[1,5],[3,6],[8,10],[3,5],[2,5],[1,6],[-1,5],[-1,5],[-4,6],[-28,25],[-6,4],[-10,3],[-69,13],[34,24],[33,19],[11,5],[10,3],[22,4],[25,7],[9,3],[7,4],[6,4],[11,11],[22,14],[4,4],[3,4],[2,4],[2,5],[4,26],[-31,29],[-4,5],[-2,5],[-2,6],[2,7],[2,5],[10,16],[1,3],[1,6],[34,46],[-8,22],[-4,32],[1,22]],[[6339,2876],[-14,-3],[-8,-1],[-17,0],[-7,0],[-7,1],[-18,5],[-14,5],[-8,4],[-3,2],[-2,3],[-9,15],[-5,4],[-6,4],[-5,2],[-6,1],[-8,1],[-8,0],[-7,-2],[-5,-3],[-1,-3],[0,-2],[-12,-1],[-20,-1],[-15,-2],[-13,-4],[-7,0],[-5,0],[-10,3],[-18,8],[-12,3],[-32,8],[-4,0],[-7,1],[-7,-1],[-4,-2],[-15,-7],[-9,-3],[-8,-1],[-9,-1],[-36,-1],[-14,-3],[-11,-4],[-10,-3],[-49,-23],[-45,-18],[-10,-3],[-25,-2],[-34,-6],[-21,-5],[0,-2],[-3,-4],[-6,-3],[-10,-6],[-7,-4],[-5,-5],[-4,-6],[-2,-4],[0,-4],[0,-6],[7,-14],[0,-5],[-3,-12],[-1,-6],[-3,-5],[-4,-4],[-4,-3],[-6,-3],[-16,-8],[-16,-11],[-23,-13],[-8,-6],[-3,-3],[-3,-4],[-5,-16],[-2,-6],[-3,-4],[-13,-13],[-2,-4],[-2,-3],[0,-4],[0,-15],[-1,-5],[-2,-5],[-2,-4],[-5,-3],[-12,-5],[-6,-3],[-3,-5],[-7,-10],[-5,-6],[-5,-4],[-4,-2],[-18,-6],[-15,-6],[-11,-5],[-14,-9],[-10,-4],[-17,-6],[-17,-5],[-9,-1],[-10,-1],[-18,1],[-9,2],[-7,2],[-16,7],[-4,2],[-4,4],[-6,11],[-2,3],[-3,3],[-4,1],[-15,5],[-15,7],[-4,1],[-5,0],[-4,-1],[-19,-9],[-18,-5],[-12,-2],[-8,0],[-18,5],[-11,3],[-18,9],[-4,1],[-7,-1],[-11,-3],[-20,-4],[-9,-3],[-4,-3],[-2,-5],[1,-6],[3,-9],[0,-5],[-3,-5],[-14,-16],[-22,-18],[-5,-7],[-1,-7],[-1,-13],[1,-14],[5,-21],[3,-30],[2,-8],[2,-6],[4,-9],[1,-3],[0,-4],[-2,-3],[-18,-17],[-6,-4],[-4,-1],[-18,-6],[-8,-5],[-4,-4],[-11,-15],[-14,-12],[-13,-21],[-6,-8]],[[4994,2294],[-179,81],[-15,20],[9,3],[8,33],[3,37],[-1,13],[28,19],[24,-6],[8,0],[-24,36],[-16,17],[-24,19],[-46,30],[-23,5]],[[4746,2601],[0,1],[0,11],[-4,19],[0,6],[3,18],[0,6],[-2,5],[-8,20],[-1,5],[1,5],[1,3],[4,7],[3,3],[6,4],[8,4],[6,3],[3,4],[3,3],[5,11],[6,7],[17,13],[5,5],[8,11],[4,10],[0,4],[-2,3],[-9,9],[-4,5],[-2,7],[-5,24],[0,4],[1,5],[6,9],[2,5],[0,2],[-5,23],[-3,29],[-21,6],[-6,1],[-8,0],[-6,-1],[-7,-1],[-19,-7],[-8,-2],[-5,0],[-6,0],[-6,2],[-20,8],[-20,7],[-4,2],[-4,4],[-3,5],[-7,14],[-3,4],[-9,9],[-2,3],[-1,3],[2,4],[4,4],[14,11],[3,4],[1,4],[1,5],[-3,11],[0,5],[3,13],[8,22],[5,23],[2,6],[11,17],[1,4],[-1,5],[-13,15],[-2,5],[0,4],[2,3],[7,10],[2,3],[2,4],[0,5],[-1,5],[-4,6],[-15,16],[-5,6],[-12,25],[-8,12],[-6,7],[20,6],[10,3],[5,0],[6,-1],[5,-1],[4,-3],[15,-12],[4,-2],[5,-2],[5,-1],[4,0],[28,2],[13,2],[4,2],[7,4],[16,13],[5,4],[5,2],[5,0],[5,0],[7,-2],[6,-4],[19,-15],[6,-5],[10,-12],[5,-4],[4,-2],[13,-6],[17,-5],[8,-2],[18,-1],[27,0],[18,1],[8,2],[27,6],[19,1],[8,2],[25,10],[31,12],[-36,33],[-5,6],[-8,14],[-12,14],[-2,3],[0,4],[0,13],[-1,10],[-7,25],[-2,5],[-4,5],[-9,10],[-4,6],[-2,6],[-1,7],[0,7],[0,7],[2,7],[2,3],[7,12],[10,12],[9,7],[7,4],[29,13],[7,4],[15,12],[13,9],[5,4],[2,5],[0,4],[-3,5],[-5,4],[-20,15],[-7,3],[-4,2],[-20,4],[-5,2],[-5,2],[-4,4],[-3,3],[-3,11],[-2,5],[-4,4],[-5,4],[-5,1],[-5,1],[-18,0],[-8,1],[-51,9],[10,13],[11,14],[7,7],[12,10],[14,8],[13,9],[22,11],[3,2],[2,4],[1,5],[-2,4],[-5,10],[-2,6],[-2,13],[0,13],[1,14],[2,6],[4,6],[9,11],[3,6],[1,6],[0,6],[-2,5],[-2,3],[-6,6],[-1,2],[-1,1],[0,2],[0,2],[0,3],[0,1],[1,0],[0,1],[3,0],[8,0],[3,0],[1,0],[0,-1],[8,-5],[3,0],[6,-1],[3,0],[6,-1],[2,0],[2,0],[2,1],[3,3],[4,4],[2,1],[2,0],[2,1],[4,0],[33,1]],[[4746,2601],[-37,9],[-60,-6],[-59,-20],[-189,-110],[-53,-16],[-79,-2],[-20,-11],[-16,-33],[6,-29],[29,-48],[21,-54],[13,-25],[15,-16],[21,-5],[26,2],[25,-1],[17,-15],[-10,-62],[-51,-84],[-64,-77],[-51,-38],[-29,0],[-27,6],[-26,0],[-21,-17],[-23,-39],[-14,-17],[-19,-14],[-46,-13],[-43,0],[-41,-9],[-41,-42],[-21,-71],[38,-32],[54,-26],[13,-30],[11,-24],[-55,-57],[-116,-37],[-200,-34],[24,98],[-4,63],[-40,41],[-148,58],[-127,71],[-69,23],[-130,10],[-27,7],[-31,8],[-146,112],[-5,4]],[[4289,4123],[14,-12],[16,-17],[8,-7],[13,-9],[31,-15],[6,-4],[6,-4],[5,-7],[1,-5],[0,-5],[-1,-7],[1,-5],[1,-4],[3,-4],[12,-10],[8,-8],[10,-15],[23,-28],[7,-9],[4,-5],[5,-3],[5,-3],[18,-7],[7,-4],[13,-8],[7,-3],[12,-4],[9,-1],[9,0],[19,0],[9,1],[8,1],[13,6],[35,17],[17,6],[4,2],[3,3],[2,3],[0,3],[-4,18],[2,18],[-2,5],[-3,3],[-18,13],[-3,5],[-1,5],[1,4],[3,5],[6,4],[5,2],[27,6],[6,2],[19,8],[6,1],[6,2],[9,1],[10,0],[19,-1],[27,-4],[35,-4],[5,0],[4,0],[5,1],[4,3],[14,14],[4,4],[5,2],[9,4],[5,2],[7,0],[5,-1],[5,-1],[7,-3],[4,-5],[6,-8],[3,-4],[7,-3],[12,-4],[37,-6],[0,-1],[0,-2],[1,-1],[1,-1],[4,-3],[2,-2],[1,-3],[1,-3],[1,-1],[0,-7],[1,-2],[1,-2],[0,-1],[2,-2],[1,-1],[2,-1],[3,-1],[2,-1],[2,-1],[2,-3],[7,-9]],[[7151,2292],[13,-16],[8,-10],[2,-5],[0,-3],[-3,-5],[-16,-12],[-15,-14],[-17,-13],[-46,-29],[-8,-4],[-27,-6],[-8,-2],[-24,-2],[-13,-3],[-17,-5],[-27,-10],[-29,-14],[-6,-4],[-10,-8],[-15,-14],[-15,-9],[-10,-9],[-9,-8],[-3,-6],[-23,-5],[-19,-6],[-10,-3],[-4,-2],[-5,0],[-3,0],[-4,1],[-16,9],[-10,4],[-4,1],[-7,0],[-4,-1],[-9,-4],[-4,-3],[-3,-3],[-2,-4],[-8,-14],[-3,-4],[-4,-3],[-8,-5],[-21,-12],[-22,-13],[-7,-3],[-5,-2],[-6,-1],[-10,-1],[-9,-1],[-81,1],[-10,-1],[-9,-2],[-10,-3],[-11,-4],[-6,-3],[-25,-15],[-6,-4],[-5,-5],[-14,-16],[-5,-5],[-14,-11],[-13,-7],[-63,-32],[-21,-7],[-32,-10],[-4,-2],[-3,-3],[-1,-3],[0,-3],[3,-6],[7,-13],[8,-15],[4,-4],[11,-10],[2,-3],[6,-14],[2,-5],[12,-15],[3,-5],[1,-5],[-2,-5],[-1,-3],[-13,-12],[-4,-5],[-6,-8],[-4,-3],[-3,-3],[-11,-5],[-8,-4],[-7,-6],[-4,-4],[-2,-3],[0,-4],[3,-10],[0,-5],[-3,-15],[1,-5],[2,-10],[-1,-5],[-4,-6],[-17,-17],[-4,-6],[-1,-5],[0,-13],[-1,-5],[-11,-23],[-1,-4],[-58,-42]],[[6192,1540],[0,14],[-23,19],[-49,2],[-77,14],[-25,12],[-47,30],[-26,13],[-27,5],[-57,-1],[-26,6],[-68,62],[-14,80],[-3,79],[-38,57],[-40,5],[-33,-19],[-34,-14],[-42,19],[-21,34],[-37,133],[-38,59],[-38,23],[-161,7],[-50,15],[-29,12],[-195,88]],[[4655,5236],[-36,20],[-17,11],[-4,3],[-4,4],[-10,12],[-9,7],[-7,3],[-11,4],[-8,1],[-24,2],[-14,2],[-6,2],[-7,3],[-21,14],[-10,4],[-9,2],[-7,1],[-7,-1],[-17,-4],[-33,-13],[-35,-15],[-21,20],[-12,10],[-4,2],[-17,5],[-6,4],[-4,4],[-2,4],[-1,4],[1,12],[-4,21],[-2,21],[-2,7],[-2,5],[-4,5],[-4,2],[-9,3],[-4,2],[-7,0],[-7,0],[-8,-3],[-12,-5],[-16,-6],[-38,-11],[-19,-7],[-30,-6],[-16,-6],[-7,-2],[-7,0],[-4,1],[-5,2],[-4,2],[-3,3],[-2,4],[-2,7],[-1,8],[1,15],[2,8],[9,20],[3,7],[-39,14],[-30,14],[-8,2],[-12,2],[-8,0],[-24,-1],[-5,1],[-4,1],[-16,13],[-20,10],[-6,4],[-25,17],[-6,3],[-6,1],[-7,2],[-15,1],[-21,-15],[-16,-12],[-6,-4],[-6,-3],[-6,-1],[-14,-3],[-5,-2],[-5,-1],[-5,-4],[-11,-11],[-10,-11],[-3,-5],[-2,-3],[0,-2],[1,-6],[3,-7],[3,-3],[14,-11],[18,-14],[7,-3],[9,-4],[6,-4],[12,-11],[11,-9],[3,-5],[1,-3],[0,-2],[-1,-4],[-4,-4],[-19,-13],[-9,-7],[-3,-4],[-16,-20],[-6,-7],[-12,-9],[-6,-7],[-3,-5],[-1,-3],[0,-9],[2,-19],[0,-6],[-2,-5],[-2,-5],[-4,-4],[-12,-12],[-7,-11],[-1,-3]],[[3730,5228],[-12,-5],[-15,-4],[-9,-1],[-8,-1],[-19,2],[-7,0],[-5,-2],[-5,-2],[-8,-6],[-5,-6],[-3,-5],[-7,-13],[-4,-12],[-2,-4],[-2,-3],[-4,-3],[-21,-14],[-3,-4],[-7,-8],[-5,-5],[-6,-4],[-15,-7],[-11,-3],[-10,-2],[-5,1],[-5,2],[-17,9],[-10,4],[-4,0],[-5,0],[-5,-1],[-5,-3],[-3,-4],[-1,-5],[1,-13],[0,-5],[-2,-5],[-4,-3],[-4,-2],[-4,0],[-9,1],[-15,3],[-11,3],[-7,4],[-6,5],[-6,6],[-13,24],[-6,7],[-6,5],[-14,9],[-33,24],[-16,9],[-10,5],[-8,6],[-6,6],[-11,14],[-16,21],[-17,20],[-10,19],[-2,6],[0,5],[2,8],[5,7],[3,5],[6,6],[16,15],[4,6],[1,5],[0,5],[-1,5],[-4,5],[-4,4],[-13,10],[-3,4],[-2,4],[-1,5],[0,6],[1,3],[2,4],[5,4],[8,5],[4,4],[2,5],[-2,12],[1,3],[2,4],[8,5],[18,10],[6,4],[4,5],[3,5],[7,13],[5,16],[10,21],[2,6],[1,7],[0,13],[-2,13],[-3,6],[-8,11],[-2,5],[-1,6],[2,10],[10,20],[2,5],[1,3],[0,6],[-7,18],[-5,25],[-10,26],[-8,8],[-7,6],[-8,5],[-17,9],[-4,3],[-3,3],[-3,4],[-1,5],[9,29],[0,3],[0,5],[-4,6],[-10,12],[-4,6],[-2,5],[-4,16],[1,12],[-1,5],[-2,4],[-5,8],[-3,3],[-3,3],[-5,3],[-5,1],[-4,-1],[-6,-2],[-3,-2],[-6,-8],[-6,-9],[-2,-17],[-3,-7],[-6,-7],[-11,-10],[-7,-7],[-5,-8],[-5,-10],[-6,-7],[-9,-6],[-8,-5],[-35,-15],[-5,-1],[-6,1],[-5,4],[-5,4],[-14,21],[-14,14],[-2,4],[-7,16],[-5,5],[-6,4],[-5,2],[-10,3],[-13,1],[-20,-1],[-9,-1],[-9,-2],[-9,-5],[-8,-5],[-5,-5],[-11,-15],[-3,-3],[-6,-4],[-9,-4],[-13,-3],[-7,-1],[-3,0],[-7,2],[-13,5],[-27,8],[-5,2],[-14,7],[-5,2],[-6,1],[-9,2],[-20,2],[-9,2],[-5,1],[-9,5],[-5,2],[-5,5],[-6,7],[-4,4],[-14,9],[-5,4],[-4,4],[-7,9],[-5,9],[-3,8],[0,6],[3,15],[1,7],[6,4],[1,2],[1,0],[0,1],[0,1],[0,10]],[[2720,5914],[0,28],[-2,13],[-2,6],[-3,4],[-12,12],[-3,5],[-2,3],[0,3],[2,5],[15,17],[1,4],[0,3],[-3,12],[15,79]],[[3730,5228],[27,-4],[5,-1],[9,-3],[7,-4],[6,-3],[4,-5],[3,-3],[2,-3],[1,-5],[-2,-13],[-1,-6],[1,-12],[1,-6],[2,-3],[10,-17],[7,-14],[2,-5],[0,-11],[-2,-16]],[[1868,4845],[-10,4],[-7,4],[-5,6],[-7,11],[-9,13],[-9,9],[-9,8],[-4,3],[-5,2],[-5,1],[-12,2],[-5,2],[-2,1],[-2,3],[-2,3],[-5,15],[-7,18],[0,4],[0,3],[2,3],[2,1],[-18,23],[-18,20],[-6,5],[-7,4],[-5,2],[-25,8],[-7,4],[-18,12],[-4,3],[-5,1],[-4,1],[-21,-2],[-7,1],[-5,1],[-12,3],[-10,4],[-4,3],[-12,9],[-6,4],[-7,3],[-8,2],[-33,6],[-22,2],[-7,1],[-17,7],[-25,7],[-13,6],[-29,17],[-9,8],[5,8],[3,7],[3,7],[1,8],[-1,15],[0,4],[2,3],[4,5],[4,2],[23,13],[4,3],[3,4],[2,4],[1,5],[3,12],[3,9],[3,4],[9,10],[10,12],[5,5],[7,3],[5,2],[6,2],[23,3],[12,3],[7,4],[5,4],[6,7],[2,5],[0,5],[0,6],[-2,6],[-7,12],[-11,15],[-5,10],[-3,4],[-5,4],[-3,1],[-5,0],[-25,-5],[-5,0],[-5,1],[-6,3],[-4,2],[-8,6],[-3,4],[-5,8],[-2,4],[-1,5],[1,6],[2,3],[5,8],[5,4],[6,4],[5,1],[6,0],[21,-2],[7,1],[10,3],[5,2],[7,6],[6,7],[16,24],[7,13],[9,24],[2,9],[0,18],[1,5],[3,5],[7,10],[2,5],[0,2],[-2,3],[-4,4],[-4,2],[-20,5],[-5,2],[-4,3],[-4,3],[-2,3],[-1,3],[0,3],[2,4],[3,3],[9,5],[9,4],[8,1],[15,2],[13,0],[7,-1],[15,-3],[8,0],[8,1],[8,2],[15,6],[12,4],[23,3],[30,2],[31,-17],[4,-3],[4,-4],[7,-16],[3,-3],[7,-7],[9,-5],[5,-2],[7,-1],[7,-1],[14,0],[15,0],[7,1],[7,2],[6,3],[5,4],[25,11],[9,3],[14,4],[28,3],[8,1],[27,8],[8,1],[15,0],[8,0],[8,-1],[17,-6],[38,-14],[24,-7],[50,-17],[30,-8],[21,-5],[5,-2],[7,-3],[6,-5],[7,-6],[18,-20],[3,-5],[1,-5],[-2,-12],[0,-4],[1,-3],[5,-3],[9,-2],[18,-1],[87,-1],[9,1],[14,1],[5,1],[5,4],[3,3],[4,9],[4,6],[12,13],[8,8],[-24,25],[-21,19],[-6,6],[-3,6],[0,5],[2,5],[5,5],[6,4],[6,3],[11,3],[5,1],[8,0],[12,-2],[12,-4],[6,-1],[4,1],[4,1],[3,3],[2,3],[2,6],[1,7],[0,13],[-1,14],[-1,7],[-4,10],[-12,21],[-2,7],[1,3],[2,4],[3,3],[17,10],[4,3],[4,4],[3,4],[0,2],[0,9],[-1,6],[-2,5],[-2,3],[-12,12],[-5,6],[-7,12],[-2,6],[1,14],[-1,5],[-1,5],[-4,6],[-5,5],[-8,6],[7,17],[5,11],[5,6],[5,5],[11,9],[6,4],[4,1],[17,5],[5,2],[11,6],[21,14],[6,4],[7,3],[6,2],[5,1],[8,0],[7,-1],[10,-3],[11,-5],[17,-10],[6,-3],[6,-1],[4,1],[17,7],[30,8],[8,3],[24,11],[7,6],[1,0],[1,0],[3,0],[12,0]],[[1621,4712],[-43,48],[-38,27],[-15,16],[-5,45],[-21,21],[-14,-1],[-27,-21],[-15,-3],[-17,7],[-25,20],[-106,59],[-45,36],[-16,33],[-4,51],[-30,55],[-42,46],[-41,26],[-28,4],[-78,-15],[-34,2],[-21,5],[-50,19],[-104,17],[-48,17],[-44,40],[-54,87],[-18,51],[-5,48],[21,53],[34,32],[28,37],[5,70],[-39,112],[6,40],[86,22],[19,12],[15,17],[14,20],[5,18],[-3,41],[5,17],[12,11],[27,12],[11,8],[113,146],[35,76],[18,23],[26,21],[48,31],[24,26],[25,47],[85,306],[10,12],[13,2],[8,7],[-2,26],[-7,21],[-10,15],[-14,10],[-14,12]],[[8661,1478],[-8,-9],[-4,-10],[9,-9],[57,-108],[33,-38],[36,-22],[2,-8],[1,-8],[-1,-8],[-2,-7],[-32,-24],[-63,-93],[17,-35],[-11,-62],[-8,-27],[-30,-102],[-9,-50],[11,-4],[125,-91],[74,-41],[31,-30],[18,-36],[10,-38],[-8,-53],[-33,-93],[-26,-40],[-27,-15],[-31,-5],[-36,-14],[-38,-38],[-38,-93],[-35,-36],[-44,-11],[-101,-2],[-46,-19],[-47,2],[-43,13],[-39,23],[-35,33],[-7,18],[-2,43],[-11,13],[-22,-3],[-63,-52],[-231,-75],[-102,-34],[-84,-12],[-38,3],[-42,4],[-79,22],[-129,52],[-31,5],[-26,-9],[-81,-56],[-17,-3],[-97,1],[-49,-9],[-236,-112],[-31,-15],[-35,-33],[-36,-18],[-1,0],[-41,2],[-85,18],[-120,-2],[-26,11],[-25,70],[-94,111],[3,62],[51,42],[144,34],[50,37],[10,40],[-12,80],[5,39],[22,28],[97,76],[120,155],[24,58],[-2,10],[-17,22],[-4,11],[5,7],[16,7],[5,4],[3,7],[13,52],[-2,7],[24,14],[29,10],[25,13],[14,22],[-20,56],[-49,25]],[[7003,1128],[25,23],[7,5],[8,3],[20,8],[8,3],[23,16],[8,6],[2,3],[1,4],[-2,20],[-1,19],[-1,20],[1,6],[3,5],[3,2],[4,3],[16,7],[6,3],[5,5],[8,9],[4,4],[4,1],[15,6],[3,2],[2,4],[-1,4],[-8,9],[-2,4],[-1,3],[1,5],[2,5],[4,4],[11,8],[6,3],[6,2],[42,10],[4,1],[7,1],[10,-1],[6,1],[26,5],[6,0],[10,0],[7,0],[9,3],[23,6],[9,2],[7,1],[24,-3],[13,-1],[5,0],[5,1],[20,4],[27,5],[15,1],[8,-1],[10,-1],[48,9],[7,2],[14,5],[17,8],[5,5],[4,5],[2,6],[3,21],[2,7],[2,3],[6,8],[5,4],[4,1],[5,1],[7,0],[7,-1],[5,-1],[6,-2],[6,-4],[19,-17],[12,-8],[6,-3],[6,-1],[5,-1],[7,0],[24,4],[33,12],[21,8],[5,2],[18,10],[14,6],[9,1],[9,1],[27,1],[17,-2],[5,-1],[4,-2],[5,-3],[14,-19],[3,-5],[1,-4],[-1,-3],[-3,-5],[-14,-15],[-3,-5],[0,-2],[2,-4],[3,-3],[4,-2],[5,-2],[9,-1],[10,-1],[24,-1],[9,1],[4,2],[5,4],[15,17],[4,4],[5,1],[5,2],[9,1],[10,0],[9,-1],[9,-1],[5,-1],[5,-2],[4,-4],[1,-4],[-2,-14],[1,-4],[1,-4],[2,-3],[8,-6],[44,-26],[22,-9],[19,-5],[5,-1],[4,-2],[5,-4],[9,-14],[3,-3],[9,-6],[11,-6],[6,-3],[28,-6],[9,-4],[10,-6],[6,-2],[4,-1],[4,0],[15,5],[4,1],[6,0],[8,-1],[11,-4],[7,-1],[7,-1],[8,0],[7,2],[4,2],[26,16],[15,17],[13,9],[6,4],[7,3],[12,4],[22,2],[8,2],[8,2],[7,2],[6,4],[12,10],[26,12],[6,4],[6,5],[13,16],[9,10],[13,11],[11,11],[5,3],[4,1],[27,3],[17,5],[10,4],[14,7],[6,2],[24,7],[3,1]],[[8937,1616],[-1,0],[-17,-8],[-43,5],[-33,-1],[-22,-14],[-37,-45],[-26,-17],[-61,-25],[-21,-15],[-15,-18]],[[7003,1128],[-13,7],[-72,13],[-52,-1],[-105,-37],[-35,0],[-41,21],[-77,75],[-37,26],[-55,14],[-152,16],[-91,10],[-58,-1],[-30,-1],[-41,10],[-24,13],[1,7],[12,7],[8,13],[8,39],[32,86],[11,42],[0,53]],[[8746,4525],[-76,-9],[-55,-18],[-29,-34],[-5,-32],[-2,-73],[-5,-40],[-6,-11],[-24,-34],[-8,-13],[-4,-76],[-23,-78],[-31,-59],[-13,-55],[32,-69],[62,-57],[3,-20],[-9,-42],[0,-21],[11,-33],[16,-33],[19,-31],[22,-27],[30,-22],[71,-30],[25,-18],[16,-34],[2,-58],[19,-31],[0,-2],[1,-1],[-1,-1],[0,-2],[-8,-9],[-3,-9],[3,-9],[8,-9],[3,-6],[1,-6],[-1,-7],[-3,-7],[-7,-12],[-2,-13],[1,-12],[30,-47],[45,-121],[23,-48],[33,-24],[80,-29],[17,-13],[34,-35],[23,-13],[26,-5],[52,2],[22,-5],[19,-15],[27,-43],[5,-5]]],"transform":{"scale":[0.0004140006285628612,0.0003939326631663186],"translate":[18.84497847500006,42.23494252500012]}};
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
