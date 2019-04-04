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
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = '__SYR__';
  Datamap.prototype.tcaTopo = '__TCA__';
  Datamap.prototype.tcdTopo = '__TCD__';
  Datamap.prototype.tgoTopo = '__TGO__';
  Datamap.prototype.thaTopo = '__THA__';
  Datamap.prototype.tjkTopo = {"type":"Topology","objects":{"tjk":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Gorno-Badakhshan"},"id":"TJ.BK","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Khatlon"},"id":"TJ.KL","arcs":[[-1,3,4]]},{"type":"Polygon","properties":{"name":"Tadzhikistan Territories"},"id":"TJ.RR","arcs":[[-2,-5,5,6,7],[8]]},{"type":"MultiPolygon","properties":{"name":"Leninabad"},"id":"TJ.LE","arcs":[[[9]],[[10]],[[-7,11]]]},{"type":"Polygon","properties":{"name":"Dushanbe"},"id":"TJ.DU","arcs":[[-9]]}]}},"arcs":[[[3779,3025],[-1,1],[-21,40],[-8,19],[-2,26],[14,48],[54,134],[16,66],[2,28],[1,128],[-3,66],[-4,36],[0,17],[1,20],[10,54],[15,54],[3,17],[0,23],[-5,39],[-4,20],[-5,15],[-10,17],[-2,18],[0,27],[4,50],[18,55],[87,105],[15,30],[4,34]],[[3958,4212],[63,77],[14,22],[8,21],[5,29],[10,27],[18,26],[42,48],[14,23],[24,53],[2,30],[-6,27],[-14,25],[-38,40],[-6,14],[5,9],[33,19],[23,19],[70,86],[20,18],[52,25],[20,14],[17,9],[16,-5],[16,-30],[13,-56],[6,-10],[11,-2],[39,8],[41,-4],[19,2],[14,7],[44,45],[62,38],[26,9],[26,3],[17,-8],[8,-14],[-1,-26],[-3,-21],[1,-20],[6,-21],[41,-105],[5,-32],[-5,-48],[1,-25],[-2,-25],[-5,-26],[-12,-36],[-1,-27],[12,-24],[38,-16],[56,4],[45,16],[20,4],[15,-4],[17,-16],[14,-25],[7,-36],[4,-45],[7,-33],[12,-25],[35,-34],[23,-48],[9,-12],[8,-6],[15,1],[20,10],[33,30],[22,17],[22,5],[19,-8],[16,-16],[13,-22],[16,-36],[6,-6],[5,5],[4,14],[5,23],[6,17],[20,32],[9,11],[18,6],[40,-2],[11,5],[10,12],[5,22],[0,61],[3,21],[7,11],[16,10],[13,10],[9,19],[9,29],[6,11],[9,14],[14,29],[8,12],[13,7],[22,2],[18,-4],[20,1],[17,5],[58,27],[9,0],[8,-3],[11,-14],[5,-4],[6,2],[8,10],[9,23],[8,23],[10,13],[20,8],[21,11],[15,20],[15,25],[18,20],[35,15],[20,5],[63,5],[21,10],[23,19],[36,45],[18,27],[22,53],[37,40],[-37,57],[-13,34],[-16,53],[-5,32],[2,32],[5,23],[4,49],[14,61],[40,64],[73,98],[10,25],[3,20],[-2,18],[-2,27],[3,26],[9,18],[13,15],[30,24],[44,24],[18,15],[9,19],[4,22],[1,66],[5,53]],[[6246,5757],[1,-1],[14,1],[53,161],[29,123],[15,35],[23,11],[28,6],[48,33],[22,2],[42,-15],[22,-2],[20,5],[40,59],[14,8],[20,-7],[32,-30],[21,0],[14,13],[25,42],[13,16],[22,9],[22,-1],[236,-86],[19,1],[55,16],[27,-2],[80,-24],[22,-10],[19,1],[63,47],[16,4],[16,-7],[22,-15],[45,-18],[41,5],[130,62],[73,19],[9,24],[2,32],[10,35],[31,31],[140,48],[45,6],[118,-18],[36,-26],[-1,-45],[14,-131],[1,-47],[-3,-36],[-40,-160],[-10,-68],[7,-66],[31,-73],[54,-75],[11,-32],[12,-78],[8,-37],[14,-30],[76,-81],[42,-66],[19,-17],[12,-39],[4,-38],[-6,-35],[-19,-28],[-27,-13],[-62,0],[-29,-20],[-18,-26],[-18,-37],[-10,-41],[3,-42],[16,-34],[37,-58],[14,-32],[4,-45],[-8,-101],[5,-35],[46,-108],[8,-33],[13,-95],[11,-36],[24,-38],[22,-20],[46,-25],[22,-18],[39,-50],[20,-17],[123,-6],[21,7],[17,39],[-10,35],[-17,38],[-1,44],[10,12],[51,24],[9,15],[2,19],[-1,20],[3,19],[18,38],[18,16],[22,0],[79,-39],[25,-6],[28,1],[89,44],[27,-5],[182,-126],[217,-117],[23,-28],[20,-32],[21,-25],[29,-6],[29,4],[24,-7],[20,-22],[20,-38],[1,0],[0,-1],[11,-25],[9,-11],[23,-19],[9,-14],[3,-19],[2,-22],[9,-65],[0,-45],[-8,-42],[-14,-37],[-55,-86],[-12,-37],[-4,-41],[0,-219],[25,-263],[24,-65],[90,-72],[16,-63],[-5,-145],[3,-61],[0,-15],[4,-13],[14,-12],[11,-14],[-3,-16],[-22,-50],[-9,-7],[-5,-12],[4,-30],[6,-17],[9,-13],[65,-51],[16,-22],[5,-42],[-5,-21],[-9,-24],[-20,-39],[-9,-21],[-4,-21],[-2,-20],[-4,-19],[-17,-35],[-17,-29],[-14,-32],[-5,-44],[12,-80],[30,-66],[38,-51],[116,-96],[22,-29],[65,-122],[37,-51],[40,-41],[-62,-29],[-30,-22],[-16,-39],[-3,-85],[-11,-28],[-119,-63],[-31,-7],[-24,-20],[-11,-40],[-14,-37],[-26,-18],[-38,31],[-59,142],[-36,56],[-164,144],[-37,-30],[-130,-12],[-11,0],[-11,4],[-46,20],[-28,17],[-24,-3],[-22,-7],[-37,10],[-15,1],[-13,6],[-18,44],[-13,12],[-14,-2],[-15,-14],[-7,30],[-15,-62],[-31,-6],[-37,14],[-34,0],[-21,-31],[-2,-79],[-23,-39],[-32,-19],[-142,-41],[-96,-51],[-27,-8],[-72,-49],[-55,-9],[-26,-11],[-48,-64],[-18,-6],[-20,7],[-29,3],[-12,-6],[-21,-23],[-14,-2],[-9,10],[-18,36],[-10,13],[-26,3],[-54,-25],[-20,18],[-6,48],[16,45],[27,33],[27,14],[49,8],[19,13],[22,26],[21,36],[9,34],[0,96],[1,19],[9,58],[-46,8],[-55,-2],[-89,34],[-153,80],[-57,-2],[-80,-63],[-21,9],[-22,19],[-30,5],[-32,-4],[-26,-13],[-20,-21],[-62,-96],[-14,-10],[-28,15],[-11,-5],[-49,-55],[-20,-35],[-22,-67],[-14,-32],[-26,-25],[-92,-13],[-91,-79],[-29,-48],[-31,-16],[-60,-17],[-51,-44],[-38,-75],[-60,-178],[-53,-120],[-8,-44],[-11,-22],[-191,-41],[-43,-31],[-88,23],[-58,-17],[-129,-75],[-50,-50],[-13,-21],[-19,-40],[-11,-17],[-44,-36],[-33,-53],[-371,-398],[-50,-30],[-63,-17],[-62,0],[-60,19],[-53,41],[-43,65],[-18,40],[-14,44],[-9,46],[-9,106],[-13,46],[-72,169],[-11,42],[-4,49],[0,94],[-5,27],[-22,50],[-8,24],[-2,28],[2,139],[10,94],[8,35],[9,20],[-5,56],[47,115],[1,64],[8,29],[3,48],[-2,97],[-10,88],[4,32],[15,52],[12,92],[-18,185],[6,100],[4,13],[16,30],[6,20],[3,23],[6,71],[15,71],[2,22],[-3,26],[-11,48],[-3,22],[11,41],[47,43],[20,41],[5,41],[1,55],[-2,50],[-4,28],[10,15],[-39,69],[-39,37],[-46,4],[-156,-76],[-23,-25],[-25,-20],[-28,16],[-48,56],[-14,3],[-10,-4],[-6,5],[-5,29],[2,25],[12,51],[9,59],[38,101],[18,94],[23,65],[8,68],[24,99],[7,52],[-9,101],[-30,68],[-44,41],[-105,62],[-79,116],[-49,51],[-36,26],[-16,5],[-15,0],[-10,-7],[-10,-1],[-13,16],[-8,19],[-11,42],[-8,18],[-13,20],[-13,16],[-14,12],[-17,6],[-29,-1],[-10,-16],[4,-52],[-13,-24],[-31,11],[-52,35],[-15,-3],[-8,-10],[-4,-10],[-9,-6],[-12,1],[-20,10],[-12,3],[-40,0],[-21,-7],[-9,-16],[-16,-39],[-74,-11],[-24,-21],[0,-16],[26,-27],[-11,-27],[-45,-48],[-12,-9],[-29,3],[-12,-10],[-5,-20],[0,-24],[1,-23],[0,-20],[-17,-78],[-13,-9],[-18,-7],[-15,-12],[-12,-57],[-38,-104],[-33,-127],[-16,-38],[-13,-19],[-43,-27],[-14,-14],[-56,-83],[-58,-108],[-10,-11],[-25,-19]],[[3779,3025],[-6,-5],[-7,-12],[-6,-20],[-14,-9],[-15,-4],[-9,-7],[-5,-21],[0,-19],[4,-19],[10,-19],[-29,-16],[-30,-7],[-29,9],[-26,30],[-15,-58],[6,-71],[18,-67],[22,-48],[14,-9],[42,-19],[9,-19],[4,-33],[8,-30],[12,-24],[12,-16],[-7,-27],[3,-32],[13,-67],[1,-33],[-3,-20],[-5,-19],[-2,-29],[-16,-33],[-6,-6],[-6,-9],[1,-18],[1,-21],[-1,-15],[-7,-17],[-3,-5],[-7,-9],[-4,2],[-25,-2],[-2,0],[-19,-67],[-3,-20],[-9,-8],[-44,-79],[-37,-21],[-38,10],[-38,20],[-36,8],[9,-17],[-40,11],[-12,6],[-5,6],[-7,10],[-5,15],[-6,11],[-17,5],[-27,14],[-14,33],[-12,36],[-21,27],[-30,2],[-53,-39],[-26,-10],[-13,-9],[-13,-16],[-14,-10],[-13,10],[-9,10],[-29,13],[-10,2],[-32,-6],[-54,-33],[-28,-8],[-174,22],[-26,-16],[-22,-96],[-28,-39],[-56,-59],[-5,-11],[-8,-27],[-5,-12],[-10,-13],[-18,-18],[-7,-13],[-8,-36],[-2,-43],[1,-88],[2,-8],[12,-4],[4,-10],[-1,-13],[-3,-3],[-3,-2],[-2,-7],[1,-21],[2,-21],[4,-20],[6,-16],[11,-34],[8,-79],[11,-21],[-10,-50],[21,-14],[24,-7],[-4,-30],[-44,-105],[-21,-30],[-52,-47],[-20,-34],[-14,-19],[-15,-8],[-5,-1],[-29,-9],[-26,-18],[-25,-3],[-121,117],[-7,5],[-28,28],[-12,19],[-23,81],[-23,28],[-29,27],[-26,34],[-18,83],[-20,40],[-26,34],[-25,20],[-88,16],[-4,3],[-8,2],[-3,-8],[6,-27],[9,-15],[20,-22],[6,-10],[5,-33],[-7,-20],[-14,-6],[-19,12],[-16,33],[-12,36],[-14,30],[-27,9],[-28,-13],[-5,-26],[15,-69],[4,-49],[-6,-22],[-15,2],[-48,43],[-15,11],[-16,2],[-27,-4],[-49,10],[-24,-1],[-14,-25],[6,-9],[4,-10],[7,-28],[-29,-6],[-15,-33],[-7,-37],[-5,-17],[-23,-5],[-48,-22],[-26,-5],[-6,-10],[-18,-44],[-11,-10],[-13,-1],[-61,-20],[-80,-9],[19,-53],[-9,-34],[-25,-19],[-33,-5],[-25,9],[-25,14],[-25,3],[-24,-26],[-10,-38],[1,-46],[9,-96],[-14,-33],[-30,0],[-53,25],[-33,-6],[-24,-28],[-20,-31],[-24,-14],[-16,-14],[-84,-105],[-14,-13],[-15,-9],[-10,1],[-6,0],[-11,12],[-7,18],[-5,20],[-8,19],[-43,79],[-12,14],[-30,23],[-14,17],[-20,48],[-14,40],[-18,28],[-57,20],[-32,24],[-29,30],[-16,31],[-1,34],[11,147],[6,33],[24,69],[14,78],[7,82],[-4,97],[-26,181],[5,96],[36,141],[54,135],[66,119],[69,94],[93,185],[38,105],[55,234],[22,33],[40,19],[60,12],[19,8],[7,7]],[[1145,2898],[0,-1],[35,-38],[13,-21],[18,-23],[32,-4],[97,22],[24,9],[5,-6],[5,-8],[4,-10],[4,-8],[7,-4],[7,1],[25,9],[8,7],[7,15],[20,106],[13,46],[17,34],[40,26],[6,8],[3,16],[3,43],[1,52],[5,42],[-2,11],[-6,7],[-20,9],[-8,5],[-5,9],[1,12],[2,12],[20,59],[54,125],[4,15],[3,13],[3,28],[0,27],[-1,38],[-3,23],[-17,78],[0,11],[2,13],[5,12],[20,34],[23,30],[10,4],[12,-1],[47,-19],[43,-10],[10,-1],[12,3],[17,13],[10,9],[7,11],[15,30],[5,8],[8,5],[10,4],[13,1],[11,-5],[8,-7],[21,-46],[13,-2],[48,17],[9,5],[9,8],[10,18],[6,14],[16,49],[5,10],[6,9],[25,21],[86,45],[175,14],[59,40],[5,1],[8,0],[10,-3],[9,-6],[11,-9],[6,-10],[6,-9],[8,-18],[3,-11],[2,-7],[5,-42],[104,-5],[12,-8],[13,-12],[0,-12],[-3,-10],[-4,-10],[-13,-17],[-5,-11],[-2,-14],[7,-26],[8,-11],[12,-6],[14,0],[23,-2],[13,4],[9,7],[14,15],[16,27],[26,33],[23,36],[8,20],[5,9],[7,8],[5,9],[12,29],[7,8],[24,20],[5,5],[10,16],[5,9],[30,30],[34,29],[57,75],[12,28],[117,244],[7,9],[9,5],[18,-2],[8,-3],[8,-6],[6,-7],[9,-18],[3,-10],[5,-9],[8,-7],[11,-1],[23,10],[11,9],[9,10],[47,120],[76,114],[13,15],[6,5],[60,32],[20,14],[17,2],[24,-10],[18,-14],[11,-16],[10,-18],[45,-62],[16,-33],[29,-42],[33,-26],[19,-15],[9,-35],[-1,-30],[-7,-52],[-5,-54],[4,-20],[5,-6],[5,7],[37,62],[35,47],[6,7],[10,5],[13,3],[60,-2],[76,10],[8,-5],[6,-7],[4,-7],[7,-12],[52,-55],[5,-8],[5,-10],[3,-10],[6,-21],[6,-38],[7,-35]],[[1145,2898],[13,14],[10,29],[6,35],[9,39],[1,1],[15,44],[50,107],[32,127],[20,134],[-5,89],[-31,70],[-102,127],[-66,53],[-22,32],[-47,122],[-50,67],[-12,33],[-5,33],[-2,73],[-8,35],[-31,67],[-9,30],[-4,50],[5,132],[-3,46],[-17,86],[-4,42],[10,35],[33,32],[6,14],[1,26],[-5,21],[-8,20],[-4,23],[5,50],[14,12],[23,-1],[29,9],[22,18],[20,24],[16,31],[11,38],[1,51],[-12,46],[-14,27]],[[1036,5091],[1,0],[34,13],[63,3],[23,9],[72,41],[20,6],[17,1],[9,-4],[25,-17],[11,-5],[8,1],[12,7],[8,6],[46,26],[37,-3],[25,10],[45,25],[14,22],[18,50],[41,40],[0,1],[3,9],[11,62],[7,28],[9,10],[9,4],[88,-6],[121,65],[17,4],[7,-6],[4,-10],[3,-10],[9,-8],[15,-5],[78,8],[72,-8],[81,-29],[7,-7],[19,-7],[5,-3],[32,-11],[41,-11],[39,24],[8,11],[6,9],[17,18],[93,73],[30,17],[21,9],[124,-6],[21,2],[9,9],[5,12],[3,84],[2,14],[5,18],[7,18],[17,21],[12,8],[12,2],[10,-1],[96,18],[14,0],[4,-4],[46,-58],[9,-19],[6,-20],[3,-24],[1,-26],[-2,-28],[-7,-41],[-1,-13],[1,-12],[5,-10],[7,-9],[7,-1],[7,5],[5,8],[11,18],[12,13],[19,12],[44,19],[14,12],[7,12],[-3,10],[-1,12],[-1,10],[1,16],[29,36],[5,10],[8,16],[4,17],[5,25],[7,94],[-3,18],[-4,13],[-16,24],[-7,13],[-5,22],[89,73],[12,2],[14,1],[11,-30],[8,-18],[8,-9],[10,-8],[18,-7],[11,0],[9,4],[14,10],[13,12],[12,15],[15,28],[12,33],[7,13],[11,13],[10,4],[129,25],[13,-2],[5,-19],[5,-11],[10,-11],[8,0],[7,5],[5,9],[11,13],[15,15],[36,19],[19,5],[14,-2],[7,-7],[4,-9],[2,-12],[0,-27],[1,-13],[4,-11],[6,0],[6,5],[26,26],[135,92],[7,7],[4,10],[9,28],[10,17],[9,7],[10,3],[8,-3],[7,-6],[11,-16],[6,-7],[13,-3],[51,3],[133,54],[16,2],[8,8],[6,10],[8,28],[3,9],[7,5],[70,13],[17,8],[12,10],[4,10],[7,26],[4,11],[6,9],[20,16],[46,49]],[[4235,6456],[1,-2],[13,-16],[30,-17],[13,-16],[7,-32],[-3,-31],[-6,-31],[0,-28],[19,-47],[34,-28],[39,-10],[35,8],[39,30],[15,6],[20,1],[11,-3],[10,6],[16,25],[24,16],[28,-18],[31,-28],[35,-14],[41,30],[24,63],[19,75],[26,63],[42,39],[53,20],[55,4],[72,-19],[16,-1],[14,15],[41,65],[18,18],[44,34],[9,10],[18,26],[9,9],[12,6],[37,9],[44,29],[23,3],[43,-36],[21,-26],[2,-2],[18,-34],[8,-37],[-7,-34],[-33,-66],[-10,-36],[26,-80],[53,-34],[62,-4],[130,38],[26,1],[20,-25],[11,-52],[4,-60],[-5,-46],[-15,-34],[-17,-24],[-13,-29],[-3,-47],[10,-46],[19,-36],[23,-25],[24,-11],[47,8],[47,28],[126,123],[22,16],[47,14],[45,34],[24,5],[22,-24],[14,-50],[7,-58],[3,-49],[11,-34],[27,-16],[55,-13],[11,-9],[19,-21],[27,-20],[4,-14],[0,-18],[3,-22],[12,-37],[13,-26]],[[1730,4277],[29,17],[8,-26],[-9,-27],[13,-28],[-1,-34],[3,-50],[24,-24],[24,2],[24,9],[2,23],[-2,38],[35,45],[38,22],[8,30],[15,33],[-22,7],[-7,29],[-23,8],[-13,10],[2,27],[-14,-1],[-5,36],[-8,32],[-13,33],[-9,35],[-11,15],[-5,-17],[-2,-32],[5,-42],[-7,-27],[-34,-23],[-28,-12],[-4,-21],[12,-41],[-33,-33],[8,-13]],[[4190,7272],[44,-2],[41,26],[16,-6],[9,-42],[-2,-41],[-13,-17],[-42,-11],[-37,-26],[-65,-73],[-8,8],[-36,86],[-13,22],[-43,42],[-17,33],[-10,38],[2,36],[19,-1],[155,-72]],[[4220,9798],[2,-39],[-26,8],[-21,28],[-37,68],[-22,30],[-1,2],[-15,47],[21,7],[35,-20],[29,-37],[18,-39],[17,-55]],[[1036,5091],[-24,50],[-43,134],[-19,33],[-1,0],[-10,4],[-10,1],[-11,-1],[-10,-4],[-21,-22],[-21,-11],[-21,6],[-20,27],[-10,8],[-22,10],[-18,1],[-18,-7],[-17,-12],[-98,-46],[-34,-1],[-163,37],[-22,31],[-2,2],[-6,56],[14,178],[-2,31],[0,1],[-12,27],[-8,4],[-21,-6],[-9,2],[-7,10],[-10,26],[-6,9],[-50,28],[-104,6],[-155,76],[-36,47],[0,1],[-9,90],[2,33],[3,16],[6,10],[9,12],[3,3],[14,6],[11,-5],[8,5],[10,76],[16,77],[2,84],[8,92],[16,89],[12,21],[19,3],[33,-6],[7,2],[6,4],[5,7],[4,8],[-9,102],[26,34],[102,22],[119,118],[47,21],[60,-2],[437,-157],[191,-8],[105,-52],[63,-6],[63,8],[79,29],[25,16],[0,1],[-9,29],[-5,14],[17,35],[55,48],[31,45],[17,45],[7,55],[13,370],[13,49],[15,-2],[3,-1],[14,-8],[43,53],[21,-22],[34,-77],[17,-12],[9,15],[3,23],[0,11],[0,4],[9,34],[4,4],[14,3],[4,5],[16,43],[0,33],[-28,84],[-13,49],[-4,43],[8,18],[27,-25],[26,-79],[20,-99],[29,-63],[54,32],[-4,51],[-113,214],[-6,23],[-2,21],[3,48],[-4,17],[-23,25],[-3,21],[17,42],[20,-22],[29,-72],[16,7],[46,55],[26,11],[93,-20],[29,6],[10,29],[2,33],[-4,35],[-8,32],[-60,59],[-299,-80],[-12,-3],[-46,24],[-57,49],[-33,50],[27,26],[52,19],[71,26],[28,3],[75,-18],[29,6],[45,35],[25,14],[208,45],[29,-7],[41,-28],[44,-30],[115,-48],[63,-3],[48,31],[0,54],[-93,115],[-5,68],[34,5],[49,-25],[41,9],[9,113],[-8,50],[-14,44],[-33,82],[-12,41],[-28,129],[-51,119],[0,48],[46,43],[78,8],[18,16],[5,31],[-8,122],[0,84],[9,69],[20,59],[33,58],[18,21],[20,15],[42,19],[23,-4],[17,-19],[16,-23],[20,-17],[41,-5],[29,-37],[49,-106],[16,-18],[32,-29],[14,-24],[23,-54],[14,-24],[16,-20],[39,-20],[34,14],[31,38],[53,92],[26,29],[28,20],[235,101],[121,126],[133,72],[93,76],[71,113],[35,242],[48,17],[57,-32],[16,-24],[24,-36],[3,-8],[4,-7],[41,-47],[233,-359],[11,-20],[-3,-43],[-25,13],[-45,53],[-25,-4],[-12,-29],[3,-39],[20,-36],[117,-37],[49,-38],[-11,-77],[-3,-20],[0,-1],[-20,-17],[-4,-9],[-3,-11],[-4,-9],[-21,-6],[-11,-8],[-18,-19],[-19,-24],[-78,-87],[-45,-76],[-16,-19],[-19,-13],[-19,-7],[-18,-11],[-17,-24],[-31,-71],[-13,-23],[-12,-7],[-88,-28],[-38,-34],[-21,-45],[3,-48],[2,-11],[2,-6],[17,-33],[-1,0],[3,-3],[11,-18],[3,-10],[-17,-80],[64,-39],[26,-10],[28,3],[24,10],[25,4],[28,-16],[34,-77],[17,-106],[23,-97],[51,-51],[54,-5],[55,7],[182,77],[114,14],[26,-4],[26,-55],[-21,-56],[-43,-44],[-39,-18],[-68,21],[-17,-9],[-9,-10],[-24,-17],[0,3],[-5,6],[-6,4],[-7,-1],[-5,-6],[-7,-14],[-50,-59],[-18,-15],[-82,-37],[-33,-45],[-6,-58],[1,-71],[-11,-79],[-17,-42],[-22,-32],[-26,-22],[-27,-14],[-55,-2],[-15,-11],[-8,-20],[-11,-51],[-11,-19],[-27,13],[-10,30],[4,40],[11,43],[17,32],[20,20],[21,15],[20,19],[19,51],[-13,41],[-30,28],[-32,14],[-102,21],[-48,29],[-45,8],[-23,17],[-21,31],[-16,32],[-18,28],[-28,19],[-29,3],[-64,-5],[-28,12],[-182,164],[-45,7],[-504,-248],[-21,-4],[-20,3],[-8,11],[-14,35],[-10,5],[-6,-11],[-5,-39],[-4,-15],[-26,-53],[-21,-52],[-8,-59],[10,-73],[5,-13],[3,-14],[1,-16],[-1,-15],[29,-75],[2,-30],[-123,-60],[-62,145],[-37,58],[-18,5],[-5,-5],[0,-14],[-6,-23],[-24,-76],[-59,-244],[-14,-89],[-4,-90],[9,-42],[19,-31],[23,-26],[18,-31],[9,-38],[5,-43],[-6,-274],[18,-55],[50,29],[8,16],[3,18],[5,15],[12,8],[7,-7],[31,-45],[27,-12],[55,12],[28,0],[24,5],[23,12],[22,18],[43,52],[22,12],[112,10],[52,-9],[50,-23],[54,-43],[49,-21],[99,29],[52,-8],[39,-25],[11,12],[20,40],[21,27],[27,11],[28,0],[26,-9],[43,-34],[20,-11],[22,10],[10,22],[36,106],[20,21],[12,-22],[6,-43],[0,-39],[-14,-82],[3,-32],[22,-12],[22,8],[114,116],[17,9],[13,-3],[27,-11],[12,0],[8,7],[7,13],[7,12],[13,6],[21,6],[41,22],[22,3],[18,-10],[29,-35],[16,-13],[22,-3],[47,12],[22,-4],[31,-33],[18,-48],[25,-110]]],"transform":{"scale":[0.0007822216955695406,0.0004361772033203289],"translate":[67.34269006300022,36.67864084900012]}};
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
