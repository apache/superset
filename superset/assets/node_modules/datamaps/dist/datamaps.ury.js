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
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = '__UKR__';
  Datamap.prototype.umiTopo = '__UMI__';
  Datamap.prototype.uryTopo = {"type":"Topology","objects":{"ury":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Salto"},"id":"UY.SA","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Soriano"},"id":"UY.SO","arcs":[[6,7,8,9]]},{"type":"Polygon","properties":{"name":"Cerro Largo"},"id":"UY.CL","arcs":[[10,11,12,13,14]]},{"type":"Polygon","properties":{"name":"Durazno"},"id":"UY.DU","arcs":[[-12,15,16,17,18,19]]},{"type":"Polygon","properties":{"name":"Rivera"},"id":"UY.RV","arcs":[[-14,20,-2,21]]},{"type":"Polygon","properties":{"name":"Tacuarembó"},"id":"UY.TA","arcs":[[-13,-20,22,23,-3,-21]]},{"type":"Polygon","properties":{"name":"Treinta y Tres"},"id":"UY.TT","arcs":[[24,25,26,27,-16,-11]]},{"type":"Polygon","properties":{"name":"Canelones"},"id":"UY.CA","arcs":[[28,29,30,31,32,33]]},{"type":"Polygon","properties":{"name":"Florida"},"id":"UY.FD","arcs":[[34,-33,35,36,-17,-28]]},{"type":"Polygon","properties":{"name":"Lavalleja"},"id":"UY.LA","arcs":[[37,38,-34,-35,-27]]},{"type":"Polygon","properties":{"name":"Maldonado"},"id":"UY.MA","arcs":[[39,-29,-39,40]]},{"type":"Polygon","properties":{"name":"Montevideo"},"id":"UY.MO","arcs":[[41,42,-31]]},{"type":"Polygon","properties":{"name":"Rocha"},"id":"UY.RO","arcs":[[-41,-38,-26,43]]},{"type":"Polygon","properties":{"name":"Colonia"},"id":"UY.CO","arcs":[[44,45,-8]]},{"type":"Polygon","properties":{"name":"San José"},"id":"UY.SJ","arcs":[[-36,-32,-43,46,-45,47]]},{"type":"Polygon","properties":{"name":"Artigas"},"id":"UY.AR","arcs":[[-6,48]]},{"type":"Polygon","properties":{"name":"Flores"},"id":"UY.FS","arcs":[[-37,-48,-7,-18]]},{"type":"Polygon","properties":{"name":"Paysandú"},"id":"UY.PA","arcs":[[-24,49,50,-4]]},{"type":"Polygon","properties":{"name":"Río Negro"},"id":"UY.RN","arcs":[[-23,-19,-10,51,-50]]}]}},"arcs":[[[4546,7995],[10,-16],[3,0]],[[4559,7979],[-50,-161],[-13,-30],[-23,-42],[-19,-18],[-24,-13],[-130,-36],[-25,-11],[-27,-17],[-13,-16],[-8,-15],[-2,-12],[-1,-12],[5,-12],[6,-11],[30,-30],[16,-20]],[[4281,7523],[-11,-39],[-17,-35],[-14,-78],[-6,-20],[-7,-14],[-8,-6],[-23,-22],[-19,-24],[-12,-13],[-11,-8],[-10,-5],[-35,-12],[-14,-8],[-9,-13],[-32,-62],[-9,-12],[-61,-55],[-9,-15],[-55,-143],[-6,-21],[4,-10],[5,-9],[13,-16],[11,-18],[7,-20],[4,-23],[6,-87],[4,-23],[7,-21],[3,-28],[-3,-56]],[[3974,6607],[-99,-24],[-28,-20],[-4,-12],[-10,-17],[-16,-21],[-58,-57],[-12,-15],[-5,-23],[-3,-10],[-10,-18],[-9,-9],[-10,-7],[-25,-8],[-31,-5],[-20,0],[-12,1],[-133,38],[-97,3],[-13,2],[-24,7],[-95,56],[-15,4],[-21,3],[-79,1],[-12,2],[-12,4],[-37,23],[-13,6],[-18,5],[-32,4],[-22,0],[-163,-32],[-21,-1],[-39,8],[-82,30],[-15,0],[-11,-4],[-8,-7],[-12,-7],[-14,-8],[-26,-8],[-18,-3],[-17,0],[-24,7],[-159,18],[-21,5],[-70,50],[-20,10],[-149,40],[-42,19],[-26,20],[-14,14],[-41,60],[-9,8],[-19,8],[-35,7],[-53,2],[-45,6],[-45,16],[-20,11],[-63,42],[-134,64],[-276,57],[-14,4],[-9,6],[-9,6],[-7,8],[-5,9],[-4,9],[-24,72],[-6,9],[-6,8],[-17,13],[-124,66],[-49,18],[-20,3],[-14,-1],[-70,-16],[-8,-5],[-7,-8],[-2,-11],[-2,-19],[0,-2],[-2,-1],[-10,-1],[-21,-1],[-32,8],[-30,3],[-28,-7],[-31,-15],[-6,-3]],[[751,7104],[-22,16],[-46,53],[24,63],[36,28],[70,40],[30,24],[18,39],[9,93],[18,42],[13,14],[30,23],[14,13],[39,78],[19,23],[0,53],[-13,91],[24,91],[47,68],[35,70],[-15,96],[-79,110],[-12,23],[15,36],[35,23],[79,19],[44,-5],[23,9],[10,31],[11,49],[2,21],[-2,86],[-6,51]],[[1201,8575],[45,63],[10,8],[13,8],[18,1],[52,-5],[20,-7],[26,-14],[122,-86],[31,-27],[14,-15],[31,-41],[10,-9],[12,-10],[22,-14],[18,-5],[16,-3],[67,0],[38,-5],[20,-5],[16,-6],[30,-23],[12,-10],[61,-41],[249,-125],[89,-27],[15,-8],[28,-22],[1,-1],[86,-81],[36,-23],[45,-23],[113,-32],[19,-1],[12,2],[11,3],[10,4],[51,36],[18,10],[12,4],[124,15],[45,-3],[213,-36],[27,-1],[44,11],[90,9],[24,5],[20,8],[17,8],[110,87],[18,10],[21,7],[63,8],[22,6],[9,6],[8,6],[27,31],[8,7],[19,11],[42,16],[9,4],[16,13],[6,8],[12,19],[13,31],[11,19],[7,8],[7,7],[13,6],[19,5],[34,3],[18,-3],[15,-3],[105,-36],[298,-62],[12,-4],[31,-18],[38,-31],[14,-16],[28,-43],[21,-24],[48,-38],[14,-15],[19,-24],[15,-15],[70,-51],[2,-1]],[[2462,3794],[-25,-65],[-12,-19],[-134,-156],[-25,-20],[-197,-215],[-20,-33],[-1,-19],[2,-13],[4,-11],[6,-9],[7,-7],[48,-30],[9,-6],[7,-8],[6,-9],[4,-9],[21,-88],[4,-10],[5,-9],[31,-36],[0,-1],[0,-1],[3,-5],[4,-26],[1,-25],[2,-15],[4,-13],[6,-8],[7,-8],[8,-7],[39,-48],[16,-14],[19,-12],[11,-4],[52,-13],[11,-6],[9,-7],[6,-14],[0,-12],[-3,-11],[-4,-10],[-6,-9],[-4,-11],[-3,-11],[-28,-201],[-1,-26],[2,-7],[3,-7],[79,-123],[22,-48],[3,-12],[5,-30],[8,-24],[5,-12],[4,-14],[9,-52],[6,-21],[5,-9],[5,-9],[33,-41],[15,-23]],[[2555,2072],[-196,28],[-155,0],[-53,6],[-10,5],[-35,25],[-32,28],[-36,19],[-40,17],[-35,9],[-323,-80],[-114,-10],[-53,4],[-256,80],[-18,12],[-9,8],[-12,14],[2,-2],[-3,3],[-3,6],[-11,9],[-13,9],[-26,12],[-18,5],[-147,4],[-56,-9],[-34,-1],[-19,2],[-15,4],[-8,4],[-5,3],[-7,6],[-6,7],[-11,17],[-5,10],[-7,21],[-9,19],[-5,8],[-12,14],[-10,10],[-211,50],[-33,3],[-30,-8],[-175,-111],[-169,-64],[-26,-7],[-60,-10],[-1,0]],[[45,2251],[-36,186],[-9,177],[26,176],[-7,42],[-11,41],[-6,43],[10,48],[25,40],[64,78],[13,44],[-12,40],[-12,10]],[[90,3176],[179,97],[101,122],[35,20],[90,0],[53,-9],[21,9],[9,35],[1,78],[5,20],[20,19],[64,31],[22,-13],[32,-28],[10,-1],[19,-15],[15,17],[8,34],[-3,34],[-5,3],[-24,21],[-11,12],[0,16],[1,18],[0,14],[-21,41],[1,14],[20,15],[30,8],[27,-6],[27,-10],[32,-3],[42,9],[8,17],[-4,25],[7,31],[18,17],[56,13],[28,11],[27,22],[19,23],[22,18],[35,9],[32,-4],[53,-29],[29,-10],[23,1],[39,11],[22,2],[21,-4],[27,-19],[57,-13],[71,-27],[37,7],[14,16],[18,45],[13,9],[63,16],[14,6],[36,23],[40,8],[42,-5],[82,-40],[18,-13],[7,-16],[0,-23],[3,-25],[9,-20],[20,-9],[22,6],[39,26],[22,9],[21,1],[19,-3],[77,-23],[33,-16],[22,-25],[21,-81],[29,7],[30,31],[19,26],[12,-54],[10,-22],[22,-9],[21,3],[84,35],[47,26],[16,6]],[[9864,4457],[-1,0],[-226,43],[-47,6],[-15,-2],[-19,-3],[-31,-17],[-15,-5],[-16,-1],[-25,3],[-15,4],[-12,6],[-24,20],[-15,4],[-20,2],[-36,-3],[-19,3],[-12,6],[-13,16],[-8,7],[-8,6],[-9,4],[-9,3],[-202,-23],[-45,2],[-67,11],[-313,-23],[-19,2],[-15,3],[-11,5],[-19,11],[-119,89],[-19,11],[-12,4],[-17,-1],[-21,-4],[-52,-28],[-10,-7],[-12,-14],[-41,-33],[-7,-8],[-5,-9],[-1,-10],[2,-10],[4,-10],[11,-17],[5,-10],[3,-11],[-5,-11],[-11,-8],[-26,-1],[-15,3],[-12,6],[-9,6],[-101,64],[-10,5],[-12,3],[-12,0],[-40,-3],[-14,1],[-14,2],[-12,3],[-10,5],[-18,12],[-11,5],[-52,5],[-39,13],[-71,8],[-12,4],[-10,4],[-9,6],[-16,14],[-9,6],[-18,-1],[-28,-11],[-93,-48],[-39,-12],[-105,-6],[-27,4],[-14,-2],[-12,-6],[-11,-16],[-9,-27],[-5,-10],[-10,-8],[-14,-7],[-27,-4],[-16,1],[-14,4],[-12,0],[-11,-5],[-9,-12],[-13,-21],[-13,-16],[-11,-9],[-15,-6],[-29,-5],[-18,1],[-15,2],[-35,13],[-25,5],[-25,1],[-17,-3],[-87,-33],[-30,-6],[-61,1],[-53,-5],[-24,-6],[-110,-52],[-32,-25],[-29,-30],[-16,-13],[-10,-5],[-64,-24],[-22,-15],[-15,-14],[-12,-8],[-41,-23],[-10,-7],[-12,-13],[-10,-14],[-6,-13],[-2,-15],[4,-17],[28,-44],[3,-14],[-1,-37]],[[6435,3995],[-96,13],[-135,-5],[-30,2],[-19,5],[-8,7],[-21,29],[0,1],[-5,5],[-179,105],[-25,20],[-35,38],[-21,33],[-9,22],[-4,22],[0,13],[11,48],[3,39],[-1,12],[-3,11],[-8,13],[-31,44],[-9,17],[-3,15],[3,11],[5,9],[9,7],[9,4],[25,5],[10,4],[7,7],[3,11],[0,12],[-2,13],[-48,104],[-4,12],[1,24],[6,23],[26,64],[27,108],[1,26],[0,24],[-9,45],[-38,67]],[[5838,5084],[166,72],[65,4],[122,-45],[64,-13],[66,9],[58,25],[49,35],[40,42],[38,60],[29,27],[67,18],[15,19],[13,23],[17,21],[19,12],[40,18],[18,12],[31,37],[40,84],[26,42],[8,22],[-8,23],[-12,23],[-7,22],[3,20],[7,20],[16,30],[43,46],[15,27],[6,47],[20,22],[47,-15],[75,-41],[28,2],[40,11]],[[7102,5845],[40,10],[39,5],[43,12],[28,30],[6,37],[-19,33],[19,24],[47,35],[12,26],[-7,34],[-23,9],[-31,4],[-30,23],[64,85],[23,60],[26,44],[46,104],[9,36],[-9,50],[-33,91],[2,49],[10,20],[17,23],[18,19],[13,8],[6,8],[26,49],[9,11],[1,1]],[[7454,6785],[6,-15],[51,-46],[62,-42],[57,-50],[57,-62],[129,-111],[104,-68],[92,-81],[44,-28],[21,1],[18,22],[34,30],[36,12],[36,-4],[36,-15],[32,-22],[11,-14],[17,-30],[17,-15],[19,-6],[61,-6],[33,-9],[27,-11],[53,-35],[22,-22],[8,-21],[5,-21],[11,-22],[19,-21],[25,-20],[52,-31],[110,-22],[27,-16],[11,-28],[3,-73],[53,-119],[96,-131],[22,-58],[13,-69],[6,-104],[9,-34],[17,-27],[48,-39],[19,-25],[32,-53],[39,-49],[44,-42],[118,-78],[111,-115],[106,-33],[81,-46],[32,-9],[60,-1],[62,-35],[61,-26],[29,-19],[124,-125],[17,-30],[-6,-38],[-24,-29],[-68,-49],[-37,-43]],[[6435,3995],[-17,-32],[-6,-8],[-14,-14],[-16,-13],[-105,-62],[-17,-19],[-14,-43]],[[6246,3804],[-96,-48],[-31,-20],[-104,-91],[-25,-16],[-21,-9],[-13,1],[-12,3],[-31,15],[-13,4],[-16,1],[-42,-19],[-42,-26],[-103,-48],[-15,-15],[-38,-44],[-358,-186],[-42,-16],[-14,0],[-70,11],[-17,1],[-23,-3],[-13,-6],[-9,-8],[-7,-8],[-12,-13],[-18,-14],[-49,-30],[-115,-48],[-63,-18],[-14,-2],[-27,2],[-13,2],[-11,4],[-31,16],[-12,3],[-14,1],[-13,0],[-99,-18],[-63,-5],[-18,-6],[-10,-8],[-4,-11],[-5,-24],[-6,-12],[-11,-12],[-39,-26],[-18,-15],[-14,-6],[-14,-1],[-91,26],[-53,5],[-106,-8],[-13,3],[-12,3],[-11,5],[-8,7],[-7,8],[-5,9],[-14,42],[-4,9],[-6,9],[-7,7],[-9,6],[-13,3],[-14,0],[-88,-9],[-14,1],[-12,3],[-22,9],[-29,17],[-8,7],[-16,15],[-11,7],[-19,3],[-10,-5],[-6,-10],[-1,-12],[1,-12],[6,-49],[2,-51],[-5,-14],[-10,-14],[-25,-18],[-17,-7],[-15,-4],[-149,3]],[[3577,3030],[-35,39],[-13,24],[-2,11],[-3,50],[-2,11],[-6,19],[-6,12],[-10,14],[-12,13],[-9,11],[-116,117],[-37,63],[-7,7],[-20,12],[-104,37],[-62,14],[-73,3],[-17,5],[-17,9],[-23,19],[-10,14],[-5,14],[-6,35],[-7,20],[-11,18],[-14,15],[-8,7],[-22,8],[-108,24],[-63,7],[-101,-14],[-20,5],[-77,40],[-89,81]],[[2462,3794],[0,12],[-10,62],[5,24],[-41,15],[-18,-8],[-20,2],[-13,12],[1,22],[9,9],[33,5],[15,8],[24,24],[32,25],[34,19],[32,8],[35,-6],[76,-30],[37,-7],[43,0],[23,4],[0,14],[-27,32],[-3,19],[31,8],[42,2],[26,5],[-2,9],[-7,16],[0,18],[22,14],[19,0],[16,-10],[13,-12],[10,-6],[31,-25],[18,-6],[8,24],[-9,38],[-1,20],[10,19],[32,8],[36,-5],[24,7],[-1,32],[0,14],[21,45],[16,16],[26,22],[33,13],[55,2],[37,16],[21,25],[34,10],[36,-10]],[[3326,4368],[56,-31],[34,8],[36,25],[32,13],[45,8],[37,1],[33,-1],[48,6],[47,-4],[39,-21],[41,-37],[40,-4],[20,37],[13,20],[52,38],[61,-5],[63,-12],[72,-3],[61,3],[11,61],[33,53],[35,43],[24,42],[83,12],[78,27],[66,3],[66,12],[51,54],[53,49],[26,38],[32,34],[45,22],[40,2],[46,-48],[51,-16],[40,26],[30,27],[10,35],[9,24],[18,19],[-1,28],[-15,38],[4,25],[22,11],[36,-4],[41,-32],[30,-20],[35,2],[30,14],[25,59],[24,29],[30,3],[40,-16],[43,-10],[48,-5],[42,4],[39,11],[25,27],[8,34],[10,30],[4,29],[17,22],[30,14],[32,-9],[17,-14],[3,-33],[3,-11],[8,-11],[14,-12],[11,-2],[11,2],[14,-2],[66,-35],[7,-10],[9,-7],[15,-3],[58,10]],[[7102,5845],[-28,28],[-12,19],[-23,48],[-24,33],[-69,64],[-31,41],[-78,83],[-32,54],[-28,29],[-52,39],[-7,7],[-37,49],[-7,8],[-8,6],[-43,20],[-81,28],[-23,5],[-144,12],[-38,12],[-71,30],[-29,6],[-59,2],[-77,-8],[-116,8],[-183,43],[-55,6],[-27,-2],[-47,-11],[-164,-10],[-52,6],[-52,11],[-14,0],[-12,-2],[-31,-12],[-12,-2],[-13,-1],[-13,2],[-15,7],[-14,13],[-20,28],[-18,30],[-7,20],[-1,12],[4,37],[-2,10],[-4,10],[-11,17],[-5,9],[-2,11],[-1,13],[2,27],[6,24],[16,44],[2,12],[0,12],[-2,11],[-8,20],[-17,67],[-8,20],[-11,18],[-12,9],[-17,11],[-36,14],[-62,19],[-13,6],[-14,9],[-62,55],[-8,9],[-6,8],[-6,13],[-1,1],[-3,8],[-29,79],[-1,12],[3,39],[-2,25],[-3,11],[-8,20],[-19,37],[-8,10],[-9,9],[-32,23],[-136,53],[-89,48],[-154,114],[-10,5],[-27,7],[-36,0],[-13,-2],[-31,-12],[-24,-21],[-45,-64]],[[4559,7979],[46,7],[124,-8],[58,11],[45,1],[18,4],[15,11],[9,11],[7,12],[11,13],[102,64],[27,25],[15,32],[20,70],[25,27],[36,4],[45,-9],[43,-3],[24,21],[3,39],[-6,85],[9,36],[29,28],[40,8],[39,-10],[53,-57],[68,-38],[31,-23],[41,-49],[87,-73],[139,-147],[28,-39],[10,-34],[7,-73],[13,-35],[20,-19],[63,-39],[21,-31],[26,-86],[16,-37],[29,-32],[32,-19],[74,-26],[35,-21],[89,-76],[37,-22],[28,-5],[25,13],[24,32],[36,66],[24,8],[33,-39],[31,-49],[48,-60],[54,-51],[76,-33],[24,-23],[21,-27],[24,-23],[26,-15],[56,-21],[311,-42],[65,0],[28,-9],[24,-23],[34,-64],[21,-28],[99,-74],[28,-28],[22,-37],[8,-36],[3,-83],[19,-46]],[[3326,4368],[17,61],[32,61],[19,69],[-5,41],[0,25],[7,38],[19,31],[37,40],[8,31],[59,228],[9,94]],[[3528,5087],[100,279],[32,45],[55,47],[70,47],[63,55],[56,61],[14,36],[54,228],[9,24],[21,37],[10,20],[13,43],[8,87],[0,1],[1,14],[-1,87],[4,21],[7,14],[8,7],[9,5],[20,6],[16,3],[8,2],[7,6],[5,11],[1,14],[-4,13],[-7,13],[-45,52],[-5,12],[-5,16],[-2,49],[3,44],[-1,14],[-8,20],[-9,18],[-61,69]],[[9864,4457],[-40,-47],[-125,-84],[-53,-52],[-15,-37],[-5,-77],[-13,-37],[-20,-23],[-229,-140],[-64,-52],[-53,-65],[0,-1],[-17,-52]],[[9230,3790],[-1,0],[-178,-38],[-137,-54],[-149,-40],[-11,-8],[-19,-23],[-9,-23],[-6,-24],[-10,-21],[-20,-20],[-45,-17],[-25,-14],[-34,-34],[-59,-76],[-44,-26],[-64,-17],[-20,-18],[-48,-91],[-37,-41],[-45,-33],[-45,-26],[-99,-22],[-22,-19],[-8,-13]],[[8095,3092],[-47,21],[-49,29],[-68,25],[-40,21],[-16,13],[-30,29],[-28,44],[-18,38],[-6,8],[-9,7],[-11,4],[-17,2],[-22,-1],[-54,-12],[-15,-6],[-61,-44],[-10,-5],[-21,-8],[-10,-5],[-8,-7],[-7,-9],[-4,-11],[-5,-23],[-10,-19],[-7,-9],[-7,-8],[-8,-6],[-9,-6],[-75,-28],[-17,-1],[-22,3],[-128,37],[-10,5],[-24,20],[-11,4],[-13,3],[-152,23],[-57,14],[-64,40],[-52,51],[-11,7],[-14,6],[-24,5],[-29,10],[-14,2],[-19,-1],[-48,-17],[-84,-39],[-15,-4],[-18,-1],[-33,5],[-16,6],[-13,8],[-8,6],[-11,5],[-37,10],[-17,10],[-6,1],[-10,0],[-98,-16],[-36,-15],[-92,-50]],[[6220,3263],[-37,44],[-5,14],[-2,20],[3,14],[5,10],[7,9],[7,7],[28,18],[12,14],[14,21],[21,49],[7,26],[3,20],[-18,92],[-2,71],[-17,112]],[[5566,721],[28,-58],[20,-22],[28,-20],[23,-20],[9,-14],[4,-14],[-10,-51],[-1,-14],[2,-17],[5,-11],[7,-9],[14,-13],[37,-49],[16,-28],[3,-15],[2,-16]],[[5753,350],[-6,3],[-47,3],[-125,9],[-77,-8],[-97,24],[-76,31],[-85,-18],[-87,34],[-119,-37],[-66,18],[-126,-39],[-56,-22],[-123,-73],[-93,-61],[-65,-34]],[[4505,180],[-13,18],[-7,21],[-7,38],[0,39],[2,13],[2,12],[20,42],[7,22],[1,12],[-5,10],[-12,6],[-25,-1],[-16,-3],[-15,-2],[-14,3],[-16,11],[-8,10],[-5,9],[-4,4],[-8,5],[-11,4],[-10,5],[-9,7],[-11,18],[-4,10],[-8,14],[-10,3],[-18,0],[-37,-11],[-18,-9],[-12,-10],[-13,-18],[-7,-8],[-8,-7],[-9,-6],[-10,-5],[-20,-7],[-10,1],[-16,4],[-26,13],[-12,8],[-9,7],[-21,34],[-7,8],[-15,15],[-11,6],[-13,5],[-20,3],[-17,0],[-34,-9],[-62,-33]],[[3894,491],[-13,20],[-29,31],[-67,53],[-61,32],[-9,6],[-6,11],[-4,15],[-3,56],[-10,57],[2,14],[6,14],[14,16],[12,8],[22,10],[9,5],[8,7],[7,8],[13,18],[14,16],[32,27],[4,13],[0,16],[-9,28],[-7,14],[-7,10],[-1,9],[0,15],[13,49],[0,39]],[[3824,1108],[33,104],[19,32],[19,10],[24,9],[32,8],[56,3],[28,-1],[18,-3],[21,-6],[83,-42],[22,-2],[32,2],[93,18],[19,8],[14,16],[17,29],[24,66],[5,10],[12,12],[17,14],[168,100],[18,2],[25,-2],[39,-11],[99,-44],[16,-2],[21,-1],[43,5],[21,6],[16,5],[128,71],[51,16],[235,30]],[[5292,1570],[51,-186],[25,-67],[78,-132],[7,-19],[3,-17],[-1,-13],[-23,-102],[-1,-18],[2,-45],[4,-8],[10,-16],[78,-86],[31,-53],[10,-30],[0,-57]],[[6220,3263],[12,-15],[10,-18],[4,-10],[2,-11],[2,-38],[-2,-27],[-6,-16],[-9,-18],[-23,-25],[-11,-11],[-11,-7],[-64,-21],[-19,-10],[-16,-10],[-5,-5],[-1,-1],[-1,-1],[-5,-5],[-9,-14],[-12,-24],[-34,-86],[-9,-13],[-18,-18],[-13,-9],[-12,-7],[-21,-9],[-59,-13],[-22,-8],[-9,-6],[-8,-12],[-8,-16],[-6,-32],[-1,-18],[2,-15],[4,-10],[5,-9],[47,-68],[5,-10],[4,-10],[3,-11],[1,-12],[0,-13],[-6,-54],[-6,-25],[-64,-133],[-7,-21],[-5,-67],[-6,-15],[-11,-14],[-23,-20],[-38,-23],[-16,-13],[-8,-7],[-16,-26],[-23,-55],[-20,-26],[-22,-21],[-12,-15],[-10,-14],[-7,-26],[1,-16],[-1,-11],[-2,-12],[-3,-12],[-9,-12],[-12,-13],[-90,-71],[-23,-23],[-9,-13],[-10,-17],[-16,-35],[-12,-38],[-8,-15],[-14,-17],[-52,-50],[-55,-71]],[[3824,1108],[-14,26],[-9,13],[-103,101],[-5,10],[0,13],[8,17],[9,11],[10,6],[36,18],[9,6],[6,8],[6,10],[4,19],[8,136],[-2,20],[-9,30],[-34,79],[-4,11],[0,12],[5,16],[5,12],[41,65],[4,11],[3,17],[2,23],[-8,84],[-57,247],[-26,67]],[[3709,2196],[23,17],[16,15],[7,8],[5,9],[6,10],[4,11],[3,12],[3,13],[10,191],[-4,18],[-8,22],[-33,58],[-28,39],[-107,357],[-29,54]],[[8095,3092],[-9,-9],[-11,-8],[-13,-6],[-45,-7],[-44,-1],[-34,-14],[-40,-126],[-70,-59],[-151,-80],[-40,-41],[-18,-31],[-8,-43],[18,-117],[-3,-17],[-9,-22],[-41,-63],[-12,-14],[-8,-12],[-6,-17],[-7,-33],[-3,-62],[-5,-24],[-8,-12],[-57,-60],[-45,-66]],[[7426,2148],[-78,-54],[-22,-29],[-3,-12],[-2,-12],[-16,-47],[-24,-47],[-15,-20],[-13,-13],[-43,-15],[-93,-11],[-18,-6],[-23,-10],[-40,-24],[-17,-15],[-12,-13],[-4,-11],[-8,-16],[-54,-75],[-28,-56],[-41,-64],[-5,-16],[1,-6],[5,-15],[1,-7],[1,-9],[0,-10],[-2,-12],[-3,-11],[-6,-42],[-7,-21],[-9,-12],[-12,-10],[-18,-12],[-9,-11],[-6,-12],[-34,-102],[-5,-25],[-3,-43],[-7,-21],[-8,-11],[-11,-6],[-33,-16],[-29,-22],[-17,-10],[-16,-5],[-34,-5],[-59,-28],[-22,-6],[-41,-4],[-25,-14],[-35,-23],[-103,-88],[-23,-16],[-11,-4],[-26,-3],[-59,4],[-27,-1],[-13,-1],[-23,-7],[-213,-163],[-13,-8],[-45,-19],[-49,-12],[-253,-12]],[[7334,341],[-21,-10],[-116,-30],[-61,-46],[-38,-16],[-80,-22],[-325,-141],[-40,-6],[-37,-12],[-48,-51],[-36,-7],[8,21],[4,13],[0,8],[-19,27],[-25,23],[-34,15],[-74,9],[-5,8],[2,13],[-12,18],[-19,13],[-17,8],[-41,7],[-90,-4],[-172,-36],[-72,12],[-50,44],[-97,118],[-66,33]],[[7426,2148],[40,-347],[-2,-10],[-5,-22],[-4,-11],[-21,-40],[-4,-10],[-4,-12],[-19,-113],[5,-126],[7,-35],[4,-47],[-7,-123],[-10,-57],[-5,-7],[-4,-4],[-8,-2],[-11,2],[-10,4],[-13,0],[-13,-6],[-14,-25],[-5,-25],[-2,-40],[2,-20],[4,-15],[13,-16],[6,-13],[4,-19],[4,-54],[3,-15],[6,-9],[16,-17],[8,-14],[8,-24],[1,-17],[-2,-15],[-3,-12],[-9,-21],[-29,-45],[-7,-14],[-15,-55],[-5,-45],[4,-82],[4,-23],[25,-76],[1,-11],[-2,-10],[-4,-8],[-15,-17],[-8,-12],[-7,-21],[-1,-16],[2,-11],[9,-22],[0,-2]],[[4505,180],[-58,-32],[-67,6],[-57,-30],[-27,-15],[-11,-43],[-40,51],[-33,6],[-34,12],[15,18],[3,23],[-21,16],[-30,4],[-11,-31],[-38,-27],[-17,0],[-42,5],[-44,-5],[-59,45],[-113,60],[-29,24],[-4,31],[32,25],[32,29],[48,10],[-7,7]],[[3893,369],[11,9],[5,8],[3,17],[1,15],[-19,73]],[[9230,3790],[-30,-94],[1,-151],[41,-308],[-42,-339],[-6,-183],[53,-84],[38,0],[34,6],[31,0],[31,-20],[18,-34],[13,-36],[23,-23],[61,4],[-33,-21],[-34,-28],[-68,-76],[-42,-68],[-23,-71],[-38,-170],[-36,-103],[-9,-94],[-18,-29],[-66,-42],[-31,-26],[-92,-107],[-101,-70],[-32,-35],[-67,-120],[-18,-21],[-4,-22],[-40,-118],[30,-75],[-2,-37],[-77,-21],[-174,-88],[-138,-89],[-286,-253],[-23,-27],[-8,-36],[1,-31],[-10,-23],[-171,-35],[-43,-3],[8,18],[11,13],[33,26],[-14,11],[-12,12],[-9,16],[-4,18],[3,25],[19,50],[5,9],[-28,25],[-51,19],[-53,12],[-37,1],[21,-14],[70,-28],[-15,-26],[-31,-28],[-35,-22],[-29,-9],[-11,-14],[-1,-28],[14,-22],[31,5],[-3,16],[28,-6],[35,-26],[17,-45],[-15,-26],[-35,-26],[-421,-204]],[[2555,2072],[25,-50],[16,-62],[8,-17],[9,-13],[10,-6],[32,-14],[13,-10],[61,-66],[69,-99],[11,-22],[1,-14],[0,-6],[-2,-6],[-4,-5],[-13,-14],[-83,-62],[-9,-5],[-14,-6],[-80,-21],[-30,-15],[-45,-29],[-8,-10],[-8,-16],[-7,-27],[-1,-16],[2,-14],[5,-9],[6,-9],[37,-40],[7,-12],[-1,-14],[-13,-42],[-10,-16],[-11,-13],[-10,-21],[-3,-23],[2,-40],[-2,-19],[-6,-14],[-7,-8],[-115,-90]],[[2387,1077],[-67,12],[-167,4],[-103,-6],[-34,26],[-87,-2],[-48,-27],[-23,27],[-48,4],[-52,-22],[-66,-27],[-60,55],[-48,2],[-54,-10],[-76,-30],[-105,-37],[-34,4],[-48,-27],[-55,5],[-54,-6],[-62,8],[18,17],[-16,31],[-52,14],[-34,50],[5,82],[-48,47],[-37,56],[-139,150],[-62,27],[-22,31],[-29,67],[-33,29],[-47,18],[-49,8],[-44,3],[-51,9],[-23,24],[-22,77],[-22,44],[-158,210],[-35,27],[-70,38],[-31,26],[-26,39],[-14,42],[-10,55]],[[3893,369],[-21,22],[-37,14],[-99,36],[-69,10],[-66,-3],[-40,-25],[-31,4],[-29,13],[-70,40],[-33,14],[-33,20],[-126,32],[-154,18],[-147,58],[-32,20],[-25,51],[-29,25],[-63,41],[-44,46],[-39,34],[-35,25],[-50,29],[-28,22],[3,28],[-12,14],[-28,17],[-11,10],[-35,36],[-34,27],[-60,24],[-29,6]],[[2555,2072],[80,-4],[272,-48],[21,2],[26,5],[46,17],[22,10],[15,9],[78,87],[32,24],[5,4],[8,3],[129,30],[43,15],[38,21],[76,57],[58,-13],[205,-95]],[[1201,8575],[-5,37],[-12,53],[-18,73],[-15,45],[-42,86],[-28,40],[-42,79],[-8,80],[24,74],[52,61],[369,320],[41,66],[14,79],[-27,89],[-9,45],[16,19],[42,1],[47,-43],[36,-107],[59,-37],[47,-5],[82,14],[45,1],[25,-12],[29,-42],[29,-7],[18,9],[43,36],[24,11],[37,-1],[23,-15],[20,-17],[28,-11],[14,5],[24,27],[11,5],[14,-7],[24,-24],[9,-6],[61,12],[54,41],[38,58],[10,64],[14,53],[40,66],[51,59],[47,31],[19,-1],[35,-16],[20,0],[37,18],[13,4],[69,13],[37,1],[91,-24],[69,12],[72,1],[67,-44],[35,-56],[18,-21],[117,-76],[58,-27],[32,-20],[28,-26],[17,-28],[7,-41],[-6,-22],[2,-13],[30,-18],[19,-5],[18,1],[18,-2],[20,-12],[11,-12],[16,-26],[70,-75],[23,-18],[31,-27],[100,-61],[32,-30],[45,-72],[27,-35],[25,-21],[87,-46],[110,-87],[61,-30],[38,-34],[59,-66],[11,-23],[5,-22],[8,-19],[21,-17],[36,-22],[16,-15],[13,-17],[62,-115],[28,-33],[123,-94],[30,-57],[12,-61],[-9,-61],[-33,-56],[-8,-44],[-1,-135],[-12,-93],[1,-44],[10,-15]],[[3528,5087],[-60,29],[-26,16],[-103,81],[-20,11],[-102,29],[-33,4],[-13,-1],[-23,-5],[-19,-1],[-24,2],[-73,13],[-20,1],[-47,-10],[-41,-3],[-41,3],[-46,10],[-59,33],[-103,44],[-28,7],[-20,2],[-10,-4],[-19,-9],[-35,-25],[-19,-10],[-11,-4],[-24,-4],[-119,-1],[-18,-4],[-20,-9],[-122,-82],[-14,-6],[-19,-5],[-33,-5],[-19,1],[-18,6],[-40,16],[-16,2],[-14,-2],[-28,-16],[-33,-10],[-48,-8],[-18,1],[-68,11],[-25,1],[-18,-2],[-10,-5],[-17,-12],[-15,-15],[-6,-7],[-17,-15],[-9,-5],[-44,-13],[-11,-4],[-8,-6],[-7,-8],[-9,-17],[-2,-4],[-1,-1],[-12,-30],[-5,-9],[-14,-16],[-8,-8],[-18,-12],[-326,-45],[-8,-7],[-6,-8],[-6,-10],[-3,-12],[-6,-42],[-9,-11],[-13,-11],[-28,-12],[-17,-2],[-14,3],[-10,5],[-165,16],[-23,5],[-18,12],[-39,10],[-45,4],[-22,5],[-15,6],[-6,7],[-2,4],[-12,35],[-10,18],[-6,8],[-8,7],[-41,21],[-9,6],[-8,7],[-51,55],[-6,7],[-9,7],[-12,7],[-21,8],[-16,3],[-96,-5],[-55,-10]],[[465,5088],[-11,45],[-5,47],[1,5],[18,22],[47,91],[119,160],[9,63],[-19,59],[-128,160],[-22,43],[11,42],[41,64],[20,79],[6,92],[-7,88],[-19,64],[-59,63],[-23,41],[13,42],[51,55],[30,20],[41,17],[89,16],[45,17],[20,30],[113,316],[17,90],[-14,92],[-50,58],[-48,35]],[[90,3176],[-40,30],[-12,41],[12,37],[29,33],[68,61],[19,41],[3,47],[-31,178],[-2,87],[29,66],[77,26],[175,-9],[80,6],[69,31],[71,61],[30,37],[13,34],[3,48],[9,37],[28,77],[13,82],[-16,62],[-37,49],[-82,79],[-19,34],[-10,37],[-3,43],[4,93],[-4,47],[-14,35],[14,16],[-16,52],[-21,144],[-22,29],[-15,32],[-27,109]]],"transform":{"scale":[0.0005329057895789584,0.00048770204920492037],"translate":[-58.43936113199993,-34.973402601999936]}};
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
