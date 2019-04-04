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
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = {"type":"Topology","objects":{"swe":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":null},"id":"-99","arcs":[[0]]},{"type":"MultiPolygon","properties":{"name":"Gävleborg"},"id":"SE.GV","arcs":[[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9,10,11,12,13,14]]]},{"type":"Polygon","properties":{"name":"Jönköping"},"id":"SE.JO","arcs":[[15,16,17,18,19]]},{"type":"MultiPolygon","properties":{"name":"Kalmar"},"id":"SE.KA","arcs":[[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28,29,30,-16,31]]]},{"type":"Polygon","properties":{"name":"Dalarna"},"id":"SE.KO","arcs":[[-12,32,33,34,35,36]]},{"type":"Polygon","properties":{"name":"Kronoberg"},"id":"SE.KR","arcs":[[-31,37,38,39,-17]]},{"type":"Polygon","properties":{"name":"Orebro"},"id":"SE.OR","arcs":[[40,41,42,43,44,-34]]},{"type":"MultiPolygon","properties":{"name":"Östergötland"},"id":"SE.OG","arcs":[[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54,-32,-20,55,-43,56]]]},{"type":"MultiPolygon","properties":{"name":"Södermanland"},"id":"SE.SD","arcs":[[[57]],[[58]],[[59]],[[60,61,62,-57,-42,63]]]},{"type":"Polygon","properties":{"name":"Västmanland"},"id":"SE.VM","arcs":[[-64,-41,-33,-11,64]]},{"type":"Polygon","properties":{"name":"Halland"},"id":"SE.HA","arcs":[[-18,-40,65,66,67]]},{"type":"Polygon","properties":{"name":"Värmland"},"id":"SE.VR","arcs":[[-45,68,69,-35]]},{"type":"Polygon","properties":{"name":"Jämtland"},"id":"SE.JA","arcs":[[70,-13,-37,71,72]]},{"type":"MultiPolygon","properties":{"name":"Norrbotten"},"id":"SE.NB","arcs":[[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[117]],[[118]],[[119]],[[120]],[[121]],[[122]],[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]],[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]],[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[151]],[[152]],[[153]],[[154]],[[155]],[[156]],[[157]],[[158]],[[159]],[[160]],[[161]],[[162]],[[163]],[[164]],[[165]],[[166]],[[167]],[[168]],[[169]],[[170,171]]]},{"type":"MultiPolygon","properties":{"name":"Västernorrland"},"id":"SE.VN","arcs":[[[172]],[[173]],[[174]],[[175]],[[176]],[[177]],[[178]],[[179]],[[180]],[[181]],[[182]],[[183]],[[184]],[[185]],[[186]],[[187]],[[188]],[[189]],[[190,-14,-71,191]]]},{"type":"MultiPolygon","properties":{"name":"Västerbotten"},"id":"SE.VB","arcs":[[[192]],[[193]],[[194]],[[195]],[[196]],[[197]],[[198]],[[199]],[[200]],[[201]],[[202]],[[203]],[[204]],[[205]],[[206]],[[207]],[[208]],[[209,-192,-73,210,-171]]]},{"type":"MultiPolygon","properties":{"name":"Gotland"},"id":"SE.GT","arcs":[[[211]],[[212]],[[213]]]},{"type":"MultiPolygon","properties":{"name":"Stockholm"},"id":"SE.ST","arcs":[[[214]],[[215]],[[216]],[[217]],[[218]],[[219]],[[220]],[[221]],[[222]],[[223]],[[224]],[[225]],[[226]],[[227]],[[228]],[[229]],[[230]],[[231]],[[232]],[[233]],[[234]],[[235]],[[236]],[[237]],[[238]],[[239]],[[240]],[[241]],[[242]],[[243]],[[244]],[[245]],[[246]],[[247]],[[248]],[[249]],[[250]],[[251]],[[252]],[[253]],[[254]],[[255]],[[256]],[[257]],[[258]],[[259]],[[260]],[[261]],[[262]],[[263]],[[264]],[[265]],[[266]],[[267]],[[268]],[[-62,269,270]],[[271]]]},{"type":"MultiPolygon","properties":{"name":"Uppsala"},"id":"SE.UP","arcs":[[[272]],[[273]],[[274]],[[275]],[[276]],[[-270,-61,-65,-10,277]]]},{"type":"MultiPolygon","properties":{"name":"Blekinge"},"id":"SE.BL","arcs":[[[278]],[[279]],[[280]],[[281]],[[282]],[[283]],[[284]],[[285]],[[286]],[[287,288,-38,-30]]]},{"type":"MultiPolygon","properties":{"name":"Västra Götaland"},"id":"SE.VG","arcs":[[[289]],[[290]],[[291]],[[292]],[[293]],[[294]],[[-44,-56,-19,-68,295,-69]]]},{"type":"Polygon","properties":{"name":"Skåne"},"id":"SE.SN","arcs":[[-289,296,-66,-39]]}]}},"arcs":[[[1299,420],[14,-6],[2,-6],[-8,-7],[-8,-2],[-24,17],[1,5],[10,1],[13,-2]],[[4816,3978],[-13,-3],[-5,0],[-6,1],[-11,-2],[-3,3],[-1,5],[1,3],[3,3],[5,2],[12,-1],[5,-3],[3,-3],[13,-1],[1,-2],[-4,-2]],[[4739,4150],[-8,-1],[-16,2],[-8,3],[1,4],[4,5],[7,5],[6,2],[5,-1],[5,-1],[4,-2],[4,-3],[-1,-4],[-3,-2],[-2,0],[-1,-3],[1,-2],[2,-2]],[[4793,4236],[-3,0],[-6,4],[-3,3],[-1,3],[1,5],[5,4],[8,2],[8,-2],[-1,-3],[-2,-1],[-1,-2],[-1,-7],[-4,-6]],[[4883,4536],[11,-3],[5,-6],[-9,-4],[-42,2],[-4,4],[0,3],[-1,1],[-1,-2],[-2,-3],[-1,-3],[-2,-2],[-6,0],[-4,5],[-3,5],[1,5],[12,3],[35,-4],[11,-1]],[[4765,4534],[-8,0],[-7,3],[-2,4],[2,3],[2,2],[1,4],[3,2],[18,-2],[3,-3],[0,-4],[-3,-2],[1,-1],[2,-2],[-12,-4]],[[4971,4660],[-2,-2],[-3,0],[-4,0],[-3,-2],[-1,-3],[-4,-1],[-9,4],[3,7],[15,2],[8,-5]],[[4920,4822],[-5,-1],[-5,5],[4,6],[6,-2],[2,-2],[0,-3],[-2,-3]],[[4950,4824],[-10,-1],[-7,2],[-6,4],[-4,4],[2,2],[10,-3],[17,-1],[3,-3],[-5,-4]],[[4835,3856],[-46,-100],[-26,-30],[-13,-4],[-14,-8],[-16,-18],[-5,-14],[6,-55]],[[4721,3627],[-50,-9],[-15,-7],[-15,-3],[-62,4],[-5,1],[-5,2],[-3,1],[-30,2],[-12,-1],[-11,-3],[-12,-7],[-5,-4],[-1,-4],[2,-5],[-2,-7],[-8,-7],[-81,-25],[-20,-3],[-19,-1],[-31,7]],[[4336,3558],[-6,9],[-9,5],[-15,7],[-13,7],[-13,12],[-20,23],[-15,13],[-40,28],[-26,12],[-18,6],[-11,3],[-13,1],[-18,8],[-24,14],[-71,61],[-4,3],[-5,2],[-10,2],[-9,4],[-11,9],[-38,37],[-2,10],[4,23],[43,17],[61,42],[8,13],[12,9],[16,7],[4,3],[7,13],[2,10],[-3,10],[-13,14],[-21,14],[-42,21],[-32,20],[-9,16],[-29,32],[-20,17],[-21,15],[-28,6],[-152,17],[-89,24],[-26,14],[-48,33],[-2,3],[2,5],[-1,11],[-4,22],[-16,24],[-29,22],[-141,73],[-156,109],[-8,10],[-11,5],[-26,20],[-30,-20],[-12,-6],[-10,-8],[-11,-4],[-295,0],[-7,4],[-2,7],[-15,12],[-10,29],[-140,21]],[[2645,4563],[30,29],[18,67],[18,38],[25,27],[62,41],[23,8],[15,1],[4,-7],[54,-46],[10,-5],[11,-4],[5,4],[4,9],[-10,19],[19,5],[30,-12],[27,2],[17,15],[35,3],[39,-3],[21,-11],[20,0],[10,10],[-1,14],[-4,10],[0,7],[4,5],[11,5],[4,13],[1,12],[-3,13],[-12,29],[6,4],[214,81],[22,17],[7,15],[-8,17],[-11,13],[-17,11],[-21,18],[-16,30]],[[3308,5067],[130,49],[39,7],[34,-3],[441,-69],[211,-7],[396,-51],[150,-2],[34,-6],[185,-16]],[[4928,4969],[-13,-13],[-6,-10],[-1,-14],[0,-9],[-4,-6],[-15,-6],[16,-4],[-7,-10],[-25,-16],[9,-4],[11,-7],[6,-6],[-8,-3],[-36,-3],[-8,-2],[-4,-8],[1,-8],[-2,-7],[-16,-2],[-7,-3],[-5,-5],[-3,-8],[0,-9],[3,-9],[10,-13],[2,-6],[-2,-5],[-11,-4],[-2,-3],[-1,1],[0,-5],[0,-6],[1,0],[2,-1],[4,-2],[1,-3],[-5,-7],[-3,-3],[-3,-4],[-1,-4],[2,-4],[10,-3],[39,5],[-3,-6],[-6,-5],[-8,-3],[-8,0],[0,-6],[12,-3],[2,-9],[-3,-11],[-1,-11],[4,-14],[6,-4],[38,5],[13,4],[13,0],[14,-6],[9,-9],[5,-8],[0,-8],[-6,-8],[-5,-10],[-2,-13],[-5,-10],[-11,-5],[-15,1],[-12,2],[-10,5],[-10,7],[-28,32],[-15,12],[-24,6],[1,-9],[4,-7],[10,-14],[-29,4],[-10,6],[3,11],[-28,12],[-32,4],[-65,-1],[9,-8],[12,-3],[26,0],[52,-15],[-7,-12],[-24,-8],[-27,-4],[-20,-1],[0,-5],[6,0],[15,-5],[-22,-4],[-35,7],[-16,-8],[97,-10],[17,-10],[-17,-4],[-13,1],[-27,8],[-17,2],[-50,-2],[0,-5],[27,1],[11,-3],[9,-7],[-33,-8],[-35,-2],[20,-8],[78,-7],[0,-5],[-72,1],[-8,-4],[7,-4],[17,-3],[14,-6],[19,-2],[8,-2],[0,-6],[-31,0],[0,-4],[29,-7],[7,-4],[3,-9],[-4,-4],[-8,-5],[-7,-7],[5,-6],[3,-6],[5,-5],[8,-3],[10,0],[5,4],[4,4],[7,2],[5,-2],[1,-5],[-3,-5],[-8,-3],[-9,0],[-8,-2],[-7,-3],[-7,-5],[-6,6],[-8,6],[-8,3],[-7,-14],[-15,-6],[-3,-7],[4,-5],[22,-17],[22,-10],[25,-6],[1,-8],[56,-17],[-22,-2],[-25,2],[-47,11],[11,-15],[20,-7],[23,-3],[19,-5],[-32,1],[-14,2],[-39,18],[-13,2],[-16,1],[0,-5],[18,-4],[23,-10],[22,-14],[15,-12],[9,-17],[-11,-7],[-20,-4],[-15,-12],[26,-10],[-3,-18],[-6,-6],[-12,-6],[16,-10],[3,-9],[-9,-6],[-19,0],[8,-2],[20,-1],[8,-2],[3,-4],[2,-5],[-2,-4],[-6,-2],[-7,-3],[-5,-8],[-4,-10],[-2,-9],[3,-3],[5,-4],[7,-3],[-15,-8],[-6,-2],[40,3],[19,-1],[9,-7],[-45,-6],[-16,-9],[-7,-20],[0,-9],[0,-3],[16,-8],[14,-1],[6,-1],[-2,-9],[2,-5],[6,-9],[2,-3],[13,4],[6,-1],[4,-4],[27,-41],[-6,-1],[-7,-2],[-5,-3],[-2,-4],[3,-9],[5,0],[7,1],[5,-3],[2,-9],[-2,-8],[1,-6],[10,-6],[14,-2],[12,0],[3,-2],[-9,-11],[-9,-5],[-24,-7],[-21,-11],[-28,-11],[-18,-3],[-4,-3],[1,-4],[5,-1],[9,1],[17,3],[7,1],[16,-2],[15,-11],[24,-5],[41,-17],[-31,-10],[0,-5],[12,-4],[16,-1],[12,1]],[[3372,1730],[16,-12],[8,-4],[26,-10],[23,-12],[9,-3],[15,0],[5,-1],[4,-2],[16,-5],[7,-3],[7,-4],[5,-6],[4,-4],[5,-4],[17,-2],[3,-3],[-3,-5],[-36,-27],[-2,-5],[4,-6],[7,-4],[18,-4],[5,-2],[3,-5],[1,-8],[-1,-7],[-6,-6],[-2,-1],[-3,-2],[-5,-5],[-5,-8],[-4,-13],[-6,-7],[-7,-4],[-6,1],[-6,2],[-5,4],[-5,4],[-5,4],[-5,2],[-6,0],[-8,-1],[-8,-3],[-7,-8],[-3,-9],[4,-20],[0,-7],[-7,-14],[-1,-7],[4,-22],[-3,-11],[-6,-5],[-11,-5],[-3,-4],[-1,-7],[2,-8],[4,-10],[31,-26],[5,-21]],[[3454,1365],[-102,17],[-35,3],[-104,-4],[-9,2],[-42,4],[-5,-2],[10,-18],[3,-7],[-1,-6],[-5,-1],[-30,4],[-18,-2],[-22,-8],[-40,-21],[-16,-5],[-13,-1],[-25,2],[-16,5],[-12,8],[-4,8],[-4,8],[-8,6],[-64,19],[-30,0],[-39,-5],[-129,-32],[-87,-10],[-21,-5],[-17,-10],[-6,-13],[-5,-40],[-8,-19],[-2,-8],[2,-8],[6,-6],[7,-4],[12,-6],[0,-1],[1,-6],[4,-12],[0,-6],[-2,-8],[-17,-20],[-27,-25],[-3,-1],[-2,-1],[-6,-1],[-23,2],[-24,6],[-11,6],[-8,7],[-30,47],[-13,15],[-4,3],[-10,6],[-13,5],[-20,7],[-20,9],[-17,5],[-11,0],[-13,0],[-18,-5],[-20,0],[-25,-3],[-60,-26],[-7,-1],[-9,1],[-31,16],[-22,7],[-14,-2],[-9,-2],[-43,-34]],[[2048,1198],[-40,13],[-25,15],[-4,6],[-1,7],[1,10],[-7,11],[-13,6],[-16,6],[-28,7],[-10,6],[-6,2],[-7,2],[-24,3],[-22,4],[-10,2],[-14,0],[-94,-13],[-13,0],[-7,-1],[-3,-3],[-2,-4],[-3,-4],[-2,-3],[-5,-2],[-15,-5],[-6,-4],[-13,-12],[-5,-3],[-7,-4],[-9,-2],[-7,1],[-3,1],[-12,16],[-16,15],[-6,9],[-3,10],[1,11],[4,10],[3,6],[13,8]],[[1612,1325],[14,8],[13,10],[41,42],[19,13],[15,7],[11,1],[7,2],[4,4],[13,21],[13,9],[14,5],[29,8],[31,14],[47,31],[32,14],[9,5],[10,9],[40,45],[32,28],[25,15],[9,7],[6,10],[1,28],[2,10],[9,11],[15,14],[3,8],[-2,15],[-3,9],[1,8],[7,18],[6,7],[6,7],[8,6],[5,6],[1,9],[-1,12],[-13,32],[42,-1],[17,-2],[78,5],[17,-3],[20,-10],[17,-5],[12,-2],[8,2],[4,4],[2,5],[1,6],[3,5],[2,4],[4,3],[5,2],[38,8],[3,2],[5,3],[49,12],[23,8],[16,9],[9,9],[4,9],[-1,9],[-8,18],[-2,7],[1,1],[144,163]],[[2604,2104],[44,-51],[22,-14],[63,-17],[179,-12],[30,1],[17,4],[11,7],[5,7],[4,13],[5,3],[7,2],[40,7],[6,-1],[5,-4],[3,-5],[15,-15],[6,-9],[8,-18],[6,-16],[2,-5],[6,-5],[20,-15],[5,-5],[1,-5],[-2,-4],[-4,-2],[-5,-2],[-8,-2],[-18,-3],[-6,-3],[-4,-5],[-1,-8],[-3,-6],[-7,-8],[-1,-4],[5,-7],[1,-4],[-1,-4],[-4,-5],[0,-6],[5,-9],[28,-23],[9,-10],[4,-9],[2,-9],[4,-10],[9,-15],[20,-26],[16,-16],[16,-9],[17,-4],[186,-8]],[[4256,1291],[8,-5],[13,-1],[6,-3],[-6,-3],[-13,3],[-5,0],[-3,0],[1,2],[-5,3],[-7,-1],[-7,-1],[-5,3],[2,3],[-1,3],[-1,3],[7,0],[16,-6]],[[4219,1339],[4,-4],[2,-5],[-2,-3],[-23,-8],[-6,3],[-2,5],[-1,2],[8,9],[5,1],[5,-1],[3,0],[3,1],[4,0]],[[4398,1391],[-1,-1],[-10,3],[5,5],[6,-4],[0,-3]],[[4606,1461],[6,-2],[7,3],[5,6],[5,0],[0,-4],[2,-1],[2,-2],[1,-3],[4,-3],[3,-3],[2,-4],[2,-5],[-21,-1],[-16,-9],[-26,-25],[17,-21],[1,-11],[-11,-19],[0,-6],[-1,-3],[-3,-2],[-10,-2],[-3,-1],[-4,-7],[-3,-11],[-3,-7],[-32,-32],[-4,-10],[-5,-20],[-14,-8],[-17,-4],[-16,-6],[4,-6],[6,-5],[8,-2],[8,-2],[-15,-7],[-11,-8],[-21,-20],[5,-10],[5,-15],[-1,-14],[-12,-6],[-7,-8],[-12,-39],[-9,-13],[-2,0],[-35,-11],[-5,-4],[-5,-6],[-3,-7],[-2,-7],[0,-8],[-4,-14],[-44,-75],[-6,-14],[-3,-17],[-3,-7],[-6,-7],[-8,-6],[-6,-2],[-10,-3],[-4,-6],[-4,-16],[0,-4],[4,-3],[1,-3],[-2,-4],[-7,-8],[-2,-3],[-1,-13],[-2,-8],[-5,-7],[-11,-13],[-10,-15],[-8,-16],[-4,-13],[-1,-6],[1,-17],[-3,-7],[-10,-11],[-3,-7],[-6,-11],[-38,-49],[-14,-9],[-17,-6],[-16,-1],[-12,8],[-2,7],[2,17],[0,7],[-10,20],[6,16],[1,18],[-2,31],[6,11],[-5,13],[-8,14],[-4,14],[6,63],[2,7],[13,23],[18,16],[2,6],[5,15],[127,172],[13,7],[16,3],[24,1],[20,3],[11,9],[13,28],[34,45],[39,40],[33,43],[13,54],[3,8],[7,3],[16,5],[10,6],[4,7],[3,41],[3,13],[17,9],[23,20],[12,6],[15,4],[8,-1],[6,-10]],[[4338,1576],[-3,0],[-11,3],[-7,3],[-6,7],[-2,4],[14,-5],[9,-5],[6,-7]],[[4344,1650],[-19,-18],[-7,-2],[-8,3],[-4,4],[-4,1],[-2,-1],[-2,-2],[-5,0],[-2,-1],[0,-2],[-2,-1],[-2,3],[1,5],[4,4],[1,3],[8,2],[3,3],[16,-2],[2,4],[0,7],[1,4],[2,1],[19,-3],[2,-5],[-2,-7]],[[4330,1780],[-3,-1],[-13,6],[-3,3],[-17,6],[-4,4],[5,3],[6,2],[29,-2],[7,-4],[3,-4],[-2,-2],[-1,-2],[-5,-3],[-1,-3],[-1,-3]],[[4345,1833],[14,-11],[12,-1],[-1,-3],[0,-2],[3,-2],[0,-2],[0,-3],[6,-4],[8,-3],[2,-4],[-7,-1],[-6,4],[-1,2],[-5,2],[-11,-4],[-5,1],[-3,2],[1,4],[-4,3],[-3,5],[-4,3],[-8,4],[-3,1],[-3,-1],[-4,0],[1,4],[8,4],[-2,1],[2,1],[13,0]],[[4313,1932],[9,-13],[6,-6],[9,3],[7,5],[6,-1],[4,-7],[1,-12],[4,-4],[20,-13],[7,-6],[-13,0],[-29,10],[7,-11],[22,-11],[2,-8],[-8,-7],[-13,0],[-13,4],[-10,6],[-14,18],[-7,2],[-2,-15],[-7,-5],[-15,0],[-30,2],[2,7],[0,6],[-3,6],[-4,6],[8,1],[8,-1],[8,-2],[6,-3],[-97,57],[-8,-1],[-5,-4],[-3,-6],[2,-5],[5,-5],[21,-15],[44,-11],[-4,-2],[-7,-6],[-4,-2],[5,-7],[0,-7],[-3,-6],[-8,-5],[-14,9],[-14,5],[-34,6],[11,-9],[-6,-6],[-5,3],[-15,3],[0,-6],[163,-95],[23,-10],[-5,-5],[-13,3],[-36,13],[-10,7],[-60,47],[-93,40],[6,-13],[9,-8],[26,-13],[43,-16],[32,-22],[6,-6],[5,-6],[5,-4],[10,-2],[8,-3],[27,-15],[9,-7],[-10,-5],[16,0],[13,-3],[11,-6],[8,-11],[-17,0],[0,-5],[10,0],[0,-5],[-51,3],[-23,4],[-24,8],[6,-6],[14,-9],[6,-5],[7,-11],[-2,-6],[-10,-1],[-16,4],[6,-8],[9,-2],[9,-1],[7,-4],[5,-9],[-4,-4],[-7,-1],[-7,-4],[-7,-5],[-21,-11],[-6,-2],[-4,3],[-1,7],[0,8],[0,7],[-6,-3],[-7,-2],[-6,2],[-7,3],[7,-8],[4,-3],[5,-3],[-11,-9],[-5,-2],[0,-5],[16,-5],[0,-5],[-21,0],[0,-4],[59,-1],[28,-6],[21,-30],[17,-19],[7,-13],[-22,3],[9,-12],[-4,-3],[-11,-1],[-10,-4],[-4,-9],[4,-7],[11,-6],[15,-2],[-13,-5],[-14,-2],[-9,-5],[5,-14],[-45,5],[-19,-4],[-10,-16],[27,-10],[-7,-6],[-9,-4],[-1,-3],[11,-7],[-58,-18],[-12,-14],[19,-23],[-22,-11],[-6,-18],[6,-19],[11,-17],[22,-20],[9,-5],[7,-2],[5,0],[5,0],[7,-5],[13,-18],[-12,-4],[5,-8],[10,-10],[7,-8],[-10,0],[-27,5],[-1,2],[1,3],[0,4],[-5,1],[-5,-1],[-3,-2],[-1,-1],[-1,-1],[-3,-2],[-2,-4],[-1,-4],[-2,-3],[-3,-1],[-2,1],[-4,2],[-12,2],[-18,4],[-10,0],[6,-5],[6,-5],[7,-3],[7,-2],[0,-5],[-15,-1],[-11,-7],[-3,-11],[3,-16],[8,-9],[9,-6],[5,-5],[-4,-8],[-20,-20],[0,-4],[3,-20],[-1,-8],[-2,-7],[-21,-36],[-1,-6],[6,-9],[10,-3],[9,3],[9,5],[8,3],[7,-3],[2,-6],[-2,-6],[-4,-5],[-9,-2],[-21,5],[-11,2],[-12,-2],[-16,-7],[-11,-1],[-4,-4],[5,-9],[11,-15],[3,-23],[-1,-14],[-6,-10],[-10,-5],[-13,-2],[-12,0],[-19,8],[-9,-1],[-10,-4],[-8,-2],[-7,-2],[-7,-6],[-17,-21],[-2,-4],[0,-3],[-1,-8],[-3,-16],[-2,-17],[-5,-7],[-21,-1],[-5,-7],[-5,-14],[-36,-39],[-17,-26],[-22,-61]],[[3844,725],[-4,0],[-15,-3],[-8,-4],[-15,-1],[-24,1],[-91,18],[-45,18],[-57,39],[-43,21],[-53,32],[-14,6],[-13,1],[-9,-1],[-8,-4],[-2,-2],[-2,-2],[-1,-3],[-3,-3],[-6,-2],[-6,0],[-41,5],[-16,5],[-14,1],[-17,-1],[-4,-2],[-21,-12]],[[3312,832],[-6,7],[0,4],[-1,2],[11,23],[5,7],[7,5],[9,3],[7,5],[2,8],[1,13],[7,66],[-2,15],[-3,9],[-9,18],[-6,16],[1,8],[5,4],[19,5],[7,3],[10,6],[9,3],[10,1],[37,0],[10,2],[9,5],[7,5],[2,7],[-1,9],[-4,11],[-5,11],[-13,19],[0,8],[4,5],[9,5],[11,3],[11,2],[14,-1],[46,-15],[8,-1],[7,1],[13,4],[69,0],[22,3],[18,11],[8,11],[0,12],[-5,9],[-13,17],[-2,3],[-2,4],[-3,5],[-6,7],[-42,32],[-7,8],[-7,5],[-32,18],[-6,5],[-3,5],[-1,4],[-2,3],[-8,4],[-42,10],[-12,6],[-4,9],[0,10],[-2,7],[-5,5],[-19,9]],[[3372,1730],[9,16],[1,5],[3,7],[7,4],[16,5],[33,7],[14,4],[8,6],[7,10],[9,7],[14,9],[24,18],[13,5],[14,3],[27,3],[17,1],[29,-3],[14,-3],[34,-13],[54,-6],[22,-7],[19,0],[15,3],[20,8],[30,21],[9,10],[3,10],[-3,11],[-5,13],[-3,8],[2,6],[4,5],[11,8],[5,6],[3,6],[-1,5],[-3,4],[-28,21],[-5,7],[-2,6],[2,6],[4,6],[1,4],[-2,4],[-6,3],[-3,4],[3,5],[12,0],[45,-5],[24,1],[23,-2],[9,2],[5,5],[3,7],[11,9],[14,5],[46,9],[19,2],[49,-3],[26,4],[15,1],[15,-1],[17,-5],[11,-5],[9,-6],[9,-4],[9,-1],[28,3],[12,-1],[10,-3],[8,-6],[5,-6],[11,-34],[6,-10],[10,-12],[3,-2],[4,-3],[3,-2],[12,-3],[19,0]],[[4336,3558],[2,-10],[-15,-4],[-110,-15],[-27,-15],[-34,-32],[-18,-9],[-20,-6],[-45,-7],[-33,-3],[-73,5],[-14,2],[-21,8],[-8,5],[-3,6],[0,5],[-2,6],[-5,16],[-17,10],[-12,3],[-27,3],[-12,4],[-8,3],[-16,-2],[-15,4],[-28,4],[-20,0],[-18,-2],[-43,-9],[-7,0],[-19,3],[-14,0],[-15,-6],[-35,-17],[-2,-6],[4,-4],[2,-4],[-12,-18],[-9,-10],[-14,-8],[-3,-6],[3,-6],[8,-5],[3,-5],[-1,-4],[-1,-3],[2,-28],[-3,-4],[-8,-8],[-20,-11],[-15,-3],[-13,1],[-18,6],[-21,4],[-28,1],[-16,-6],[-9,-9],[-5,-13],[-5,-8],[-19,-11],[-9,-6],[-7,-7],[-7,-12]],[[3381,3315],[-141,88],[-8,4],[-15,5],[-167,36],[-68,8],[-35,9],[-14,7],[-5,4],[-2,4],[0,3],[0,3],[-4,2],[-11,1],[-15,-3],[-34,-13],[-9,-15],[-4,-13],[15,-28],[-21,-3],[-20,0],[-201,13]],[[2622,3427],[-147,52],[-16,22],[-19,16],[-4,8],[-21,26],[-16,17],[-11,7],[-12,3],[-64,3],[-39,9],[-8,0],[-6,-1],[-1,-4],[4,-7],[8,-6],[23,-13],[0,-3],[-4,-3],[-12,-4],[-16,-4],[-17,5],[-81,42],[-134,106],[-21,9],[-85,20],[-17,7],[-11,6],[-30,24],[-1,2],[-12,17],[-27,28],[-104,88],[-12,6],[-10,3],[-13,3],[-8,5],[-6,6],[-23,36],[-19,17],[-32,22],[-259,135],[-10,10],[-22,29],[-2,2]],[[1305,4173],[2,3],[14,49],[5,10],[6,7],[55,39],[15,16],[11,20],[26,69],[-1,9],[-8,7],[-199,128],[-23,11],[-24,4],[-52,2],[-29,3],[-21,6],[-60,37],[-35,13],[-87,44],[-11,10],[59,186],[59,186],[-2,28]],[[1005,5060],[20,1],[345,-49],[135,-56],[55,-36],[105,-27],[74,3],[74,-32],[-18,-17],[-24,-55],[62,-51],[28,-31],[37,-29],[21,-23],[17,-26],[46,-20],[522,-43],[65,-13],[76,7]],[[3312,832],[-16,-9],[-8,-2],[-11,0],[-22,3],[-15,0],[-16,-3],[-8,-4],[-4,-5],[-3,-4],[-4,-3],[-5,-2],[-8,0],[-13,1],[-17,4],[-23,8],[-10,2],[-13,0],[-36,-6],[-33,-1],[-8,-2],[-5,-2],[-2,-5],[-3,-5],[-5,-6],[-26,-20],[-25,-12],[-16,-3],[-19,1],[-109,16],[-19,6],[-27,13],[-28,17],[-24,10],[-42,10]],[[2689,829],[-137,21],[-39,10],[-23,3],[-87,-1],[-12,2],[-18,9],[-10,3],[-11,-1],[-13,-5],[-11,-6],[-6,-6],[-3,-4],[-3,-9],[-4,-5],[-14,-5],[-23,-5],[-315,-41],[-57,0]],[[1903,789],[-23,18],[-11,19],[-3,7],[-1,6],[1,6],[2,4],[1,7],[-1,10],[-5,22],[-8,15],[-15,17],[-50,50],[-14,10],[-17,10],[-2,2],[4,7],[2,4],[0,6],[-2,11],[5,36],[-2,21],[3,11],[5,8],[9,12],[4,4],[5,2],[13,1],[25,6],[12,1],[51,0],[11,1],[29,9],[63,10],[15,4],[12,6],[15,10],[12,14],[4,8],[-4,14]],[[3381,3315],[7,-9],[13,-10],[2,-7],[-3,-6],[-6,-7],[2,-3],[11,-3],[15,-2],[23,-8],[12,-12],[15,-22],[3,-14],[-4,-16],[-14,-32],[-2,-18],[4,-10],[7,-4],[9,-2],[32,0],[15,-1],[12,-10],[4,-12],[2,-21],[4,-9],[7,-7],[10,-1],[19,1],[8,-1],[9,-4],[1,-7],[-3,-7],[-15,-14],[0,-2],[0,-1],[0,-4],[3,-4],[18,-13],[4,-10],[1,-11],[-8,-8],[-15,-5],[-58,-10],[-5,-4],[-5,-8],[-2,-9],[3,-7],[5,-6],[9,-5],[3,-4],[1,-2],[-20,-29],[-2,-7],[4,-3],[31,-8],[19,-9],[17,-16],[9,-7],[12,-2],[31,1],[10,-1],[1,-4],[-3,-3],[-17,-15]],[[3626,2821],[-5,-7],[2,-6],[6,-11],[18,-25],[2,-7],[-4,-5],[-11,-5],[-15,-4],[-21,-4],[-13,-3],[-9,-4],[-9,-9],[-25,-13],[-10,-7],[-8,-7],[-3,-7],[7,-8],[8,-7],[48,-23]],[[3584,2659],[-33,-7],[-21,-1],[-20,-5],[-17,-7],[-6,-6],[-2,-6],[3,-5],[2,-8],[-4,-11],[-20,-16],[-21,-8],[-84,-21],[-21,-3],[-21,0],[-27,5],[-20,1],[-24,-3],[-82,-28],[-22,-12],[-59,-45],[-26,-16],[-14,-6],[-88,-13],[-26,-9],[-37,-17]],[[2894,2412],[-49,19],[-16,11],[-9,19],[-14,15],[-15,6],[-14,2],[-9,-2],[-4,-3],[-2,-4],[-3,-4],[-6,-4],[-12,-5],[-15,-4],[-6,0],[-4,3],[-4,6],[-8,3],[-30,2],[-18,5],[-7,7],[-1,15],[-4,11],[-11,12],[-43,35],[-7,11],[-1,9],[1,9],[-1,7],[-5,8],[-16,17],[-14,18],[-12,20],[-6,7],[-12,19]],[[2517,2682],[11,30],[4,29],[-4,15],[-10,23],[-3,9],[0,34],[3,24],[12,44],[14,29],[18,27],[27,31],[5,7],[2,5],[5,5],[25,14],[8,7],[4,8],[-3,11],[-2,2],[-14,7],[-9,6],[-5,7],[0,9],[5,12],[7,6],[8,2],[6,-1],[9,-3],[4,5],[1,11],[-6,31],[-6,15],[-10,16],[-6,13],[-7,29],[-2,19],[3,48],[-7,65],[-7,14],[-13,7],[-24,8],[-9,5],[-4,4],[2,6],[12,5],[64,20],[-3,25]],[[4413,2013],[1,-2],[3,1],[6,2],[6,-1],[-4,-5],[-13,-1],[-16,3],[-10,7],[4,6],[10,4],[8,1],[3,-1],[4,-6],[0,-3],[-8,-3],[1,-1],[3,0],[2,-1]],[[4494,2088],[0,-2],[2,1],[3,3],[5,-3],[3,-4],[0,-2],[1,-1],[2,-4],[-9,-5],[-5,2],[-9,3],[-5,-1],[-1,5],[1,5],[6,4],[4,1],[2,-2]],[[4555,2123],[-6,0],[4,5],[2,2],[4,0],[5,4],[9,2],[4,0],[3,-1],[0,-2],[-2,-3],[-5,-1],[-5,0],[-6,-2],[-4,-3],[-3,-1]],[[4483,2123],[-3,-4],[-1,7],[6,5],[6,6],[6,-3],[0,-6],[-8,-4],[-6,-1]],[[4451,2139],[-10,0],[-6,2],[-8,11],[-3,10],[9,5],[16,-4],[8,-4],[3,-4],[-1,-10],[-8,-6]],[[4444,2233],[4,-2],[-2,-4],[-8,-7],[-9,-2],[-8,1],[14,-7],[-2,-2],[-8,0],[-5,-4],[2,-6],[12,-7],[18,-9],[16,0],[15,3],[6,-1],[-3,-1],[-1,0],[-4,-4],[-3,-2],[-7,-4],[-10,-3],[-13,0],[-14,2],[-14,6],[-10,8],[-4,7],[-4,3],[-3,4],[1,5],[-4,5],[-8,6],[3,6],[14,4],[7,1],[10,3],[5,1],[3,-1],[10,2],[4,-1]],[[4523,2247],[-2,-5],[-4,0],[-2,7],[-3,3],[9,3],[4,2],[5,0],[4,-3],[-6,-5],[-5,-2]],[[4537,2294],[-7,-2],[-9,3],[-6,4],[1,5],[8,3],[12,-3],[9,-1],[3,-4],[-4,-2],[-4,-1],[-3,-2]],[[4511,2310],[-1,-3],[-7,1],[-2,3],[-7,0],[-13,3],[-11,7],[-1,4],[6,2],[7,0],[11,-5],[7,-5],[5,-2],[6,-5]],[[4385,2404],[-153,9],[-262,16],[0,-5],[10,-3],[8,-5],[3,-6],[-4,-6],[-12,-2],[-32,4],[-14,-2],[0,-5],[10,3],[9,1],[8,-2],[4,-7],[15,5],[35,-9],[15,6],[11,9],[10,2],[9,-2],[17,-11],[3,-1],[0,-2],[0,-10],[4,-6],[8,-3],[9,1],[7,3],[5,9],[4,12],[6,10],[8,7],[11,-2],[38,-11],[10,-5],[90,2],[16,-3],[14,-9],[11,-4],[30,-2],[14,-7],[-2,4],[-2,8],[-1,4],[26,-5],[10,0],[-7,-14],[4,-11],[14,-8],[20,-2],[-7,-4],[-3,-2],[0,-4],[20,0],[0,-5],[-7,-7],[9,-4],[29,-4],[42,-20],[-18,-6],[-38,0],[-17,-4],[7,-11],[-17,-8],[-26,-5],[-18,-1],[-5,-2],[-9,-7],[-4,-1],[-6,0],[-10,4],[-5,1],[-93,9],[-44,14],[-74,13],[-22,-6],[27,-2],[160,-44],[25,-1],[10,-4],[7,-9],[0,-7],[-3,-6],[-1,-6],[4,-7],[6,1],[12,3],[10,4],[2,2],[9,-3],[3,-5],[3,-17],[-108,11],[12,-8],[28,-11],[11,-7],[-2,-7],[1,-5],[9,-3],[9,1],[4,3],[0,5],[-5,6],[44,5],[15,-1],[-7,-14],[-4,-1],[-13,2],[-4,-1],[-1,-2],[0,-4],[-1,-5],[-3,-3],[-9,-3],[-28,-2],[0,-5],[18,-3],[55,-17],[-7,-4],[-3,-1],[10,-5],[8,-8],[6,-9],[2,-11],[-1,-9],[-4,-2],[-7,2],[-9,1],[-6,-2],[3,-4],[6,-5],[7,-3],[-24,-23],[-42,14],[-46,26],[-33,13],[11,-13],[30,-15],[11,-13],[-5,1],[-10,-1],[-5,0],[16,-14],[26,-18],[16,-14],[-16,-4],[2,-9],[-4,-5],[-9,-2],[-11,1],[16,-6],[13,-3],[12,-5],[11,-10],[-7,-7],[-6,-1],[-7,2],[-6,6],[-22,-8],[-4,-4],[10,-8],[-16,5],[-15,22],[-11,3],[-10,-8],[5,-10],[17,-18],[9,1],[11,-1],[0,-1]],[[2604,2104],[290,308]],[[3584,2659],[41,-11],[8,1],[10,3],[10,15],[4,3],[7,3],[15,5],[14,0],[10,-2],[27,-14],[123,-46],[44,-26],[122,-48],[11,-8],[9,-11],[11,-10],[38,-24],[4,-5],[3,-13],[7,-8],[13,-9],[12,-6],[10,-2],[133,-3],[44,-6],[36,-11],[23,-13],[12,-9]],[[4918,2458],[-18,-5],[-2,3],[1,7],[2,5],[6,2],[8,-5],[3,-7]],[[4926,2492],[0,-9],[-12,-2],[-8,0],[-9,-15],[-6,-2],[-6,2],[-4,4],[-4,5],[3,1],[5,-2],[3,1],[1,3],[-1,4],[-4,2],[-10,1],[-1,4],[4,4],[8,2],[9,-1],[7,-3],[4,-5],[0,3],[-2,3],[1,4],[8,1],[14,-5]],[[5080,2522],[-9,-1],[-25,8],[-10,8],[-29,12],[-5,6],[0,3],[3,-4],[49,-17],[23,-10],[3,-5]],[[4525,3059],[79,-8],[58,4],[17,-1],[23,-5],[30,-11],[4,-2],[1,-2],[2,-5],[14,-12],[23,-12],[47,-12],[26,-10],[17,-9],[21,-22]],[[4887,2952],[8,-7],[0,-6],[-5,-8],[-13,-4],[-27,-1],[-13,-2],[-11,-2],[-8,-5],[-9,-9],[-3,-17],[1,-20],[-5,-15],[-30,-15],[-6,-5],[-2,-5],[0,-7],[4,-9],[1,-8],[5,-11],[8,-12],[22,-25],[13,-57],[5,-10],[4,-7],[16,-16],[8,-2],[13,-2],[50,1],[34,-2],[25,-7],[22,-12]],[[4994,2645],[-4,-3],[-3,-3],[6,-4],[6,-3],[7,-2],[7,-1],[0,-5],[-8,-6],[10,-3],[10,-4],[-7,-12],[-14,-6],[-16,1],[-16,4],[-16,1],[7,-9],[11,-7],[23,-9],[0,-5],[-16,0],[6,-3],[5,-2],[-21,0],[-57,23],[-25,7],[0,-5],[13,-5],[3,-8],[-6,-22],[-7,-12],[-1,-6],[5,-2],[6,-1],[18,-9],[-22,-6],[-92,11],[26,-20],[3,-10],[-14,-10],[-40,1],[-22,-3],[0,-13],[-86,1],[-23,4],[-8,5],[-15,12],[-11,3],[-9,-2],[-22,-7],[-13,-1],[10,-3],[24,-2],[8,-5],[0,-7],[-5,-6],[-6,-4],[-5,-3],[15,-5],[32,2],[16,-2],[0,-5],[-18,-10],[-11,-10],[-11,-6],[-18,1],[-44,14],[-28,3],[-16,-12],[37,-1],[13,-6],[12,-13],[-17,0],[-67,-12],[-108,7]],[[3626,2821],[60,12],[18,7],[14,7],[4,8],[0,6],[0,7],[1,6],[6,6],[45,41],[8,5],[15,6],[31,7],[18,1],[15,-1],[48,-7],[18,0],[23,2],[53,11],[17,5],[9,5],[4,3],[1,3],[-1,3],[-3,2],[-16,5],[-7,4],[-5,6],[-3,6],[-1,6],[3,5],[1,0],[0,1],[9,3],[425,41],[12,-2],[22,1],[10,2],[45,15]],[[4721,3627],[109,-43],[15,-8],[4,-11],[-7,-17],[-59,-91],[-14,-13],[-13,-6],[-11,-2],[-19,1],[-9,-1],[-7,-5],[-24,-23],[-9,-7],[-1,-2],[-1,-5],[5,-6],[9,-4],[12,-3],[7,-4],[2,-8],[-1,-13],[-4,-18],[-7,-12],[-11,-9],[-39,-13],[-32,-15],[-13,-4],[-15,-2],[-9,2],[-8,5],[-10,10],[-5,2],[-43,4],[-52,10],[-11,1],[-6,-1],[-3,-4],[0,-7],[2,-17],[-4,-9],[-11,-7],[-36,-12],[-2,-6],[7,-10],[78,-85],[12,-20],[23,-57],[8,-12],[7,-11]],[[1903,789],[-37,4],[-24,-3],[-23,-4],[-54,-18],[-18,-8],[-16,-9],[-13,-10],[-20,-11],[-17,-3],[-12,0],[-9,4],[-9,5],[-10,4],[-105,11],[-24,4],[-4,3],[-3,5],[0,6],[3,7],[4,6],[2,5],[0,5],[-2,5],[-3,4],[-4,3],[-34,13],[-15,9]],[[1456,826],[7,8],[10,16],[4,15],[-3,14],[-23,34],[-14,32],[-11,9],[-22,3],[-18,-1],[-30,-6],[-12,0],[-12,0],[-12,2],[-39,24],[-7,9],[-5,17],[-11,7],[-14,7],[-11,12],[-16,27],[4,16],[-2,8],[-48,19],[-4,2],[0,3],[0,3],[-1,2],[-5,1],[-13,2],[-4,2],[-14,14],[-8,4],[-24,3],[-20,7],[-28,5],[-14,9],[-8,12],[-2,16],[1,4],[7,6],[1,2],[0,5],[-4,7],[0,4],[-2,4],[-4,5],[-6,5],[-24,7],[-23,9],[-18,14],[-2,13],[-5,2],[-15,8],[15,11],[-4,10],[-22,19],[-2,6],[-3,15],[0,6],[-4,0],[-23,0],[-9,3],[23,11],[8,6],[-8,3],[-17,1],[-15,2],[-13,4],[-15,8],[22,0],[10,1],[10,4],[-11,3],[-11,2],[-24,0],[0,5],[8,4],[5,5],[5,4],[18,4],[3,4],[0,5],[-3,4],[1,9],[-6,6],[-8,6],[-8,4],[-2,2],[-3,3],[-3,4],[-5,1],[-6,-1],[-12,-4],[-5,0],[-14,9],[11,9],[20,10],[14,12],[-37,0],[17,6],[7,7],[-1,8],[-23,26],[-5,3],[-7,-1],[-6,-3],[-5,-4],[-5,-2],[-12,-11],[-11,-50],[-10,-14],[-5,13],[-17,-2],[-13,0],[9,19],[-9,0],[-8,0],[-7,2],[-7,3],[9,7],[-2,9],[-5,12],[-2,12],[2,12],[7,8],[11,5],[11,5],[-13,6],[-13,4],[5,1],[11,4],[-16,8],[-5,2],[10,11],[-3,32]],[[701,1636],[33,2],[85,-10],[58,6],[118,26],[23,-24],[2,-9],[0,-14],[-2,-12],[-1,-21],[0,-3],[1,-2],[4,-6],[17,-13],[24,-13],[11,-8],[7,-7],[1,-5],[-1,-7],[-3,-7],[-11,-14],[-3,-5],[2,-10],[6,-12],[23,-34],[10,-8],[8,-3],[20,-1],[11,2],[12,4],[9,5],[7,7],[6,6],[6,4],[33,16],[8,1],[29,-4],[23,0],[10,-2],[11,-6],[35,-24],[17,-5],[10,0],[20,5],[7,0],[6,-2],[5,-5],[9,-3],[14,-3],[60,-5],[6,-1],[2,-2],[0,-5],[-1,-4],[-3,-5],[-14,-16],[-1,-7],[6,-11],[12,-6],[21,-3],[29,-2],[6,-2],[7,-7],[8,-6],[7,-3],[46,-8]],[[2517,2682],[-46,17],[-11,3],[-8,1],[-464,7],[-20,-2],[-24,-9],[-30,-15],[-18,-14],[-27,-23],[-15,-18],[-12,-16],[-9,-19],[-17,-28],[-5,-10],[3,-12],[10,-12],[35,-30],[2,-7],[-9,-4],[-22,-6],[-23,-3],[-65,0],[-273,54],[-52,126],[-56,46],[-6,7],[-4,11],[-6,34],[-6,10],[-10,8],[-15,6],[-9,5],[-7,6],[-12,4],[-16,-1],[-26,-12],[-15,-17],[-11,-7],[-9,-2],[-10,5],[-11,11],[-6,3],[-6,1],[-12,-2],[-17,-5],[-5,0],[-8,1],[-8,5],[-7,3],[-32,10],[-5,4],[-2,4],[4,4],[9,2],[27,2],[7,2],[1,3],[-7,4],[-13,0],[-65,-9],[-9,0],[-24,7],[-38,8],[-11,4],[-7,6],[-10,16],[-15,6],[-22,2],[-44,-5],[-14,-6],[-3,-11],[3,-7],[-1,-4],[-3,-3],[-9,-3],[-7,-1],[-9,0],[-67,29],[-14,4],[-11,1],[-11,-5],[-7,-3],[-11,-2],[-9,0],[-55,10],[-11,1]],[[624,2852],[0,1],[0,15],[-3,17],[-18,49],[-80,145],[-5,15],[3,20],[14,11],[102,27],[18,10],[30,24],[4,6],[0,13],[5,28],[-1,11],[-10,12],[-4,3],[-22,13],[-9,11],[5,25],[19,9],[12,5],[39,7],[121,-6],[31,4],[112,44],[118,67],[27,22],[21,27],[11,32],[-3,26],[-19,47],[-7,25],[4,12],[10,10],[40,25],[15,11],[12,14],[9,18],[5,26],[-3,23],[-11,21],[-84,104],[-80,70],[-20,29],[-12,26],[-16,53],[-14,25],[-30,33],[-2,15],[21,10],[175,25],[44,1],[85,-8],[16,5],[6,8]],[[4357,6334],[-86,-121],[-9,-42],[-20,-42],[-49,-15],[-31,-6],[-170,-11],[-76,7],[-43,-5],[-70,-16],[-56,-7],[-20,-18],[42,-35],[17,-22],[13,-34],[3,-16],[7,-22],[22,-10],[30,-5],[37,-16],[33,-31],[596,-280],[-3,-11],[-183,-27],[-49,-14],[-164,-100],[-38,-30],[-28,-10],[-31,-5],[-324,-10],[-209,-42],[-331,-36],[-135,5],[-100,-7],[-20,-6],[-8,-6],[4,-5],[2,-4],[1,-4],[-1,-5],[-1,-4],[0,-4],[1,-3],[9,-8],[4,-5],[8,-20],[8,-13],[1,-5],[-5,-4],[-13,-5],[-8,-6],[10,-21],[35,-17],[45,-36],[33,-19],[50,-22],[46,-10],[50,-7],[58,10],[67,-4]],[[1005,5060],[0,10],[-22,36],[-5,6],[-142,177],[-1,15],[10,20],[27,36],[11,20],[2,17],[-45,111],[-3,16],[9,11],[89,57],[-123,149],[-51,61],[161,121],[11,15],[0,16],[-37,74],[93,43],[143,111],[151,108],[55,25],[172,49],[191,24],[266,-30],[267,-30],[19,0],[14,8],[125,109],[10,13],[0,14],[-34,172],[-14,17],[-28,9],[-59,5],[-32,5],[-225,68],[200,149],[201,148],[0,1],[104,67],[16,22],[1,1]],[[2532,7136],[6,-2],[278,-82],[42,-20],[14,-9],[12,-9],[8,-8],[59,-43],[9,-3],[13,-4],[39,-6],[28,-7],[14,-5],[16,-9],[10,-11],[15,-27],[11,-11],[7,-4],[8,-2],[45,-1],[29,-7],[33,-11],[13,-6],[10,-6],[6,-6],[24,-13],[19,-5],[14,-6],[2,-2],[-6,-3],[-46,-10],[-7,-6],[11,-6],[18,-6],[13,-6],[13,-10],[127,-48],[20,-10],[11,-7],[4,-3],[3,-4],[5,-13],[8,-13],[5,-3],[7,0],[19,4],[9,20],[6,8],[10,11],[31,3],[15,-9],[8,-8],[7,-29],[9,-16],[17,-14],[150,-53],[28,-17],[20,-29],[15,-15],[12,-5],[54,8],[28,0],[22,-5],[31,-9],[364,-174]],[[8037,7123],[-1,-8],[-12,1],[-6,0],[-2,-2],[-8,-1],[-2,1],[0,2],[2,0],[1,2],[-2,5],[15,5],[15,-5]],[[8128,7144],[-10,-1],[-3,0],[5,4],[1,4],[-7,6],[11,-4],[6,-3],[4,-1],[-7,-5]],[[8102,7147],[-3,-2],[-12,2],[-7,4],[-9,3],[3,3],[-1,3],[10,3],[13,-8],[6,-5],[0,-3]],[[8297,7188],[-1,-5],[-15,3],[-9,2],[3,2],[13,0],[9,-2]],[[8254,7193],[12,-10],[-6,3],[-12,4],[-10,4],[1,5],[15,-6]],[[8221,7193],[-5,-1],[-6,2],[-2,1],[-4,2],[-7,4],[-19,7],[-19,7],[-4,6],[7,4],[8,0],[3,-1],[3,-2],[7,0],[7,0],[4,-2],[4,-2],[5,-1],[4,-2],[2,-2],[4,-2],[3,-1],[2,-4],[0,-3],[1,-1],[1,-3],[1,-6]],[[8294,7251],[-2,-1],[-5,2],[-4,3],[0,1],[7,-1],[4,-4]],[[8229,7239],[2,-6],[-2,-4],[-5,0],[-7,4],[-6,4],[-10,-2],[-8,-1],[-4,3],[-8,0],[-15,2],[-14,11],[-7,10],[6,1],[10,0],[6,-1],[10,-2],[6,-3],[7,-3],[7,-3],[9,-2],[10,-3],[7,-2],[6,-3]],[[8616,7279],[-1,-1],[-14,6],[4,2],[8,-1],[5,0],[0,-4],[-2,-2]],[[8191,7286],[3,-5],[-15,1],[-23,3],[-10,5],[1,4],[6,2],[4,0],[8,-2],[15,-2],[11,-6]],[[8254,7309],[10,-5],[3,-1],[0,-2],[0,-2],[-1,-1],[-4,3],[-3,-1],[-4,2],[-4,0],[-3,1],[-5,0],[-1,3],[3,0],[9,3]],[[8689,7311],[-14,-3],[-6,1],[6,4],[6,3],[3,0],[3,0],[8,-2],[1,-2],[-7,-1]],[[8696,7328],[-7,-2],[-11,3],[-3,4],[3,3],[6,1],[7,-3],[5,-6]],[[8147,7336],[16,-4],[13,-6],[7,-4],[6,-4],[4,-4],[4,-3],[4,-5],[-10,-2],[-16,4],[-9,2],[-7,2],[-6,2],[-5,2],[-7,4],[-6,3],[-3,3],[-2,1],[-3,1],[-3,4],[-4,0],[-2,-6],[-5,-2],[-9,1],[-4,1],[-3,0],[-5,2],[-6,1],[-6,2],[-4,3],[2,3],[8,0],[10,-3],[7,-2],[3,0],[0,3],[3,3],[8,2],[14,-1],[8,-2],[8,-1]],[[8212,7327],[-2,0],[-14,2],[-10,1],[-10,7],[3,3],[8,-3],[13,-5],[12,-5]],[[8661,7315],[-1,-2],[-5,1],[-7,4],[-4,2],[-2,2],[-13,6],[-13,8],[2,4],[5,-1],[5,-5],[7,-4],[4,-1],[12,-3],[8,-1],[6,-4],[-3,-3],[-1,-3]],[[8353,7324],[-5,-3],[-17,3],[-15,6],[-4,5],[6,5],[11,1],[5,-1],[5,-2],[8,-3],[5,-5],[1,-6]],[[8729,7342],[-6,-1],[-5,1],[-2,0],[-2,2],[-4,2],[-5,4],[1,3],[11,0],[8,-2],[4,0],[5,-4],[0,-4],[-2,-1],[-3,0]],[[8378,7342],[-5,-1],[-8,3],[-4,4],[2,4],[10,1],[6,-1],[3,-1],[4,-2],[0,-3],[-4,-2],[-4,-2]],[[8433,7365],[-4,-1],[-5,1],[2,-4],[1,-4],[-7,1],[-7,4],[0,2],[3,2],[2,5],[3,1],[7,-2],[5,-5]],[[8650,7380],[-5,-6],[-18,-6],[-9,-2],[-61,-2],[-7,3],[1,8],[6,7],[9,2],[8,-2],[3,-4],[9,-3],[14,5],[15,7],[15,0],[13,-3],[7,-4]],[[8808,7381],[-5,-1],[-17,1],[2,4],[5,1],[0,1],[8,3],[10,-7],[-3,-2]],[[8815,7398],[7,-1],[6,0],[0,-7],[-9,3],[-4,5]],[[8510,7361],[-1,-4],[-9,1],[-7,3],[-7,1],[-36,4],[-4,3],[-4,8],[1,7],[2,2],[0,8],[7,4],[14,0],[27,-6],[4,-4],[-6,-3],[-1,-5],[8,-6],[8,-3],[3,-4],[1,-6]],[[8893,7400],[1,-1],[-1,-3],[-5,-2],[-6,1],[-5,0],[-3,0],[-4,3],[1,2],[3,0],[1,1],[1,3],[5,3],[6,1],[4,2],[3,2],[2,-3],[-1,-5],[-2,-4]],[[8389,7413],[9,-9],[-14,3],[-5,2],[-1,2],[11,2]],[[8356,7421],[1,-3],[-2,-2],[0,-2],[-3,1],[-9,2],[-8,-1],[6,0],[0,-4],[-6,2],[-2,1],[-2,1],[-5,1],[-1,3],[2,0],[-2,1],[3,1],[6,-1],[15,1],[7,-1]],[[8764,7398],[-18,0],[-18,1],[-7,3],[-2,1],[-1,1],[-2,1],[-1,3],[-1,2],[0,1],[3,6],[9,5],[6,1],[5,0],[6,1],[3,-1],[1,-2],[3,-1],[5,-2],[3,-3],[4,-3],[7,-6],[2,-5],[-7,-3]],[[8874,7413],[-8,-1],[-18,4],[-8,7],[7,2],[11,-2],[10,-4],[6,-4],[0,-2]],[[8402,7409],[-2,-1],[-3,3],[0,4],[-1,3],[-2,4],[0,5],[4,1],[11,-2],[13,-3],[2,-4],[-5,-2],[-2,-1],[0,-1],[-2,-2],[-5,-1],[-5,-1],[-3,-2]],[[8881,7430],[-15,-1],[-3,7],[12,3],[7,-3],[-1,-6]],[[9510,7439],[3,-7],[-3,1],[-2,1],[-1,3],[-4,0],[-2,-2],[-5,0],[3,3],[11,1]],[[8799,7425],[-7,-1],[-13,2],[-16,3],[-11,10],[5,6],[14,-4],[7,-3],[6,-1],[12,-3],[5,-4],[-2,-5]],[[8622,7430],[-4,-6],[-9,1],[1,3],[-2,4],[-5,4],[-11,5],[-9,4],[4,1],[12,-4],[7,-3],[5,-2],[11,-7]],[[8655,7442],[-4,0],[-6,2],[4,5],[4,-2],[3,-2],[-1,-3]],[[8564,7434],[6,-1],[5,1],[6,-2],[7,-6],[17,-6],[0,-7],[-11,-3],[-8,1],[-9,6],[-10,5],[-11,3],[-11,1],[-6,-2],[3,-6],[-3,-1],[0,-2],[1,-5],[8,-6],[2,-2],[-4,-1],[-11,2],[-35,19],[-20,14],[-5,8],[9,3],[10,3],[11,-1],[59,-15]],[[8942,7449],[7,-3],[-2,-5],[-5,-1],[-2,-1],[2,-2],[2,-4],[-3,-2],[-6,3],[-4,3],[-2,2],[-1,3],[-1,3],[-4,3],[-3,1],[-7,-1],[-10,1],[-6,5],[6,4],[13,-3],[9,-3],[6,-1],[11,-2]],[[8855,7453],[-8,-4],[-7,0],[-7,-3],[-9,-1],[-5,3],[2,4],[2,4],[9,4],[17,-1],[6,-6]],[[8945,7454],[-7,-2],[-11,2],[-10,3],[-1,5],[8,4],[6,0],[3,0],[6,-1],[6,-4],[3,-4],[-3,-3]],[[8819,7482],[-3,-7],[-12,-3],[-5,-3],[-2,-6],[-4,-4],[-7,-3],[-8,1],[-9,2],[-2,0],[3,-3],[-5,1],[-23,6],[-4,3],[-4,6],[6,4],[7,0],[11,0],[13,1],[37,8],[11,-3]],[[9666,7473],[8,-7],[0,-4],[-2,-1],[-1,-1],[-6,0],[-5,2],[-5,2],[-6,2],[-5,2],[-2,0],[-3,0],[-3,1],[-1,4],[2,2],[2,0],[4,1],[5,2],[1,2],[1,2],[1,3],[3,4],[6,4],[4,0],[-2,-4],[-2,-8],[6,-8]],[[9713,7493],[-2,-1],[-7,1],[2,4],[7,-4]],[[8624,7495],[-1,-9],[-11,4],[0,3],[1,2],[-1,2],[-1,1],[6,0],[7,-3]],[[8791,7490],[-11,-5],[-15,1],[-8,5],[-3,3],[10,5],[20,0],[7,-9]],[[9998,7494],[-3,-1],[-2,2],[1,4],[5,1],[-1,-6]],[[9873,7493],[-2,-2],[-7,1],[2,2],[2,1],[3,5],[5,2],[-1,-4],[-2,-5]],[[8680,7492],[-2,0],[-7,3],[-7,4],[-9,3],[-8,2],[5,3],[7,-1],[3,-1],[5,-3],[9,-4],[5,-4],[0,-2],[-1,0]],[[8952,7511],[-4,-3],[-3,2],[1,4],[6,-3]],[[8703,7516],[3,-9],[-7,1],[-7,11],[11,-3]],[[8825,7516],[-10,-3],[-9,2],[-3,0],[-5,3],[1,4],[3,1],[10,1],[11,-2],[2,-6]],[[9083,7519],[-3,-4],[-7,3],[-6,2],[-5,4],[0,3],[1,3],[5,0],[1,-2],[-2,-1],[4,-1],[6,-3],[6,-4]],[[9700,7518],[3,-1],[1,-2],[-3,0],[-9,1],[-2,2],[-4,-1],[-18,4],[8,5],[2,2],[4,2],[8,-5],[6,-3],[4,-4]],[[9878,7527],[-5,-2],[-3,3],[3,4],[5,-5]],[[9520,7531],[-4,-1],[-4,1],[4,2],[4,-2]],[[8652,7531],[-10,-1],[-6,2],[1,4],[7,0],[8,-5]],[[9839,7533],[-5,-3],[-7,2],[3,4],[9,-3]],[[9723,7527],[-1,-1],[-5,2],[-4,2],[0,2],[0,1],[-1,3],[-1,4],[6,0],[4,-6],[2,-7]],[[8930,7540],[2,-2],[2,-3],[2,-3],[2,-3],[-8,-1],[-12,1],[-5,8],[4,3],[4,-1],[5,1],[4,0]],[[9948,7539],[-2,-3],[-2,0],[-2,1],[-5,2],[-1,3],[-5,4],[9,-2],[8,-5]],[[9103,7546],[3,-5],[2,-4],[-2,0],[-4,1],[-6,-1],[-7,3],[-4,3],[-1,1],[2,1],[4,0],[3,1],[6,-1],[4,1]],[[9965,7539],[-5,0],[-6,7],[9,-1],[2,-6]],[[8680,7547],[4,-1],[2,1],[4,-1],[2,-7],[-12,3],[-3,3],[-3,0],[2,2],[4,0]],[[9158,7543],[2,-3],[0,-3],[-4,-2],[-5,-1],[-10,2],[-8,3],[-6,3],[-2,3],[7,-1],[5,-1],[1,2],[1,2],[3,0],[5,-1],[6,-2],[5,-1]],[[8880,7543],[-3,-4],[-11,2],[-10,3],[1,3],[7,3],[7,-1],[3,-1],[3,-2],[3,-3]],[[9002,7550],[8,-3],[3,1],[3,-3],[0,-2],[0,-1],[-1,0],[-10,1],[-9,5],[6,2]],[[8815,7532],[-14,-1],[-8,0],[-3,0],[-3,2],[3,3],[8,3],[2,4],[-2,4],[2,1],[3,0],[0,2],[-1,2],[3,2],[7,-2],[6,-6],[2,-5],[-1,-4],[0,-2],[-4,-3]],[[9820,7561],[10,-2],[12,0],[5,0],[1,0],[1,-3],[-3,-4],[-6,-2],[-10,0],[-9,2],[-3,2],[-2,3],[-3,2],[-1,1],[2,2],[6,-1]],[[9931,7567],[-2,-4],[6,1],[1,-2],[-5,-1],[-10,5],[-7,1],[8,4],[9,-4]],[[9967,7574],[6,-6],[4,-4],[5,-3],[-1,-1],[-6,1],[0,3],[-6,2],[-2,3],[-8,0],[-12,0],[-4,2],[12,3],[12,0]],[[8657,7563],[-8,0],[-10,2],[-3,1],[-4,3],[4,4],[7,3],[4,0],[5,0],[6,-1],[0,-2],[-2,-4],[1,-6]],[[8754,7577],[1,-3],[-2,0],[-5,1],[-5,7],[4,0],[4,-2],[3,-3]],[[9236,7580],[-2,-3],[-6,1],[1,3],[5,2],[2,-3]],[[8770,7584],[-1,-1],[-11,3],[7,1],[5,-3]],[[9227,7583],[-4,-3],[-3,4],[-4,3],[8,1],[3,-5]],[[9516,7581],[4,-7],[-9,2],[-8,6],[-2,2],[-7,3],[4,6],[10,-8],[8,-4]],[[9079,7563],[-2,-5],[-8,2],[-5,0],[-3,-4],[2,-6],[6,-11],[-11,3],[-22,10],[-22,12],[-12,14],[3,12],[13,4],[20,-1],[20,-6],[2,-6],[-11,0],[1,-2],[12,-4],[11,-5],[6,-7]],[[9481,7573],[-2,-3],[-4,1],[-3,2],[-1,1],[-3,2],[-4,1],[-4,1],[-1,2],[1,6],[0,3],[0,3],[4,4],[4,-2],[1,-2],[3,-4],[5,-3],[3,-3],[2,-3],[0,-3],[-1,-3]],[[9296,7595],[5,-5],[6,-7],[9,-3],[5,-3],[-3,-3],[-8,1],[-5,3],[-2,2],[-3,2],[-3,2],[-3,5],[-8,1],[-5,-2],[1,-4],[4,-4],[4,-5],[0,-2],[-3,0],[-1,-1],[3,-2],[-2,-1],[-6,1],[-4,2],[-2,1],[-2,2],[-4,3],[-3,2],[-6,3],[-4,2],[-4,2],[-1,4],[5,1],[7,-4],[6,-1],[0,1],[-4,3],[2,4],[10,3],[11,-1],[5,-1],[3,-1]],[[9898,7593],[-9,-2],[-3,4],[5,3],[6,3],[3,-6],[-2,-2]],[[9698,7595],[-2,-7],[-5,-4],[-5,-3],[-3,-3],[2,-2],[-9,-5],[-27,-11],[-29,8],[-14,11],[1,15],[6,4],[5,-6],[6,-3],[5,3],[2,9],[4,-1],[8,-4],[9,-2],[9,-1],[9,2],[7,4],[5,-1],[4,-3],[3,2],[2,5],[3,0],[3,-3],[1,-4]],[[9414,7594],[-2,0],[-1,1],[-6,2],[-5,2],[3,2],[0,2],[3,2],[4,2],[2,-2],[4,-4],[-2,-7]],[[9273,7603],[1,-3],[-6,0],[-4,-3],[-8,0],[-5,-3],[-5,0],[-7,0],[-4,2],[-2,3],[-1,2],[1,1],[3,0],[4,2],[1,-1],[3,0],[3,1],[2,1],[3,0],[4,1],[5,1],[6,-3],[6,-1]],[[9374,7604],[-2,0],[-1,3],[4,2],[-1,-5]],[[9768,7602],[-2,0],[-5,2],[3,5],[5,-4],[-1,-3]],[[9298,7600],[-1,-2],[-10,2],[-11,4],[-4,3],[9,1],[12,1],[5,-1],[0,-1],[-1,-3],[1,-4]],[[8700,7611],[-3,-2],[-4,5],[5,0],[2,-3]],[[8948,7573],[-5,-6],[-34,2],[-14,4],[-7,3],[-5,4],[1,5],[3,6],[1,9],[3,11],[8,3],[33,-14],[9,-12],[7,-15]],[[8814,7625],[3,-3],[0,-4],[-5,-1],[-7,-1],[-7,-1],[-6,1],[0,2],[2,3],[1,3],[5,1],[6,-1],[5,1],[3,0]],[[9825,7623],[-1,-3],[-12,2],[6,5],[9,-1],[-3,-2],[1,-1]],[[9455,7627],[-5,-3],[-1,1],[-1,2],[-3,3],[-2,3],[6,0],[4,-1],[2,-1],[1,-2],[-1,-2]],[[9273,7627],[-6,-3],[-6,1],[-4,1],[-5,4],[0,4],[8,0],[10,-2],[3,-5]],[[9969,7626],[-3,0],[-2,3],[-5,7],[9,-1],[2,-3],[-1,-6]],[[8648,7629],[8,-3],[-12,1],[-7,-2],[-6,2],[-3,1],[-1,4],[5,4],[8,-3],[4,-3],[4,-1]],[[9936,7628],[-4,-2],[-9,2],[5,4],[4,2],[5,1],[4,3],[6,-1],[-2,-6],[-9,-3]],[[8910,7631],[-1,-1],[-14,4],[-14,9],[16,-2],[6,-5],[7,-5]],[[8701,7634],[0,-3],[-6,1],[-8,4],[-4,4],[2,5],[5,2],[3,-6],[2,-4],[4,0],[2,-1],[0,-2]],[[8920,7641],[3,-8],[-7,2],[-6,8],[-3,4],[13,-6]],[[8017,7101],[-24,6],[-214,65],[-872,107],[-311,-45],[-57,-30],[-93,-26],[-42,-8],[-20,-2],[-15,2],[-11,5],[-2,1],[-1,1],[0,2],[0,2],[0,3],[-4,1],[-10,4],[-5,1],[-18,5],[-3,3],[-24,4],[-22,0],[-15,6],[-6,22],[-9,13],[-22,11],[-43,14],[-79,9],[-41,24],[-126,24],[-42,20],[-4,3],[-22,19],[-8,4],[-14,3],[-106,2],[-26,6],[-48,22],[-80,9],[-41,11],[-40,16],[-36,21],[-16,15],[-14,1],[-290,54],[-233,72],[-447,183],[-291,51],[-480,147],[-275,53],[-18,4]],[[3397,8041],[-35,79],[-3,21],[184,79],[280,210],[66,34],[140,55],[44,11],[23,8],[12,13],[21,94],[-4,13],[-235,163],[40,54],[15,8],[126,10],[47,9],[41,17],[79,50],[16,16],[116,168],[16,14],[19,10],[312,95],[60,42],[17,5],[217,-49],[217,-50],[19,2],[23,14],[23,18],[140,104],[17,29],[-40,144],[1,23],[14,67],[4,8],[8,5],[13,1],[187,26],[35,-8],[123,-45],[42,-4],[256,7],[335,-59],[340,-54],[31,1],[29,9],[179,83],[-215,46],[143,48],[65,39],[77,77],[10,15],[3,14],[-6,64],[-5,13],[-181,82],[197,5],[197,5],[40,-13],[90,-5],[52,-19],[36,-4],[18,-10],[0,-13],[-13,-12],[-23,-4],[-2,-15],[16,-8],[126,-19],[61,-20],[48,-18],[45,-30],[9,-4],[5,-2],[5,-6],[3,-3],[7,-1],[54,0],[16,-4],[6,-7],[5,-9],[23,-22],[9,-7],[24,-8],[58,-6],[68,-25],[42,-11],[15,-22],[138,-15],[34,-15],[4,-5],[22,-11],[10,-7],[9,-4],[4,-1],[5,-2],[1,-5],[0,-5],[1,-3],[26,-8],[174,-1],[52,-6],[2,-1],[0,-8],[3,-1],[60,-2],[49,-10],[33,-1],[32,-8],[14,0],[13,1],[14,0],[21,-7],[22,-14],[22,-9],[46,7],[19,-8],[31,-24],[22,-11],[112,-28],[11,-6],[5,-6],[3,-6],[3,-6],[10,-7],[35,-16],[11,-12],[-4,-17],[7,-5],[1,-6],[-4,-18],[-4,-7],[0,-4],[2,-7],[2,-1],[3,-1],[5,-4],[16,1],[65,16],[26,1],[10,-6],[8,-7],[31,-44],[2,-6],[7,-6],[56,-20],[20,-6],[68,-31],[52,-8],[15,-9],[-1,-13],[-19,-14],[-25,-8],[-53,-7],[-26,-8],[-13,-13],[-4,-17],[3,-17],[3,-16],[0,-43],[3,-9],[9,-11],[8,-29],[6,-12],[18,-19],[6,-12],[3,-17],[-14,-8],[-27,-7],[-20,-9],[8,-8],[-14,-15],[-17,-13],[-9,-14],[9,-18],[26,-13],[28,1],[30,5],[31,1],[51,-12],[52,-4],[16,-3],[10,-5],[-2,-17],[-9,-20],[0,-17],[26,-6],[-17,-23],[-21,-12],[-85,-15],[-15,-7],[-6,-11],[-3,-15],[4,-5],[14,-3],[-6,-9],[-7,-8],[-8,-7],[-10,-6],[6,-14],[13,-9],[16,-9],[21,-15],[8,-3],[6,-4],[3,-8],[0,-10],[2,-6],[3,-5],[5,-7],[28,-24],[18,-11],[13,-5],[23,-4],[19,-10],[43,-37],[29,-15],[16,-11],[21,-20],[30,-36],[3,-5],[-4,-7],[-11,-2],[-18,0],[-17,-1],[-10,-14],[-25,-16],[-1,-5],[9,-27],[0,-15],[-3,-15],[-6,-13],[-7,-12],[6,-13],[3,-13],[-2,-12],[-7,-12],[-16,-6],[-40,-11],[-1,-8],[-16,-8],[-23,-4],[-18,-7],[0,-11],[-19,-3],[-22,-7],[-19,-11],[-7,-17],[3,-8],[15,-14],[3,-7],[1,-10],[4,-14],[0,-10],[-3,-7],[-6,-10],[-2,-7],[3,-8],[11,-16],[6,-19],[27,-37],[19,-13],[27,-9],[79,-11],[16,-10],[41,-49],[7,-6],[8,-5],[19,-8],[7,-4],[8,-11],[19,-36],[2,-11],[-2,-16],[16,-15],[20,-14],[17,-29],[29,-20],[0,-14],[-17,-13],[-27,-2],[-55,6],[5,-4],[1,-3],[3,-1],[7,-2],[-19,-4],[-37,3],[-17,-4],[-4,-4],[-6,-13],[-6,-3],[-7,-1],[-7,2],[-5,3],[-12,2],[-7,3],[-6,4],[-3,4],[-2,7],[-4,0],[-9,-4],[-37,0],[-18,3],[-7,9],[-8,12],[-17,5],[-37,1],[-12,-4],[-19,-16],[-10,-5],[-10,0],[-5,4],[-3,4],[-4,2],[-60,0],[-33,4],[5,11],[-5,3],[-11,-1],[-9,-2],[0,-1],[-6,-10],[-5,-2],[-5,-1],[-6,-2],[-5,-5],[9,-3],[3,-4],[0,-5],[-1,-7],[-2,-6],[-4,-1],[-7,1],[-13,1],[-13,5],[-8,11],[-3,13],[3,10],[-16,-1],[-11,-6],[-10,-7],[-10,-5],[-17,0],[-16,5],[-29,14],[-13,4],[-13,0],[-9,-6],[-1,-13],[6,-9],[11,-6],[25,-9],[-12,-4],[-48,-9],[-8,-4],[-15,-8],[1,-14],[-20,-8],[-19,2],[6,15],[-21,20],[-10,5],[-42,2],[-35,8],[-6,2],[-16,13],[-10,2],[-18,-3],[-13,1],[-18,8],[-23,30],[-16,12],[-85,30],[-15,2],[-14,-2],[10,-8],[19,-9],[7,-8],[3,-7],[2,-18],[3,-10],[4,-7],[1,-7],[-2,-11],[-6,-10],[-8,-8],[-11,-5],[-12,-2],[4,17],[-19,9],[-44,4],[-10,-3],[-25,-11],[-9,-1],[-4,6],[4,8],[9,7],[7,4],[-11,9],[-11,6],[-25,9],[1,3],[4,7],[-54,6],[-27,-2],[-2,-14],[-31,-4],[31,-20],[-2,-9],[-10,-1],[-25,4],[9,-6],[11,-16],[12,-7],[-26,-19],[-31,6],[-31,12],[-27,1],[16,-12],[15,-7],[18,-4],[50,-5],[17,-5],[11,-12],[9,-20],[-10,0],[-9,0],[-10,-2],[-8,-4],[-8,18],[-16,8],[-20,1],[-18,-6],[6,-4],[2,-5],[-2,-6],[-6,-6],[6,-4],[5,-6],[10,-14],[-18,-5],[-55,-1],[56,-9],[28,0],[14,15],[-3,7],[-19,10],[-3,7],[6,7],[12,-4],[11,-7],[7,-6],[-5,-4],[41,-8],[3,-5],[-34,-11],[-5,-6],[8,-6],[17,-5],[29,-4],[5,-4],[6,-7],[8,-14],[-18,-6],[-14,6],[-13,10],[-15,4],[-23,2],[-16,4],[-18,8],[-9,1],[-9,-4],[4,-11],[-21,2],[-77,24],[-57,9],[-23,13],[-11,5],[-32,4],[-26,12],[-47,7],[-11,4],[-7,4],[-16,14],[-10,6],[-24,6],[-10,6],[17,-30],[46,-19],[92,-21],[63,-25],[50,-10],[10,-4],[12,-7],[17,-11],[10,-4],[15,1],[-20,-7],[-43,0],[-21,-3],[-6,-3],[-2,-2],[-1,-3],[-4,-5],[-7,-3],[-7,4],[-7,4],[-7,0],[-21,-5],[-103,14],[-16,-1],[35,-25],[21,-9],[17,4],[-15,8],[-6,2],[19,1],[43,-24],[21,-7],[-6,-10],[-4,-9],[-5,-7],[-11,-4],[-12,0],[-12,5],[-18,15],[-7,-9],[2,-8],[6,-7],[-1,-7],[-11,-5],[-15,-1],[-14,3],[-6,8],[-23,-8],[-22,-4],[-24,-1],[-64,10],[-13,-1],[11,-11],[-35,0],[-19,2],[-16,13],[-18,0],[-32,-5],[0,-4],[31,-6],[11,0],[0,-4],[-55,3],[-29,-2],[-14,-12],[5,0],[6,-3],[4,-2],[-31,-10],[16,-1],[16,-5],[15,-7],[12,-9],[12,-6],[17,-2],[14,4],[2,12],[14,-3],[13,-5],[24,-13],[25,-9],[11,-8],[-2,-10],[-23,-14],[-34,-8],[-35,-2],[-25,6],[-7,8],[-14,19],[-10,9],[-10,7],[-12,6],[-13,4],[-16,2],[-20,8],[-23,16],[-25,13],[-25,-2],[4,0],[7,-3],[4,-2],[-10,-9],[-31,-1],[-11,-9],[96,-11],[24,-10],[45,-35],[42,-22],[55,-45],[7,-15],[-15,-7],[-42,-1],[10,-5],[4,-6],[0,-8],[-14,-21],[4,-4],[12,-1],[16,-5],[-4,-1]],[[5088,4999],[-11,-2],[-6,7],[-3,10],[4,9],[13,5],[16,-2],[12,-3],[4,-2],[-2,-3],[-2,-3],[-14,-10],[-2,-2],[-2,-1],[-7,-3]],[[5227,5235],[-3,-3],[-2,2],[5,1]],[[5382,5338],[-7,-9],[-59,12],[-2,3],[4,3],[5,2],[39,3],[4,-2],[-1,-2],[9,-1],[10,-4],[-2,-5]],[[5377,5407],[8,-2],[19,5],[16,-1],[8,-2],[1,-6],[-3,-10],[-7,-7],[-1,-5],[-3,-2],[-9,1],[-8,-1],[-2,-3],[5,-3],[4,-3],[-4,-5],[-34,-6],[-39,4],[-16,15],[7,13],[7,9],[3,7],[9,7],[18,3],[13,-3],[8,-5]],[[5464,5413],[-6,-2],[-2,6],[2,4],[13,9],[6,4],[11,-1],[0,-5],[-10,-4],[-14,-11]],[[5312,5416],[-8,-5],[-4,2],[-18,13],[-4,6],[1,4],[33,-3],[11,-4],[4,-6],[-4,-5],[-5,-2],[-6,0]],[[5538,5474],[-1,-5],[-3,4],[1,5],[3,-4]],[[5221,5512],[-6,0],[-3,3],[1,4],[4,2],[6,1],[8,0],[0,-3],[-10,-7]],[[5799,5580],[-18,-7],[-5,3],[4,16],[2,3],[18,9],[6,-1],[1,-5],[-1,-7],[-2,-7],[-5,-4]],[[5695,5604],[-6,-1],[-5,3],[-2,4],[1,1],[4,1],[-1,3],[-2,4],[2,6],[6,6],[24,7],[3,-4],[6,-2],[9,-1],[3,-3],[-7,-1],[-6,-5],[-2,-6],[-3,-3],[-18,-5],[-6,-4]],[[5776,5631],[-2,-1],[-5,6],[-2,9],[9,5],[7,-3],[0,-5],[-3,-4],[-2,-5],[-2,-2]],[[5863,5642],[0,-5],[-3,1],[-3,6],[0,6],[1,4],[3,1],[1,-2],[0,-5],[1,-6]],[[5889,5684],[0,-6],[-6,3],[1,6],[5,-3]],[[5923,5691],[-17,-3],[-5,1],[-4,2],[-3,3],[4,3],[25,-2],[0,-4]],[[5825,5689],[-6,-2],[-10,2],[-5,3],[1,6],[6,5],[5,-1],[4,-3],[3,-4],[2,-6]],[[5946,5699],[-7,0],[-3,3],[13,6],[13,-1],[-16,-8]],[[5986,5726],[-3,0],[-11,3],[4,4],[14,1],[3,-4],[-5,-2],[-2,-2]],[[6202,5787],[-1,-1],[-11,4],[-5,4],[9,1],[8,-5],[0,-3]],[[6303,5926],[-4,2],[-13,4],[-10,-5],[-3,-12],[0,-26],[-1,-7],[-3,-12],[-1,-6],[0,-23],[-8,-9],[-10,-5],[-9,2],[-4,12],[-16,-12],[-39,-5],[-18,-8],[5,-2],[11,-8],[-9,-5],[-14,-17],[-8,-8],[15,0],[-12,-12],[-15,1],[-30,17],[-13,-16],[12,-9],[24,-4],[19,-1],[-6,-9],[-9,-1],[-10,1],[-9,-4],[-5,-7],[-2,-6],[-4,-4],[-12,-1],[-4,3],[-21,13],[-4,2],[-6,5],[-15,7],[-7,5],[3,10],[-8,5],[-13,3],[-11,5],[-13,7],[-15,4],[-10,-2],[4,-12],[-10,-2],[-42,8],[-31,1],[-14,-2],[-12,-5],[16,-7],[119,-23],[-14,-10],[-24,-4],[-50,-1],[3,-7],[2,-3],[-12,-7],[-11,1],[-9,6],[-4,10],[-2,12],[16,3],[38,0],[0,6],[-72,9],[-22,-5],[10,-5],[5,-6],[2,-7],[4,-7],[17,-18],[4,-7],[-109,16],[-36,-1],[0,-5],[16,0],[18,-4],[15,-6],[11,-7],[6,-8],[4,-9],[-2,-8],[-11,-3],[-16,3],[-15,6],[-15,2],[-16,-6],[-6,-6],[-3,-9],[-5,-8],[-12,-7],[26,0],[-34,-13],[-10,-1],[-5,-4],[-5,-18],[-6,-4],[-8,3],[-25,17],[-12,4],[-11,2],[-12,-1],[-12,-5],[24,-9],[13,-6],[10,-9],[-50,4],[-2,2],[-7,7],[-4,3],[-6,2],[-2,-2],[0,-4],[-2,-3],[1,-1],[-12,-8],[-18,-6],[-44,-5],[19,-7],[195,1],[20,-4],[15,-9],[4,-11],[-6,-4],[-11,4],[-7,11],[-6,0],[-6,-14],[-18,-4],[-21,3],[-45,12],[-11,-3],[-8,-15],[36,-12],[11,-3],[28,5],[15,1],[9,-6],[-8,-15],[-30,-1],[-55,6],[11,-10],[37,-7],[8,-8],[-2,-6],[-7,-5],[-8,-3],[-19,-2],[-7,-3],[-6,-4],[-7,-2],[-17,-4],[-9,0],[-14,2],[-12,1],[-6,1],[-2,2],[-2,3],[-1,5],[-25,15],[-12,5],[-15,0],[2,-2],[3,-8],[-36,0],[0,-5],[8,-2],[2,-6],[-4,-6],[-6,-6],[17,-4],[24,14],[16,-5],[-18,-23],[-12,-8],[-14,-4],[-7,-3],[-7,-6],[-8,-3],[-9,4],[-1,5],[4,6],[6,5],[4,2],[-11,3],[-7,-6],[-6,-9],[-7,-8],[-15,-6],[-15,-1],[-32,2],[3,7],[2,3],[-12,5],[-15,1],[-30,-1],[19,13],[66,-4],[19,12],[-32,6],[-15,5],[-10,8],[2,2],[1,1],[2,2],[-18,-2],[-26,-9],[-24,-11],[-10,-10],[-5,-3],[-13,2],[-12,5],[-7,4],[-1,6],[1,26],[-1,2],[-7,6],[-2,4],[2,4],[7,6],[1,3],[-3,11],[-10,0],[-11,-4],[-12,0],[-5,6],[-13,27],[-7,6],[-7,5],[-9,3],[-11,3],[6,4],[10,11],[-17,-1],[-24,-11],[-11,-3],[-14,3],[-13,7],[-12,4],[-13,-3],[94,-38],[23,-15],[14,-14],[18,-23],[9,-23],[-13,-12],[0,-6],[33,-10],[9,-5],[9,-6],[3,-2],[-1,-15],[6,-8],[25,-17],[5,-14],[-2,-8],[-7,-13],[1,-4],[4,-7],[-3,-4],[-7,-1],[-7,-1],[-5,1],[-18,7],[-8,2],[-47,0],[15,-9],[115,-24],[0,-8],[3,-6],[5,-5],[8,-3],[-17,-3],[-56,-23],[-5,3],[-1,9],[-6,21],[1,5],[-2,2],[-11,1],[-4,-3],[-4,-5],[-8,-23],[-2,-6],[0,-6],[-3,-6],[-6,-2],[-17,-4],[11,-10],[-24,-19],[-14,-8],[-14,-3],[-9,3],[-13,9],[-7,2],[-39,0],[-31,-5],[-17,-6],[-9,-9],[1,-12],[12,-4],[15,-4],[9,-9],[-100,2],[-11,2],[-8,3],[-14,11],[-5,2],[-33,29],[-33,23],[-9,3],[-15,-4],[-8,-18],[-13,-4],[-15,-1],[-13,-4],[-8,-8],[0,-11],[33,-25],[2,-3],[1,-6],[1,-7],[-1,-4],[-6,-3],[-9,-2],[-9,0],[-7,0],[8,-4],[9,-6],[5,-8],[-4,-10],[-1,-7],[6,-9],[9,-8],[10,-3],[23,2],[11,-1],[12,-6],[6,-7],[5,-7],[6,-7],[9,-5],[0,-4],[-7,0],[-5,-1],[-9,-5],[65,-17],[15,4],[25,-4],[25,-6],[15,-6],[-63,-20],[-19,-3],[-2,4],[21,19],[-12,3],[-14,-1],[-12,-5],[-8,-7],[-3,-11],[1,-12],[2,-10],[0,-7],[-5,-10],[-2,-2]],[[4357,6334],[30,-15],[89,-27],[627,-51],[478,68],[49,0],[31,-9],[7,-9],[2,-8],[-4,-4],[-6,-2],[-27,0],[-3,-2],[3,-6],[46,-40],[4,-6],[7,-4],[11,-6],[45,-12],[16,-3],[56,1],[13,-1],[37,-10],[35,-5],[15,-4],[18,-9],[17,-5],[15,-1],[30,1],[16,-4],[17,-7],[8,-11],[0,-6],[2,-5],[5,-3],[37,-8],[17,-8],[24,-15],[96,-73],[81,-94],[2,-5]],[[6376,5915],[-5,-3],[0,4],[-1,3],[4,5],[4,-2],[0,-2],[-2,-5]],[[6455,5921],[13,-4],[-6,-7],[-12,3],[-1,4],[-2,1],[-3,0],[-2,1],[-5,6],[-3,11],[4,-3],[4,-6],[13,-6]],[[6743,5949],[3,-10],[-5,1],[-4,-2],[-3,8],[9,3]],[[6730,5986],[-3,-7],[-3,7],[-2,4],[3,1],[0,7],[1,7],[5,-7],[4,-6],[-5,-6]],[[7411,6032],[2,-1],[-1,-2],[-5,-2],[-11,-3],[-8,4],[1,4],[5,3],[2,0],[3,-4],[2,1],[3,6],[1,3],[5,3],[5,-1],[0,-4],[-4,-4],[0,-3]],[[7016,6074],[7,-2],[3,2],[4,-2],[3,-3],[-5,-4],[-12,9]],[[7458,6062],[-12,-1],[1,7],[28,17],[3,0],[2,-5],[-5,-7],[-7,-6],[-10,-5]],[[7259,6127],[0,-8],[-5,4],[-3,2],[-2,0],[-3,0],[-1,5],[5,3],[4,3],[5,-9]],[[7508,6099],[-11,-4],[-5,1],[-6,0],[-11,-6],[-2,8],[14,35],[6,6],[7,3],[7,1],[10,6],[14,7],[7,1],[-1,-1],[-3,-3],[-2,-3],[3,-3],[-1,-3],[-5,-4],[-3,-4],[2,-6],[1,-7],[-3,-9],[-7,-9],[-11,-6]],[[7251,6157],[-1,0],[2,7],[6,6],[4,1],[3,-4],[-3,-6],[-6,-1],[-5,-3]],[[7517,6156],[-35,-14],[5,5],[-6,7],[-7,2],[-9,-1],[-9,-3],[19,21],[30,-2],[12,-15]],[[7351,6178],[-4,-4],[-1,0],[2,4],[1,4],[8,1],[-1,-4],[-5,-1]],[[7586,6177],[-9,-1],[2,7],[10,3],[1,-2],[0,-5],[-4,-2]],[[7670,6464],[5,-6],[-2,0],[-12,5],[9,1]],[[7964,6756],[0,-2],[-1,0],[-6,1],[-1,6],[6,-3],[2,-2]],[[7695,6824],[5,-1],[6,4],[9,2],[9,-3],[7,-4],[4,-7],[-1,-2],[-4,0],[-6,-2],[-42,10],[-5,2],[1,2],[-6,7],[-1,3],[-1,4],[2,3],[9,1],[11,-4],[1,-5],[-3,-3],[1,-4],[4,-3]],[[7803,6960],[-7,-2],[-8,2],[-8,5],[-7,4],[-3,7],[1,5],[3,2],[6,0],[15,-6],[2,-3],[6,-5],[1,-6],[-1,-3]],[[8017,7101],[-14,-5],[-63,1],[-9,-5],[8,-11],[13,-10],[6,-4],[-23,-8],[-7,-2],[-8,2],[-15,4],[-8,-1],[0,-1],[-2,-3],[-2,-4],[-2,-2],[-13,-4],[-11,-6],[-3,-7],[12,-8],[-13,-4],[-92,-3],[-10,-3],[-1,-5],[4,-4],[4,-6],[-4,-7],[-6,-6],[-8,-6],[-10,-4],[-10,-1],[8,-20],[-15,-8],[-15,-5],[6,-13],[-12,-5],[-26,-4],[-13,-1],[-12,4],[-5,8],[-1,8],[-3,6],[-12,2],[-12,-3],[-9,-7],[-3,-10],[3,-10],[10,-4],[23,-4],[-3,-7],[-2,-3],[14,-7],[13,-3],[30,0],[48,6],[48,-9],[19,-6],[5,-11],[-10,-4],[-39,2],[-14,-3],[13,-12],[16,-10],[34,-13],[0,-5],[-13,0],[-5,-4],[2,-5],[10,-6],[0,-4],[-20,3],[-36,17],[-19,4],[-16,6],[-15,10],[-16,9],[-18,-3],[-8,-9],[1,-13],[9,-12],[13,-8],[22,-3],[25,-1],[23,-4],[14,-12],[-14,-1],[0,-7],[10,-8],[14,-4],[16,-1],[8,-1],[7,-3],[4,-3],[7,-10],[2,-2],[6,-2],[11,-10],[7,-3],[7,2],[2,4],[-2,4],[-2,0],[5,9],[1,7],[4,2],[16,-3],[15,-10],[17,-13],[14,-7],[9,18],[7,0],[7,-2],[3,-4],[0,-17],[9,-8],[10,-5],[13,-2],[15,0],[-10,-5],[-10,-4],[-11,-1],[-11,3],[-19,14],[-6,3],[-37,-14],[-21,-6],[-10,8],[-2,5],[-5,2],[-6,0],[-5,-3],[-2,-4],[5,-2],[10,-1],[14,-13],[10,-4],[10,5],[8,2],[31,2],[10,-1],[2,-4],[6,-12],[2,-5],[-9,-11],[1,-8],[10,-5],[14,-1],[7,2],[8,10],[5,3],[16,-2],[15,-3],[-5,10],[11,0],[9,-4],[5,-6],[1,-10],[-5,-7],[-8,-1],[-10,0],[-11,-5],[-8,-5],[-19,-5],[-9,-5],[-43,-31],[-30,-14],[-15,-9],[-18,-7],[-17,7],[-13,11],[-12,6],[4,-6],[1,-6],[-1,-7],[-4,-6],[5,-2],[2,-3],[1,-2],[3,-3],[-12,-3],[-22,-7],[-13,0],[-11,2],[-4,3],[-5,-1],[-96,-63],[-3,-1],[-23,4],[-3,1],[-7,-4],[-19,-22],[-59,-30],[-14,-15],[10,-12],[-5,-13],[-30,-28],[-2,-3],[-1,-4],[-3,-9],[2,2],[2,-3],[1,-4],[0,-3],[-1,-2],[-3,-1],[-3,0],[-2,-4],[-1,-15],[-3,-7],[-5,-4],[-8,-1],[-6,-4],[-4,-3],[-2,-2],[-17,-4],[-12,-11],[-15,-25],[-14,-23],[-7,-7],[-37,-14],[-33,-1],[-8,-4],[-4,-10],[7,-5],[11,-1],[12,1],[-16,-17],[-10,-7],[-8,1],[-16,17],[-10,5],[-13,1],[-36,-18],[-2,-9],[-7,-6],[-8,-2],[-9,5],[8,7],[-2,7],[-7,6],[-16,9],[-4,1],[-36,-37],[-14,-8],[-18,5],[5,-6],[-1,-4],[-2,-4],[-2,-6],[6,-16],[0,-5],[-4,-8],[-8,-8],[-8,-6],[-9,-3],[-13,2],[-8,7],[-1,8],[7,11],[-1,7],[-7,10],[-10,8],[-10,3],[-7,-10],[1,-45],[-7,-18],[-10,-1],[-12,5],[-9,8],[0,8],[6,8],[5,10],[3,11],[-1,8],[-15,-9],[-14,-16],[-8,-18],[5,-16],[-17,1],[-50,-1],[-8,-2],[-9,-3],[-9,-2],[-8,4],[-5,7],[-3,3],[-5,3],[-14,1],[-15,-2],[-14,-5],[-11,-7],[-7,-10],[2,-8],[13,-15],[-60,13],[-11,0],[-11,-6],[-27,-6],[-5,-3],[-12,-19],[-28,-13],[-31,-11],[-25,-12],[-2,-7],[12,-20],[4,-16],[-2,-3],[-19,-3],[-7,-3],[-9,-6],[-18,-8],[-9,-2],[-36,10],[-3,11],[3,7],[-2,7],[-18,5],[1,3],[2,5],[1,2],[-10,3],[-20,13],[-40,7],[-10,5],[-15,11],[-17,6],[-18,0],[-20,-9],[8,-4],[9,-3],[20,-4],[-11,-18],[9,-6],[21,-3],[22,-8],[-21,-7],[-11,-2],[-12,0],[-3,-3],[7,-7],[31,-19],[3,-5],[1,-9],[-7,-2],[-15,4],[-25,10],[-62,35],[-20,5],[-1,-6],[21,-24],[-16,-3],[-16,6],[-11,7]],[[2532,7136],[4,5],[21,68],[11,18],[15,11],[62,24],[24,22],[3,34],[-5,38],[-1,35],[38,173],[8,11],[50,47],[9,16],[-3,29],[-79,206],[194,11],[194,10],[325,89],[7,9],[-1,15],[-6,24],[-5,10]],[[5901,1823],[14,-10],[6,19],[12,9],[13,7],[6,13],[-4,4],[-6,6],[-1,5],[10,2],[47,5],[0,-5],[-11,-12],[14,-7],[19,0],[-1,10],[12,4],[15,3],[15,0],[10,-3],[-6,-4],[4,-7],[5,-8],[8,-7],[12,-3],[8,-4],[21,-20],[5,-7],[-53,-3],[-21,-10],[-4,-27],[-9,6],[-9,4],[-7,-1],[-1,-9],[-7,-6],[-5,-8],[0,-8],[7,-8],[-30,-4],[-27,-1],[-10,2],[-15,7],[-9,1],[-10,-2],[-1,-4],[3,-7],[0,-7],[-10,-25],[-13,-17],[-4,-8],[-4,-4],[-3,-6],[-2,-7],[5,-2],[31,-5],[-7,-12],[-5,-10],[-2,-10],[-1,-11],[-6,-10],[-11,-11],[-5,-9],[11,-8],[-5,-11],[3,-7],[10,-3],[13,1],[-4,-4],[-6,-11],[29,-7],[31,-3],[3,2],[1,5],[4,3],[10,-2],[12,-5],[4,-3],[4,-5],[5,-7],[3,-10],[-3,-9],[-12,-4],[-24,0],[-3,1],[-8,3],[-5,1],[-3,-1],[-9,-7],[-5,-2],[-25,-3],[-24,-9],[-22,-12],[-18,-14],[-28,-13],[-10,-10],[5,-14],[6,-2],[16,2],[6,-3],[2,-22],[-26,-7],[1,-3],[-67,-8],[-21,-7],[0,-5],[11,0],[0,-5],[-18,-2],[-94,-28],[-18,-8],[-16,-12],[52,0],[-18,-7],[-54,-16],[-11,-9],[-5,-38],[8,-9],[12,-5],[27,-6],[-42,0],[0,-5],[10,-5],[-19,-10],[-9,-5],[-7,-16],[-10,-4],[-72,-20],[-26,-2],[-23,7],[49,47],[2,6],[-1,8],[-3,9],[10,6],[28,6],[11,5],[6,10],[6,19],[7,9],[-18,-6],[-17,-11],[-16,-7],[-17,4],[0,5],[10,7],[8,9],[2,10],[-10,4],[3,4],[4,7],[4,4],[-33,8],[-19,62],[-46,21],[2,14],[11,14],[28,12],[10,13],[4,15],[-4,11],[10,9],[-2,5],[-7,2],[-6,4],[-3,3],[-7,7],[-2,4],[1,9],[-2,5],[-8,9],[-8,15],[-6,16],[-1,17],[12,27],[25,22],[124,69],[104,96],[28,17],[38,9],[11,-1],[12,-3],[11,-2],[11,4],[4,5],[5,11],[4,7],[11,13],[13,12],[15,8],[17,6],[18,1],[14,-4],[11,-8],[9,-14],[1,-3],[-2,-3],[-3,-3],[-1,-3],[2,-4],[3,-2],[4,-2],[1,-2],[2,-7],[5,-6]],[[6232,1933],[3,-12],[10,-2],[25,4],[25,0],[12,-3],[13,-6],[-5,-4],[-5,-1],[-5,-1],[-6,1],[-11,-10],[-37,7],[-16,-5],[-16,-8],[-33,-7],[-16,-13],[10,-4],[5,-5],[2,-5],[-2,-6],[-22,-21],[-1,-3],[-12,1],[-12,3],[-10,5],[-10,6],[-26,27],[2,9],[5,5],[16,11],[6,7],[3,7],[5,7],[9,6],[13,3],[25,-1],[11,6],[7,0],[12,-2],[14,-1],[12,5]],[[6284,2196],[-31,-5],[-27,8],[-20,30],[26,0],[20,-7],[43,-5],[20,-8],[-31,-13]],[[5207,2498],[-2,-20],[-3,4],[1,1],[-1,1],[-2,11],[-3,4],[1,6],[6,-1],[3,-6]],[[5096,2557],[-3,-9],[-2,2],[-2,0],[-3,2],[-2,4],[1,3],[-8,10],[8,-3],[6,-5],[4,0],[1,-4]],[[5390,2568],[-1,-5],[-5,0],[-4,2],[-1,2],[-2,2],[1,3],[10,9],[24,12],[2,-3],[1,-2],[-2,-5],[-2,-6],[-2,-3],[-10,-5],[-6,0],[-3,-1]],[[5195,2564],[7,-3],[6,-10],[-1,-9],[-1,-3],[3,-2],[-1,-5],[-4,-2],[-4,-1],[-3,-2],[-1,-5],[-3,-1],[-8,2],[-33,0],[-3,2],[6,4],[11,5],[2,6],[-2,7],[-4,10],[1,4],[4,3],[4,-1],[0,3],[-2,7],[0,7],[4,5],[7,1],[1,4],[6,6],[7,1],[4,-1],[3,-4],[-1,-6],[-11,-9],[-8,-12],[2,-1],[12,0]],[[5425,2602],[-8,-3],[-2,1],[2,2],[1,5],[5,3],[8,0],[3,8],[0,1],[1,4],[3,3],[18,1],[4,2],[3,0],[2,-2],[4,0],[-2,-3],[-36,-21],[-6,-1]],[[5329,2628],[-5,-6],[-6,-3],[-4,0],[-2,3],[-3,0],[-8,-1],[0,5],[20,21],[9,6],[5,-2],[0,-4],[-4,-3],[-4,-2],[0,-2],[3,-2],[0,-2],[-1,-3],[0,-2],[0,-3]],[[5575,2647],[-11,-7],[-17,-5],[-6,-3],[-6,-1],[-6,0],[-3,-3],[8,-5],[11,-3],[2,-3],[-22,-2],[-12,-3],[-26,-4],[-16,-6],[-8,-1],[-6,2],[-3,3],[1,6],[12,11],[11,7],[27,11],[11,1],[11,0],[7,1],[4,2],[12,3],[23,8],[4,-2],[-2,-7]],[[5471,2688],[-1,-3],[-28,-6],[2,-2],[3,2],[5,0],[5,-1],[-3,-9],[-3,-3],[-6,4],[-6,2],[-5,-3],[-6,0],[-9,5],[-2,0],[3,-8],[0,-6],[1,-6],[-4,-6],[-11,-3],[-10,2],[-14,8],[-3,-1],[-6,-2],[-11,-7],[-12,-4],[-5,1],[0,5],[2,2],[4,11],[5,4],[9,2],[4,2],[-2,4],[3,5],[7,7],[8,3],[17,-1],[18,3],[17,2],[34,-3]],[[5443,2708],[5,-6],[-6,0],[-4,1],[-5,-2],[-4,-1],[-8,2],[-6,1],[3,7],[10,2],[6,1],[0,-3],[2,-1],[7,-1]],[[5720,2715],[-8,-5],[0,-5],[1,-5],[-4,-5],[-6,-3],[-10,1],[3,14],[3,4],[4,3],[2,-3],[1,0],[5,3],[5,2],[3,1],[1,-2]],[[5071,2616],[-6,-3],[2,-5],[6,-9],[-4,-1],[-21,16],[0,-3],[-7,0],[-7,9],[1,12],[-5,7],[-6,0],[-1,5],[2,13],[7,12],[7,8],[2,6],[-2,5],[1,7],[-2,20],[6,8],[8,0],[2,-5],[3,-4],[3,-1],[3,-1],[7,-5],[6,-8],[5,-10],[4,-12],[1,-11],[-4,-7],[-2,-5],[3,-9],[0,-7],[-3,-7],[-2,-8],[-2,-5],[-5,-2]],[[5765,2728],[-6,0],[-2,2],[0,3],[0,4],[2,3],[5,2],[1,1],[14,4],[-9,-7],[0,-4],[-2,-3],[0,-3],[-3,-2]],[[5867,2737],[-2,0],[-3,3],[-4,3],[8,4],[6,5],[8,3],[3,-2],[0,-3],[-4,-1],[-3,-2],[-3,-2],[-4,0],[-3,-4],[1,-4]],[[5652,2712],[-15,-5],[-2,-5],[-3,-4],[0,-4],[-1,-5],[-3,-3],[-3,-3],[-5,-4],[-6,-2],[-7,1],[-4,0],[-4,-2],[-7,0],[-8,1],[-8,5],[-8,7],[-3,6],[4,3],[5,-1],[7,2],[-3,5],[-6,5],[1,3],[4,-1],[7,2],[8,4],[2,5],[-6,2],[3,4],[30,10],[14,9],[13,5],[12,4],[10,0],[4,-8],[0,-6],[3,-2],[1,-4],[-2,-3],[-3,-2],[-21,-19]],[[5749,2760],[-6,-2],[-4,4],[10,6],[9,-2],[-2,-3],[-7,-3]],[[5807,2808],[-9,-10],[-9,-5],[-5,3],[10,10],[7,3],[2,-2],[4,3],[0,-2]],[[5866,2815],[-53,-17],[-7,2],[5,8],[9,8],[10,7],[10,2],[9,-2],[21,-2],[5,-1],[-9,-5]],[[5631,2826],[-7,-1],[-10,8],[10,-1],[5,-1],[2,-5]],[[5773,2841],[-2,-7],[-5,0],[-2,2],[-8,-1],[-4,0],[6,5],[15,1]],[[6010,2871],[-5,-1],[-15,6],[-2,5],[2,3],[9,0],[3,0],[3,-2],[2,-3],[4,-2],[1,-3],[-2,-3]],[[5896,2860],[0,-2],[0,-2],[-2,-1],[-4,-1],[-5,0],[-8,4],[-8,2],[-4,0],[-4,-1],[-7,3],[1,8],[11,9],[14,7],[14,2],[11,-1],[5,-1],[5,-1],[6,-3],[-3,-5],[-7,-3],[-5,-4],[-10,-10]],[[5703,2881],[67,-22],[-39,-1],[-16,2],[-17,9],[0,-17],[12,-5],[35,2],[-21,-14],[-23,3],[-40,17],[-28,4],[-3,2],[-7,9],[-3,4],[-13,5],[-39,10],[88,-1],[47,-7]],[[5982,2896],[-5,-3],[-17,0],[-1,3],[9,3],[16,0],[5,-2],[-7,-1]],[[5999,2930],[6,-4],[1,-3],[-2,0],[-10,0],[-6,0],[-5,-2],[7,-2],[-1,-4],[-11,-8],[-14,-3],[-3,1],[0,3],[3,3],[3,5],[1,7],[3,5],[6,1],[6,-3],[7,5],[9,-1]],[[5835,2943],[6,-1],[7,-4],[12,-9],[6,-2],[2,0],[2,-5],[2,-9],[-4,-9],[-11,-6],[-33,-8],[-4,-1],[-4,3],[3,6],[5,1],[2,3],[-2,4],[-1,6],[-4,7],[-10,5],[-8,6],[-3,3],[-8,6],[7,3],[31,0],[2,1],[5,0]],[[5496,2938],[-13,-1],[-7,1],[-15,0],[5,-3],[9,-8],[-7,-7],[-17,-2],[-19,1],[-19,6],[-13,6],[-4,6],[-4,5],[-5,4],[1,6],[12,3],[87,-12],[9,-5]],[[5962,2955],[-7,-3],[-6,3],[-1,5],[6,4],[8,-1],[3,-5],[-3,-3]],[[6025,2947],[-8,-4],[-13,5],[-9,6],[-4,2],[-3,2],[0,5],[6,4],[10,0],[11,-5],[5,-4],[3,-4],[2,-7]],[[5613,2971],[1,-4],[-5,0],[-12,1],[-1,-1],[37,-6],[0,-4],[-32,1],[-11,3],[-9,16],[7,0],[8,-3],[11,0],[6,-3]],[[6081,2975],[-3,-2],[-2,2],[3,2],[2,-2]],[[6031,2979],[8,-4],[6,1],[3,-2],[-3,-4],[-7,-3],[-7,-7],[-7,-1],[-5,4],[-2,5],[-1,3],[1,3],[6,4],[8,1]],[[5562,2979],[-17,-3],[-8,1],[0,3],[-1,2],[3,4],[-2,2],[4,3],[6,3],[9,-2],[15,-5],[6,-5],[-15,-3]],[[6231,2986],[-5,0],[-3,5],[-3,2],[0,1],[5,1],[5,0],[1,-3],[0,-2],[0,-4]],[[5995,2976],[-11,-8],[-17,1],[-9,12],[10,11],[19,4],[10,1],[4,-1],[5,-3],[2,-6],[-13,-11]],[[6452,2992],[-1,-1],[-9,2],[0,3],[7,2],[3,-6]],[[5864,3005],[-4,-4],[-16,-2],[0,-2],[6,0],[2,-2],[-6,-2],[-15,-1],[-8,3],[-4,-2],[-5,-2],[-18,-1],[-3,2],[5,6],[13,6],[23,1],[4,0],[3,0],[3,1],[5,2],[8,1],[7,-4]],[[5933,3019],[-2,-3],[-84,-7],[-3,2],[-1,3],[5,1],[13,0],[2,1],[1,2],[28,3],[6,-2],[1,-3],[2,2],[-1,2],[5,2],[19,1],[8,-1],[1,-3]],[[6197,3039],[-9,-10],[-2,1],[1,2],[0,3],[4,2],[4,4],[2,-2]],[[5825,3061],[3,-1],[4,0],[34,5],[-1,-4],[-42,-10],[-19,-10],[-8,-2],[-6,-4],[-4,-7],[-7,-1],[-12,4],[-3,0],[0,-4],[-3,-1],[-4,0],[8,-15],[-3,-7],[-8,-3],[-6,2],[-3,6],[2,-24],[-6,1],[-8,-3],[-5,-4],[-4,0],[-4,4],[-3,7],[-4,7],[-7,6],[-6,6],[-1,8],[-3,3],[-3,3],[3,6],[8,3],[10,0],[8,-1],[7,-8],[-1,4],[3,2],[4,2],[5,0],[4,1],[-1,1],[-5,-1],[-5,0],[-2,2],[-4,1],[-5,0],[-2,2],[4,6],[7,6],[15,9],[9,6],[13,5],[18,3],[16,0],[15,-3],[8,-4],[0,-4]],[[6103,3094],[5,-1],[8,1],[6,-3],[-1,-2],[-14,-6],[-4,0],[-16,2],[-7,4],[3,2],[20,3]],[[6174,3097],[-4,-1],[2,4],[24,9],[0,-2],[1,-2],[4,-1],[-2,-2],[-8,-2],[-13,-1],[-4,-2]],[[6257,3117],[-9,-8],[-2,0],[4,6],[7,2]],[[6045,3126],[-5,-3],[-10,-1],[-14,1],[-7,2],[-11,-22],[-6,-7],[-7,-1],[-8,-2],[-17,4],[-3,9],[7,7],[53,31],[11,3],[9,-4],[10,-10],[3,0],[3,-3],[-1,-4],[-3,0],[-4,0]],[[6102,3143],[0,-6],[-4,1],[-3,-2],[-10,0],[-5,1],[-1,3],[6,5],[4,2],[1,2],[5,-2],[1,-4],[6,0]],[[5900,3090],[-10,-2],[-10,1],[0,2],[13,4],[17,6],[14,9],[7,5],[30,17],[46,18],[-1,-6],[-14,-11],[-36,-22],[-2,-2],[-18,-6],[-3,-3],[0,-2],[-2,-1],[-6,-1],[-6,-1],[-19,-5]],[[6181,3146],[-6,-2],[-8,4],[-7,1],[-3,2],[5,1],[5,3],[7,-2],[2,-3],[6,-2],[-1,-2]],[[6207,3152],[-7,-1],[-2,1],[-1,3],[2,5],[3,1],[3,-1],[3,-1],[4,0],[1,-2],[0,-3],[-6,-2]],[[6188,3163],[-1,0],[-1,1],[1,0],[1,-1]],[[5985,3159],[-4,-1],[8,1],[0,-2],[-3,-3],[-7,-4],[-6,1],[-9,3],[-14,-1],[-4,1],[0,2],[5,5],[22,5],[5,-1],[-1,-2],[-1,-1],[9,-1],[0,-2]],[[6369,3184],[-6,-1],[10,5],[-4,-4]],[[6177,3214],[-11,-3],[-14,3],[-7,5],[0,3],[3,2],[5,0],[22,-4],[0,-1],[4,-2],[-2,-3]],[[6204,3228],[-4,-1],[-5,0],[-4,3],[-2,2],[-1,3],[-5,1],[3,3],[12,4],[11,2],[5,-2],[2,-4],[-3,-4],[-9,-7]],[[6135,3237],[-6,-1],[-5,3],[-1,5],[9,5],[11,-2],[2,-2],[-4,-3],[-1,-3],[-5,-2]],[[6058,3265],[0,-5],[2,1],[1,1],[2,-1],[3,-2],[-1,-4],[-3,-4],[-7,-4],[-12,-2],[-12,0],[-10,2],[-6,2],[-2,-2],[-5,-2],[-7,1],[-19,-2],[-5,6],[9,12],[34,28],[7,9],[6,2],[7,-1],[7,-3],[8,-5],[5,-8],[1,-10],[-3,-9]],[[6161,3287],[-16,-12],[-2,2],[-2,-1],[-4,-1],[-3,4],[0,3],[10,7],[6,8],[4,2],[12,3],[4,-3],[1,-6],[-4,-4],[-6,-2]],[[4887,2952],[14,16],[9,17],[6,4],[29,13],[6,6],[2,8],[0,11],[2,8],[0,6],[5,8],[37,32],[4,7],[-1,6],[-13,8],[-6,6],[-4,7],[-1,10],[3,11],[8,9],[1,0],[1,8],[2,4],[4,2],[6,1],[16,3],[13,5],[15,9],[9,8],[6,4],[6,0],[26,-1],[15,-3],[25,-8],[10,-1],[21,5],[46,7],[105,31],[61,1],[16,7],[12,12],[20,25],[19,12],[25,8],[48,6],[52,12],[35,13],[16,13],[8,16],[0,31],[4,11],[8,6],[10,5],[29,9],[4,3],[-2,2],[-5,3],[-7,2],[-7,4],[-5,5],[1,7],[9,10],[23,16],[39,31]],[[5727,3489],[14,-24],[4,-10],[4,0],[4,11],[1,14],[-3,14],[-6,11],[16,4],[20,2],[19,-2],[26,-13],[26,-3],[11,-8],[4,-12],[-1,-25],[5,-11],[33,-23],[6,-10],[-12,19],[-14,19],[-7,19],[10,21],[28,8],[10,-3],[3,-3],[-2,-12],[1,-12],[4,-9],[33,-55],[26,-34],[15,-9],[33,-6],[17,-5],[13,-6],[3,-1],[0,-2],[0,-6],[0,-2],[11,-9],[6,-2],[9,1],[-2,3],[-2,8],[-1,4],[13,-2],[13,-3],[-3,-10],[-1,-30],[1,-6],[-25,1],[-10,4],[-55,44],[-24,15],[-23,7],[7,-10],[26,-23],[4,-12],[-9,-12],[-47,-36],[-14,-6],[-17,-2],[-33,1],[-17,-2],[-12,-6],[-4,-10],[14,0],[29,7],[191,5],[32,-10],[-8,-16],[-12,-10],[-17,-6],[-46,-6],[-14,0],[-12,3],[-7,6],[-8,11],[-6,3],[-9,-12],[-16,-10],[-19,-6],[-56,-8],[-17,-8],[-2,-10],[-27,-1],[-5,-2],[-1,-6],[-3,-5],[-5,-4],[-6,-2],[37,0],[-5,-6],[-9,-7],[-10,-5],[-8,-3],[-8,2],[-6,5],[-7,3],[-9,1],[14,-14],[6,-8],[-8,-4],[-9,-2],[-19,-10],[-32,-7],[-43,-21],[-43,-8],[-19,-9],[-34,-23],[-26,-11],[-26,-2],[-57,3],[0,-5],[26,-10],[-11,-4],[-21,1],[-10,-2],[14,-4],[12,-6],[-4,-10],[12,-6],[19,-3],[15,-1],[-23,-9],[-46,1],[-44,7],[-22,11],[8,3],[9,1],[10,-1],[9,-3],[-3,6],[-3,15],[-4,4],[-10,1],[-16,-8],[-11,-2],[-6,1],[-8,7],[-6,1],[-4,-1],[-9,-7],[-5,-1],[-8,-4],[0,-8],[5,-9],[6,-5],[-25,-8],[-9,-2],[-9,2],[-16,6],[-9,2],[104,-50],[-27,-3],[-12,2],[0,-9],[59,0],[18,6],[8,-2],[5,-9],[5,0],[26,31],[48,10],[54,-5],[44,-11],[-4,-2],[-8,-6],[-4,-2],[23,-4],[10,2],[9,7],[-21,25],[-5,10],[36,0],[-30,11],[-14,7],[-8,12],[44,-1],[20,-5],[19,-9],[1,-2],[3,-10],[2,-3],[51,-15],[-8,-9],[-13,0],[-16,3],[-14,1],[17,-5],[26,-4],[24,-6],[10,-12],[-5,-11],[-15,-5],[-39,-1],[-13,-2],[-12,-3],[-12,-2],[-13,4],[-9,3],[-22,4],[-10,0],[-63,-5],[-20,5],[1,3],[2,9],[2,3],[-15,1],[-13,-3],[-13,-6],[-11,-7],[10,-3],[8,-5],[7,-6],[6,-6],[0,-5],[-26,0],[-7,-3],[4,-9],[45,-13],[17,-3],[21,-7],[18,-11],[11,-14],[-69,29],[-17,-2],[0,-8],[12,-6],[16,-2],[11,-1],[6,-5],[4,-9],[7,-6],[15,5],[-3,-3],[-2,-2],[-2,-3],[-4,-2],[0,-5],[20,4],[8,0],[4,-7],[-2,-8],[-6,-7],[-7,-3],[-9,4],[-16,1],[-29,-4],[-27,-8],[-13,-7],[8,1],[8,-1],[6,-3],[3,-7],[-71,-17],[-22,-2],[10,4],[21,6],[10,4],[-10,5],[5,3],[5,2],[0,5],[-12,0],[-12,-1],[-10,-4],[-10,-7],[-9,-4],[-25,-1],[-10,-3],[-7,-5],[-16,-17],[-9,-4],[-40,1],[1,-3],[3,-9],[1,-3],[-19,5],[-9,-1],[-8,-4],[12,-12],[-11,-12],[-20,-14],[-12,-17],[1,-9],[4,-5],[2,-6],[-7,-10],[-10,-6],[-13,-3],[-14,0],[-10,4],[-4,-9],[-1,-10],[0,-21],[-10,5],[-8,7],[-3,8],[5,10],[-5,9],[-3,3],[-7,5],[-6,0],[-5,-2],[-5,0],[-12,4],[-7,4],[-15,15],[-9,5],[1,-10],[9,-16],[12,-12],[-8,-13],[-5,-5],[-5,-2],[-4,3],[1,8],[3,9],[3,5],[-26,6],[-2,14],[4,16],[-8,14],[0,5],[11,11],[4,23],[0,22],[-2,10],[-1,3],[9,17],[0,9],[-8,3],[-10,-2],[-9,-6],[-4,-7],[-1,-23],[-4,-10],[-8,-5],[-7,3],[-27,18],[2,10],[16,17],[3,10],[-3,8],[-6,8],[-9,6],[-8,5],[11,-25],[-9,-11],[-11,-9],[-12,-6],[-15,-4],[7,-15],[-3,-16],[-2,-14],[13,-10],[-7,-12],[-6,-16],[-5,-10],[-8,3],[-8,-4]],[[5900,3529],[1,0],[4,0],[4,2],[4,-1],[4,-7],[1,-5],[-19,-5],[-16,-3],[-19,2],[-9,2],[-3,4],[-4,9],[-1,7],[1,4],[3,5],[4,1],[4,0],[0,3],[-13,9],[5,3],[15,-2],[11,-4],[6,-4],[4,-5],[5,-3],[7,-2],[5,-4],[-1,-4],[-3,-2]],[[5753,3557],[26,-9],[1,-2],[-4,-4],[-20,-3],[-7,2],[0,3],[-1,1],[-3,-1],[-3,1],[-2,3],[-3,1],[-3,0],[-2,0],[1,3],[2,2],[5,2],[7,1],[6,0]],[[5727,3542],[-1,-4],[-11,1],[-32,13],[-17,13],[32,-2],[26,-9],[1,-3],[-3,-3],[0,-2],[2,-2],[3,-2]],[[5789,3601],[3,-4],[-2,-3],[-13,6],[0,-4],[-5,-1],[-9,2],[-2,3],[4,5],[6,4],[5,-2],[13,-6]],[[5639,3733],[21,-9],[6,-9],[-12,1],[-18,8],[-11,1],[7,-10],[34,-35],[8,-12],[7,-7],[10,0],[17,9],[2,-11],[3,-7],[10,-12],[4,-2],[5,-1],[5,-2],[2,-3],[-3,-7],[-7,0],[-33,10],[-42,24],[-43,12],[-9,15],[-4,20],[3,36],[0,8],[-10,16],[3,6],[8,1],[13,-3],[3,-4],[9,-7],[3,-4],[0,-2],[-1,-4],[-1,-4],[2,-5],[9,-7]],[[5618,3775],[-9,-1],[-20,4],[-9,3],[1,2],[9,4],[12,2],[7,0],[5,-1],[2,-4],[3,-6],[1,-1],[-2,-2]],[[4835,3856],[3,1],[12,5],[13,5],[101,8],[21,-1],[15,-6],[11,-7],[28,-9],[10,-7],[-9,-6],[-27,-9],[-6,-3],[3,-10],[11,-17],[2,-8],[10,-15],[25,-8],[53,-4],[0,5],[-10,21],[26,21],[41,16],[77,11],[23,-1],[20,-8],[16,-25],[-2,-9],[-4,-8],[-7,-5],[-9,-3],[0,-5],[20,-1],[19,-7],[35,-17],[26,-10],[3,-4],[4,-12],[3,-4],[24,-17],[26,-11],[63,-12],[-12,-4],[-20,-10],[-9,-6],[0,-5],[10,-7],[6,-4],[5,-4],[12,5],[20,11],[14,4],[13,1],[10,-1],[24,-5],[53,0],[15,-5],[-1,-2],[-1,-6],[1,-7],[1,-5],[3,-3],[17,-7],[0,-5],[-9,-2],[-9,1],[-9,0],[-9,-4],[105,-20],[30,-15],[-31,-8],[-124,23],[-24,14],[-39,31],[10,-26],[30,-19],[34,-18],[25,-17],[-13,-1],[-10,4],[-19,12],[6,-18],[15,-10],[36,-13],[19,-11],[10,-4],[13,1],[9,2],[7,4],[3,6],[0,1],[0,-22],[1,-11],[4,-6]],[[2921,480],[-4,0],[-5,5],[-1,8],[4,1],[7,-1],[5,-3],[-6,-10]],[[3632,503],[-3,-3],[4,1],[10,4],[7,-1],[-5,-6],[-11,-9],[-12,7],[5,2],[-1,2],[0,3],[2,1],[2,1],[4,1],[-2,-3]],[[3548,568],[6,-2],[8,0],[9,-1],[9,0],[7,1],[-1,-4],[-9,-4],[-10,-1],[-2,-4],[4,-8],[0,-6],[-1,-3],[-4,-2],[-7,0],[-3,1],[-24,11],[-7,10],[10,11],[10,3],[5,-2]],[[3022,572],[0,-5],[-5,-6],[-6,4],[-8,2],[-1,3],[8,-1],[8,1],[4,2]],[[3397,554],[-8,-4],[-4,1],[-2,1],[-10,0],[-3,2],[-2,4],[1,4],[4,0],[8,6],[15,2],[5,2],[4,0],[2,-3],[-1,-5],[-2,-5],[-7,-5]],[[3462,557],[-4,-4],[-26,2],[-5,2],[-1,4],[1,3],[4,7],[5,3],[5,0],[18,-2],[6,-5],[-3,-10]],[[3512,556],[-15,-5],[-7,5],[-4,5],[2,1],[13,10],[2,3],[4,3],[6,0],[4,-1],[1,-3],[-3,-3],[-1,-3],[0,-3],[2,-3],[0,-4],[-4,-2]],[[3611,578],[5,-2],[6,2],[3,-4],[0,-4],[-3,-1],[-3,-2],[-1,-5],[-3,-3],[-6,-1],[-4,3],[-4,4],[-23,12],[3,4],[8,2],[6,-1],[9,-4],[7,0]],[[3345,594],[-5,-8],[-6,3],[0,10],[11,-5]],[[3844,725],[-21,-59],[-6,-4],[-8,-2],[-4,-6],[-3,-7],[-5,-7],[-13,-8],[-29,-15],[-13,-9],[-43,-53],[-18,-12],[-12,1],[-14,7],[-21,7],[22,24],[6,14],[-15,7],[-38,-9],[-19,1],[-13,13],[-9,-4],[-4,2],[-4,4],[-7,3],[-9,1],[-11,7],[-6,1],[-12,-6],[-15,-12],[-15,-7],[-12,11],[5,4],[7,9],[3,8],[-7,4],[-11,-2],[-28,-13],[-32,-9],[-5,-4],[-1,-11],[-4,-3],[-15,7],[-6,3],[-6,5],[-8,5],[-12,2],[-10,-2],[-8,-3],[-13,-10],[-5,-7],[0,-5],[-3,-3],[-34,-1],[-11,1],[-9,5],[15,4],[6,0],[-4,7],[-17,19],[-16,-13],[-30,-10],[-32,-3],[-23,8],[-5,3],[-6,-1],[-6,-3],[-6,-1],[-29,0],[-6,2],[-2,13],[-5,5],[-5,-1],[-19,-4],[-7,0],[3,-5],[5,-11],[3,-5],[-46,12],[-26,2],[-19,-6],[-17,-2],[-25,2],[-19,0],[1,-12],[-15,-4],[-12,6],[-14,8],[-16,5],[-37,-1],[-18,-4],[-12,-10],[-2,-6],[-2,-9],[1,-7],[6,-4],[10,-2],[6,-6],[3,-6],[4,-6],[21,-18],[8,-9],[7,-13],[-8,-2],[-10,-4],[-9,-6],[-6,-5],[-6,-3],[-4,3],[-4,7],[-15,0],[-5,-5],[-5,-3],[-6,1],[-5,2],[-6,1],[-21,-1],[-8,1],[-1,3],[10,7],[-6,4],[-6,5],[-4,7],[1,8],[-16,-10],[-9,5],[-3,4],[2,1],[-10,-2],[-2,-1]],[[2699,519],[2,31],[10,18],[10,12],[3,13],[-2,17],[-6,16],[-14,21],[-6,5],[-5,3],[-7,1],[-9,0],[-11,1],[-6,2],[-8,2],[-21,6],[-8,6],[-5,11],[-3,11],[-5,9],[-16,17],[-1,6],[2,6],[33,45],[12,11],[51,40]],[[599,1689],[6,-8],[-4,-10],[-8,2],[-9,4],[-2,0],[-5,-1],[-6,-2],[-4,1],[-5,2],[-2,5],[4,2],[6,0],[2,-1],[2,1],[8,4],[3,1],[4,-1],[2,-3],[3,2],[5,2]],[[505,1722],[0,-1],[8,-2],[1,-2],[1,-2],[1,-2],[1,-2],[3,-3],[-3,-3],[-4,0],[-10,2],[-5,-1],[-7,3],[-5,5],[-5,1],[-6,1],[-3,2],[1,3],[3,2],[8,0],[10,-1],[-5,2],[-1,3],[-2,4],[-1,3],[1,3],[0,6],[14,-5],[8,-7],[4,-4],[-2,-2],[-5,-3]],[[490,1857],[4,-2],[1,-4],[-1,-3],[-8,-1],[-2,-4],[-2,0],[-6,-3],[-5,-4],[-5,-2],[-6,-4],[-6,-2],[-1,2],[2,3],[-1,3],[1,3],[-1,0],[-6,-3],[-15,5],[-1,2],[4,1],[0,1],[-4,1],[1,3],[6,0],[5,-2],[3,1],[16,5],[0,2],[-7,1],[-11,-3],[-12,5],[0,1],[5,0],[11,6],[14,2],[18,-3],[7,-3],[2,-4]],[[569,1983],[0,-12],[1,-5],[4,-3],[-7,-20],[-3,-4],[-10,-4],[-7,0],[-2,5],[3,9],[-12,2],[-12,-6],[-9,-12],[-6,-19],[-7,-6],[-8,-3],[-16,2],[-6,-4],[-5,-6],[-7,-4],[-10,1],[-7,3],[-5,4],[-4,2],[-20,1],[-5,3],[-1,9],[-2,6],[-5,7],[-3,6],[2,6],[9,3],[21,-2],[9,1],[-15,5],[-17,0],[-14,2],[-6,11],[6,13],[14,3],[32,-3],[70,0],[17,3],[13,7],[13,3],[17,-4]],[[607,2120],[14,-11],[5,-14],[1,-16],[-1,-33],[-7,-14],[-17,-4],[-19,-1],[-37,-15],[-41,7],[-19,-6],[-13,14],[-20,3],[-22,-4],[-17,-8],[-8,-7],[-3,-5],[-2,-3],[-8,0],[-8,3],[-24,12],[0,-25],[-5,0],[-5,18],[-2,5],[-24,14],[-7,6],[1,11],[16,11],[74,38],[27,5],[19,9],[10,4],[13,0],[22,-3],[12,3],[-4,8],[1,7],[6,6],[8,4],[-4,7],[-2,3],[12,4],[13,0],[27,-4],[8,-17],[15,-6],[15,-6]],[[22,2610],[5,-3],[3,-4],[-2,-1],[0,-6],[1,-1],[6,3],[7,0],[10,-2],[3,-2],[0,-2],[-3,-3],[-3,-1],[1,-3],[6,-2],[4,1],[1,-3],[-1,-5],[-8,-5],[-3,0],[-6,2],[-4,0],[-4,1],[1,1],[-1,2],[-14,3],[-4,4],[-5,2],[-2,-2],[-1,-3],[-2,-3],[-3,-2],[-2,2],[1,2],[0,3],[0,9],[1,1],[4,1],[3,2],[-1,1],[-5,1],[-5,5],[1,2],[3,1],[2,2],[7,0],[4,1],[5,1]],[[701,1636],[-1,9],[4,19],[-3,1],[-9,3],[-3,0],[-4,-10],[-9,-5],[-10,1],[-4,7],[-3,11],[-6,8],[-7,6],[-4,8],[7,15],[49,3],[11,11],[-16,-4],[-21,-3],[-22,0],[-19,2],[-38,12],[-17,1],[3,-13],[-11,-2],[-13,1],[-11,3],[-1,8],[1,9],[73,39],[6,5],[-2,5],[-14,1],[-17,-1],[-11,-3],[-19,14],[-14,14],[-16,11],[-23,1],[16,11],[10,3],[10,1],[-8,16],[10,7],[40,8],[0,4],[-11,0],[0,5],[8,2],[3,1],[5,7],[-23,8],[6,12],[33,31],[9,18],[3,10],[-5,9],[-7,7],[-4,8],[3,7],[11,5],[-2,3],[-2,3],[-2,4],[19,3],[8,13],[7,48],[3,5],[8,2],[10,0],[8,2],[6,4],[4,9],[-12,-1],[-10,2],[-6,6],[-6,19],[-7,6],[-9,6],[-7,7],[-4,17],[13,11],[43,11],[-9,10],[-16,-2],[-32,-12],[-42,2],[-19,-2],[-1,-10],[-11,-4],[-24,0],[-38,-19],[-8,-2],[-4,-3],[-17,-13],[-7,-4],[-11,-2],[-11,1],[-11,2],[-9,4],[3,-4],[7,-11],[-25,4],[-7,11],[5,16],[12,18],[17,21],[19,16],[42,24],[-11,5],[10,8],[12,5],[25,7],[-13,11],[-18,-5],[-18,-11],[-13,-11],[-7,10],[-15,25],[-4,11],[-5,0],[5,-22],[-1,-25],[-8,-25],[-15,-21],[-20,-17],[-22,-14],[-53,-21],[7,10],[8,8],[10,7],[10,4],[0,6],[-11,-1],[-22,-6],[-7,1],[-5,10],[5,8],[8,5],[10,2],[26,2],[-5,5],[-14,11],[1,18],[-13,-1],[-7,-6],[-5,-9],[-7,-9],[-9,-5],[-11,-3],[-7,2],[4,8],[26,30],[16,15],[7,8],[6,10],[-7,-8],[-32,-24],[-13,-5],[-5,-3],[-3,-3],[-6,-9],[-2,-3],[-21,-6],[-21,5],[-19,0],[-17,-20],[-8,5],[-1,5],[2,6],[2,7],[-2,7],[-13,15],[3,13],[11,5],[27,-2],[-6,14],[8,8],[13,5],[11,8],[-27,8],[-4,4],[-2,5],[-7,6],[-2,4],[2,4],[4,2],[3,2],[2,0],[0,22],[2,5],[7,5],[7,3],[5,3],[5,7],[-16,0],[3,9],[-4,3],[-6,2],[-3,6],[0,6],[5,7],[0,7],[-7,10],[-30,22],[3,15],[3,6],[-4,2],[-20,0],[-7,6],[1,13],[9,12],[15,3],[-2,10],[4,7],[7,5],[7,9],[2,6],[-2,26],[-4,4],[-9,2],[-8,3],[-4,6],[0,18],[-2,7],[-4,8],[2,2],[2,3],[2,5],[-39,6],[-20,7],[-9,10],[7,11],[16,7],[34,9],[-32,-1],[-14,3],[-6,11],[3,9],[8,7],[48,36],[21,7],[76,7],[25,-6],[11,-20],[6,-16],[13,-16],[15,-14],[12,-7],[6,0],[0,1],[0,-1],[1,0],[11,-22],[-1,-47],[23,-7],[49,-2],[49,7],[40,19],[22,39],[5,19],[6,16],[20,32],[8,20],[2,35],[21,45],[7,12],[13,12],[7,10]],[[2699,519],[-15,-6],[-7,-1],[-20,-2],[-14,-7],[-26,-21],[-28,-19],[-17,-8],[-15,-3],[-15,-6],[-10,-14],[-7,-14],[-9,-6],[-31,-9],[-27,-23],[-20,-31],[-8,-30],[-3,-27],[1,-12],[8,-13],[13,-8],[29,-13],[9,-9],[2,-8],[-1,-7],[1,-9],[6,-8],[8,-6],[17,-9],[31,-29],[7,-13],[-3,-16],[-11,-9],[-41,-26],[-13,-5],[-9,-5],[-35,-35],[-15,-11],[-14,-6],[-17,-2],[-49,0],[-22,2],[-22,5],[-60,21],[-20,5],[-25,1],[-11,-1],[-19,-6],[-11,-3],[-11,0],[-36,5],[-101,-5],[-13,-2],[-9,-5],[-7,-7],[-10,-6],[-11,-3],[-33,3],[-26,-4],[-70,-26],[-22,-5],[-52,-2],[-24,2],[-125,25],[-41,1],[-15,3],[-8,1],[-5,1],[-12,7],[-7,2],[-15,2],[-16,-2],[-8,-3],[-12,-6],[-8,-1],[-8,1],[-10,3],[-8,1],[-15,-3],[-15,-5],[-11,0],[-3,13],[23,25],[5,0],[4,0],[5,-2],[7,-5],[13,-5],[19,1],[18,4],[10,7],[-5,10],[3,4],[7,0],[10,-4],[-8,20],[-36,32],[-8,20],[9,24],[22,14],[52,20],[8,7],[9,8],[6,10],[3,10],[-5,15],[-11,8],[-11,5],[-11,12],[-14,-2],[-14,0],[-6,15],[-19,-1],[-14,3],[-9,11],[10,1],[6,3],[3,5],[2,10],[-10,32],[-26,14],[-31,9],[-22,15],[-8,12],[-2,5],[0,11],[-2,3],[-5,4],[-6,4],[-5,1],[-10,5],[-5,12],[-3,14],[-6,9],[-13,7],[-12,5],[-8,7],[-3,14],[-5,8],[-67,47],[-6,5],[-28,35],[-8,8],[-7,23],[-3,6],[-18,22],[-9,17],[-31,12],[-10,9],[148,-34],[5,-3],[10,-10],[6,-3],[6,-1],[11,-7],[6,-2],[7,1],[10,4],[6,0],[32,-2],[15,2],[13,5],[10,10],[4,12],[-3,9],[-34,11],[-16,16],[-24,33],[-66,26],[-17,17],[27,26],[43,9],[90,-18],[43,9],[11,9],[5,5]]],"transform":{"scale":[0.0013214781765176521,0.0013695047070707077],"translate":[10.986827019000089,55.342678127000084]}};
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
