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
  Datamap.prototype.tjkTopo = '__TJK__';
  Datamap.prototype.tkmTopo = '__TKM__';
  Datamap.prototype.tlsTopo = '__TLS__';
  Datamap.prototype.tonTopo = '__TON__';
  Datamap.prototype.ttoTopo = '__TTO__';
  Datamap.prototype.tunTopo = '__TUN__';
  Datamap.prototype.turTopo = '__TUR__';
  Datamap.prototype.tuvTopo = '__TUV__';
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = {"type":"Topology","objects":{"tza":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Mbeya"},"id":"TZ.MB","arcs":[[0,1,2,3,4,5,6]]},{"type":"Polygon","properties":{"name":"Rukwa"},"id":"TZ.RK","arcs":[[-5,7,8]]},{"type":"Polygon","properties":{"name":"Zanzibar South and Central"},"id":"TZ.ZS","arcs":[[9,10,11]]},{"type":"Polygon","properties":{"name":"Mwanza"},"id":"TZ.MW","arcs":[[12,13,14,15,16]]},{"type":"Polygon","properties":{"name":"Shinyanga"},"id":"TZ.SH","arcs":[[17,18,19,20,-14]]},{"type":"Polygon","properties":{"name":"Tabora"},"id":"TZ.TB","arcs":[[21,-7,22,23,24,-20]]},{"type":"Polygon","properties":{"name":"Kagera"},"id":"TZ.KR","arcs":[[25,-16,26,27,28]]},{"type":"Polygon","properties":{"name":"Kigoma"},"id":"TZ.KM","arcs":[[-24,29,30,-28,31]]},{"type":"Polygon","properties":{"name":"Dar-Es-Salaam"},"id":"TZ.DS","arcs":[[32,33]]},{"type":"Polygon","properties":{"name":"Morogoro"},"id":"TZ.MO","arcs":[[34,35,36,37,38,39,40,41]]},{"type":"Polygon","properties":{"name":"Kaskazini-Pemba"},"id":"TZ.PN","arcs":[[42,43]]},{"type":"MultiPolygon","properties":{"name":"Kusini-Pemba"},"id":"TZ.PS","arcs":[[[44]],[[45,-43]]]},{"type":"MultiPolygon","properties":{"name":"Pwani"},"id":"TZ.PW","arcs":[[[46]],[[47]],[[48,-33,49,50,-35,51]]]},{"type":"MultiPolygon","properties":{"name":"Kaskazini-Unguja"},"id":"TZ.ZN","arcs":[[[52]],[[-11,53,54]]]},{"type":"Polygon","properties":{"name":"Zanzibar West"},"id":"TZ.ZW","arcs":[[-10,55,-54]]},{"type":"Polygon","properties":{"name":"Dodoma"},"id":"TZ.DO","arcs":[[-40,56,57,58]]},{"type":"Polygon","properties":{"name":"Iringa"},"id":"TZ.IR","arcs":[[-57,-39,59,-2,60]]},{"type":"MultiPolygon","properties":{"name":"Lindi"},"id":"TZ.LI","arcs":[[[61]],[[62]],[[63,64,65,-36,-51]]]},{"type":"Polygon","properties":{"name":"Mtwara"},"id":"TZ.MT","arcs":[[66,-65,67]]},{"type":"Polygon","properties":{"name":"Ruvuma"},"id":"TZ.RV","arcs":[[-66,-67,68,69,-37]]},{"type":"Polygon","properties":{"name":"Singida"},"id":"TZ.SD","arcs":[[70,-58,-61,-1,-22,-19,71,72]]},{"type":"Polygon","properties":{"name":"Arusha"},"id":"TZ.AS","arcs":[[73,74,-73,75,76,77]]},{"type":"Polygon","properties":{"name":"Manyara"},"id":"TZ.MY","arcs":[[78,-41,-59,-71,-75,79]]},{"type":"Polygon","properties":{"name":"Kilimanjaro"},"id":"TZ.KL","arcs":[[80,81,-80,-74]]},{"type":"Polygon","properties":{"name":"Mara"},"id":"TZ.MA","arcs":[[-77,82,-17,-26,83]]},{"type":"Polygon","properties":{"name":"Tanga"},"id":"TZ.TN","arcs":[[-52,-42,-79,-82,84]]},{"type":"Polygon","properties":{"name":"Katavi"},"id":"TZ.KA","arcs":[[-23,-6,-9,85,-30]]},{"type":"Polygon","properties":{"name":"Simiyu"},"id":"TZ.SI","arcs":[[-76,-72,-18,-13,-83]]},{"type":"Polygon","properties":{"name":"Geita"},"id":"TZ.GE","arcs":[[-21,-25,-32,-27,-15]]},{"type":"Polygon","properties":{"name":"Njombe"},"id":"TZ.NJ","arcs":[[-38,-70,86,-3,-60]]}]}},"arcs":[[[3741,4456],[28,-24],[20,-31],[13,-48],[7,-51],[21,-37],[39,-15],[31,-31],[21,-41],[14,-21],[18,-19],[51,-16],[12,-22],[3,-25],[16,-39],[3,-38],[15,-9],[18,-4],[37,-28],[41,-19]],[[4149,3938],[23,-16],[15,-17],[-13,-26],[-18,-22],[-25,-60],[-20,-36],[-25,-33],[-16,-34],[-8,-38],[13,-27],[34,-5],[419,22],[46,-4],[133,-33],[33,-24],[38,-13],[243,-40],[9,-28],[-3,-24],[24,-4],[43,4],[41,-15],[25,-26],[-22,-30],[-39,-32],[-50,-15],[-22,-28],[-32,-77],[-23,-40],[-32,-25],[-38,-13],[-33,-32],[-26,-40],[-18,-39],[14,-38],[19,-28],[15,-32],[-11,-61]],[[4862,2909],[-22,-61],[-20,-14],[-30,4],[-33,-13],[-29,-21],[-24,-49],[-31,-34],[-42,-17],[-46,-1],[-87,13],[-89,-23],[-52,-1],[-53,5],[-45,-19],[-9,-27],[-25,-9],[-67,24],[-49,-10],[-37,-34],[-51,-86],[5,-45],[30,-35],[21,-39],[15,-42],[-19,-11],[-5,-19],[30,-7],[10,-13],[3,-29],[20,-26],[49,-87],[27,-39],[17,-7],[18,-3],[36,-37],[-3,-30]],[[4275,2067],[-28,19],[-31,11],[-15,-13],[-11,-13],[-21,-18],[-14,-23],[17,-42],[-1,-16],[-7,-28],[0,-17],[-4,-12],[-7,-10],[-13,-9],[0,-6],[-15,-17],[-11,8],[-9,19],[-22,18],[-25,16],[-21,9],[-24,16],[-23,23],[-24,16],[-29,-8],[-24,-14],[-23,-3],[-24,4],[-27,9],[-31,3],[-22,-9],[-21,-13],[-28,-7],[-37,3],[-17,6],[-14,10],[-11,17],[-15,35],[-17,16],[-51,37],[-16,5],[-8,-1],[-14,-10],[-8,-2],[-10,1],[-19,5],[-13,0],[-5,-3],[-13,-10],[-8,-3],[-3,2],[-27,11],[-24,5],[-8,4],[-55,43],[-45,46],[-16,10],[-18,-1],[-17,-9],[-13,-15],[-14,9],[-67,26],[-42,28],[-7,2],[-15,-2],[-7,3],[-5,6],[-3,14],[-3,8],[-13,13],[-11,7],[-64,5],[-78,17],[-33,3],[-13,9],[-13,20],[-17,42],[-10,13],[-32,23],[-37,9],[-117,-2],[-19,2],[-18,7],[-18,13],[-33,35],[-8,4]],[[2538,2476],[0,6],[-8,56],[9,11],[14,2],[-12,37],[-34,33],[-21,15],[-16,19],[18,26],[-31,34],[-42,29],[19,37],[112,41],[52,33],[67,88],[4,104],[-15,51],[3,53],[33,41],[55,2],[113,78],[23,-11],[4,-18],[-4,-28],[14,-23],[1,-28],[4,-27],[75,-98],[37,-3],[35,5],[34,-7],[-7,61],[-207,285],[-43,44],[-166,114],[-242,130]],[[2416,3668],[-16,33],[25,80],[35,75],[32,49],[92,37],[33,66],[36,101],[0,98],[205,73],[46,26]],[[2904,4306],[62,-1],[62,10],[23,18],[58,96],[10,23],[22,9],[40,-4],[30,20],[22,20],[28,11],[77,18],[73,-22],[63,-43],[72,-17],[195,12]],[[2538,2476],[-10,6],[-9,0],[-17,-4],[-8,-1],[-10,3],[-25,15],[-23,4],[-15,-6],[-13,-10],[-18,-8],[-39,9],[-18,37],[0,46],[17,37],[-134,38],[-21,-2],[-30,-17],[-19,-7],[-18,0],[-15,6],[-86,69],[-21,28],[-7,40],[0,35],[-6,23],[-18,16],[-35,10],[-14,9],[-19,23],[-14,8],[-14,1],[-12,-2],[-12,1],[-12,9],[-3,6],[-3,17],[-3,6],[-8,5],[-3,-2],[-2,-3],[-7,-3],[-10,-2],[-46,-17],[-7,-5],[-8,-3],[-12,2],[-9,8],[-17,23],[-11,8],[-21,0],[-19,-11],[-19,-13],[-19,-10],[-37,1],[-40,14],[-37,23],[-30,24],[-61,66],[-57,85],[-45,92],[-23,88],[-22,84],[-65,165],[-192,308],[-24,88],[-9,61],[-32,117],[-67,150]],[[875,4264],[254,189],[98,31],[196,10],[78,-31],[39,-121],[0,-81],[39,-61],[128,-10],[147,-11],[48,-60],[10,-102],[20,-142],[19,-131],[118,-21],[147,-20],[200,-35]],[[8974,5105],[-1,5],[-3,19],[-16,17],[-9,22],[-2,23],[6,73],[-5,19],[-1,19]],[[8943,5302],[65,4],[35,24],[5,3]],[[9048,5333],[1,-2],[10,-43],[5,-3],[19,-3],[2,-12],[-2,-12],[-4,-11],[-2,-13],[1,-15],[1,-11],[4,-10],[6,-12],[-10,-13],[-5,-8],[-3,-11],[13,6],[8,-6],[7,-10],[9,-8],[0,14],[6,9],[8,0],[4,-11],[4,1],[1,0],[0,2],[1,3],[15,-3],[0,19],[-4,28],[2,20],[15,-21],[8,-27],[17,-136],[3,-8],[25,-44],[-5,-40],[-22,-28],[-32,-12],[-33,10],[-13,13],[-13,16],[-8,18],[-18,80],[2,14],[-20,-7],[0,-10],[8,-12],[6,-13],[-1,-21],[-5,-5],[-25,10],[4,18],[-5,14],[-23,26],[-29,45],[-7,7]],[[3627,8899],[115,-224],[27,-37],[68,-83],[40,-40],[32,-30],[41,-19],[41,-26],[22,-43],[-3,-26],[-17,-19],[-18,1],[-16,-6],[-34,-28],[-62,18],[-25,-16],[-21,-6],[-16,-14],[-13,-18],[-22,-5],[-12,-24],[27,-104],[-7,-38],[-26,-80],[-6,-44],[-12,-29],[-22,-22],[-22,-67]],[[3686,7870],[-49,-31],[-36,-10],[-38,-6],[-34,8],[-31,-11],[-34,-69],[-60,-29],[-21,13],[-17,18],[-17,8],[-19,2],[-27,15],[-30,9],[-24,20],[-14,34],[-26,25],[-27,21],[-26,-5],[-30,-10],[-23,7],[-18,-11],[-14,-29],[-26,-13],[-26,1],[-7,-25],[-12,-35],[4,-30],[21,-3],[-1,-26],[-33,1],[-72,46],[-32,24],[-1,48],[7,52],[-8,34],[-19,28]],[[2866,7941],[77,221],[-78,68],[23,70],[-157,95],[48,94],[-152,26],[-28,39],[-46,17],[-37,25],[-58,40],[-68,36],[-26,21],[-15,29],[3,24],[-10,21],[-18,17],[-4,30],[-7,48],[-16,56]],[[2297,8918],[743,632]],[[3040,9550],[15,-14],[551,9],[109,-44],[10,-48],[-4,-51],[2,-51],[-8,-49],[-24,20],[-39,5],[-38,-28],[-38,-89],[4,-14],[12,-20],[-7,-12],[-1,-7],[1,-14],[-3,-2],[-22,-14],[28,-20],[35,18],[35,26],[32,2],[2,9],[7,5],[10,0],[11,-1],[-6,-12],[6,-7],[19,-13],[7,-11],[-2,-5],[-24,-16],[39,-4],[36,-9],[-2,-3],[-1,-1],[-1,0],[-3,-2],[7,-3],[2,-2],[3,1],[7,4],[14,-16],[-4,-13],[-11,-13],[-6,-13],[-7,3],[-41,1],[-59,41],[-28,8],[-25,-24],[25,-38],[-12,-3],[-4,-4],[-2,-6],[-36,31],[-14,3],[0,-27],[-6,0],[-6,13],[-13,19],[-13,10],[-11,-11],[14,-6],[6,-12],[1,-13],[-7,-10],[-4,3],[-22,7],[0,-2],[-25,2],[-5,1],[-2,2],[-2,-1],[-4,-9],[3,-1],[2,-7],[1,-10],[1,-7],[-4,-10],[-8,-13],[-1,-10],[2,-7],[3,-7],[8,-11],[16,19],[18,10],[20,0],[26,-10],[23,-13],[10,-10],[4,-12],[5,-8]],[[3686,7870],[46,-6],[43,-39],[64,-62],[79,-39],[45,-13],[33,8],[31,17],[27,-12],[26,-52],[43,-27],[66,-8],[84,-2],[73,-22],[29,-49],[31,-106],[38,-92],[50,-66],[38,-37],[43,-32]],[[4575,7231],[-23,-26],[-54,-14],[-34,-31]],[[4464,7160],[-26,4],[-21,-12],[-12,-22],[-24,-1],[-31,14],[-32,2],[-18,5],[-14,14],[-18,7],[-20,-6],[-29,0],[-29,9],[-25,18],[-18,25],[-24,16],[-28,4],[-54,1],[-68,24],[-30,-1],[-30,-5],[-18,15],[-4,23],[-50,12],[-52,-13],[-25,-9],[-61,-1],[-50,14],[-104,-26],[-80,-39],[-48,-2],[-53,4],[-41,36],[-37,12],[-43,-19],[-64,14],[-15,-8],[-13,-13],[-58,-26],[-49,-17],[10,-53],[-14,-51],[-21,-4],[-10,-16],[-16,-15],[-6,-16],[15,-19],[18,-16],[41,-15],[-17,-49],[-87,-26],[-22,-1],[-1,15],[1,18],[-10,26],[-17,19],[-29,14],[-32,-20],[-24,-4],[-14,-24],[-6,-37],[6,-35],[-3,-20],[-14,-11],[-23,-30],[-32,-7],[-37,18],[-34,21],[-73,24],[-75,-15],[-73,-58],[-67,-32],[6,35],[3,39],[-13,46],[-3,48],[2,50],[-7,48],[-26,26],[-30,23],[-80,17],[-105,33]],[[2129,7159],[-12,65],[12,59],[51,78],[79,72],[95,46],[91,13],[83,7],[12,72],[-15,92],[-13,94],[19,63],[39,52],[28,23],[34,10],[27,-20],[8,-34],[23,-20],[28,-3],[15,31],[21,25],[27,23],[56,28],[29,6]],[[4464,7160],[-4,-40],[-7,-17],[-8,-15],[-7,-30],[-28,-3],[-29,11],[-21,-19],[-46,-82],[-39,-86],[-107,-143],[-19,-85],[10,-79],[2,-80],[-32,-89],[0,-47],[15,-45],[8,-36],[-26,-73],[6,-39],[9,-39],[26,-28],[46,-17],[40,-25],[29,-24],[31,-21],[79,-83],[20,-25],[-25,-41],[-34,-35],[-58,-51],[-40,-63],[20,-24],[27,-20],[3,-42],[-19,-39],[-24,-20],[-5,-17],[-2,-18],[-1,-81],[-47,-181],[-3,-78],[10,-32],[4,-30],[-62,-47],[-53,-46],[-31,-52],[-10,-8],[-22,-3],[-19,-9],[-36,-26],[-92,-96],[-65,-25],[-14,-9],[-42,-52],[9,-21],[-6,-99],[5,-98],[-39,-82]],[[2904,4306],[21,93],[9,96],[-5,97],[4,96],[26,86],[53,69],[25,16],[18,24],[9,16],[5,18],[-6,13],[-8,13],[-5,19],[-15,9],[-131,12],[-37,14],[-27,30],[-33,53],[-13,14],[-9,4],[-20,3],[-17,13],[-31,14],[-10,7],[-5,5],[-9,14],[-1,5],[1,10],[0,4],[-6,5],[-11,2],[-6,3],[-12,9],[-46,26],[-22,17],[-23,27],[-21,31],[-15,34],[-15,63],[-12,16],[-6,16],[1,46],[-4,18],[-6,8],[-17,16],[-8,8],[-3,9],[-3,10],[-3,9],[-6,4],[-19,2],[-51,17],[0,6],[-14,-7],[-16,1],[-42,8],[-21,11],[-3,-1],[-3,-3],[-4,-2],[-6,3],[-8,10],[-5,4],[-5,2],[-27,-6],[-19,-14],[-18,-17],[-19,-14],[-18,-8],[-7,-5],[-10,-9],[-5,-7],[0,-3],[-12,-2],[-34,-14],[-10,-6],[-9,-2],[-67,21],[-10,-2],[-9,-14],[-14,10],[-15,-1],[-17,-6],[-19,-3],[-20,3],[-17,7],[-33,22],[-17,-7],[-37,5],[-17,-8],[-16,-3],[-13,14],[-17,31],[-18,7],[-18,-3],[-19,-7],[-17,-4],[-12,3],[-2,7],[5,13],[-1,5],[-4,9],[-1,5],[6,21],[-4,16],[-3,9],[-5,8],[3,7],[0,6],[-3,6],[-4,1],[-12,0],[-6,2],[-59,47],[-4,1],[-3,3],[-7,15],[-2,11],[0,11],[26,15],[2,23]],[[1564,5800],[70,19],[65,15],[16,32],[-33,148],[8,107],[44,126],[-4,25],[-11,14],[-6,16],[6,3],[44,35],[21,7],[6,4],[4,7],[4,14],[3,6],[16,11],[42,20],[7,11],[-10,97],[5,17],[17,12],[50,19],[8,10],[14,42],[-16,70],[-9,70],[-11,23],[-24,-3],[-7,42],[0,44]],[[1883,6863],[20,32],[10,39],[23,30],[36,11],[87,-10],[62,32],[-5,26],[-11,24],[-17,11],[-7,17],[13,28],[35,56]],[[3056,9983],[-16,-433]],[[2297,8918],[-53,-24],[-65,-7],[-11,-16],[5,-27],[2,-19],[-6,-17],[-6,-7],[0,-9],[-40,-20],[-45,-48],[-62,2],[-180,82],[-42,7],[-47,-17],[-60,-9],[-28,6],[-133,-236],[-98,-49],[-32,-91],[41,-46],[45,-39],[11,-59]],[[1493,8275],[-89,-83],[-17,-24],[-18,-21],[-23,-13]],[[1346,8134],[6,11],[-21,0],[-42,-12],[-21,-2],[-12,3],[-21,14],[-11,5],[-11,-1],[-9,-4],[-9,-2],[-12,3],[-2,4],[-3,15],[-2,5],[-4,3],[-12,5],[-58,36],[-8,2],[-12,-5],[-11,-9],[-18,-26],[-4,-2],[0,1],[-4,11],[-8,8],[-5,8],[4,10],[-16,4],[-14,14],[-22,30],[-2,16],[10,21],[20,27],[0,24],[3,14],[7,12],[52,56],[6,18],[-21,-8],[-32,-15],[-19,-7],[-18,1],[-10,10],[4,23],[7,11],[22,21],[8,12],[4,10],[8,29],[34,86],[12,20],[29,38],[18,11],[19,-2],[19,-6],[19,1],[10,9],[13,25],[10,8],[12,2],[10,-4],[47,-24],[7,-1],[8,2],[7,4],[12,3],[14,8],[15,7],[12,9],[9,17],[4,19],[-4,64],[8,41],[31,104],[-8,27],[-9,13],[-14,14],[-16,9],[-17,-4],[12,54],[-3,25],[-27,4],[5,8],[5,6],[15,11],[-7,17],[5,14],[9,14],[5,16],[-7,37],[-3,10],[10,26],[-2,8],[-8,13],[-2,5],[0,10],[12,73],[0,24],[-6,20],[-22,-9],[-14,12],[-8,21],[-9,33],[-4,7],[-11,13],[-15,20],[-5,12],[4,6],[3,11],[2,24],[-5,24],[-18,11],[-17,3],[-60,23],[-8,5],[-13,13],[-10,7],[-26,11],[-12,10],[-5,14],[1,7],[2,6],[2,4],[1,3],[-2,7],[-8,12],[-5,19],[-17,28],[-5,13],[-4,24],[-3,6],[-11,8],[-4,-1],[-6,-3],[-7,-1],[-8,5],[-2,6],[3,5],[3,6],[2,5],[-3,13],[-13,9],[-3,10],[3,11],[7,10],[7,8],[1,1],[7,6],[11,-1],[7,-5],[5,-5],[5,-2],[11,0],[16,4],[46,5],[19,-2],[22,-7],[11,9],[32,36],[13,7],[35,11],[33,18],[32,-8],[14,-8],[58,0],[165,0],[164,0],[20,0],[145,0],[164,0],[165,0],[160,0],[4,0],[165,0],[164,0],[165,0],[163,0]],[[1564,5800],[-21,75],[-9,12],[-15,17],[-4,6],[-11,23],[-7,7],[-7,6],[-6,8],[-5,11],[-3,40],[-6,16],[-15,7],[-16,-8],[-19,-37],[-14,-13],[-19,16],[-27,39],[-22,16],[-6,1],[-13,-2],[-6,1],[-6,6],[-13,20],[-28,19],[-41,2],[-248,-1],[-31,-22],[-58,-68],[-35,-32],[-44,-10],[-192,-3],[-16,-21],[81,-71],[35,-81],[59,-354],[25,-76],[54,-104],[28,-80],[42,-26],[29,-34],[-10,-58],[16,-38],[3,-42],[-85,-60],[-27,-82],[-23,-32],[-214,-185],[-32,-22]],[[582,4586],[-86,45],[-121,95],[-28,31],[-21,35],[-45,125],[-61,82],[-25,43],[-11,37],[-15,111],[-27,104],[-3,37],[18,59],[68,94],[28,52],[9,72],[-17,78],[-87,213],[-37,151],[-70,132],[-30,76],[-1,6],[-18,74],[-2,78],[18,79],[54,153],[9,79],[-3,37],[-3,12],[210,2],[44,-10],[37,-3],[4,-2],[10,8],[3,11],[1,12],[3,13],[6,5],[15,8],[5,8],[1,15],[2,3],[15,10],[9,-2],[10,-5],[15,-2],[8,2],[48,24],[32,31],[31,18],[9,8],[20,11],[11,15],[23,57],[9,14],[62,52],[27,34],[21,38],[2,6],[14,35],[16,67],[10,19],[48,50],[34,62],[23,15],[40,-14],[3,17],[-3,14],[-5,14],[-4,16],[1,17],[0,1],[7,17],[37,60],[6,17],[1,17],[-2,19],[4,11],[26,19],[2,4],[3,10],[2,3],[15,3],[2,-1],[1,-1],[17,1],[1,2],[1,8],[2,3],[24,5],[6,3],[7,6],[12,14],[42,21],[23,23],[2,25],[-28,16],[-6,3],[17,21],[17,16],[19,13],[25,9],[11,2],[9,5],[6,8],[2,11],[24,-12],[25,3],[22,15],[13,25],[0,6],[-4,16],[-1,7],[13,19],[8,22],[1,12],[-1,11],[-3,7],[-12,9],[-3,7],[1,5],[4,13],[0,5],[-9,12],[-22,22],[-5,14],[6,14],[28,34],[3,5]],[[1493,8275],[37,-16],[21,-41],[1,-15],[7,-11],[7,-3],[5,-7],[1,-70],[-25,-67],[-34,-55],[-1,-51],[8,-10],[10,0],[13,16],[17,11],[48,-36],[10,-67],[23,-65],[16,-32],[19,-30],[0,1],[2,-3],[15,-31],[-3,-35],[4,-29],[8,-33],[2,-63],[22,-59],[51,-49],[54,-124],[16,-76],[-5,-45],[-30,-86],[-3,-46],[8,-29],[3,-29],[11,-14],[3,-16],[19,-49],[30,-48]],[[9087,4234],[-11,15],[-12,-4],[-1,132],[-20,33],[-25,30],[-23,7],[-22,3],[-13,-2],[-12,1],[-30,-3],[-21,-31],[-14,-1],[-13,2],[-8,-17],[-13,-12],[-17,6],[-13,7],[-19,-15],[-12,-21],[-20,-13],[-19,17],[-17,-6],[-11,10],[11,22],[16,20],[5,22],[10,20],[18,10],[10,18],[-8,20],[-5,19],[-25,16],[-7,32],[0,18],[-12,10],[-21,1],[2,14],[25,33],[12,41],[4,45],[16,41],[17,15],[15,18],[7,6]],[[8811,4813],[2,-3],[23,-17],[7,-8],[14,-24],[8,-9],[15,-9],[8,-7],[6,-11],[3,-12],[2,-12],[5,-23],[14,-25],[16,-13],[14,17],[4,-27],[-4,-37],[1,-33],[18,-17],[-1,17],[-1,7],[-4,8],[16,-1],[13,-6],[26,-16],[13,-3],[28,-3],[11,-6],[13,-5],[33,0],[7,-5],[3,-13],[17,-23],[7,-27],[43,-59],[3,-6],[-1,-9],[-4,-6],[-5,-5],[-2,-6],[8,-59],[-1,-24],[-14,1],[-9,-12],[-7,-25],[-5,-11],[-10,-8],[-8,0],[-7,8],[-3,16],[-38,-27],[-1,-1]],[[7620,5431],[42,-33],[28,-48],[1,-27],[6,-25],[16,-18],[24,-54],[23,-31],[11,-22],[13,-20],[24,-8],[21,-4],[-13,-2],[-6,-8],[23,-12],[16,-20],[3,-75],[-18,-142],[-23,-55],[-17,-19],[0,-20],[-4,0],[9,-15],[12,-15],[8,-21],[17,-8],[26,-4],[26,-13],[90,-35],[21,-2],[21,4],[8,7],[10,5],[17,2],[16,-4],[16,-70],[-24,-55],[-8,-55],[35,-51],[20,0],[16,-10],[8,-9],[11,-5],[14,4],[14,6],[18,-4],[14,-10],[23,2],[16,-14],[3,-33],[9,-10],[5,-12],[-22,-48],[-33,-41],[-19,-40],[-36,-4],[-33,-21],[-26,-34],[-22,-69],[39,-116],[18,-39],[-5,-34],[-145,-26],[-44,-15],[-45,-9],[-31,8],[-33,4],[-80,-16],[-34,-12],[-27,-25],[-7,-47],[0,-48],[-10,-44],[2,-45],[-4,-5],[-5,-7],[-3,-8],[-3,-2],[-4,-3],[-5,-7],[-2,-5],[-10,-39],[-3,-22],[-2,-10],[-7,-9]],[[7620,3525],[-6,-8],[-9,-18],[-6,-8],[-7,-6],[-23,-14],[-15,-12],[-10,-13],[-18,-32],[-6,-7],[-6,-5],[-5,-6],[-2,-8],[0,-9],[-1,-7],[-3,-6],[-23,-27],[-7,-13],[-3,-14],[-6,-14],[-14,-8],[-16,-5],[-13,-5],[-7,-8],[-31,-51],[-11,-27],[-13,-19],[-4,-13],[-5,-7],[-6,-4],[-13,-5],[-5,-4],[-18,-22],[-25,-48],[-16,-22],[-18,-19],[-18,-24],[-7,-27],[15,-28],[4,-12],[-1,-20],[-2,-21],[-21,-71],[-39,-82],[-6,-27],[13,-84],[-1,-31],[24,-61],[-7,-58],[26,-40],[-6,-36],[-50,-16],[-42,-36],[-7,-59],[-11,-27],[-15,-26],[-70,-226]],[[7028,2019],[-67,-20],[-80,-61],[-29,-13],[-70,-46],[-60,-56],[-52,-63],[-72,-64],[-83,-47],[-61,-2],[-23,44],[49,66],[28,75],[-36,68],[-28,71],[1,30],[-12,26],[-10,-5],[-19,-5],[1,-42],[-8,-23],[-40,-58],[-23,-25],[-5,-4],[-75,-11],[-55,9],[-78,-20],[-24,14],[-5,8],[-8,-2],[-7,7],[3,12],[-40,-12],[-40,-36],[-8,-25],[-15,-20],[-32,-2],[-33,5],[-125,-5],[-39,31],[6,56],[14,13],[20,1],[17,14],[40,65],[31,39],[6,20],[-8,19],[4,30],[13,28],[37,34],[13,47],[-15,31],[-10,33],[-3,66],[-4,19],[-1,15],[6,9],[-3,9],[-58,-67],[-53,-51],[-35,-14],[-36,-9]],[[5729,2225],[-3,44],[-12,43],[-170,137],[-62,96],[-19,10],[-15,-13],[-17,-9]],[[5431,2533],[-11,37],[3,66],[-8,19],[-16,8],[-1,14],[23,35],[-1,41],[-15,38],[4,41],[72,2],[82,-24],[103,-18],[15,-22],[4,-79],[19,-16],[11,42],[-1,44],[33,118],[27,27],[83,39],[64,59],[34,97],[61,79],[70,66],[79,50],[33,-7],[29,7],[52,8],[16,27],[-6,32],[-5,15],[-1,16],[0,12],[2,10],[28,28],[65,51],[79,30],[85,-8],[79,-24],[68,20],[33,82],[41,78],[64,61],[44,60],[-19,5],[-9,0],[-3,0],[-13,6],[-45,4],[-8,0],[-12,-4],[-12,-7],[-14,-2],[-17,7],[-6,9],[-2,10],[3,29],[-1,3],[-2,4],[-5,4],[-7,3],[-13,3],[-23,3],[-18,7],[-21,5],[-4,2],[-8,11],[-16,13],[-19,8],[-41,10],[-11,2],[-20,-4],[-13,-1],[-26,13],[-15,27],[-21,94]],[[6430,4058],[34,35],[6,44],[-11,45],[-5,45],[11,42],[38,83],[74,47],[4,42],[-4,167],[21,69],[14,21],[-1,23],[-10,15],[3,15],[13,-4],[12,-2],[11,17],[5,19],[19,47],[22,91],[37,19],[49,76],[-25,219],[2,53],[26,45]],[[6775,5331],[48,16],[131,109]],[[6954,5456],[14,-98],[27,-15],[24,-8],[-19,-27],[4,-25],[3,-6],[0,-8],[20,-23],[24,-16],[24,25],[18,37],[38,30],[28,35],[33,14],[29,27],[16,106],[14,25],[28,-10],[5,-4],[3,-6],[11,-5],[14,2],[15,-9],[16,-1],[30,-13],[11,-43],[58,-69],[22,-19],[24,25],[47,-3],[37,12],[-2,26],[14,12],[21,-7],[15,14]],[[9466,6094],[-26,-9],[-17,-9],[-17,4],[-3,13],[3,13],[-8,11],[-26,1],[-8,-5]],[[9364,6113],[-10,5],[-12,-13],[5,19],[2,6],[-5,7],[-7,4],[-9,1],[-11,-6],[2,10],[2,4],[3,6],[-4,11],[2,13],[4,10],[7,1],[11,-5],[5,3],[-1,8],[-6,9],[-8,5],[-29,11],[3,9],[12,11],[4,9],[-13,-6],[-7,17],[5,14],[12,4],[16,-10],[3,15],[-10,9],[-15,8],[-10,13],[0,11],[5,26],[1,14],[2,-5],[3,-4],[2,-3],[3,-1],[7,-4],[5,-8],[3,-9],[1,-4],[9,1],[4,7],[2,7],[5,4],[5,-3],[14,-15],[3,-4],[42,-25],[7,-7],[1,-11],[2,-9],[4,-4],[6,8],[-1,7],[-3,9],[0,11],[11,11],[0,-7],[4,-7],[1,-5],[7,15],[6,19],[2,17],[-2,12],[12,-8],[0,-19],[-2,-22],[10,-35],[-10,-17],[-16,-13],[-12,-6],[4,-16],[-3,-18],[-5,-19],[-3,-17],[8,-28],[1,-5],[8,4],[1,9],[-1,9],[1,4],[11,-5],[2,-16],[-6,-36],[0,-11]],[[9290,5821],[-25,-2],[-15,13],[-14,17],[-8,12],[-11,11],[-9,14],[6,11],[8,-5],[13,-8],[9,-14],[11,-17],[14,-5],[14,-4],[9,-12],[-2,-11]],[[9466,6094],[0,-44],[-7,-15],[7,-7],[-11,-13],[-27,-82],[-7,-10],[-3,-4],[-2,-6],[0,-16],[-4,-12],[-8,-2],[-5,7],[4,17],[-5,0],[-6,-15],[-3,-6],[-4,-4],[3,-10],[-5,-11],[-10,-9],[-13,-9],[-8,-2],[-3,4],[3,5],[8,6],[0,7],[-12,-4],[-10,-6],[-7,-2],[-7,12],[-31,-2],[-13,5],[-5,12],[0,33],[3,15],[9,13],[-6,10],[12,2],[31,-6],[-7,13],[-19,24],[-5,14],[14,-3],[18,-2],[16,3],[8,9],[-10,2],[-9,4],[-7,5],[-6,8],[14,0],[22,5],[14,1],[16,-8],[9,2],[6,19],[-18,-7],[-22,6],[-41,27],[-8,-6],[-11,4],[-11,9],[-6,12],[9,-4],[7,-5],[6,-2],[8,5],[9,-3],[30,-5],[17,1],[-7,7],[7,18],[-3,15]],[[9370,3411],[-27,-25],[-15,1],[-5,15],[5,24],[11,20],[24,31],[29,3],[21,-1],[4,-13],[-10,-12],[-37,-43]],[[9499,3701],[-25,-61],[-12,-16],[-2,-7],[0,-6],[-1,-6],[-6,-19],[-3,-5],[-8,-11],[-1,-7],[-5,-11],[-10,0],[-25,8],[-26,-9],[-12,-20],[-5,-22],[-9,-12],[-35,-15],[-18,-4],[-15,0],[-18,7],[-24,26],[-15,12],[9,2],[15,0],[8,4],[0,2],[2,7],[3,6],[1,0],[2,7],[5,2],[7,-1],[5,2],[38,39],[13,21],[-8,11],[5,15],[10,7],[14,2],[17,0],[15,3],[28,14],[15,3],[-5,7],[-8,2],[-23,-3],[0,6],[10,3],[10,5],[16,12],[20,8],[8,7],[6,24],[7,14],[9,12],[8,5],[5,5],[9,24],[1,9],[14,-15],[-1,-30],[-15,-63]],[[8517,5367],[-5,-23],[-8,-19],[-7,-20],[1,-23],[3,-6],[12,-13],[4,-6],[8,-36],[4,-9],[5,-6],[20,-13],[14,-12],[2,-6],[3,-35],[-2,-22],[-6,-20],[-11,-14],[7,-23],[3,-52],[11,-24],[10,-7],[11,-6],[9,-6],[4,-9],[2,-10],[4,-11],[5,-9],[8,-8],[5,-4],[4,-2],[12,-1],[6,-2],[3,-6],[3,-7],[4,-4],[11,-2],[25,-2],[10,-5],[9,-4],[10,4],[-1,7],[-8,4],[-14,5],[-18,12],[26,-8],[18,-8],[50,-49],[28,-34]],[[9087,4234],[-7,-10],[-5,-17],[-2,-15],[-4,-14],[-10,-12],[-12,-10],[-6,-2],[-7,-1],[-7,-3],[1,-7],[4,-8],[2,-7],[-5,-11],[-12,-2],[-15,1],[-11,-1],[9,-15],[9,-11],[6,-11],[0,-20],[-4,-14],[-8,-19],[-9,-17],[-24,-23],[-11,-35],[-15,-102],[1,-19],[3,-20],[12,-30],[3,-17],[-5,-14],[-4,-13],[14,-34],[-4,-16],[-40,-49],[27,7],[20,23],[13,31],[7,30],[14,-12],[11,-13],[1,-13],[-14,-14],[34,4],[15,-2],[16,-12],[24,-24],[3,-13],[-6,-23],[-13,-30],[-1,-12],[10,-32],[0,-37],[4,-16],[14,9],[5,4],[-3,-29],[-11,-26],[-29,-47],[-30,-84],[-13,-25],[-6,3],[-3,-1],[-3,-1],[-7,-1],[6,-14],[-2,-33],[3,-17],[-13,6],[0,-7],[-6,-18],[-14,17],[-8,5],[-8,3],[7,-14],[0,-11],[-6,-8],[-14,-5],[4,-8]],[[8952,3176],[-12,4],[-34,28],[-45,-2],[-174,-39],[-112,-39],[-56,-12],[-15,5],[-9,14],[-17,6],[-63,-15],[-23,-39],[-19,-51],[-42,-26],[-51,1],[-15,38],[-14,88],[-67,66],[-43,31],[-83,74],[-50,27],[-111,24],[-106,39],[-46,28],[-125,99]],[[7620,5431],[136,38],[61,-14],[26,4],[23,11],[64,-5],[57,-29],[25,-29],[33,-12],[39,-10],[23,-35],[25,-10],[28,1],[14,-14],[15,-9],[31,-7],[9,8],[9,7],[16,-7],[19,1],[13,3],[11,-7],[52,23],[20,7],[16,17],[12,2],[13,-3],[18,6],[14,12],[75,-13]],[[8910,5467],[-11,-2],[-10,0],[-1,14],[1,16],[3,26],[-3,19],[11,8],[-1,-13],[5,-16],[7,-12],[-6,-9],[5,-12],[0,-19]],[[8943,5302],[-32,3],[-33,-3],[-3,0]],[[8875,5302],[-11,36],[4,53],[-1,11],[1,11],[2,9],[4,7],[3,-5],[7,-9],[2,-5],[15,25],[32,27],[15,18],[8,30],[6,68],[16,17],[11,-28],[27,-51],[6,-33],[-7,-39],[0,-15],[3,-14],[8,-27],[1,-13],[4,-15],[17,-27]],[[8974,5105],[-7,5],[-13,-6],[0,-7],[6,-1],[0,-3],[0,-4],[1,-5],[-12,9],[-4,-15],[3,-21],[10,-11],[-3,-1],[-1,-2],[-3,0],[-9,3],[-8,6],[-3,3],[-2,4],[-45,54],[-9,15],[-11,41],[-8,17],[32,41],[-7,54],[-6,21]],[[6430,4058],[-4,22],[-6,14],[-15,10],[-22,4],[-41,0],[-25,-8],[-12,-2],[-11,6],[-3,7],[-3,19],[-3,7],[-5,7],[-10,22],[-7,6],[-14,9],[-4,4],[-9,19],[-6,21],[-11,17],[-21,7],[-17,3],[-81,34],[-12,1],[-20,-1],[-10,1],[-7,3],[-13,4],[-52,-13],[-19,4],[-36,12],[-15,3],[-14,6],[-16,11],[-9,2],[-79,20],[-29,-2],[-31,3],[-65,36],[-43,16],[-43,5],[-13,8],[0,15],[-11,19],[-20,11],[-42,15],[-43,4],[-30,-5],[-31,0],[-26,-7],[-18,-20],[-90,-15],[-88,55]],[[5175,4477],[-4,99],[-14,86],[113,6],[25,62],[-16,159],[9,84],[15,29],[0,34],[-8,37],[-18,32],[-8,81],[20,84],[3,108],[32,77],[23,35],[9,36],[4,37],[28,26],[19,23],[-10,27],[-30,33],[-23,39],[-2,18],[-4,15],[-8,2],[-7,6],[-9,12],[-14,9],[-16,27],[-11,29],[-24,27],[-21,31],[-14,63],[-16,37],[-12,37],[1,35],[-3,35],[-18,31],[4,31],[220,155],[8,24],[15,31],[-4,33]],[[5409,6399],[12,-1],[11,-6],[82,-8],[47,9],[20,33],[62,129],[45,75],[9,35],[-16,33],[-5,15],[-2,16],[4,16],[9,5],[19,-8],[71,50],[39,39],[9,15],[15,11],[15,-7],[16,-9],[21,12],[22,15],[45,-1],[27,47],[10,8],[23,14],[26,21],[225,65],[6,-276],[9,-52],[15,-51],[20,-47],[5,-31],[-10,-189],[-33,-224],[-20,-65],[-28,-46],[-20,-50],[10,-58],[-15,-53],[12,-42],[34,-38],[47,-38],[42,-43],[25,-47],[32,-42],[55,-35],[57,-28],[36,-45],[26,-55],[33,-52],[45,-41],[60,-24],[62,-19]],[[5431,2533],[-66,-22],[-85,5],[-85,63],[10,166],[-216,78],[0,46],[-127,40]],[[4149,3938],[79,46],[74,52],[28,40],[30,35],[42,-1],[40,-15],[42,-2],[42,6],[17,16],[-1,29],[45,56],[265,56],[33,66],[11,90],[33,27],[38,23],[15,12],[18,7],[17,11],[13,13],[35,-3],[37,-9],[37,-5],[36,-11]],[[9252,2470],[-9,-16],[-17,11],[-14,18],[-10,11],[-1,16],[46,-23],[5,-17]],[[9169,2980],[2,-13],[-17,3],[-13,13],[-4,17],[10,-2],[12,-8],[10,-10]],[[8952,3176],[8,-16],[7,-24],[4,-26],[1,-28],[-6,-54],[3,-26],[30,-32],[11,-21],[8,-24],[4,-21],[-2,-78],[-5,-18],[32,-9],[5,-6],[2,-8],[4,-6],[10,-3],[18,-1],[5,-6],[1,-11],[4,-20],[7,-15],[10,-7],[11,-5],[12,-8],[7,-13],[11,-33],[10,-15],[25,-20],[5,-8],[-12,-4],[-11,1],[-6,2],[-14,11],[-1,2],[-18,16],[-18,23],[-14,8],[-17,-2],[-10,-5],[-5,-1],[-4,-3],[-18,-26],[14,-6],[54,6],[-12,-15],[-3,-10],[7,-6],[17,-1],[16,-5],[0,-13],[-5,-18],[-2,-21],[3,-4],[8,-6],[2,-4],[0,-17],[0,-2],[-5,-9],[-1,-3],[2,-3],[4,-1],[4,-3],[2,-6],[-2,-9],[-5,-6],[-4,-6],[2,-11],[6,-15],[0,-7],[-3,-9],[12,3],[16,7],[14,10],[10,8],[11,1],[13,-12],[39,-51],[15,-26],[4,-29],[-14,-29],[0,-7],[5,-8],[7,-7],[4,-7],[0,-11],[-5,-18],[-1,-9],[2,-31],[-3,-11],[-12,-16],[-12,-11],[-8,-2],[-9,2],[-14,-2],[-11,-5],[-5,-9],[1,-13],[3,-18],[8,4],[10,2],[18,1],[3,10],[4,4],[9,-4],[6,-7],[3,-2],[3,-1],[10,-4],[2,-10],[-2,-11],[0,-7],[6,-8],[21,-21],[8,-18],[11,-51],[9,-14],[12,-9],[-2,-6],[-7,-5],[-2,-8],[4,-10],[4,-7],[12,-12],[5,-10],[-3,-19],[9,-18],[-8,-6],[-18,-7],[-15,-15],[-4,-8],[7,-3],[36,1],[7,-1],[3,-7],[7,-25],[5,-9],[15,-11],[7,-7],[6,-11],[6,-26],[-6,-19],[-17,-10],[-26,4],[7,-13],[26,-20],[1,-8],[-10,-7],[-31,-13],[-28,-7],[0,-11],[11,-24],[-1,-17],[-7,-13],[-10,-11],[-14,-9],[23,4],[42,52],[19,-2],[12,-7],[27,2],[19,-20],[12,-1],[13,0],[12,-2],[22,-18],[55,-92],[1,-42]],[[9574,1445],[-29,-18],[-31,-25],[-145,-84],[-38,-14],[-23,-31],[-6,-40],[-15,-36],[0,-25],[23,-20],[5,-33],[-21,-33],[-30,-29],[-36,20],[-26,66],[-15,9],[-13,17],[-29,85],[-69,45],[-22,0],[-23,-4],[-23,-26],[-28,-14],[-29,2],[-10,-22],[-9,-39],[-40,-8],[-11,25],[-6,29],[-29,7],[-37,-16],[-74,-43],[-42,-14],[-69,-32],[-25,-19],[-17,-19],[-62,-5],[-35,10],[-26,19],[-31,1],[-28,-14],[-81,-6],[-239,-101],[-55,-58],[-44,-68],[-32,-22],[-157,-11]],[[7792,851],[-45,84],[-20,23],[-15,24],[-13,44],[-23,41],[-6,21],[-10,22],[-22,37],[-24,20],[-28,16],[-42,31],[-498,124],[-218,86],[-44,39],[3,67],[-4,67],[6,57],[23,51],[75,69],[68,78],[40,58],[21,54],[12,55]],[[7882,442],[-62,220],[-28,189]],[[9574,1445],[0,-12],[8,-28],[9,11],[5,16],[0,16],[-5,14],[-8,19],[2,8],[11,1],[17,-3],[13,-4],[28,-12],[17,-4],[36,-14],[5,1],[2,-1],[3,-10],[-1,-12],[-6,-13],[-3,-13],[7,-16],[3,-8],[-7,-5],[-8,-4],[-3,-6],[5,-7],[4,-1],[5,2],[4,1],[15,-10],[7,-1],[3,7],[1,10],[3,6],[5,1],[10,-4],[11,-8],[21,-19],[11,-8],[0,8],[1,6],[3,5],[2,7],[7,-5],[5,-1],[6,1],[7,5],[-15,4],[-47,21],[31,38],[12,-3],[5,-11],[3,-13],[4,-11],[8,-7],[20,-10],[10,-8],[5,-8],[29,-67],[9,-8],[2,1],[30,-6],[4,-2],[30,9],[4,18],[-11,15],[-16,-3],[-4,11],[3,8],[8,4],[12,2],[8,-3],[4,-8],[3,-9],[5,-9],[8,-16],[-8,-15],[-15,-14],[-12,-15],[6,1],[12,-1],[6,0],[-10,-32],[-1,-10],[2,-7],[5,-7],[4,-9],[0,-12],[-14,-27],[-29,-29],[-32,-24],[-59,-21],[-34,-25],[-53,-54],[-17,-23],[-10,-10],[-25,-10],[-112,-90],[-18,-9],[-92,-40],[-90,-64],[-23,-10],[-151,-33],[-69,-6],[-15,-5],[-15,-8],[-176,-144],[-21,-12],[-22,-7],[-24,1],[-19,7],[-37,20],[-21,5],[-28,-13],[-31,-7],[-117,1],[-31,-8],[-24,-21],[-15,-11],[-19,-5],[-12,-8],[-36,-35],[-16,-8],[-10,0],[-20,5],[-10,1],[-10,-2],[-18,-9],[-27,-7],[-14,-13],[-21,-26],[-88,-61],[-23,-28],[-26,16],[-72,18],[-31,17],[-50,53],[-32,23],[-42,6],[-9,-2],[-20,-9],[-10,-2],[-11,3],[-17,14],[-9,3],[-3,1],[-5,9],[-1,2],[-6,0],[-4,-2],[-3,-3],[0,-1],[-7,0]],[[7882,442],[-20,0],[-52,-9],[-8,-9],[-8,-2],[-37,-2],[-14,-4],[-57,-32],[-6,-9],[-2,-13],[-14,-42],[-9,-12],[2,-16],[-22,-39],[-5,-21],[4,-13],[5,-11],[2,-12],[-7,-12],[-12,-10],[-18,-14],[-66,-29],[-40,-33],[-16,-9],[-20,-4],[-28,0],[-20,-4],[-32,-17],[-19,-4],[-11,-5],[-7,-12],[-5,-13],[-5,-9],[-7,-7],[-6,-3],[-17,-3],[-21,0],[-44,13],[-8,4],[-16,17],[-10,5],[-9,-1],[-7,-3],[-7,-5],[-8,-4],[-33,-3],[-39,4],[-76,18],[-32,15],[-31,27],[-24,31],[-11,29],[-14,-9],[-8,-6],[-9,-4],[-83,-7],[-13,2],[-22,15],[-18,2],[-9,4],[-15,-5],[-41,-49],[-25,-38],[-8,-7],[-10,-6],[-33,-13],[-9,-7],[-5,-6],[-6,-4],[-24,-3],[-14,-5],[-56,-9],[-16,2],[-22,11],[-5,2],[-6,5],[-5,22],[-7,5],[-105,0],[-4,-2],[-5,-5],[-6,-4],[-29,-4],[-32,-10],[-13,-1],[-10,3],[-14,8],[-10,2],[-37,-6],[-11,7],[-8,17],[-3,19],[6,14],[-6,18],[-2,22],[-5,17],[-14,7],[-8,2],[-7,5],[-5,6],[-8,6],[-9,4],[-20,5],[-8,4],[-33,20],[-19,9],[-13,-1],[-17,-5],[-17,9],[-8,18],[9,20],[-16,19],[-12,7],[-34,-1],[-6,2],[-25,11],[-37,7],[-12,-9],[-28,-36],[-16,-12],[-45,-9],[-16,-10],[7,-20],[-11,-7],[-10,-13],[-8,-13],[-6,-19],[-9,-6],[-48,-13],[-2,0],[-21,-12],[-14,4],[-15,6],[-10,-1],[-1,-16],[-10,4],[-4,5],[-2,6],[-5,7],[-8,7],[-4,0],[-4,-2],[-6,-2],[0,-1],[-12,-5],[-4,0],[-22,1],[-8,3],[-6,6],[-2,5],[-37,-1],[-375,4],[-2,8],[0,48],[-2,14],[-4,11],[-4,8],[-2,5],[-4,7],[-9,8],[-8,10],[-8,25],[-17,14],[-3,7],[-7,19],[-17,16],[-22,11],[-39,14],[-7,1],[-7,-3],[-11,-10],[-6,-1],[-6,7],[-20,38],[6,3],[7,6],[6,3],[0,6],[-14,8],[-12,14],[-8,18],[-3,21],[-2,9],[-6,7],[-7,5],[-16,4],[-4,6],[-3,8],[-5,9],[-43,38],[-7,16],[-2,23],[-12,38],[-4,19],[4,24],[18,23],[9,11],[16,38],[2,10],[0,41],[12,58],[-4,25],[6,7],[11,9],[-3,12],[-5,7],[-6,4],[-4,5],[-1,4],[-6,9],[12,19],[-1,21],[-8,18],[-20,24],[-2,5],[1,18],[-3,11],[-3,1],[-3,1],[-8,-1],[-7,4],[-8,11],[-6,12],[-4,13],[-1,7]],[[4725,1116],[2,0],[23,5],[12,-3],[10,-7],[28,2],[26,12],[77,51],[42,59],[66,34],[77,61],[5,61],[21,24],[31,11],[32,0],[33,7],[11,31],[76,108],[-9,61],[-35,53],[2,46],[-13,33],[-20,19],[-17,25],[9,25],[30,17],[65,28],[88,95],[58,32],[78,75],[34,22],[27,29],[34,22],[42,21],[32,24],[27,26]],[[5006,7278],[33,-70],[77,-86],[2,-28],[-52,-71],[-47,-89],[-34,-94],[41,-47],[61,-38],[45,-53],[33,-75],[60,-30],[8,-37],[0,-39],[36,-26],[52,-9],[34,-66],[54,-21]],[[4575,7231],[27,20],[32,10],[33,7],[153,64],[11,20],[24,20],[32,7]],[[4887,7379],[57,-54],[62,-47]],[[7281,8197],[-1,0],[-39,9],[-74,32],[-30,18],[-32,4],[-18,-7],[-15,6],[-46,-1],[-41,-29],[-54,-45],[-23,-25],[-30,-13],[-60,-19],[-21,-61],[2,-44],[8,-44],[22,-22],[29,-13],[62,-43],[34,-63],[2,-169]],[[6956,7668],[-32,-12],[-28,-20],[-17,-25],[-20,-19],[-68,0],[-23,-27],[-23,-31],[-27,-7],[-17,31],[-16,12],[-17,5],[-65,-4],[-7,-7],[0,-10],[-6,-15],[-18,-6],[-19,-17],[-17,-4],[-16,-6],[-54,-73],[-15,-38],[8,-106],[20,-118],[-1,-53],[-13,-7],[-15,6],[-25,1],[-25,-8],[-42,-4],[-40,-8],[-9,-19],[-42,-5],[-44,19],[-203,305],[-43,83],[-30,44],[-51,-18],[-44,-60],[-32,-29],[-24,-31],[-3,-28],[-18,-5],[-19,64],[6,67],[22,67],[-12,44],[-24,4],[-5,-65],[-16,-33],[-106,-30],[3,-36],[-16,-24],[-41,6],[-27,29],[18,31],[23,27],[-28,12],[-37,8],[-35,19],[-37,0],[-60,-62],[-36,-14],[-31,-22],[-25,-9],[-28,1],[-86,-55],[-8,-11],[-3,-14],[-12,-14],[-53,-16],[-31,-18],[-34,-14],[-31,-18]],[[4887,7379],[-9,36],[3,37],[24,35],[31,29],[5,13],[2,15],[17,7],[22,-6],[24,24],[8,665],[31,-5],[34,-29],[21,-34],[35,-11],[15,10],[14,12],[49,23],[25,47],[59,265],[-8,90]],[[5289,8602],[37,109],[22,11],[25,8],[23,50],[13,55],[-12,46],[-51,16],[-34,23],[-7,41],[19,367]],[[5324,9328],[152,-88],[193,-111],[193,-112],[193,-111],[192,-112],[193,-112],[193,-111],[193,-112],[193,-111],[193,-112],[69,-39]],[[7825,6600],[-45,-49],[-7,-62],[0,-44],[12,-40],[18,-25],[6,-30],[10,-26],[15,-24],[8,-35],[-43,1],[-25,15],[-24,18],[-15,-1],[-62,-13],[-45,-16],[-55,-13],[-53,13],[-44,15],[-45,0],[-49,-46],[-133,-166],[-7,-21],[7,-25],[-1,-26],[-19,-90],[-21,-62],[-82,-110],[-17,-50],[-20,-109],[-28,-48],[-107,-75]],[[6956,7668],[22,6],[23,2],[24,-3],[24,25],[18,6],[18,1],[11,-14],[11,-17],[25,-8],[26,-1],[14,-12],[-4,-18],[28,-68],[48,-54],[33,-59],[27,-48],[16,-42],[-4,-103],[8,-47],[11,-19],[20,-71],[6,-25],[0,-25],[-13,-34],[-1,-29],[2,-30],[-5,-72],[2,-72],[30,-52],[46,-40],[21,-3],[78,-45],[62,-49],[22,-8],[21,3],[33,22],[20,3],[54,-2],[12,-5],[9,-7],[18,-3],[10,-4],[19,-18],[24,-29]],[[7281,8197],[124,-72],[74,-43],[14,-23],[16,-101],[2,-12],[18,-114],[-17,-1],[-9,-8],[-3,-13],[2,-17],[-17,-1],[-22,-12],[-20,-16],[-13,-15],[-4,-9],[-5,-10],[-2,-11],[1,-10],[7,-6],[15,-2],[4,-8],[-3,-15],[-8,-18],[3,-13],[43,3],[19,-2],[19,-5],[17,-9],[13,-12],[6,-14],[16,-57],[9,-19],[12,-17],[49,-37],[77,-57],[77,-57],[76,-57],[77,-57],[77,-58],[76,-57],[71,-52]],[[8172,7083],[0,-1],[-306,-453],[-41,-29]],[[5289,8602],[-494,-4],[-33,15],[-50,36],[-23,1],[-29,-4],[-26,14],[-20,33],[-25,29],[-66,40],[-30,23],[-21,31],[-21,13],[-24,5],[-70,39],[-32,0],[-31,4],[-58,55],[-22,-14],[-6,-32],[-36,-4],[-61,4],[-23,-11],[-36,20],[1,9],[-14,37],[-27,26],[-33,8],[-34,-17],[-40,-31],[-9,-4],[-13,-4],[-12,-11],[-21,-23],[-36,18],[-51,10],[-54,2],[-44,-5],[-25,-9],[-13,-2]],[[3056,9983],[2,0],[110,0],[54,0],[164,0],[165,0],[138,0],[26,0],[158,0],[7,0],[164,0],[74,0],[69,0],[3,1],[14,-1],[2,-24],[12,-8],[33,-3],[68,-39],[193,-111],[193,-112],[145,-84],[47,-27],[193,-112],[193,-111],[41,-24]],[[8172,7083],[6,-5],[77,-57],[76,-57],[77,-57],[77,-58],[77,-57],[76,-57],[77,-57],[77,-57],[76,-57],[6,-6],[16,-5],[6,-26],[-5,-30],[-17,-16],[-24,-13],[19,-8],[14,-1],[8,-5],[2,-21],[-1,-20],[-3,-16],[-6,-15],[-29,-50],[-11,-11],[-6,13],[3,19],[6,18],[3,17],[-6,17],[-15,-48],[-14,-17],[-20,1],[16,-25],[2,-9],[3,-53],[-2,-9],[-6,-4],[-14,4],[-8,-3],[-3,-5],[-9,-18],[-2,-13],[13,1],[29,12],[0,-14],[10,-22],[2,-9],[-4,-6],[-34,-31],[-6,-8],[-18,-39],[-27,-42],[-3,-7],[7,-7],[10,8],[14,18],[5,-11],[-39,-117],[-10,-21],[-12,-17],[-10,-6],[-10,-5],[-8,-8],[-3,-12],[4,-8],[7,-4],[6,-5],[2,-15],[-12,-37],[-26,-55],[-32,-49],[-29,-19],[12,-6],[-6,-19],[0,-44],[-9,-17],[-12,-15],[-16,-34],[-20,-31],[-6,-20],[-4,-22],[0,-60],[-4,-9],[-6,-7],[-5,-8],[-3,-8],[-1,-3],[0,-1]],[[875,4264],[-54,85],[-129,156],[-71,60],[-39,21]],[[4725,1116],[0,5],[2,12],[8,21],[2,9],[-4,17],[-17,30],[-4,20],[18,101],[0,10],[-2,12],[-7,20],[-9,49],[-30,69],[-6,32],[1,9],[8,18],[2,11],[-1,10],[-10,32],[-27,39],[-11,19],[-89,114],[-1,4],[-17,16],[-4,2],[-20,21],[-5,8],[-4,17],[-3,17],[-5,12],[-27,10],[-87,95],[-26,12],[-16,18],[-7,4],[-30,37],[-13,8],[-8,10],[-1,1]]],"transform":{"scale":[0.00111294735353535,0.001074651695369547],"translate":[29.32103153500009,-11.731272481999966]}};
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
