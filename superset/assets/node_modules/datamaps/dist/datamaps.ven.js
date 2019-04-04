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
  Datamap.prototype.uryTopo = '__URY__';
  Datamap.prototype.usaTopo = '__USA__';
  Datamap.prototype.usgTopo = '__USG__';
  Datamap.prototype.uzbTopo = '__UZB__';
  Datamap.prototype.vatTopo = '__VAT__';
  Datamap.prototype.vctTopo = '__VCT__';
  Datamap.prototype.venTopo = {"type":"Topology","objects":{"ven":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]]]},{"type":"Polygon","properties":{"name":"Falcón"},"id":"VE.FA","arcs":[[34,35,36,37]]},{"type":"Polygon","properties":{"name":"Apure"},"id":"VE.AP","arcs":[[38,39,40,41,42]]},{"type":"Polygon","properties":{"name":"Barinas"},"id":"VE.BA","arcs":[[43,44,45,-43,46,47,48]]},{"type":"Polygon","properties":{"name":"Mérida"},"id":"VE.ME","arcs":[[-48,49,50,51,52]]},{"type":"Polygon","properties":{"name":"Táchira"},"id":"VE.TA","arcs":[[-47,-42,53,54,-50]]},{"type":"Polygon","properties":{"name":"Trujillo"},"id":"VE.TR","arcs":[[55,-49,-53,56,57,58]]},{"type":"MultiPolygon","properties":{"name":"Zulia"},"id":"VE.ZU","arcs":[[[59,-58,60,-37]],[[-51,-55,61]]]},{"type":"Polygon","properties":{"name":"Cojedes"},"id":"VE.CO","arcs":[[62,-45,63,64,65,66]]},{"type":"Polygon","properties":{"name":"Carabobo"},"id":"VE.CA","arcs":[[67,68,-67,69,70]]},{"type":"Polygon","properties":{"name":"Lara"},"id":"VE.LA","arcs":[[71,-65,72,-59,-60,-36]]},{"type":"Polygon","properties":{"name":"Portuguesa"},"id":"VE.PO","arcs":[[-64,-44,-56,-73]]},{"type":"Polygon","properties":{"name":"Yaracuy"},"id":"VE.YA","arcs":[[73,-70,-66,-72,-35]]},{"type":"Polygon","properties":{"name":"Amazonas"},"id":"VE.AM","arcs":[[74,75]]},{"type":"Polygon","properties":{"name":"Bolívar"},"id":"VE.BO","arcs":[[76,-76,77,-40,78,79,80,81]]},{"type":"Polygon","properties":{"name":"Anzoátegui"},"id":"VE.AN","arcs":[[82,83,-80,84,85,86]]},{"type":"Polygon","properties":{"name":"Aragua"},"id":"VE.AR","arcs":[[87,88,-68,89,90]]},{"type":"Polygon","properties":{"name":"Vargas"},"id":"VE.","arcs":[[91,92,93,-91,94]]},{"type":"Polygon","properties":{"name":"Distrito Capital"},"id":"VE.DF","arcs":[[95,-93]]},{"type":"MultiPolygon","properties":{"name":"Dependencias Federales"},"id":"VE.DP","arcs":[[[96]],[[97]],[[98]],[[99]],[[100]],[[101]],[[102]],[[103]],[[104]],[[105]],[[106]],[[107]]]},{"type":"Polygon","properties":{"name":"Guárico"},"id":"VE.GU","arcs":[[-85,-79,-39,-46,-63,-69,-89,108]]},{"type":"MultiPolygon","properties":{"name":"Monagas"},"id":"VE.MO","arcs":[[[109]],[[110]],[[111,112,-81,-84,113]]]},{"type":"Polygon","properties":{"name":"Miranda"},"id":"VE.MI","arcs":[[-86,-109,-88,-94,-96,-92,114]]},{"type":"MultiPolygon","properties":{"name":"Nueva Esparta"},"id":"VE.NE","arcs":[[[115]],[[116]],[[117]]]},{"type":"MultiPolygon","properties":{"name":"Sucre"},"id":"VE.SU","arcs":[[[118]],[[-114,-83,119]]]},{"type":"MultiPolygon","properties":{"name":"Delta Amacuro"},"id":"VE.DA","arcs":[[[120]],[[121]],[[122]],[[123]],[[124]],[[125]],[[126]],[[127]],[[-82,-113,128]],[[129]]]}]}},"arcs":[[[6245,6309],[-6,-2],[-5,1],[-5,2],[-3,6],[8,-1],[5,-3],[6,-3]],[[5620,6361],[-5,-1],[-2,4],[-4,1],[-5,1],[-6,3],[-5,4],[-23,3],[-12,9],[0,4],[2,1],[11,-1],[33,-12],[8,-4],[7,-6],[1,-6]],[[6518,6385],[-5,-3],[-5,4],[1,2],[1,2],[-2,1],[5,4],[3,-4],[3,-2],[-1,-4]],[[6374,6396],[-3,-2],[-7,3],[-8,6],[0,3],[6,4],[3,5],[8,2],[6,-4],[0,-4],[-5,-13]],[[6610,6454],[-10,-4],[-3,2],[-2,3],[0,3],[6,6],[3,2],[5,-1],[3,-3],[0,-6],[-2,-2]],[[7115,7009],[0,-7],[-8,7],[3,3],[2,-2],[3,-1]],[[7554,7107],[-2,0],[0,2],[2,0],[1,-2],[-1,0]],[[7558,7115],[-1,-2],[0,3],[1,-1]],[[7556,7113],[-7,0],[3,7],[4,-7]],[[7609,7120],[-2,-2],[-1,3],[3,-1]],[[7564,7120],[-1,0],[0,1],[1,0],[0,-1]],[[7595,7127],[-5,-3],[-3,4],[5,3],[3,-4]],[[7586,7133],[-1,0],[0,1],[1,-1]],[[7585,7136],[1,-1],[-1,-1],[0,1],[-1,0],[0,1],[1,0]],[[7569,7137],[1,-3],[-1,-5],[2,-5],[5,-4],[0,-2],[0,-2],[-5,1],[-20,16],[0,3],[2,-1],[4,-1],[6,2],[6,1]],[[7551,7139],[0,-1],[0,-1],[-1,0],[-1,1],[2,1]],[[7567,7138],[-1,0],[-1,0],[1,1],[1,-1]],[[7620,7153],[1,-4],[-3,0],[2,4]],[[5012,7418],[-5,-8],[-4,6],[4,6],[3,1],[2,-5]],[[4748,7427],[2,-3],[6,2],[3,-2],[-8,-1],[-3,1],[0,3]],[[4912,7446],[-3,-2],[0,2],[3,0]],[[4918,7450],[-4,-4],[-1,1],[5,3]],[[5000,7445],[-5,-5],[-5,7],[4,7],[6,-9]],[[5365,7427],[-10,-1],[5,4],[5,2],[0,2],[2,1],[4,2],[-1,10],[-3,9],[8,-5],[1,-6],[-2,-9],[-9,-9]],[[4942,7455],[-5,-4],[-1,3],[-2,4],[1,3],[4,0],[0,-1],[3,-5]],[[4877,7466],[-7,-1],[-7,1],[-1,0],[-1,-1],[-1,1],[-5,3],[0,2],[6,-3],[5,0],[11,-2]],[[4982,7465],[-2,-2],[-5,4],[-3,0],[-3,1],[0,2],[-3,1],[-3,2],[3,1],[8,-1],[6,-6],[2,-2]],[[4812,7475],[5,-5],[-6,4],[1,1]],[[4387,7504],[-5,0],[0,2],[5,-2]],[[4396,7506],[-7,-2],[-3,3],[6,0],[5,1],[-1,-2]],[[4382,7512],[-1,0],[0,1],[1,0],[0,-1]],[[4952,7509],[-2,-2],[-6,3],[-11,5],[3,1],[13,-3],[3,-4]],[[4361,7522],[-1,-2],[-5,-2],[-2,4],[2,0],[3,-1],[3,1]],[[7187,9995],[-2,-2],[-3,1],[-3,3],[3,2],[4,-2],[1,-2]],[[3769,6632],[-181,3],[-53,27],[-3,16],[0,12],[-13,5],[-15,3],[-15,0],[-10,2],[-30,0],[-5,-1],[-6,-2],[-9,-3],[-8,-1],[-5,1],[-7,4],[-5,-1],[-5,-2],[-8,-6],[-4,-4],[-8,-13],[-4,-5],[-13,-6],[-43,-12]],[[3319,6649],[-11,15],[-3,3],[-4,3],[-11,4],[-25,0],[-17,-2],[-27,0],[-8,1],[-4,0],[-18,-6],[-19,-4],[-31,0],[-79,12],[-6,0],[-13,-3],[-5,1],[-5,1],[-3,1],[-5,1],[-105,8],[-4,-1],[-8,-3],[-34,-7],[-7,0],[-6,1],[-1,3],[-1,4],[-1,3],[-2,7],[-3,4],[-2,2],[-12,7],[-40,4],[-38,10],[-9,1],[-7,0],[-33,-21],[-28,-11],[-31,-10],[-9,-1],[-6,-1],[-5,1],[-4,1],[-1,2],[1,3],[3,2],[3,1],[6,4],[-4,7],[-4,0],[-5,0],[-4,-2],[-4,-2],[-2,-2],[-3,-2],[-9,-7],[-10,-6],[-7,-3],[-6,0],[-6,1],[-8,0],[-6,-1],[-7,-3],[-4,-1],[-5,0],[-5,2],[-6,0],[-10,1],[-6,-1],[-13,-9],[-23,-10],[-10,-6],[-11,-5],[-7,-2],[-6,0],[-35,7],[-21,1],[-7,-1],[-5,-1],[-3,-2],[-3,-2],[-3,-2],[-4,-6],[-9,-15],[-10,-7],[-13,-6],[-5,-4],[-4,-5],[0,-3],[-12,-10],[-27,5],[-17,0],[-12,-2],[-6,-3],[-6,-8],[-5,-4],[-21,-8],[-10,-6],[-5,-6],[-6,-10],[-9,-8],[-15,-5],[-11,-2],[-15,-6],[-16,-11],[-6,-9],[-9,-17],[-3,-8],[-6,-10],[-4,-8],[-4,-4],[-11,-2],[-14,-2],[-16,-4],[-16,-6],[-18,-10],[-10,-9],[-5,-6]],[[2013,6413],[-16,4],[-11,1],[-13,6],[-12,7],[-7,9],[-1,10],[0,17],[-4,20],[-15,17],[-10,8],[-18,5],[-38,-3],[-25,-6],[-7,-2],[-3,-1],[-7,3],[-11,7],[-11,0],[-7,0],[-4,2],[-7,5],[-8,9],[-28,25],[-5,5],[-4,15],[0,4],[-4,12],[-5,11],[-6,6],[-6,6],[-12,10],[-4,5],[-2,5],[1,7],[0,4],[-1,3],[-3,10],[-2,6],[0,6],[1,8],[6,25],[-2,10],[-6,6],[-33,26],[-7,4],[-14,11],[-28,29],[-12,6],[-14,11],[-8,7],[-7,12],[-19,42],[-1,2]],[[1553,6870],[79,28],[33,17],[6,6],[44,14],[142,71],[115,27],[21,7],[16,-6],[25,0],[85,9],[13,7],[12,17],[-7,-2],[-6,-4],[-4,-6],[-3,-6],[-2,16],[17,6],[39,-5],[24,6],[57,24],[27,16],[14,0],[28,-3],[37,16],[16,17],[10,18],[0,12],[-1,5],[-5,4],[-8,2],[7,4],[10,-1],[10,-4],[6,-8],[7,-7],[8,-6],[8,2],[4,7],[3,9],[6,0],[9,-4],[7,-3],[5,-4],[4,0],[1,6],[0,7],[-1,4],[-3,3],[-6,2],[1,3],[1,2],[3,4],[-10,4],[1,9],[-32,9],[-17,1],[-2,2],[3,4],[6,0],[11,0],[-6,5],[-9,3],[-10,3],[-9,4],[-14,10],[28,-6],[21,-11],[19,-9],[14,-6],[6,-1],[13,-3],[12,1],[13,-3],[11,-6],[14,5],[8,6],[14,-4],[4,-11],[6,-2],[10,2],[5,-12],[12,-6],[14,-7],[9,-15],[23,-7],[14,7],[4,10],[22,11],[9,9],[3,15],[-16,22],[3,13],[-6,8],[-12,31],[-5,20],[-18,32],[-4,0],[-2,-12],[-6,1],[-7,7],[-5,4],[-10,-2],[-6,-5],[-4,-5],[-3,-2],[-35,-9],[-16,-2],[3,11],[-30,-12],[-8,-1],[-22,-1],[-11,-2],[-7,-4],[-17,-7],[-47,-4],[-36,-15],[-18,4],[-14,12],[-2,17],[3,4],[9,9],[3,5],[0,5],[-1,3],[-2,2],[-2,4],[0,18],[-1,1],[-7,8],[-2,4],[4,-2],[12,-5],[4,-2],[0,19],[-1,8],[-4,5],[-8,4],[-4,-5],[-3,-8],[-5,-5],[-4,12],[-16,25],[-4,4],[-3,2],[-2,3],[-2,14],[-2,4],[-5,1],[-8,-1],[4,9],[6,25],[1,9],[3,11],[13,22],[3,13],[5,10],[23,23],[8,10],[2,11],[-1,20],[4,6],[32,1],[13,3],[13,7],[46,35],[17,8],[18,4],[10,-4],[10,-6],[34,-7],[14,-10],[66,-95],[10,-27],[4,-28],[0,-58],[6,-28],[45,-114],[34,-61],[26,-28],[31,-20],[26,-3],[18,10],[20,13],[27,7],[62,-9],[29,-1],[30,10],[21,12],[12,4],[15,2],[8,-2],[15,-9],[7,-2],[25,1],[8,-1],[47,-17],[9,1],[4,-7],[10,-8],[11,-7],[10,-4],[31,-4],[115,4],[14,-4],[11,-7],[25,-24],[14,-9],[16,-8],[25,-9],[12,-2],[10,-1],[5,3],[4,-2],[17,-7],[4,-5],[7,-12],[19,-12],[55,-26],[16,-10],[14,-11],[5,-10],[7,-7],[48,-19],[4,7],[1,3],[0,4],[6,0],[2,-4],[7,-10],[0,-4],[-5,-13],[7,-17],[28,-37],[46,-79],[7,-18],[-7,-9],[-5,3],[-8,7],[-10,6],[-12,2],[-9,-2],[-9,-3],[-7,-4],[-6,-5],[25,-5],[59,-5],[18,-12],[-8,-13],[-12,-5],[-34,0],[-11,-6],[-4,-13],[1,-15],[9,-41],[23,-58],[10,-16]],[[4307,4855],[6,-11],[-8,-11],[6,-6],[8,0],[8,1],[8,0],[18,-8],[10,-1],[25,0],[5,1],[6,2],[8,2],[9,0],[42,-15],[8,-6],[5,-16],[12,-9],[28,-9],[11,-8],[8,-7],[11,-5],[36,-6],[13,-7],[14,-5],[18,1],[28,13],[16,3],[30,-19],[16,2],[16,7],[16,4],[5,-2],[4,-3],[5,-3],[74,-11],[5,1],[6,3],[4,1],[6,-1],[8,-6],[4,-2],[16,1],[75,18],[17,2],[12,-3],[5,2],[31,7],[5,1],[11,-1],[5,0],[1,4],[-1,3],[0,4],[4,3],[9,1],[6,-3],[16,-16],[8,-4],[8,-3],[4,-4],[-5,-8],[16,-9],[22,-9],[23,-3],[25,9],[6,-4],[17,-21],[4,-11],[0,-12],[-4,-13],[-1,-1]],[[5200,4649],[-9,0],[-20,-6],[-29,-16],[-13,-11],[-10,-12],[-8,-19],[-11,-12],[-11,-21],[-5,-6],[-19,-13],[-5,-5],[-2,-6],[-4,-12],[-4,-8],[-45,-58],[-14,-11],[-14,-6],[-29,-4],[-14,-5],[-6,-4],[-10,-9],[-6,-4],[-8,-3],[-28,-2],[-17,-6],[-40,-28],[-8,-3],[-17,-4],[-8,-3],[-8,-4],[-13,-12],[-7,-5],[-16,-5],[-31,-4],[-58,-41],[-12,-19],[6,-28],[12,-29],[5,-8],[11,-14],[5,-8],[2,-14],[-5,-14],[-9,-13],[-6,-14],[9,-7],[5,-13],[1,-26],[-6,-18],[-13,-11],[-15,-10],[-12,-15],[-18,-42],[-15,-73],[0,-7],[3,-7],[8,-14],[2,-7],[-5,-11],[-11,-11],[-13,-9],[-32,-15],[-7,-4],[-16,-14],[-8,-3],[-14,-5],[-6,-3],[-4,-7],[-7,-19],[-18,-34],[-11,-12],[-14,-7],[-8,-1],[-16,2],[-8,0],[-9,-3],[-7,-5],[-10,-15],[-12,-8]],[[4375,3686],[-29,2],[-20,14],[-20,17],[-21,12],[-116,24],[-51,4],[-14,3],[-6,0],[-9,-4],[-13,-12],[-8,-6],[-8,-1],[-10,0],[-9,-2],[-3,-9],[-2,-6],[-4,-7],[-5,-5],[-7,-2],[-7,-1],[-26,-8],[-30,-4],[-94,8],[-32,-4],[-84,-27],[-27,0],[-49,12],[-15,1],[-16,-1],[-54,-15],[-46,-2],[-8,-3],[-19,-16],[-10,-4],[-18,2],[-30,13],[-16,3],[-16,2],[-47,12],[-16,3],[-47,-3],[-16,3],[-17,6],[-17,3],[-13,-3],[-28,11],[-15,3],[-18,0],[-14,-6],[-21,-18],[-15,-8],[-44,-38],[-42,-21],[-17,11],[-31,32],[-15,7],[-20,-3],[-35,-15],[-18,-5],[-1,0],[-8,0],[-22,25],[-56,63],[-56,63],[-55,64],[-56,63],[-56,64],[-56,63],[-56,64],[-56,63],[-12,14],[-24,19],[-21,5],[-28,-2],[-27,-6],[-41,-21],[-23,1],[-77,33],[-11,4],[-2,1],[-5,6],[-3,2],[-7,1],[-17,-2],[-8,0],[-11,3],[-8,4],[-37,42],[-5,4],[-12,-2],[-21,-5],[-12,-1],[-25,5],[-7,3],[-10,8],[-5,2],[-22,-1],[-44,-9],[-32,-2],[-29,-9],[-15,0],[-6,-4],[-3,-6],[-8,-9],[-31,-20],[-37,-13],[-40,-4],[-52,5],[-7,-4],[-6,-6],[-9,-6],[-13,-4],[-8,2],[-5,5],[-9,3],[-36,1],[-10,4],[-4,7],[0,8],[-2,8],[-6,4],[-11,1],[-31,-5],[-12,1],[-24,6],[-12,1],[-11,-2],[-19,-8],[-9,-2],[-15,11],[-16,3],[-14,-3],[-1,-1],[1,-1],[-15,1],[0,1],[-2,1],[-2,4],[-3,3],[-6,-2],[-10,-5],[-6,-1],[-5,0],[-9,6],[-4,5],[-6,4],[-25,1],[-9,-1],[-5,-5],[3,-11],[-21,5],[-17,-2],[-18,-2],[-21,0],[2,-12],[-5,-3],[-8,2],[-8,-1],[-9,-5],[-7,-5],[-8,-5],[-12,-1],[-24,1],[-61,13],[-22,5],[-8,4],[-17,13],[-10,5],[-21,9],[-8,5],[-13,13],[-40,70],[-8,19],[-6,19],[-2,20],[1,6],[7,27],[-2,3],[-4,2],[-25,30],[-25,6],[-60,-1],[-36,6],[-19,6]],[[733,4489],[34,15],[12,8],[7,3],[3,1],[7,1],[8,-1],[41,-5],[13,0],[28,6],[15,-4],[7,-4],[8,-11],[2,-2],[6,-4],[31,-14],[12,-8],[7,-3],[33,-7],[10,0],[15,1],[10,3],[7,3],[31,18],[8,3],[16,3],[4,1],[4,3],[5,3],[12,16],[14,30],[-2,3]],[[1141,4547],[9,3],[15,-1],[45,-13],[6,-4],[11,-13],[7,-7],[9,-3],[32,-4],[15,0],[7,7],[2,7],[5,-1],[10,-9],[9,2],[16,6],[7,2],[8,-2],[15,-6],[9,-2],[8,1],[5,2],[2,3],[4,4],[16,7],[13,0],[29,-3],[55,1],[27,-3],[27,-7],[14,6],[16,-10],[16,-16],[12,-7],[17,-2],[7,-2],[9,-8],[11,0],[19,2],[31,-7],[30,-11],[29,-16],[25,-20],[13,3],[13,-5],[14,-8],[14,-4],[13,2],[34,10],[11,6],[27,-10],[34,-6],[34,-2],[26,5],[4,4],[12,15],[4,3],[10,3],[6,0],[5,-2],[7,-1],[13,4],[12,8],[18,16],[5,9],[4,0],[6,-1],[4,-2],[1,-2],[6,4],[3,3],[1,4],[0,10],[5,10],[11,3],[15,1],[15,1],[26,13],[21,21],[14,24],[16,48],[8,9],[13,4],[8,1],[13,3],[7,1],[8,-2],[12,-6],[5,-1],[12,2],[19,6],[17,9],[8,12],[4,13],[11,16],[12,13],[11,6],[9,3],[34,20],[11,2],[37,-2],[9,3],[11,6],[21,16],[11,8],[11,6],[10,1],[10,-4],[8,5],[25,11],[9,2],[20,2],[13,4],[115,71],[85,71],[16,9],[17,1],[35,-7],[28,0],[88,9],[17,-4],[26,-15],[15,-4],[4,-3],[7,-16],[4,-4],[28,-9],[4,-2],[8,-5],[3,-2],[5,2],[7,6],[3,1],[28,0],[4,2],[7,2],[8,0],[4,-6],[1,-7],[4,-6],[10,-12],[0,-3],[-1,-8],[1,-3],[3,-1],[8,2],[4,-1],[28,-13],[46,-6],[69,9],[11,3],[10,8],[38,22],[12,2],[46,-2],[16,-3],[29,-13],[18,-2],[18,6],[26,21],[14,4],[15,4],[9,0],[4,-6],[3,-1],[17,-10],[15,0],[18,3],[16,0],[6,-6],[8,-3],[16,6],[22,13],[5,2],[13,1],[7,2],[9,5],[7,6],[7,5],[23,5],[26,11],[14,5],[73,4],[18,-5],[17,-8],[17,-6],[16,6],[34,-9],[71,-3],[37,-7],[15,-5],[15,-4],[13,3],[5,1],[2,-1],[5,-6],[3,-2],[17,-4],[16,-11],[2,-3]],[[2363,5552],[8,-11],[96,-66],[18,-22],[10,-8],[70,-38],[66,-25],[4,-1],[13,-2],[18,2],[17,-4],[16,-11],[16,-3],[5,1],[4,1],[7,4],[16,13],[9,6],[7,5],[4,3],[8,3],[4,-3],[11,-18],[22,-8],[26,-21],[52,-21],[15,-4],[12,-2],[23,0],[4,-3],[9,-2],[47,-3],[13,-2],[6,-2],[4,-3],[13,-25],[8,-11],[5,-5],[39,-29],[2,-3],[15,-19],[3,-6],[1,-4],[0,-3],[-1,-8],[0,-4],[3,-5],[4,-9],[3,-2],[4,-1],[17,0],[7,-1],[4,-3],[1,-3],[-1,-3],[-2,-2],[-5,-5],[-2,-2],[-4,-6],[-3,-7],[-2,-7],[-1,-4],[3,-6],[6,-8],[28,-27],[7,-9],[3,-3],[4,-2],[34,-16],[28,-17],[4,-4],[8,-12],[16,-20],[5,-4],[5,-3],[34,-15],[4,-4],[3,-4],[2,-8],[2,-5],[3,-2],[4,-2],[8,-2],[5,0],[4,0],[4,1],[4,2],[2,2],[5,5],[4,12],[-1,8],[-8,23],[0,6],[10,38],[16,39],[4,6],[3,4],[37,21],[40,19],[18,20],[37,52],[10,24],[6,21],[1,9],[1,3],[4,11],[1,13],[-1,9]],[[3548,5305],[53,-16],[10,0],[26,1],[5,-1],[5,-1],[7,-3],[5,-1],[7,1],[4,2],[6,4],[3,2],[7,0],[9,-2],[18,-5],[18,-4],[15,3],[9,0],[41,-4],[8,0],[7,1],[7,3],[3,1],[9,1],[4,1],[15,-1],[14,-3],[39,-14],[5,-1],[10,-1],[7,-3],[5,-3],[3,-7],[1,-5],[3,-5],[2,-2],[6,-3]],[[3944,5240],[23,-22],[4,-6],[3,-4],[15,-10],[3,-4],[-5,-8],[-1,-5],[3,-2],[4,-1],[4,-2],[3,-2],[2,-2],[1,-7],[4,-7],[5,-7],[5,-4],[5,-1],[10,5],[5,0],[2,-3],[2,-8],[1,-3],[11,-7],[4,-2],[6,0],[10,5],[4,0],[4,-7],[-3,-7],[-4,-8],[-2,-10],[5,0],[4,4],[3,-1],[2,-2],[4,-1],[-1,-2],[6,-3],[6,-4],[2,0],[0,-4],[-1,-12],[3,-2],[7,0],[5,-1],[3,-3],[3,-5],[1,3],[2,3],[1,3],[1,4],[5,0],[3,-4],[1,-6],[2,-24],[3,-3],[5,1],[34,0],[5,-2],[11,-10],[4,-2],[7,-6],[9,-28],[4,-7],[9,-4],[9,-10],[8,-14],[2,-13],[9,2],[8,-3],[8,-5],[10,-3],[-3,-6],[-1,-4],[1,-4],[3,-4],[0,-4],[-16,4],[1,-5],[15,-13],[8,-22],[8,-7],[14,6],[13,-8],[-2,-6],[-9,-5],[-9,-4]],[[1141,4547],[-1,3],[-3,7],[0,4],[0,3],[1,4],[2,3],[4,1],[8,2],[19,2],[11,-1],[8,1],[6,3],[8,2],[48,2],[18,-1],[31,-9],[54,-6],[31,-7],[6,-1],[25,1],[8,-1],[8,-1],[46,-14],[17,-3],[6,0],[6,0],[7,2],[6,2],[5,3],[1,2],[0,2],[-2,3],[-6,3],[-18,2],[-10,2],[-8,4],[-17,13],[-4,6],[-3,4],[-11,6],[-3,6],[-4,7],[-16,9],[-5,4],[-4,4],[-4,3],[-4,2],[-5,3],[-3,4],[5,24],[0,12]],[[1405,4673],[11,3],[5,3],[4,6],[1,8],[-6,20],[1,16],[24,22],[103,66],[19,10],[7,4],[10,8],[17,21],[7,7],[29,15],[58,45],[22,29],[9,24],[14,21],[5,5],[5,7],[2,7],[0,8],[-1,6],[-5,9],[-1,4],[-4,14],[-3,7],[-4,5],[-2,3],[-3,2],[-8,2],[-3,2],[-3,2],[-2,3],[-5,13],[-2,8],[-1,7],[-1,17],[2,5],[3,5],[19,15],[2,3],[3,4],[2,8],[1,10],[1,5],[4,5],[8,6],[18,11],[4,4],[5,6],[6,14],[2,7],[0,6],[-3,6],[-2,7],[0,4],[0,4],[2,4],[3,5],[5,6],[4,4],[17,13],[3,1],[3,1],[4,-3],[4,-1],[3,0],[12,13],[32,39],[3,6],[7,9],[8,8],[16,10],[27,20],[12,1],[2,-1],[3,-3],[1,-3],[2,-3],[2,-2],[4,-1],[4,0],[3,2],[4,2],[3,3],[6,10],[4,11],[3,6],[3,3],[4,3],[7,1],[4,-1],[4,0],[6,1],[7,2],[12,7],[12,5],[15,3],[13,4],[4,3],[4,5],[4,27],[5,10],[15,20]],[[2104,5517],[8,8],[8,11],[12,10],[39,14],[12,2],[22,-2],[36,-3],[40,2],[17,3],[6,0],[8,-2],[12,-4],[16,-3],[23,-1]],[[1405,4673],[-6,19],[-3,8],[-4,3],[-2,2],[-2,2],[-13,7],[-3,2],[-2,2],[-1,4],[0,5],[13,21],[5,14],[1,8],[-1,36],[-3,18],[-6,9],[-1,3],[1,9],[15,18],[2,9],[-1,3],[-7,11],[-60,35],[-19,1],[-5,-1],[-11,2],[-5,-1],[-7,-2],[-5,0],[-7,3],[-8,0],[-5,-1],[-3,-2],[-3,-2],[-3,-2],[-3,-2],[-6,1],[-7,3],[-17,14],[-7,7],[-31,44],[-3,3],[-16,10],[-7,3],[-15,1],[-30,-3],[-4,2],[0,2],[-1,3],[0,3],[2,11],[5,14],[2,5],[19,20],[10,15],[3,5],[11,5],[5,4],[2,3],[6,19],[-14,37],[38,43],[4,6],[1,8],[-2,12],[-1,1],[-1,2],[-13,15],[-2,3],[-1,3],[-2,20],[-1,4],[-2,3],[-3,4],[-6,3],[-4,3],[-90,14]],[[1065,5289],[6,6],[9,4],[10,2],[7,2],[7,3],[8,6],[9,7],[2,3],[3,2],[4,2],[6,2],[11,2],[7,-1],[5,-1],[4,-1],[3,-2],[2,-2],[2,-3],[1,-4],[1,-3],[-1,-4],[-1,-3],[-4,-6],[-1,-3],[1,-3],[4,0],[7,1],[12,4],[7,2],[6,0],[5,-1],[4,-1],[3,-2],[6,-4],[3,-1],[3,0],[4,4],[10,33],[2,3],[9,13],[14,15],[46,35],[196,129],[21,20],[15,12],[12,5],[12,7],[16,9],[12,2],[6,-5],[7,-7],[5,-8],[1,-7],[4,-8],[5,-2],[10,4],[12,8],[7,15],[2,18],[0,9],[2,10],[0,16],[-3,10],[-11,9],[-15,11],[-7,5],[-11,9],[-9,5]],[[1600,5671],[9,30],[14,9],[19,22],[7,6],[7,2],[19,3],[5,2],[5,3],[6,2],[6,2],[11,3],[7,9],[3,7]],[[1718,5771],[8,4],[11,6],[13,2],[11,-1],[12,-1],[8,-1],[7,-6],[15,-12],[11,-7],[8,-7],[4,-12],[10,-38],[4,-14],[2,-11],[5,-10],[15,-24],[6,-7],[26,-15],[7,-3],[4,-1],[4,-1],[8,-5],[9,-16],[7,-3],[3,-1],[11,2],[12,-7],[5,-6],[2,-11],[6,-13],[4,-7],[4,-4],[6,-4],[5,-1],[8,1],[24,10],[25,19],[4,2],[7,3],[7,2],[5,0],[4,-1],[2,-2],[4,-12],[8,-3],[3,0],[4,-2],[3,-3],[1,-4],[-2,-8],[0,-11],[6,-10]],[[733,4489],[-14,4],[-27,18],[-20,29],[-2,16],[4,13],[6,14],[3,14],[-2,13],[-10,26],[-2,14],[6,69],[15,41],[2,11],[-2,29],[-3,12],[-5,7],[-16,16],[-3,6],[2,8],[7,4],[8,3],[8,3],[11,8],[9,9],[6,11],[3,13],[8,12],[14,1],[15,-2],[13,0],[12,15],[-2,26],[-15,45],[-25,41],[-4,15],[1,11],[6,21],[2,11],[-2,11],[-5,12],[-7,10],[-9,8]],[[719,5137],[4,4],[5,5],[1,8],[0,4],[1,3],[2,3],[7,8],[2,2],[3,0],[6,-4],[3,0],[12,14],[1,3],[2,4],[0,3],[1,12],[2,3],[2,3],[2,1],[4,4],[14,12],[10,6],[15,7],[3,1],[4,1],[6,-2],[4,-3],[3,-6],[1,-5],[0,-18],[1,-7],[4,-11],[3,-24],[-2,-16],[1,-4],[5,0],[7,1],[34,28],[1,5],[2,2],[2,3],[6,0],[22,-2],[4,1],[10,4],[18,10],[4,2],[5,1],[4,1],[14,-1],[5,1],[5,2],[5,4],[8,10],[12,10],[4,1],[2,1],[4,4],[36,53]],[[2473,5833],[-16,-39],[-7,-11],[-3,-2],[-13,-11],[-14,-24],[-19,-17],[-3,-6],[-2,-5],[1,-3],[3,-3],[3,-1],[4,-1],[8,0],[4,-1],[7,-3],[4,0],[4,0],[3,1],[13,7],[4,-10],[-2,-62],[-13,-29],[-6,-9],[-11,-11],[-3,-6],[-5,-19],[-3,-5],[-5,-3],[-19,-1],[-4,0],[-9,-3],[-11,-4]],[[1718,5771],[2,5],[0,12],[-13,37],[-4,56],[-3,12],[-4,9],[-2,6],[1,8],[3,5],[15,17],[-1,9],[3,10]],[[1715,5957],[1,0],[11,-1],[25,-5],[5,0],[3,1],[18,3],[5,-1],[4,-1],[4,-5],[3,-2],[4,0],[16,3],[4,1],[5,-1],[7,-2],[4,-1],[4,-1],[4,-1],[13,1],[5,0],[5,0],[6,2],[6,4],[19,20],[17,26],[3,3],[5,3],[15,2],[4,2],[1,3],[-1,3],[-2,3],[-1,2],[-1,2],[1,3],[15,27],[2,3],[4,2],[5,0],[4,-2],[4,-5],[4,-3],[3,-3],[8,1],[9,4],[6,9],[13,7],[11,10],[4,13],[0,19],[-18,43]],[[2011,6148],[-1,34],[18,31],[10,13],[11,6],[12,3],[9,0],[11,-4],[2,-7],[1,-14],[0,-6],[10,-11],[13,-22],[10,-8],[14,-2],[15,-10],[17,-9],[7,0],[11,7],[13,6],[7,4],[28,4],[10,-1],[5,-5],[8,-16],[3,-6],[11,-3],[26,-5],[11,-18],[5,-8],[8,-5],[12,6],[2,3],[3,2],[4,2],[4,0],[3,-2],[8,-8],[2,-2],[2,-2],[18,-22],[5,-5],[5,-2],[5,0],[27,-1],[7,-1],[5,-2],[4,-2],[2,-2],[3,-2],[4,-5],[4,-6],[28,-19],[9,-8],[2,-3],[2,-4],[2,-6],[-1,-3],[-2,-3],[-11,-8],[-4,-2],[-3,-1],[-4,0],[-12,2],[-4,0],[-4,-1],[-5,-3],[-3,-2],[-25,-15],[-4,-3],[-5,-5],[-2,-4],[-1,-5],[1,-4],[0,-4],[12,-38],[6,-16],[7,-5],[24,-8],[4,-3],[3,-3],[18,-38]],[[2013,6413],[-5,-5],[-8,-12],[-6,-11],[-8,-15],[-3,-14],[-4,-8],[-5,-8],[-11,-9],[-73,-39],[-17,-15],[-7,-20],[2,-17],[12,-17],[23,-23],[25,-15],[21,-8],[36,-22],[11,-5],[15,-2]],[[1715,5957],[10,37],[0,31],[5,4],[4,4],[1,6],[0,2],[-5,11],[-9,11],[-13,10],[-10,13],[-3,16],[7,1],[6,3],[2,5],[-2,6],[-13,13],[-14,18],[-39,44],[-16,9],[-17,-3],[-16,59],[-13,30],[-16,25],[-28,25],[-17,11],[-26,9],[-7,11],[-8,26],[-6,9],[-16,16],[-6,20],[-7,11],[-16,16],[-8,7],[-4,5],[-3,7],[-1,6],[5,11],[4,34],[-2,8],[-11,9],[-34,20],[-11,13],[0,17],[3,5],[26,19],[2,1],[-4,2],[-20,30],[-2,7],[1,9],[4,17],[0,10],[-2,8],[-5,5],[-13,10],[-8,11],[-5,5],[-7,2],[0,4],[54,3],[23,-2],[24,-9],[8,15],[-4,13],[-7,12],[-3,10],[5,10],[18,11],[7,10],[-19,0],[-7,1],[-8,4],[-8,5],[-14,14],[-9,4],[32,10],[29,3],[61,0],[31,4],[8,4]],[[719,5137],[-7,3],[-7,2],[-8,2],[-8,7],[-18,17],[-14,14],[-15,14],[-14,14],[-15,14],[-14,14],[-15,14],[-14,14],[-15,14],[-13,13],[-15,22],[-8,27],[-8,29],[-9,29],[-8,29],[-9,29],[-8,29],[-8,29],[-9,29],[-8,29],[-4,13],[-13,13],[11,15],[-4,7],[-12,7],[-14,12],[-6,-6],[-5,1],[-7,2],[-8,0],[-9,-3],[-6,-2],[-25,-15],[-15,-5],[-14,3],[-13,16],[-4,14],[2,28],[-3,17],[-2,3],[-7,6],[-3,3],[0,3],[3,5],[1,3],[-10,24],[-4,5],[-17,-1],[-32,-26],[-17,-9],[-18,-5],[-13,-7],[-26,-21],[-26,-12],[-31,-4],[-81,-2],[-10,0],[-10,6],[0,14],[9,13],[27,17],[13,11],[9,13],[26,57],[59,78],[14,29],[11,9],[29,17],[12,11],[8,12],[18,45],[41,56],[23,42],[6,17],[-3,13],[-7,12],[-5,17],[1,14],[6,26],[0,26],[39,116],[14,146],[0,13],[1,9],[0,4],[5,13],[12,13],[12,11],[10,12],[14,35],[45,47],[20,29],[36,91],[17,29],[19,20],[32,20],[14,12],[13,16],[25,55],[6,8],[14,13],[6,7],[2,7],[1,12],[3,6],[13,8],[16,2],[32,2],[40,13],[15,3],[15,-1],[27,-7],[13,3],[8,9],[22,36],[22,36],[22,37],[22,36],[22,37],[21,36],[22,36],[22,37],[8,12],[13,16],[14,9],[19,4],[43,10],[43,10],[43,10],[44,10],[43,10],[43,10],[43,10],[43,10],[20,5],[29,11],[26,19],[13,6],[22,0],[-10,-16],[-2,-12],[6,-13],[-21,-2],[-5,-2],[-3,-5],[-1,-6],[-1,-5],[-7,-2],[-17,-3],[-42,-19],[-29,-8],[-124,-17],[-138,-38],[-28,-4],[-18,-6],[-17,-7],[-9,-7],[-8,-24],[1,-29],[22,-87],[61,-109],[45,-56],[19,-17],[86,-43],[11,-9],[9,-9],[1,-9],[-6,-2],[-34,-7],[3,11],[-5,8],[-11,6],[-20,4],[-8,2],[-7,1],[-3,-2],[-2,-3],[-4,-4],[-9,-5],[7,-7],[26,-22],[6,-9],[0,-8],[-3,-8],[0,-10],[7,-26],[12,-28],[15,-23],[17,-21],[24,-18],[31,-15],[-8,-15],[-6,-26],[-11,-14],[3,-6],[2,-6],[-2,-8],[-3,-7],[3,-11],[-6,-13],[-8,-15],[-5,-14],[2,-36],[1,-4],[-1,-2],[-7,-6],[-5,-2],[-20,-6],[-16,-16],[-2,-3],[-12,-3],[-12,-6],[-19,-14],[-18,-19],[-42,-71],[-41,-48],[-4,-16],[-11,-6],[-30,-8],[-12,-8],[-9,-11],[-7,-14],[-7,-28],[-17,-27],[-15,-37],[-48,-49],[-11,-20],[2,-9],[14,-26],[9,-12],[50,-46],[17,-20],[39,-76],[-13,7],[-7,12],[-4,14],[-6,13],[-6,-4],[2,-3],[2,-2],[2,-5],[-7,-1],[-3,-2],[-2,-2],[-3,-4],[10,-4],[12,-9],[9,-12],[4,-13],[-5,-13],[-12,-1],[-14,7],[-9,9],[-4,-12],[7,-13],[11,-16],[11,7],[17,13],[15,7],[8,-13],[5,0],[0,13],[8,-5],[20,-20],[7,-4],[7,-2],[7,-2],[6,-7],[-22,3],[-19,-7],[-10,-14],[6,-19],[8,23],[2,5],[43,0],[19,-11],[17,-19],[18,-11],[19,13],[-2,-11],[-2,-3],[7,-5],[2,-5],[-4,-3],[-11,0],[0,-5],[9,-7],[1,-12],[-4,-12],[-6,-10],[-7,6],[-15,-10],[-28,-23],[7,-5],[8,5],[8,4],[7,-9],[6,3],[4,2],[3,3],[2,6],[8,-6],[-3,-7],[-1,-8],[11,-6],[-14,-2],[1,-9],[13,-17],[-17,-17],[-3,-5],[2,-8],[6,-2],[5,-2],[3,-4],[4,-1],[9,-4],[7,-4],[-3,-3],[-1,-2],[7,-6],[17,-10],[29,-8],[33,-5],[32,-1],[32,5],[106,30],[72,27],[24,14],[15,16],[1,5]],[[4126,6096],[0,-19],[3,-8],[1,-3],[19,-48],[2,-11],[-1,-7],[-4,0],[-7,-1],[-4,-1],[-3,-2],[-26,-22],[-6,-4],[-17,-7],[-5,-1],[-4,0],[-5,0],[-4,1],[-3,1],[-4,2],[-3,1],[-3,1],[-4,-1],[-3,-2],[-12,-9],[-8,-8],[-3,-5],[-2,-5],[3,-11],[-2,-3],[-2,-2],[-11,-5],[-5,-2],[-5,-5],[-1,-3],[2,-2],[4,-1],[3,-1],[3,-11],[1,-3],[3,-2],[3,-2],[3,-1],[2,-2],[1,-4],[1,-2],[7,-19],[2,-7],[0,-5],[0,-28],[-2,-19],[-4,-13],[-11,-21],[-1,-6],[-1,-5],[2,-3],[24,-29],[27,-53],[12,-65],[0,-8],[-8,-23],[-7,-15],[-21,-32],[-4,-5],[-3,-3],[-10,-5],[-2,-2],[-8,-7],[-7,-4],[-4,-3],[-6,-6],[-3,-5],[-2,-6],[-5,-30],[-12,-14],[-15,-55],[0,-9],[1,-5],[2,-2],[2,-5],[1,-5],[1,-19],[4,-13],[0,-5],[-1,-3],[-8,-21],[-2,-7],[0,-5],[1,-4],[2,-3],[6,-7],[1,-2],[2,-3],[1,-6],[0,-5],[-2,-3],[-1,-1],[-3,-1],[-7,-1],[-3,-1],[-5,-8],[-9,4]],[[3548,5305],[-42,22],[-12,9],[-5,8],[-6,6],[-5,3],[-7,2],[-3,2],[-1,4],[0,4],[-1,5],[-2,7],[-7,11],[-5,5],[-4,4],[-6,3],[-4,1],[-11,2],[-8,3],[-1,3],[2,2],[7,2],[29,6],[7,3],[4,1],[3,0],[3,-2],[3,-2],[3,-1],[3,-1],[3,1],[6,4],[3,1],[8,3],[3,2],[2,2],[3,6],[3,3],[2,2],[6,1],[15,2],[3,2],[3,3],[0,3],[-1,3],[-3,2],[-3,2],[-7,3],[-8,2],[-5,2],[-13,13],[-10,22],[-1,10],[1,6],[3,10],[11,40],[18,98],[2,15],[-1,16],[-4,13],[-13,14],[-10,8],[-15,10],[-15,8],[-26,15],[-24,19],[-15,13],[-9,8],[-11,9],[-17,12],[-18,4],[-12,4],[-8,6],[-11,33],[-8,5],[-5,8],[-3,12],[-1,19],[-6,11],[-16,25],[-6,24],[-14,22],[-3,16],[-2,5],[-10,7],[-3,5],[0,6],[9,21],[-1,8]],[[3248,6066],[0,1],[0,6],[0,8],[3,35]],[[3251,6116],[68,-4],[19,1],[3,2],[2,3],[2,2],[1,5],[6,10],[11,12],[3,5],[2,7],[0,7],[3,11],[4,5],[3,3],[9,2],[32,2],[4,0],[12,-4],[14,3],[5,0],[4,0],[5,-1],[6,1],[9,2],[5,3],[4,3],[4,8],[3,5],[7,6],[6,3],[5,1],[24,-2],[3,-1],[3,-2],[1,-2],[1,-1],[0,-1],[0,-3],[-4,-10],[-1,-4],[0,-4],[0,-3],[1,-4],[2,-3],[2,-3],[2,-2],[3,-2],[3,-2],[8,-3],[16,-4],[3,-1],[3,-2],[0,-2],[-2,-2],[-2,-2],[-3,-2],[-3,-2],[-1,-3],[2,-2],[7,-3],[6,0],[5,0],[9,3],[12,6],[60,40],[26,13]],[[3698,6204],[23,9],[8,7],[8,19],[11,18],[13,9],[20,23],[6,5],[6,2],[3,-1],[3,-2],[1,-3],[6,-18],[3,-6],[11,-13],[-29,-18],[-7,-10],[0,-4],[1,-5],[2,-5],[6,-9],[9,-9],[9,-7],[54,-31],[3,-2],[6,-6],[7,-5],[7,-3],[11,-8],[12,-11],[7,-4],[5,-1],[15,9],[15,5],[16,8],[2,0],[3,0],[5,-1],[1,-3],[1,-3],[-2,-2],[-9,-7],[-1,-3],[0,-4],[3,-8],[4,-2],[4,-3],[7,-2],[31,-6],[41,-2],[10,0],[26,4],[31,1]],[[4067,6517],[-3,-7],[-1,-9],[-1,-27],[1,-11],[11,-15],[30,-23],[4,-1],[4,0],[3,0],[4,1],[3,2],[9,6],[6,4],[4,1],[4,1],[4,0],[5,0],[4,-1],[18,-7],[4,-1],[5,0],[13,1],[4,0],[4,-1],[3,-2],[3,-2],[3,-2],[9,-10],[2,-4],[0,-6],[-2,-11],[-3,-6],[-2,-4],[-4,-6],[-1,-4],[0,-6],[11,-83],[0,-4],[-1,-5],[-3,-5],[-3,-4],[-3,-3],[-12,-7],[-2,-3],[-1,-4],[1,-10],[-1,-5],[-1,-3],[0,-4],[2,-2],[5,0],[14,8],[54,-21],[4,0],[3,-1],[4,0],[6,1],[9,-5],[14,-28]],[[4314,6179],[6,-22],[-2,-8],[-3,-1],[-3,1],[-2,2],[-5,5],[-3,2],[-5,0],[-7,-2],[-4,-3],[-2,-4],[-1,-3],[-5,-12],[-6,-12],[-5,-4],[-3,-1],[-8,7],[-3,1],[-4,1],[-4,0],[-3,-2],[-13,-6],[-23,-10],[-7,-1],[-7,-1],[-3,2],[-3,2],[-1,3],[1,3],[1,3],[3,7],[1,2],[0,3],[-2,2],[-4,2],[-13,2],[-4,1],[-3,2],[-3,2],[-4,5],[-8,11],[-2,2],[-4,2],[-6,2],[-9,2],[-6,0],[-4,-1],[-6,-4],[-5,-5],[5,-30],[4,-13],[9,-17]],[[3698,6204],[-15,11],[-4,8],[-3,15],[-2,9],[-3,5],[-4,4],[-2,4],[0,4],[2,12],[-8,50],[1,7],[2,3],[26,31],[10,10],[6,7],[-23,65],[3,90],[3,11],[6,13],[5,8],[3,2],[3,2],[3,2],[4,1],[4,0],[4,0],[4,-1],[13,-7],[3,-1],[4,1],[13,6],[7,6],[20,23],[2,1]],[[3785,6606],[7,-11],[24,-27],[29,-22],[30,-11],[91,0],[13,-2],[17,-7],[18,-5],[12,2],[11,5],[13,2],[9,0],[5,-3],[3,-4],[0,-6]],[[3319,6649],[0,-9],[-1,-16],[-1,-4],[-4,-6],[-6,-6],[-35,-22],[-11,-5],[-9,-3],[-16,4],[-2,0],[-4,1],[-3,-1],[-8,-3],[-4,-4],[-4,-7],[-9,-25],[-2,-11],[-1,-4],[-4,-3],[-10,-3],[-2,-5],[-2,-15],[1,-5],[2,-4],[6,-4],[5,-1],[4,1],[10,4],[3,1],[2,-2],[1,-4],[-5,-33],[1,-7],[2,-9],[11,-32],[1,-23],[-2,-8],[-10,-4],[-5,-6],[-1,-2],[-4,-1],[-4,2],[-5,0],[-9,0],[-7,-2],[-31,-17],[-4,-4],[-2,-4],[-1,-8],[-2,-7],[-2,-3],[-4,-6],[-4,-5],[-8,-7],[-3,-4],[-2,-2],[-4,-1],[-6,1],[-5,3],[-13,18],[-14,8],[-6,-4],[-5,-5],[-1,-2],[-1,-3],[-1,-2],[0,-3],[1,-9],[1,-3],[6,-10],[12,-15],[2,-3],[4,-6],[23,-20],[18,-20],[4,-5],[2,-4],[1,-4],[0,-3],[-3,-30],[1,-4],[1,-3],[1,-4],[2,-2],[5,-5],[10,-9],[2,-3],[2,-3],[2,-6],[1,-2],[2,-2],[3,-2],[6,-1],[4,3],[4,4],[4,10],[2,5],[0,6],[-2,17],[0,6],[1,4],[14,10],[55,24],[15,-6],[5,-12],[13,-24],[5,-5],[2,-2],[0,-3],[-21,-18],[-7,-10],[-11,-21]],[[3248,6066],[-24,-21],[-3,-2],[-19,-5],[-3,-3],[-2,-4],[-1,-4],[-2,-3],[-2,-2],[-3,-2],[-4,-2],[-43,-11],[-36,-4],[-28,2],[-8,1],[-6,3],[-7,5],[-12,11],[-5,6],[-3,5],[0,5],[2,7],[3,7],[0,4],[0,7],[-4,15],[-2,24],[-2,3],[-5,0],[-4,-4],[-5,-5],[-15,-26],[-19,-16],[-17,-48],[-4,-12],[-9,-13],[-19,-12],[-20,-6],[-38,-2],[-37,-3],[-22,-2],[-22,-2],[-9,-8],[-7,-8],[-8,-17],[1,-8],[1,-8],[4,-10],[1,-4],[0,-8],[-1,-3],[-10,-23],[0,-6],[0,-5],[2,-3],[1,-3],[0,-5],[0,-4],[-1,-4],[-12,-8],[-46,-12],[-11,6],[-2,8],[0,4],[-1,3],[-2,3],[-4,0],[-4,-2],[-7,-4],[-11,-4],[-65,-3],[-5,0],[-7,1],[-3,5],[-1,4],[1,3],[10,19],[6,8],[5,5],[13,16],[26,23],[1,3],[2,3],[-1,4],[-1,3],[-3,2],[-5,1],[-8,-1],[-5,1],[-5,1],[-8,2],[-4,0],[-7,-2],[-24,-8],[-7,-1],[-5,1],[-4,2],[-2,3],[-5,4],[-6,4],[-3,1],[-6,-2],[-7,-4],[-46,-45],[-2,-4],[-3,-6],[-4,-20],[-4,-9],[-7,-5]],[[3769,6632],[16,-26]],[[6440,2364],[-10,13],[-28,24],[-34,16],[-34,-2],[-10,-9],[-6,-12],[-2,-15],[2,-14],[9,-14],[13,-8],[15,-5],[16,-8],[10,-11],[6,-12],[9,-26],[33,-57],[14,-16],[35,-25],[16,-14],[32,-41],[71,-50],[29,-14],[35,-12],[17,-10],[43,-47],[32,-24],[15,-15],[5,-16],[0,-25],[-2,-11],[-5,-12],[-20,-24],[-7,-12],[-3,-16],[19,-84],[3,-28],[-7,-57],[2,-27],[13,-23],[23,-25],[27,-43],[23,-27],[57,-99],[12,-36],[8,-12],[3,-7],[0,-6],[-5,-17],[-3,-38],[-3,-13],[-28,-46],[-6,-16],[1,-14],[7,-12],[11,-5],[16,3],[43,-4],[89,-22],[48,0],[46,6],[96,-2],[46,-7],[93,-2],[15,-5],[3,-9],[-8,-23],[-1,-11],[2,-45],[-2,-10],[-10,-20],[-11,-21],[-2,-11],[1,-12],[-7,-14],[-23,-8],[-50,-8],[-7,0],[-21,2],[-9,-1],[-41,-17],[-107,-76],[-15,-7],[-14,-2],[-88,1],[-27,-2],[-27,-9],[-31,-20],[-12,-22],[-5,-58],[-12,-41],[3,-40],[-3,-13],[-4,-12],[-8,-17],[-13,-16],[-15,-13],[-34,-18],[-41,-36],[-51,-33],[-15,-15],[-14,-27],[-9,-12],[-13,-5],[-14,7],[-4,15],[3,17],[4,13],[16,27],[-1,13],[-16,9],[-16,-2],[-18,-9],[-31,-21],[-39,-18],[-17,-10],[-14,-16],[-15,-31],[-10,-12],[-93,-56],[-15,-2],[-15,2],[-37,16],[-13,0],[-12,-8],[-16,-16],[-15,-10],[-13,-3],[-13,-2],[-17,-4],[-8,-4],[-24,-19],[-3,-2],[-7,-2],[-3,-2],[-2,-3],[-1,-9],[-1,-3],[-27,-5],[-31,2],[-26,-6],[-18,-31],[-6,-55],[-7,-28],[-18,-21],[-15,-6],[-15,-1],[-30,4],[-19,0],[-13,-6],[-45,-49],[-8,-13],[-7,-16],[-1,-6],[1,-19],[-3,-9],[-14,-13],[-14,-21],[-16,-12],[-18,-9],[-16,-5],[-17,-1],[-13,4],[-11,10],[-8,14],[-1,32],[18,25],[22,26],[12,31],[-1,16],[-5,14],[-8,13],[-18,20],[-8,7],[-9,6],[-10,4],[-8,1],[-16,-2],[-53,2],[-15,-2],[-18,-5],[-29,-17],[-64,-27],[-14,-8],[-17,-14],[-28,-31],[-16,-14],[-15,-8],[-14,-4],[-32,-2],[-16,-6],[-24,-24],[-17,-7],[-16,2],[-13,6],[-11,8],[-15,6],[-14,-1],[-42,-11],[-45,9],[-45,28],[-31,26],[-14,11],[-35,28],[-50,41],[-58,47],[-57,46],[-51,41],[-35,29],[-14,11],[-15,28],[-4,16],[14,24],[-1,16],[-5,17],[-8,13],[-8,7],[-8,6],[-7,7],[-3,9],[5,27],[-3,15],[-7,14],[-15,24],[-8,14],[-2,13],[0,30],[-3,14],[-63,152],[-13,22],[-2,8],[-3,5],[-14,8],[-6,9],[-5,5],[-5,7],[-2,8],[12,14],[3,5],[2,12],[-2,36],[-5,10],[-11,6],[-13,3],[-11,6],[-7,9],[-12,28],[-5,21],[-12,25],[0,12],[8,9],[15,12],[9,14],[-4,13],[-4,6],[-1,13],[-2,6],[-6,5],[-25,14],[-26,7],[-7,4],[-14,13],[-8,5],[-8,2],[-6,3],[-5,8],[-3,9],[-4,7],[-6,6],[-17,7],[-7,5],[-4,7],[-4,8],[-6,6],[-9,2],[-3,3],[-11,13],[-3,5],[-3,4],[-16,7],[-6,5],[-4,5],[-4,12],[-3,6],[-11,9],[-14,4],[-33,0],[-9,6],[-4,15],[-4,30],[-5,12],[-11,15],[-13,9],[-14,-3],[-15,-5],[-18,4],[-31,13],[-8,8],[-6,3],[-14,-7],[-8,-1],[-16,1],[-15,-3],[-7,-8],[-6,-10],[-11,-7],[0,45],[13,19],[18,15],[32,26],[31,27],[32,26],[31,26],[32,27],[31,26],[32,26],[32,27],[13,11],[9,4],[16,3],[8,2],[9,6],[44,51],[19,27],[4,28],[-24,23],[-28,10],[-11,7],[-10,12],[-50,117],[-21,25],[-27,12],[-16,-1],[-13,-2],[-14,0],[-14,6],[-13,14],[-5,16],[-4,33],[-7,16],[-30,46],[-3,14],[-2,42],[-7,15],[-5,3],[2,11],[-4,12],[-9,8],[-6,21],[-14,14],[-13,10],[-7,13],[-3,20],[-6,21],[-4,22],[3,25],[13,22],[2,8],[-2,8],[-10,15],[-3,9],[1,5],[5,9],[-1,6],[-3,4],[-9,2],[-3,3],[-6,23],[-5,9],[-14,9],[0,-5],[-7,4],[-6,6],[-5,6],[-2,7],[1,10],[4,4],[5,3],[5,6],[1,6],[-1,21],[4,18],[3,37],[3,14],[8,11],[5,11],[2,29],[5,12],[-4,6],[2,4],[2,5],[0,8],[-2,4],[-6,12],[-2,5],[1,15],[5,26],[9,25],[1,13],[-1,30],[2,3],[3,3],[4,5],[1,7],[-2,4],[-14,14],[-4,7],[-3,6],[-1,7],[-1,7],[0,7],[2,8],[7,16],[1,6],[-1,16],[-3,11],[-4,10],[-7,11],[-7,25],[7,28],[18,26],[27,21],[4,1],[8,-2],[3,1],[4,3],[8,8],[3,3],[22,7],[6,4],[14,13],[8,5],[9,2],[4,4],[8,24],[4,5],[6,4],[4,6],[2,8],[-3,3],[-11,9],[-2,3],[-1,14],[-9,39],[0,30],[6,29],[12,26],[18,24],[43,37],[7,11],[35,34],[11,6],[26,10],[9,7],[3,11],[-2,15],[-5,14],[-19,12],[-27,38],[-1,26],[4,9],[8,8],[14,9]],[[4371,3682],[23,-14],[7,-8],[7,-16],[2,-3],[3,-2],[3,-2],[3,-2],[5,-1],[8,-1],[5,1],[4,1],[6,4],[10,9],[3,2],[3,1],[5,-1],[4,-2],[14,-12],[4,-2],[5,-2],[10,-3],[12,-2],[10,0],[22,3],[10,0],[4,-1],[5,-1],[4,-3],[4,-5],[7,-10],[3,-6],[11,-43],[1,-10],[3,-14],[0,-27],[-1,-8],[-2,-7],[-39,-86],[-4,-24],[0,-4],[0,-4],[2,-7],[2,-3],[1,-3],[4,-3],[6,-2],[11,-1],[7,1],[5,1],[11,3],[17,3],[18,2],[6,-2],[6,-2],[9,-5],[4,-4],[3,-4],[3,-7],[5,-22],[2,-7],[4,-5],[2,-3],[3,-2],[4,-2],[5,-1],[12,-1],[5,0],[12,2],[4,1],[14,6],[51,26],[7,3],[42,12],[8,1],[82,2],[16,4],[30,9],[23,5],[36,11],[7,3],[6,4],[50,46],[89,66],[4,2],[4,0],[6,-2],[7,-4],[10,-11],[4,-6],[2,-6],[15,-66],[3,-7],[13,-20],[3,-3],[4,-2],[8,-2],[5,0],[5,1],[18,6],[13,6],[9,6],[11,8],[9,6],[7,2],[4,1],[4,0],[58,-3],[9,1],[25,10],[6,3],[2,3],[2,2],[2,3],[2,4],[2,7],[3,16],[4,6],[4,5],[72,111],[11,27],[6,9],[3,6],[1,4],[2,2],[33,18],[3,1],[4,1],[9,1],[49,0],[26,3],[19,1],[5,-1],[4,-1],[5,-3],[13,-8],[5,-4],[3,-6],[2,-5],[1,-6],[1,-10],[0,-7],[-1,-5],[-3,-7],[-1,-8],[0,-3],[0,-4],[-4,-10],[-2,-10],[-3,-6],[-6,-32],[-2,-3],[-2,-4],[-6,-8],[-5,-9],[-7,-24],[-1,-11],[1,-43],[2,-7],[19,-42],[3,-4],[3,-5],[8,-6],[6,-2],[5,-2],[9,1],[8,2],[7,3],[3,2],[25,22],[16,18],[6,4],[3,2],[3,2],[4,1],[17,2],[127,-1],[17,-3],[4,-1],[4,-2],[3,-2],[2,-2],[2,-5],[0,-5],[-1,-11],[-2,-5],[-3,-4],[-2,-3],[-20,-18],[-3,-3],[-1,-4],[1,-7],[3,-11],[5,-10],[8,-11],[11,-9],[61,-41],[3,-2],[4,-6],[1,-3],[1,-5],[-1,-7],[-5,-14],[-3,-6],[-3,-4],[-19,-10],[-3,-2],[-3,-3],[-1,-3],[0,-4],[3,-5],[3,-3],[36,-24],[5,-5],[2,-3],[1,-5],[-1,-7],[-5,-15],[-3,-7],[-3,-5],[-2,-2],[-8,-7],[-10,-5],[-15,-5],[-4,-1],[-44,2],[-4,0],[-5,-1],[-3,-1],[-4,-2],[-6,-3],[-2,-3],[-2,-2],[-4,-6],[-1,-4],[-1,-4],[1,-6],[4,-9],[14,-23],[4,-5],[10,-9],[8,-7],[8,-11],[28,-95],[26,-58],[25,-35],[5,-10],[8,-12],[9,-19],[105,-115],[7,-3],[77,-15],[66,-3],[27,-4],[3,-1],[4,-2],[9,-6],[3,-2],[6,-9],[6,-10],[7,-31],[11,-87],[6,-17],[0,-6],[-1,-28],[-10,-43],[-4,-10]],[[9666,4830],[-3,-2],[-36,-22],[-16,-13],[-6,-16],[-18,-12],[-32,-2],[-63,1],[-16,-5],[-10,-9],[-15,-25],[-17,-18],[-3,-6],[-1,-6],[3,-12],[0,-7],[-12,-18],[2,-10],[-3,-9],[-7,-4],[-10,1],[-5,-3],[-7,-9],[-11,-17],[-11,-13],[-34,-9],[-10,-18],[1,-10],[4,-9],[17,-28],[9,-4],[11,-2],[10,-6],[3,-5],[0,-4],[-1,-4],[0,-6],[3,-6],[6,-3],[7,-3],[5,-3],[5,-9],[8,-18],[7,-9],[1,-6],[0,-5],[-1,-5],[-4,-5],[-18,-14],[-9,-18],[1,-20],[10,-20],[8,-7],[52,-36],[9,0],[16,26],[12,10],[16,5],[19,0],[9,-3],[8,-4],[8,-4],[10,0],[12,1],[10,0],[9,-5],[9,-8],[0,-1],[26,-13],[9,-7],[6,-11],[0,-11],[-3,-12],[-5,-11],[-8,-9],[-10,-8],[-13,-7],[-11,-8],[-6,-12],[-7,-33],[-12,7],[-20,-4],[-94,-53],[-53,-11],[-14,-5],[-12,-9],[-21,-27],[-12,-11],[-15,-5],[-11,3],[-27,16],[-15,3],[-9,-1],[-17,-3],[-7,-1],[-9,3],[-6,4],[-5,5],[-5,3],[-17,4],[-9,1],[-5,-3],[2,-8],[7,-9],[2,-6],[0,-5],[-2,-3],[-20,-19],[-4,-3],[-15,-2],[-34,4],[-13,-9],[-16,4],[-15,2],[-7,-12],[-14,4],[-16,1],[-14,-2],[-7,-8],[-23,-24],[-14,-24],[-11,-24],[-5,-23],[1,-14],[7,-6],[11,-5],[11,-10],[6,-10],[7,-19],[8,-10],[2,-6],[1,-5],[-1,-6],[-1,-5],[-7,-8],[-3,-10],[-5,-32],[1,-7],[6,-18],[4,-7],[13,-7],[3,-4],[2,-5],[3,-1],[2,-3],[2,-6],[-4,-25],[-1,-9],[-2,-11],[-8,-2],[-11,1],[-10,-1],[-10,-8],[-7,-17],[-8,-9],[-8,-4],[-13,-4],[-24,-4],[-10,-5],[-7,-9],[-9,-21],[-34,-50],[-11,-7],[-25,-13],[-8,-7],[13,-27],[24,-24],[56,-55],[55,-55],[56,-56],[56,-55],[56,-56],[56,-55],[55,-56],[57,-55],[21,-3],[20,-6],[15,-12],[48,-115],[5,-32],[-15,-32],[-50,-55],[-28,-22],[-33,-20],[-71,-28],[-7,-1],[-14,0],[-6,-2],[-5,-6],[-21,-41],[-6,-29],[-6,-13],[-22,-26],[-25,-11],[-62,-7],[-41,-11],[-13,-1],[-12,3],[-25,11],[-14,3],[-43,5],[-14,-1],[-5,-8],[20,-27],[2,-14],[-11,-10],[-19,-6],[-20,-3],[-15,-1],[-42,2],[-15,-1],[-32,-11],[-11,-18],[-4,-52],[-3,-8],[-5,-8],[-7,-7],[-7,-5],[-11,-4],[-7,0],[-7,3],[-10,1],[-8,-2],[-13,-6],[-9,-1],[-6,1],[-24,6],[-28,2],[-14,-2],[-13,-4],[-17,-9],[-38,-37],[-12,-7],[-15,-6],[-16,-5],[-14,-2],[-17,0],[-14,4],[-14,5],[-16,4],[-33,-4],[-56,-37],[-31,-9],[-29,3],[-141,52],[-32,6],[-26,-5],[-3,-4],[-2,-12],[-4,-5],[-6,-3],[-23,-4],[-16,-5],[-7,-8],[-2,-10],[0,-14],[-9,-26],[-20,-5],[-61,9],[-42,-4],[-12,-3],[-16,-9],[-4,-10],[3,-12],[1,-15],[-5,-16],[-7,-13],[-5,-14],[3,-18],[4,-8],[4,-4],[3,-4],[2,-18],[13,-25],[7,-28],[0,-27],[-7,-27],[-16,-25],[-11,-12],[-8,-5],[-8,0],[-11,1],[-6,-2],[-15,-12],[-15,-8],[-13,-3],[-13,0],[-18,2],[-14,4],[-18,9],[-16,10],[-10,11],[-11,15],[-78,83],[-46,29],[-42,53],[-26,23],[-49,25],[-29,9],[-25,-2],[-17,-20],[-5,-25],[-10,-23],[-31,-8],[-32,14],[-50,40],[-36,7],[-14,-2],[-41,-9],[-18,-1],[-15,3],[-30,11],[-32,0],[-31,-13],[-29,-19],[-29,-14],[-31,2],[-19,19],[-11,27],[-13,48],[-9,22],[-12,20],[-16,15],[-19,9],[-50,12],[-92,6],[-165,-21],[-14,5],[-9,13],[-12,30],[-8,11]],[[4371,3682],[5,4],[-1,0]],[[5200,4649],[10,0],[39,-7],[21,-1],[15,3],[30,18],[33,10],[36,0],[72,-9],[18,1],[15,5],[77,52],[35,44],[13,12],[17,9],[72,30],[37,7],[41,-7],[51,-22],[19,-4],[20,1],[47,5]],[[5918,4796],[37,4],[21,-1],[20,-4],[43,-15],[44,-3],[21,-4],[41,-19],[38,-24],[45,-36],[20,-8],[16,-18],[10,-7],[12,-4],[13,0],[14,4],[44,24],[41,16],[39,25],[11,5],[12,2],[38,-6],[13,0],[21,5],[20,12],[13,15],[-3,20],[-14,13],[-18,10],[-15,12],[-5,19],[7,30],[4,9],[10,8],[13,2],[42,-6],[12,1],[59,11],[10,6],[6,7],[8,17],[6,8],[9,6],[12,5],[13,1],[12,-1],[13,-7],[48,-41],[8,-5],[9,-4],[4,-14],[10,-6],[13,1],[14,5],[16,4],[16,-2],[31,-7],[16,0],[8,1],[7,3],[5,4],[10,10],[5,4],[9,4],[18,4],[8,4],[7,6],[3,7],[3,8],[21,40],[8,9],[12,5],[12,-2],[13,-4],[13,-1],[12,3],[11,4],[22,12],[13,6],[11,1],[11,-2],[14,-4],[15,-2],[48,2],[41,-4],[14,3],[10,7],[9,7],[14,19],[9,9],[12,6],[13,2],[38,-7],[15,7],[29,30],[16,10],[17,8],[38,11],[36,4],[37,0],[73,-7],[11,-17],[18,-9],[22,-2],[21,5],[24,13],[7,5],[6,7],[9,15],[6,6],[17,15],[11,6],[9,3],[9,0],[18,-3],[10,1],[8,2],[8,4]],[[7885,5139],[6,3],[59,38]],[[7950,5180],[72,-27],[138,-51],[48,-11],[451,-18],[-6,-33],[0,-19],[3,-15],[22,-45],[8,-10],[5,-5],[12,-8],[16,-19],[117,-118],[28,-23],[10,-7],[18,-8],[4,0],[4,1],[7,4],[7,2],[16,3],[14,2],[4,1],[13,5],[12,4],[3,1],[3,2],[11,9],[3,1],[12,3],[4,1],[18,11],[4,1],[4,1],[20,-1],[4,1],[4,0],[15,5],[4,2],[5,4],[16,13],[6,4],[3,1],[5,1],[18,2],[13,0],[7,-2],[4,-1],[8,-8],[1,-2],[3,-4],[105,-109],[5,-3],[4,0],[4,0],[10,5],[24,19],[17,18],[3,2],[16,8],[62,39],[3,2],[4,1],[12,3],[4,1],[6,3],[9,6],[3,1],[4,1],[199,3],[1,0]],[[6522,6379],[1,-2],[9,-9],[6,-9],[13,-5],[30,-11],[8,-4],[4,-6],[1,-5],[0,-5],[0,-4],[0,-4],[0,-4],[2,-3],[3,-2],[5,-2],[8,-2],[5,-3],[4,-3],[2,-4],[4,-3],[6,-4],[21,-9],[7,-2],[10,1],[15,4],[6,-1],[7,-1],[21,-12],[6,-4],[9,-3],[24,1],[45,5],[35,9],[7,2],[27,12],[8,7],[3,2],[5,1],[9,-1],[34,-9],[9,-5],[14,-16]],[[6955,6266],[-6,-4],[-20,-9],[-3,-1],[-5,0],[-8,2],[-5,0],[-18,-2],[-4,0],[-4,-2],[-3,-1],[-3,-2],[-2,-3],[-2,-3],[0,-51],[1,-5],[4,-6],[9,-8],[6,-3],[5,-1],[16,3],[6,0],[4,-1],[3,-1],[1,-3],[-2,-3],[-1,-4],[0,-3],[5,-3],[5,-2],[14,-3],[7,-3],[3,-2],[14,-14],[2,-4],[1,-3],[-1,-6],[-3,-3],[-4,-2],[-4,-1],[-4,-1],[-2,-3],[-1,-4],[1,-14],[-1,-5],[-1,-4],[-9,-11],[-2,-3],[-1,-3],[-1,-4],[1,-4],[2,-4],[5,-6],[2,-4],[1,-8],[-1,-5],[7,-13],[71,-101],[-3,-6],[-2,-2],[-2,-3],[-81,-77],[-2,-4],[1,-25],[-4,-33],[3,-7],[6,-7],[30,-25],[3,-9],[6,-28],[1,-3],[3,-1],[5,-1],[4,1],[4,1],[24,12],[3,1],[3,2],[3,2],[5,0],[5,-1],[9,-3],[5,-1],[5,1],[3,1],[10,5],[4,1],[4,1],[9,-3],[58,-34],[12,-5],[6,-1],[5,0],[4,-1],[4,-1],[4,-1],[4,-3],[5,-4],[7,-9],[7,-14],[3,-3],[7,-2],[10,-3],[14,-6],[34,-22],[4,-3],[6,-8],[6,-6],[11,-7],[19,-7],[6,-4],[4,-1],[8,-2],[4,-2],[10,-12],[24,-47],[23,-73],[1,-3],[1,-1],[3,-3],[5,-2],[9,-3],[4,-3],[4,-3],[2,-3],[8,-1],[15,-1],[216,13],[20,0],[4,-8],[-4,-6],[-5,-5],[-2,-2],[-3,-2],[-4,-1],[-4,-1],[-4,0],[-4,1],[-15,5],[-4,0],[-4,0],[-3,-2],[-3,-2],[-2,-3],[-2,-3],[-1,-4],[-1,-3],[-17,-20],[-1,-4],[2,-47],[4,-12],[6,-13],[14,-14],[13,-9],[11,-5],[181,-53],[2,-3],[-1,-3],[-2,-3],[-3,-6],[-1,-4],[0,-4],[2,-4],[4,-4],[28,-12],[7,-6],[6,-9]],[[5918,4796],[-2,6],[-6,13],[-3,4],[-4,5],[-6,4],[-3,2],[-8,2],[-9,2],[-19,0],[-18,-1],[-5,0],[-5,1],[-3,1],[-3,2],[-3,2],[-2,3],[-1,3],[-2,7],[-1,8],[0,9],[1,8],[4,11],[7,10],[10,10],[11,8],[6,4],[35,38],[10,21],[3,12],[5,9],[4,5],[47,43],[7,8],[18,32],[6,6],[32,25],[4,4],[3,5],[17,39],[5,24],[2,7],[9,16],[9,38],[0,9],[-1,7],[1,12],[-1,4],[-1,4],[-6,8],[-2,3],[-4,6],[-1,3],[0,4],[0,4],[2,8],[2,17],[1,4],[2,3],[3,4],[5,12],[3,4],[3,3],[3,2],[5,2],[18,4],[11,4],[4,2],[5,0],[5,0],[9,-3],[10,-4],[4,-2],[7,-1],[17,-2],[52,4],[11,3],[9,1],[5,0],[9,-2],[12,-3],[9,-1],[4,2],[4,5],[5,14],[1,8],[0,5],[-6,14],[1,4],[4,7],[9,11],[12,10],[20,11],[-11,20],[-3,4],[-4,4],[-8,4],[-8,5],[-8,7],[-15,14],[-13,11],[-7,4],[-3,1],[-25,7],[-2,0],[-1,2],[-2,4],[-2,7],[0,19],[-1,5],[-1,4],[-3,6],[-3,9],[-3,4],[-5,5],[-10,9],[-6,4],[-5,2],[-21,5],[-6,4],[-20,19],[-6,4],[-3,2],[-3,1],[-5,1],[-4,1],[-47,-2],[-5,1],[-4,1],[-3,1],[-3,3],[-3,3],[-14,17],[-10,10],[-11,8],[-7,8],[-5,8],[-4,3],[-5,2],[-4,1],[-3,3],[-2,3],[-2,5],[-1,18],[-1,4],[-1,3],[-9,10],[-1,2],[-1,2],[-1,3],[-1,8],[1,8],[5,6],[6,5],[37,16],[6,5],[3,6],[2,4],[1,3],[0,4],[0,4],[-1,4],[0,4],[0,8],[-1,3],[-1,4],[-1,3],[-2,3],[-5,4],[-8,4],[-13,3],[-26,5],[-37,9],[-14,5],[-14,6],[-6,4],[-2,2],[-5,6],[-32,52],[-5,-4],[-4,-3],[-34,-47],[-151,74],[-4,3],[-2,2],[1,5],[2,4],[17,18],[4,9],[4,21],[-8,17],[-16,21],[-1,3],[-3,7],[-1,18],[5,53]],[[5667,6180],[20,16],[4,1],[4,1],[6,-1],[3,-2],[3,-2],[3,-1],[4,1],[8,8],[7,4],[7,3],[20,5],[10,2],[5,3],[7,3],[18,18],[8,4],[17,5],[10,6],[4,3],[4,2],[4,2],[3,1],[4,2],[7,10],[9,30],[1,2]],[[5867,6306],[85,-13],[104,-17],[30,-14],[27,-7],[8,-2],[0,-5],[-55,16],[-15,3],[6,-10],[14,-7],[15,-5],[33,-2],[7,0],[7,3],[13,5],[22,5],[26,14],[13,6],[15,1],[41,-6],[54,-4],[28,4],[21,11],[8,9],[6,10],[9,24],[0,11],[-4,17],[4,9],[6,-6],[7,-3],[8,-1],[9,1],[-5,-7],[-3,-1],[-7,-1],[8,-9],[13,0],[8,7],[-8,7],[8,5],[19,22],[11,1],[21,7],[11,1],[-2,-5],[-1,-2],[-2,-2],[4,1],[7,1],[4,2],[5,-8],[5,1],[4,4],[3,2]],[[4545,6488],[22,-32],[5,-3],[6,-4],[1,-2],[-2,-3],[-6,-5],[-2,-3],[-1,-4],[0,-4],[0,-4],[2,-5],[6,-6],[4,-3],[4,-2],[23,-8],[6,-3],[10,-6],[4,-4],[1,-3],[0,-6],[-7,-37],[-2,-4],[-6,-8],[-3,-7],[-1,-3],[0,-5],[1,-7],[10,-22],[6,-7],[16,-12],[35,-20],[10,4],[6,4],[6,4],[3,2],[3,1],[3,0],[4,0],[7,-1],[4,-1],[11,-8],[4,-6],[1,-3],[7,-8],[7,-6],[3,-5],[3,-3],[5,-2],[10,0],[15,-3],[3,-2],[3,-1],[2,-1],[10,0],[22,8],[10,2],[22,-2],[13,-2],[8,-6],[1,-2],[4,-2],[6,-2],[22,0],[6,0],[5,0],[5,-2],[8,-4],[14,-6],[40,-4]],[[4993,6189],[20,-94],[1,-9],[0,-9],[-2,-7],[-4,-6],[-6,-4],[-7,-3],[-6,-3],[-4,-6],[0,-8],[1,-14],[3,-9],[5,-7],[5,-5],[5,-4],[19,-11],[7,-5],[6,-6],[6,-11],[2,-8],[-1,-7],[-5,-14],[-12,-26],[-3,-8],[-2,-8],[-1,-9],[2,-6],[1,-3],[6,-6],[4,-7],[1,-6],[-1,-7],[-13,-34],[-4,-5],[-3,-2],[-6,-3],[-7,-1],[-15,-1],[-42,1],[-4,1],[-6,2],[-22,11],[-14,5],[-14,4],[-28,3],[-7,1],[-16,6],[-14,7],[-7,2],[-16,2],[-59,-2],[-22,-3],[-5,0],[-3,5],[3,8],[4,8],[5,11],[1,4],[3,2],[19,10],[15,4],[22,3],[4,1],[3,2],[6,4],[7,11],[15,25],[1,3],[0,4],[-2,20],[1,13],[-1,6],[-1,2],[-5,2],[-5,0],[-9,-1],[-9,-1],[-5,1],[-4,1],[-12,7],[-4,2],[-13,2],[-18,30],[-9,9],[-4,1],[-4,1],[-7,0],[-6,1],[-9,2],[-5,3],[-3,3],[-2,4],[-4,6],[-4,2],[-5,1],[-11,1],[-21,8],[-4,9],[-2,3],[-4,4],[-15,12],[-5,6],[-3,4],[-16,32],[-4,4],[-6,6],[-23,3],[-10,-1],[-10,-3],[-11,-3],[-4,-1],[-3,-1],[-4,1],[-4,4],[-2,4],[-3,3],[-3,1],[-20,0],[-21,-3],[-15,7],[-49,34],[-4,-1],[-2,0],[-5,0],[-14,-6],[-53,-17]],[[4067,6517],[0,-3],[3,-3],[6,5],[5,7],[2,3],[22,9],[30,5],[97,7],[63,15],[60,4],[64,6]],[[4419,6572],[0,-3],[-9,-13],[-1,-3],[1,-1],[0,-1],[1,-1],[1,0],[2,-1],[0,-1],[1,0],[1,-1],[1,-1],[1,-2],[1,-1],[1,0],[1,-2],[1,-3],[9,-15],[4,-7],[8,-7],[2,-1],[11,-31],[1,-3],[5,4],[1,1],[1,0],[0,1],[1,3],[1,0],[0,1],[1,0],[2,1],[1,0],[4,1],[7,2],[1,0],[2,1],[1,1],[2,1],[2,1],[5,3],[2,1],[1,-1],[6,-1],[1,0],[2,1],[1,0],[1,0],[3,0],[3,1],[4,0],[10,1],[2,0],[2,0],[3,-3],[10,-6]],[[5213,6629],[1,-4],[2,-16],[0,-1],[0,-2],[1,-1],[0,-1],[-4,-30],[0,-1],[0,-1],[1,-1],[0,-1],[-1,-2],[-9,-5],[-21,10],[-10,-1],[-51,-3],[-2,-1],[-1,0],[-1,0],[-5,5],[-2,0],[-2,0],[-5,-2],[-4,-2],[-3,0],[-12,4],[-4,1],[-2,1],[0,1],[-1,0],[-1,1],[-4,1],[-4,1],[-1,0],[-1,1],[-2,0],[-5,1],[-3,1],[-38,1],[-1,0],[-2,0],[-3,-2],[-7,-5],[-6,-4],[-5,2],[-71,-1],[-8,4],[-3,1],[-2,0],[-54,-1],[-31,-5],[-3,1],[-9,4],[-3,1],[-3,0],[-8,-4]],[[4800,6574],[-8,1],[-3,1],[-1,0],[-3,2],[-9,2],[-4,1],[-2,0],[-1,0],[-4,-1],[-2,-1],[-3,0],[-12,-3],[-3,0],[-2,0],[0,1],[-1,0],[-2,1],[-1,1],[-5,1],[-2,0],[-3,2],[-2,0],[-2,1],[-2,0],[-1,0],[-5,2],[-4,2],[-3,2],[-2,1],[-2,2],[-1,1],[-1,0],[-1,0],[-1,0],[-2,-1],[-2,-3],[-4,-5],[-2,-3],[-1,-2],[1,-1],[3,-3],[1,-1],[0,-1],[-1,-1],[-3,-1],[-10,-4],[-6,-2],[-1,0],[-1,-1],[-1,0],[-3,-2],[-2,-2],[-2,-5],[0,-2],[0,-2],[2,-2],[1,-1],[0,-1],[0,-1],[-2,-6],[-1,-3],[0,-1],[1,-1],[0,-1],[0,-2],[1,-2],[0,-1],[-1,-1],[-3,0],[-14,-2],[-2,-1],[-1,-2],[-1,-1],[-1,-1],[-5,-3],[-2,-1],[-2,0],[-4,1],[-2,1],[-2,0],[-2,0],[-3,0],[-2,0],[-7,-3],[-19,-12]],[[4595,6504],[-50,-16]],[[4419,6572],[48,4],[61,-2],[54,6],[42,20],[29,5],[29,10],[16,2],[93,-1],[81,6],[173,9],[84,-1],[8,-2],[9,-5],[40,-6],[12,0],[9,6],[6,6]],[[4800,6574],[10,-13],[5,-8],[0,-2],[-2,-4],[-9,-9],[-9,-7],[-5,-11],[-7,-33],[-22,4],[-12,0],[-9,-2],[-6,-2],[-14,-7],[-18,-7],[-8,-1],[-9,0],[-16,1],[-17,4],[-33,14],[-18,4],[-2,1],[-3,1],[0,1],[-1,6]],[[6000,6845],[13,0],[6,0],[6,0],[2,-3],[-6,-7],[11,-14],[-2,-9],[-12,-7],[-18,-6],[3,6],[2,3],[-15,-5],[-14,-1],[-29,1],[-14,3],[-14,6],[-13,4],[-11,-4],[-18,13],[7,16],[19,12],[16,1],[18,6],[18,0],[38,-14],[7,-1]],[[4848,7374],[-6,-1],[-8,-2],[-17,0],[-3,3],[16,-1],[11,1],[4,1],[3,0],[44,17],[10,3],[5,1],[1,-1],[-35,-13],[-4,-3],[-21,-5]],[[4996,7395],[11,0],[4,0],[-14,-10],[-26,-4],[-28,3],[-18,11],[22,-4],[18,2],[13,11],[13,19],[6,-5],[4,-7],[0,-8],[-5,-8]],[[5364,7424],[4,-5],[1,-13],[-9,-13],[-22,1],[-23,11],[-14,13],[11,4],[13,1],[22,0],[17,1]],[[4844,7455],[60,-2],[13,0],[3,-1],[-19,-2],[-3,0],[-9,-2],[-13,2],[-7,0],[-5,2],[-22,2],[2,1]],[[6510,7422],[-8,-4],[-31,1],[-18,2],[-14,6],[2,5],[1,2],[0,1],[-3,6],[10,6],[12,19],[9,6],[9,-4],[23,-16],[5,-7],[3,-12],[0,-11]],[[4238,7526],[-7,-1],[-14,2],[-6,3],[-1,3],[2,2],[4,-1],[3,-3],[4,-2],[6,0],[9,-3]],[[4207,7558],[-1,-2],[-1,1],[2,1]],[[4209,7558],[0,-1],[-1,1],[1,1],[0,-1]],[[4210,7572],[-1,-3],[0,1],[0,3],[1,-1]],[[4205,7582],[1,-2],[-3,2],[2,0]],[[4201,7584],[0,-1],[-1,2],[1,-1]],[[4993,6189],[62,1],[31,5],[26,4],[9,5],[9,11],[2,2],[2,1],[2,1],[14,4],[5,1],[7,-1],[8,-2],[15,-5],[10,-5],[1,-1],[2,-1],[21,-10],[5,-1],[8,-1],[15,0],[17,-1],[8,-3],[18,-11],[14,-5],[5,0],[6,2],[22,8],[6,1],[3,1],[8,-5],[2,-4],[2,-2],[4,-2],[5,0],[15,4],[5,1],[5,1],[6,0],[12,-2],[55,-16],[9,0],[35,6],[17,5],[3,2],[3,2],[7,3],[7,0],[8,0],[18,-3],[7,-3],[6,-2],[3,-2],[4,-1],[4,-1],[20,-1],[15,2],[36,9]],[[8154,6119],[-4,-12],[-9,1],[-8,18],[-1,17],[1,11],[4,7],[6,-1],[3,-2],[6,-7],[5,-16],[-3,-16]],[[8098,6196],[-9,-3],[-9,6],[-5,12],[-6,22],[0,9],[7,2],[8,-10],[9,-19],[4,-1],[5,-7],[-4,-11]],[[7644,6276],[2,-3],[11,-10],[10,-6],[4,2],[3,7],[7,3],[7,0],[3,-5],[3,-33],[7,-15],[11,0],[-9,10],[2,8],[3,8],[-4,8],[0,4],[2,7],[5,5],[5,1],[4,-5],[-4,-10],[3,-6],[11,-6],[11,2],[10,5],[11,1],[9,-5],[7,-6],[9,-6],[15,-1],[-8,-17],[6,-5],[11,4],[6,11],[-7,22],[2,12],[15,5],[5,-3],[13,-12],[8,-4],[9,0],[39,8],[18,9],[16,12],[8,12],[1,15],[-12,29],[-3,13],[5,19],[13,4],[16,-4],[16,-7],[30,-20],[17,-21],[18,-55],[7,-12],[8,-10],[6,-10],[0,-13],[9,-14],[2,-9],[-3,-9],[-8,-14],[13,0],[11,-6],[9,-8],[14,-18],[39,-65],[4,-12],[-1,-11],[-3,-10],[-2,-10],[1,-2]],[[8150,6024],[2,-11],[-10,-10],[-13,-10],[-9,-11],[-5,-20],[-4,-6],[-30,-28],[-15,-22],[-5,-10],[2,-11],[10,-8],[13,-6],[12,-5],[3,-14],[1,-15],[3,-13],[9,-12],[33,-19],[7,-9],[1,-7],[-1,-16],[2,-32],[2,-6],[1,-13],[2,-3],[2,-3],[2,-3],[0,-4],[-1,-12],[2,-8],[-1,-4],[-2,-6],[-6,-9],[-3,-7],[-2,-6],[1,-5],[3,-2],[4,-1],[31,-2],[3,-1],[2,-2],[2,-3],[3,-6],[1,-3],[3,-3],[3,-2],[10,-5],[3,-2],[2,-2],[7,-8],[3,-2],[3,-1],[3,-1],[2,0],[7,2],[8,3],[15,9],[7,3],[5,1],[2,-3],[4,-18],[2,-3],[2,-3],[2,-1],[3,0],[3,0],[4,2],[10,6],[6,2],[4,0],[12,-2],[3,-1],[9,-2],[2,-6],[0,-6],[-6,-13],[-15,-25],[-5,-13],[3,-16],[9,-15],[6,-7],[6,-4],[9,-3],[17,-1],[9,-3],[1,-6],[1,-4],[0,-5],[-1,-6],[-4,-5],[-34,-32],[-4,-6],[-2,-5],[-2,-28],[-4,-10],[-9,-6],[-27,-10],[-19,-5],[-24,-15],[-3,-2],[-16,-18],[-15,-23],[-8,-11],[-12,-3],[-40,-1],[-10,-2],[-5,-2],[-4,-2],[-3,-3],[-2,-3],[-1,-3],[-2,-3],[-7,-7],[-8,-6],[-8,-4],[-43,-17],[-11,-2],[-8,0],[-29,6],[-10,0],[-9,-4],[-2,-10],[-9,-1],[-9,-4],[-8,-6],[-21,-21],[-3,-2]],[[6955,6266],[10,1],[79,21],[20,8],[25,33],[9,8],[11,8],[7,2],[6,1],[15,1],[33,6],[25,-1],[18,2],[19,5],[13,2],[5,4],[1,3],[2,13],[1,4],[1,3],[4,6],[2,2],[7,5],[18,10],[17,6],[9,1],[6,-1],[2,-3],[7,-7],[2,-3],[4,-1],[3,-2],[17,-4],[3,-2],[1,-3],[-1,-3],[-1,-3],[0,-3],[2,-3],[3,-1],[4,-1],[3,-2],[3,-2],[4,-3],[6,-1],[22,-1],[5,-2],[2,-2],[3,-7],[2,-3],[3,-2],[38,-3],[3,-1],[3,-3],[4,-5],[3,-2],[6,-1],[12,0],[5,0],[4,-2],[2,-1],[1,-4],[6,-8],[8,-3],[5,1],[4,2],[6,4],[5,5],[9,7],[29,15],[-2,-8],[1,-3],[1,-4],[3,-3],[5,-5],[5,-1],[4,0],[6,4],[4,2],[6,0],[4,-3],[2,-4],[5,-10],[1,-4],[1,-14],[5,-12],[3,-5],[4,-3],[3,-2],[10,-4],[3,-1]],[[5213,6629],[3,3],[11,9],[14,3],[17,-2],[46,-21],[48,-10],[15,-12],[34,-3],[9,-2],[-6,-9],[-16,-9],[-20,-6],[-14,2],[1,-8],[-1,-16],[3,-6],[22,-21],[56,-39],[6,-6],[24,-13],[14,-18],[52,-28],[-11,-1],[-10,2],[-9,3],[-5,5],[-6,-5],[-5,-4],[16,-19],[19,4],[19,-10],[32,-25],[19,-6],[20,-3],[42,-1],[-22,13],[-74,28],[-15,19],[212,-83],[89,-24],[25,-4]],[[6984,6700],[-20,-2],[-15,7],[0,12],[-19,2],[-10,2],[-6,5],[-1,9],[5,7],[8,5],[8,1],[15,-6],[21,-6],[18,-9],[7,-15],[-11,-12]],[[6777,6761],[13,-1],[3,1],[6,-2],[3,-9],[-14,-8],[-20,-2],[-14,7],[2,9],[11,4],[10,1]],[[7069,6876],[4,-18],[-23,4],[0,-4],[0,-9],[0,-4],[-11,7],[-6,2],[-3,-3],[-2,-4],[-16,-13],[-20,-35],[-42,6],[-16,-2],[-48,-15],[-13,-7],[2,19],[-13,3],[-16,0],[-15,25],[-16,10],[-17,8],[-11,8],[-19,-16],[-16,-3],[-54,5],[-4,2],[-3,1],[-4,2],[-19,-1],[-7,1],[-31,8],[-14,1],[18,34],[3,9],[1,14],[6,6],[11,1],[16,-1],[8,2],[6,2],[9,8],[8,2],[15,-5],[20,8],[18,2],[16,-3],[7,-9],[0,-8],[0,-10],[5,-8],[25,-7],[27,-16],[16,-3],[30,-3],[12,4],[11,12],[1,7],[-1,21],[5,6],[10,7],[5,5],[3,7],[-1,5],[1,5],[7,6],[7,2],[16,0],[7,2],[11,9],[19,20],[11,7],[2,-12],[9,-6],[9,-5],[5,-6],[2,-13],[11,-25],[2,-12],[24,-39]],[[7904,6417],[-4,0],[0,8],[-3,6],[-12,10],[-5,5],[-13,12],[-23,15],[-21,11],[-13,13],[-4,11],[1,13],[1,4],[3,8],[4,5],[3,0],[22,-21],[18,-22],[42,-41],[5,-4],[7,-10],[-1,-13],[-7,-10]],[[6522,6379],[4,1],[7,-2],[16,-6],[7,-1],[16,5],[21,18],[23,6],[14,6],[4,1],[6,4],[0,6],[-5,4],[-20,-8],[-17,1],[-16,5],[-11,7],[5,6],[7,-1],[9,-4],[9,-1],[9,2],[16,8],[11,3],[-2,9],[0,3],[2,6],[-16,0],[0,5],[15,5],[8,-2],[2,-8],[0,-11],[2,-10],[6,0],[6,7],[7,10],[0,17],[30,11],[38,9],[27,13],[6,10],[3,9],[7,6],[17,2],[16,0],[12,-2],[10,-3],[32,-13],[14,-4],[17,-1],[17,1],[46,9],[15,-1],[28,-7],[15,-2],[32,1],[101,22],[21,9],[-17,2],[-19,-1],[-19,1],[-18,10],[-13,9],[-38,16],[-17,4],[-39,1],[-18,2],[-17,9],[-14,5],[-20,0],[-38,-7],[3,3],[7,10],[-11,0],[-8,-4],[-6,-6],[-6,-3],[-9,-2],[-52,3],[-10,-1],[-22,-12],[-5,-2],[-7,-4],[-6,-15],[-7,-4],[-11,4],[-6,8],[-1,10],[0,8],[-6,13],[-14,13],[-9,14],[4,12],[7,3],[6,5],[2,6],[1,9],[4,0],[7,-12],[11,-6],[32,-5],[10,-3],[19,-9],[9,-2],[10,2],[44,18],[7,2],[10,1],[5,-1],[2,-3],[2,-3],[4,-2],[69,0],[17,-5],[10,5],[29,5],[11,4],[7,7],[6,10],[5,11],[2,13],[5,0],[10,-15],[14,-10],[17,-7],[76,-16],[74,-8],[16,1],[30,18],[18,6],[13,-6],[5,0],[2,9],[7,1],[9,-3],[9,-2],[4,3],[5,14],[4,6],[5,-5],[5,-3],[5,1],[5,2],[5,-4],[-5,-4],[15,-5],[6,8],[11,-1],[12,-4],[12,-3],[0,2],[3,5],[6,3],[9,-3],[6,-2],[8,3],[51,31],[8,2],[2,-3],[2,-7],[4,-6],[9,-3],[9,0],[7,1],[6,3],[6,6],[13,-4],[50,4],[17,-2],[29,-10],[17,-2],[18,1],[30,11],[26,3],[80,25],[10,1],[17,-8],[8,-1],[10,-1],[15,-3],[71,-1],[107,-17],[57,-7],[33,-4],[53,-1],[23,-7],[13,0],[9,3],[19,12],[10,3],[48,0],[22,4],[18,10],[8,-8],[20,6],[7,-7],[12,7],[19,6],[21,3],[14,-3],[-12,-5],[-11,-7],[-6,-10],[3,-14],[-4,-4],[-9,7],[-6,-5],[-9,-8],[-14,-4],[-3,-1],[-9,-6],[-6,-2],[-9,0],[-7,1],[-7,0],[-8,-6],[-46,-4],[-16,-5],[-63,8],[-49,-3],[-9,-4],[-9,-9],[-36,-47],[-16,-12],[-15,2],[-17,8],[-14,-1],[-15,-4],[-17,-1],[-9,1],[-14,6],[-8,2],[-7,0],[-12,-4],[-9,0],[-15,1],[-48,12],[-41,3],[-172,-20],[-20,-4],[-9,-9],[-7,-10],[-18,-13],[-18,-10],[-12,-5],[0,-5],[22,8],[41,31],[23,12],[27,1],[12,-13],[2,-19],[-1,-18],[5,-20],[1,-13],[-3,-5],[-7,-1],[-11,-4],[-5,0],[-6,3],[-11,9],[-6,2],[-49,2],[-23,-5],[-6,-16],[5,4],[15,6],[4,-17],[4,-6],[7,-5],[-9,-4],[-11,-14],[-10,-4],[13,-8],[-1,-8],[-9,-7],[-8,-9],[42,2],[11,5],[3,11],[-15,27],[4,14],[-8,5],[-3,8],[3,8],[8,6],[13,0],[12,-5],[21,-18],[7,5],[7,2],[8,1],[8,1],[23,12],[5,2],[12,-2],[15,-4],[13,-6],[8,-6],[2,-5],[1,-12],[2,-6],[5,-5],[17,-10],[11,-9],[7,-9],[4,-11],[1,-15],[-5,-20],[0,-7],[9,-15],[1,-6],[2,-2],[6,-2],[5,-3],[4,-12],[7,-11],[2,-4],[-3,-11],[-9,-12],[-11,-9],[-11,-4],[-8,-1],[-14,-3],[-8,-1],[-9,1],[-6,3],[-3,3],[-4,3],[-12,2],[-14,-1],[-10,-4],[-5,-9],[-1,-6],[-4,-5],[-6,-4],[-7,-1],[-4,3],[-3,12],[-2,5],[-12,5],[-20,-9],[-11,2],[-2,5],[1,7],[0,6],[-5,5],[-7,0],[-7,-3],[-6,-5],[-5,-5],[-2,6],[-5,5],[-6,4],[-7,2],[-12,-8],[-8,-1],[-20,5],[3,-4]],[[8839,5268],[15,-6],[19,1],[22,-1],[7,-12],[0,-11],[2,-14],[8,-9],[11,-4],[12,-6],[1,-10],[-4,-11],[-9,-3],[-12,4],[-18,12],[-6,13],[-10,10],[-20,0],[-25,-1],[-25,4],[-15,11],[-10,7],[-16,7],[-14,1],[-23,8],[3,7],[15,-2],[29,-4],[27,1],[17,9],[19,-1]],[[9132,5266],[-10,-16],[-16,-7],[-17,8],[-1,-9],[6,-8],[2,-7],[-62,-8],[-79,6],[-28,-1],[9,15],[9,14],[14,9],[19,3],[16,-4],[23,-17],[17,-7],[-9,11],[-1,1],[1,5],[4,4],[3,3],[2,2],[20,20],[9,3],[48,2],[4,0],[4,-2],[2,-1],[3,-1],[6,-1],[2,-17]],[[9363,5343],[10,-5],[22,1],[18,-2],[5,-9],[-3,-11],[-7,-12],[-10,-2],[-14,1],[-17,5],[-15,0],[-15,-3],[-16,0],[-15,0],[-11,-4],[-14,0],[-13,1],[-1,6],[9,10],[8,12],[10,14],[9,14],[11,1],[14,2],[9,8],[13,7],[10,9],[5,3],[3,-2],[-3,-7],[-8,-12],[0,-14],[6,-11]],[[9327,5466],[-7,-8],[4,-6],[10,-3],[4,-12],[2,-7],[9,-9],[9,-14],[-10,-8],[-18,-10],[-18,-2],[-16,-12],[-10,-17],[-11,-15],[-6,-14],[-15,-14],[-14,-9],[-28,-2],[-27,3],[-20,-3],[-15,-3],[-26,6],[-37,0],[-30,-4],[-13,-6],[-13,-9],[-9,-6],[-8,-3],[-13,-1],[-5,6],[2,13],[2,9],[2,17],[2,24],[8,15],[22,23],[22,15],[26,13],[21,6],[26,9],[17,2],[16,2],[35,4],[16,5],[8,11],[8,9],[22,0],[39,-1],[16,9],[18,6],[3,-9]],[[9077,5433],[-18,-4],[42,27],[13,11],[25,33],[9,22],[7,7],[9,5],[9,7],[2,6],[0,6],[1,6],[9,7],[17,3],[16,-4],[15,-8],[13,-10],[-16,-4],[-4,0],[11,-16],[-11,-19],[-20,-18],[-30,-20],[-99,-37]],[[9233,5593],[-2,-5],[0,5],[-6,-12],[-7,-5],[-10,-2],[-16,0],[-12,-3],[-11,-7],[-62,-51],[-4,-6],[-5,-13],[-4,-6],[-24,-12],[-6,-2],[-9,7],[3,13],[7,15],[4,13],[7,11],[16,5],[18,4],[15,5],[13,12],[28,32],[12,6],[18,1],[40,13],[0,-7],[-1,-5],[-2,-6]],[[9228,5630],[-8,-10],[0,4],[-12,-12],[-37,-11],[-16,-8],[13,23],[1,21],[4,19],[22,14],[26,6],[14,0],[6,-8],[-2,-13],[-5,-13],[-6,-12]],[[9327,5675],[-8,-3],[-10,-1],[-13,1],[-20,-11],[-6,-10],[-5,-12],[-9,-11],[-15,-4],[6,17],[6,30],[8,13],[11,7],[16,8],[17,1],[12,-11],[2,-3],[4,-7],[4,-4]],[[8150,6024],[5,-8],[21,18],[15,22],[20,51],[2,21],[-13,42],[1,24],[13,-9],[13,-15],[27,-47],[4,-14],[3,-94],[-9,-28],[-21,-17],[25,8],[14,22],[6,29],[-4,82],[-4,16],[-16,25],[-6,14],[43,-4],[13,-3],[5,-8],[3,-9],[7,-8],[8,-3],[23,-5],[15,-1],[6,0],[1,3],[-8,6],[-6,3],[-22,5],[-9,1],[-1,4],[-22,19],[-12,6],[-9,2],[-44,1],[-10,4],[-11,10],[10,13],[4,12],[8,6],[7,4],[63,-15],[37,-13],[26,-13],[74,-52],[14,-10],[22,-27],[21,-13],[12,-8],[1,-9],[2,-5],[10,-9],[3,-6],[-1,-7],[-8,-20],[-14,-24],[-3,-14],[5,0],[20,37],[10,36],[13,-1],[11,-14],[9,-16],[7,-10],[-4,-13],[4,-55],[7,13],[3,15],[0,29],[-1,8],[-3,6],[-3,4],[-5,5],[-5,7],[-4,15],[-3,7],[-5,3],[-15,3],[-6,3],[-1,4],[-12,15],[-5,7],[-1,5],[-3,4],[6,2],[22,0],[28,-5],[57,-16],[9,-1],[51,-10],[14,9],[-3,9],[-10,9],[-8,10],[-5,1],[-5,3],[-13,8],[-1,5],[-2,5],[-10,2],[-10,8],[-5,7],[5,3],[21,-1],[7,-3],[11,-5],[21,-10],[30,-17],[24,-14],[25,-16],[11,-12],[29,-31],[-4,18],[-18,20],[-5,12],[-22,8],[-11,10],[3,2],[11,-8],[10,-2],[14,-1],[9,-5],[8,-7],[19,-20],[13,-11],[11,-9],[11,-10],[13,-13],[9,-7],[15,-10],[34,-25],[16,-11],[8,-21],[15,-16],[10,4],[-12,14],[18,0],[40,-21],[13,7],[5,-2],[28,2],[10,-1],[28,-12],[29,-9],[12,-7],[4,-12],[-5,1],[-3,2],[-2,6],[-2,-22],[2,-5],[5,-4],[5,0],[6,2],[7,2],[12,-3],[15,-6],[16,-8],[12,-8],[6,-7],[12,-14],[11,-10],[2,-2],[1,-4],[1,-4],[2,-2],[9,-2],[4,-3],[6,-13],[4,-17],[-1,-17],[-9,-12],[-2,5],[-2,3],[-6,6],[-4,-10],[-1,-11],[-3,-8],[-10,-4],[-11,-2],[-17,-9],[-7,-2],[-9,-1],[-9,-2],[-8,-3],[-7,-3],[-4,-8],[-4,-4],[-4,-1],[-1,-1],[-17,-4],[-41,-35],[-17,-6],[-15,-8],[-13,-20],[-20,-41],[11,4],[9,8],[8,10],[2,8],[4,6],[60,48],[19,10],[3,-12],[-4,-6],[-11,-10],[-5,-6],[-2,-6],[-3,-15],[-3,-4],[-5,-6],[-2,-5],[0,-12],[-3,-7],[-8,-4],[-8,-2],[-7,-3],[-25,-25],[-5,0],[-3,-6],[-13,-19],[-4,-10],[-9,-27],[-1,-11],[5,-13],[0,-7],[-11,-28],[-39,-53],[-10,-28],[-4,-32],[-8,-24],[-17,-13],[-33,0],[-42,12],[-10,2],[-129,-9],[-32,6],[-28,16],[-15,0],[-15,-2],[-10,-7],[-1,-13],[6,-7],[40,-21],[27,-4],[7,-2],[5,-5],[3,-5],[3,-2],[8,0],[13,3],[7,1],[1,-1],[8,-9],[12,-10],[5,-2],[9,0],[4,-2],[6,-10],[3,-2],[14,-2],[29,6],[12,1],[8,-5],[4,-9],[4,-10],[4,-8],[8,-7],[19,-11],[8,-10],[23,15],[10,9],[4,11],[4,7],[12,9],[13,9],[10,4],[16,3],[48,-3],[34,6],[16,-1],[2,-9],[-12,-9],[-28,-5],[-5,-11],[-1,-15],[0,-7],[3,-6],[8,-3],[1,7],[-1,17],[4,12],[3,2],[8,4],[8,1],[8,0],[7,1],[3,5],[1,6],[4,6],[4,6],[8,6],[2,8],[1,16],[1,6],[0,5],[2,3],[7,4],[14,-5],[14,3],[15,4],[73,8],[92,9],[14,-8],[4,-7],[11,-7],[11,-7],[9,-4],[15,-2],[45,-2],[48,-11],[13,1],[3,3],[8,16],[15,14],[17,26],[23,9],[128,-8],[30,-7],[29,-11],[26,-15],[14,-6],[32,-5],[45,-60],[77,-77],[29,-42],[-1,-14],[-9,-15],[-14,-11],[-15,-5],[-16,0],[-36,-8],[-13,-6],[-8,-7],[-19,-14],[-5,-10],[0,-9],[2,-8],[-1,-8],[-9,-10],[-6,-26],[-8,-12],[-12,-7],[-16,0],[-29,2],[-16,-4],[-15,-11],[-12,-10],[-13,-10],[-35,-12],[-9,-9],[-7,-11],[-11,-9]],[[8178,6203],[-7,-3],[-1,9],[9,18],[14,14],[13,5],[7,-1],[3,-5],[4,-10],[-3,-10],[-7,-7],[-10,-6],[-12,-3],[-10,-1]]],"transform":{"scale":[0.0013576911483148277,0.001505513833183325],"translate":[-73.39114864099992,0.649315491000024]}};
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
