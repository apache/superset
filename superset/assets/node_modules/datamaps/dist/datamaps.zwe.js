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
  Datamap.prototype.zweTopo = {"type":"Topology","objects":{"zwe":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Mashonaland Central"},"id":"ZW.MC","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Harare"},"id":"ZW.HA","arcs":[[4,-2,5]]},{"type":"Polygon","properties":{"name":"Matabeleland North"},"id":"ZW.MN","arcs":[[6,7,8,9,10,11]]},{"type":"Polygon","properties":{"name":"Midlands"},"id":"ZW.MI","arcs":[[12,13,14,-7,15]]},{"type":"Polygon","properties":{"name":"Mashonaland East"},"id":"ZW.ME","arcs":[[16,17,-13,18,-6,-1,19]]},{"type":"Polygon","properties":{"name":"Manicaland"},"id":"ZW.MA","arcs":[[20,-17,21]]},{"type":"Polygon","properties":{"name":"Matabeleland South"},"id":"ZW.MS","arcs":[[22,23,-10,24,-8,-15]]},{"type":"Polygon","properties":{"name":"Bulawayo"},"id":"ZW.BU","arcs":[[-25,-9]]},{"type":"Polygon","properties":{"name":"Masvingo"},"id":"ZW.MV","arcs":[[-21,25,-23,-14,-18]]},{"type":"Polygon","properties":{"name":"Mashonaland West"},"id":"ZW.MW","arcs":[[-3,-5,-19,-16,-12,26]]}]}},"arcs":[[[9600,8386],[-4,-3],[-34,-36],[-22,-11],[-24,-3],[-73,7],[-11,4],[-22,13],[-11,4],[-173,24],[-32,-4],[-33,-13],[-61,-41],[-33,-13],[-18,-2],[-52,2],[-14,-3],[-11,-6],[-21,-17],[-25,-15],[-29,-12],[-30,-8],[-27,-1],[-12,2],[-21,10],[-12,3],[-19,-4],[-20,-9],[-36,-25],[-13,-16],[-12,-21],[-9,-24],[-14,-70],[-7,-15],[-12,-12],[-41,-23],[-19,-17],[-16,-22],[-13,-26],[-8,-27],[-8,-48],[-5,-15],[-29,-53],[-17,-24],[-21,-21],[-25,-16],[-7,-6],[-7,-10],[-11,-22],[-7,-11],[-14,-14],[-33,-22],[-14,-12],[-11,-21],[-3,-27],[3,-27],[4,-25],[2,-40],[-13,-33],[-20,-31],[-109,-119],[-21,-37],[-3,-13],[-23,-24],[-116,-69],[-6,-8],[-14,-26],[-13,-29],[-8,-13],[-9,-12],[-7,3],[-9,4],[-7,0],[-14,-11],[-67,-72],[-14,-12],[-14,-7],[-44,20],[-15,-5],[-28,-17],[-12,-3],[-9,12],[-6,14],[-4,16],[-2,15],[2,16],[43,125],[3,9],[-1,9],[-10,3],[-202,19],[-17,-10],[-17,-18],[-20,-48],[-27,-34],[-2,-8],[8,-19],[9,-6],[8,-1],[3,-12],[1,-12],[-25,-123]],[[7502,6975],[-4,-64],[-10,-23],[-9,-9],[-8,-5],[-8,-2],[-24,0],[-12,-5],[-16,-2],[-12,0],[-6,2],[-7,5],[-21,21]],[[7365,6893],[-35,65],[-24,10],[-8,-5],[-8,-9],[-6,-9],[-8,-7],[-8,0],[-9,5],[-17,13],[-60,36],[-71,31],[-12,9],[-4,9],[0,14],[2,11],[10,28],[4,26],[-2,6],[-7,2],[-180,-1],[-5,3],[-7,6],[0,35],[16,123],[-1,20],[-2,24],[-17,83],[3,10],[2,8],[19,31],[48,102],[1,8],[0,7],[-5,8],[-6,5],[-5,6],[-1,6],[4,8],[5,6],[5,5],[19,20],[17,21],[15,25],[3,6],[5,15],[14,121],[0,10],[-1,8],[-7,8],[-7,4],[-15,5],[-7,2],[-8,0],[-6,-2],[-6,-3],[-11,-8],[-6,-4],[-5,0],[-5,5],[-2,15],[-4,9],[-7,6],[-7,-1],[-7,-3],[-17,-11],[-15,-13],[-6,-2],[-7,0],[-6,3],[-5,4],[-6,2],[-8,1],[-32,-3],[-8,0],[-7,2],[-5,4],[-4,7],[-5,30],[-1,38],[0,5],[5,4],[5,3],[5,4],[4,4],[1,7],[-5,8],[-4,6],[-21,19],[-4,5],[-3,6],[-3,12],[-8,130],[2,9],[1,9],[3,8],[3,6],[20,29],[6,14],[2,9],[-1,11],[-3,12],[-9,19],[-6,10],[-7,6],[-6,4],[-7,3],[-6,4],[-5,5],[3,8],[2,7],[3,9],[-1,10],[-19,49],[-4,4],[-3,2],[-10,6],[-41,27],[-7,3],[-15,3],[-6,3],[-11,9],[-6,4],[-21,9],[-5,4],[-5,7],[-10,22],[-12,21],[-2,10],[-1,13],[9,62],[11,34],[3,7],[7,13],[6,15],[8,46],[3,37],[2,6],[5,13],[16,33],[3,8],[0,12],[-2,17],[-9,33],[-6,18],[-10,20],[-9,5],[-9,3],[-73,-5],[-6,2],[-6,3],[-3,3],[-23,28],[-4,10],[-12,39],[-5,12],[-6,7],[-8,3],[-17,2],[-8,0],[-46,-6],[-13,-6],[-5,-4],[-4,-6],[-3,-7],[-1,-8],[1,-9],[6,-30],[1,-9],[-2,-7],[-3,-7],[-4,-6],[-4,-6],[-6,-4],[-5,-3],[-29,-7],[-6,-4],[-5,-4],[-8,-12],[-4,-5],[-6,-3],[-7,1],[-28,7],[-8,0],[-7,-1],[-13,-6],[-5,-4],[-4,-5],[-3,-7],[-6,-16],[-3,-6],[-5,-4],[-7,-1],[-7,1],[-15,5],[-6,3],[-6,4],[-3,8],[2,15],[22,57],[8,13],[6,7],[16,12],[4,6],[4,9],[2,12],[0,20],[-6,48],[0,9],[2,12],[4,12],[16,29],[6,7],[33,24],[4,6],[3,9],[-1,14],[-3,9],[-6,4],[-7,1],[-7,-1],[-7,-1],[-6,2],[-5,4],[-5,5],[-8,12],[-1,7],[0,9],[0,8],[-1,5],[-1,4],[-9,9],[-4,6],[-3,6],[-2,7],[-3,16],[0,13],[5,38],[-1,13],[-4,8],[-27,11],[-6,4],[-10,10],[-3,6],[-3,6],[-2,8],[-1,8],[1,6],[2,4],[5,5],[333,322],[10,19],[5,21],[-10,32],[-6,15],[-16,20],[-5,21],[-1,59],[4,16]],[[6489,9963],[40,-19],[37,1],[51,23],[1,-119],[2,-141],[3,-176],[2,-103],[143,2],[92,0],[208,2],[138,1],[57,-13],[51,-41],[21,-24],[19,-16],[21,-4],[29,14],[14,15],[24,29],[19,11],[11,-3],[10,-8],[10,-1],[10,21],[32,22],[57,-5],[129,-34],[25,-11],[21,-16],[18,-26],[24,-50],[16,-20],[25,-15],[12,-10],[6,-14],[4,-14],[8,-9],[5,-1],[10,2],[5,1],[6,-4],[0,-7],[-2,-7],[2,-4],[25,-4],[28,0],[25,-4],[19,-15],[50,-28],[213,-15],[32,-16],[35,-32],[77,-95],[25,-23],[53,-31],[16,-14],[11,-26],[6,-57],[11,-22],[21,-11],[132,-24],[253,7],[100,-17],[132,-59],[203,-91],[153,-68],[14,-15],[6,-21],[1,-34],[13,-58],[34,-29],[7,-4]],[[7234,6558],[34,8],[42,16],[5,7],[2,7],[-4,15],[-6,10],[-6,9],[-27,16],[-7,6],[-3,9],[2,13],[8,19],[0,17],[-3,9],[-5,7],[-4,8],[0,12],[3,17],[3,10],[6,6],[12,3],[14,7],[15,12],[35,46],[15,46]],[[7502,6975],[23,-2],[6,-2],[4,-5],[3,-12],[3,-11],[6,-9],[9,-5],[23,-5],[42,2],[12,-4],[6,-7],[5,-16],[1,-16],[-1,-16],[-5,-25],[0,-10],[2,-10],[5,-10],[4,-8],[2,-10],[-1,-16],[0,-9],[3,-15],[4,-13],[12,-28],[2,-7],[0,-5],[-3,-8],[-6,-9],[-12,-14],[-5,-10],[-2,-10],[-2,-15],[-6,-9],[-11,-8],[-47,-23],[-2,-4],[0,-5],[4,-16],[1,-9],[1,-16],[0,-7],[-5,-25],[-13,-16],[-18,-9],[-4,-11],[-1,-7],[4,-6],[12,-10],[1,-4],[-4,-6],[-22,-18],[-7,-3],[-16,-2],[-8,-2],[-7,-4],[-11,-8],[-4,-2],[-5,-1],[-5,-1],[-8,2],[-11,6],[-29,28],[-63,45],[-49,23],[-16,5],[-25,11],[-34,35]],[[3870,7353],[-3,-54],[-3,-13],[-10,-30],[-1,-19],[-2,-7],[-3,-5],[-4,-5],[-1,0],[0,-1],[-7,-26],[-9,-24],[-2,-8],[0,-11],[1,-12],[4,-19],[1,-12],[-1,-10],[-2,-7],[-7,-12],[-3,-7],[-7,-35],[-7,-24],[0,-10],[8,-34],[1,-12],[-2,-9],[-35,-42],[-20,-19],[-9,-11],[-5,-4],[-5,-2],[-6,2],[-4,4],[-5,5],[-6,3],[-6,1],[-6,-2],[-5,-4],[-34,-33],[-2,-8],[-4,-17],[-6,-15],[-1,-9],[0,-11],[15,-69],[-1,-14],[-1,-10],[-16,-34],[-11,-31],[0,-8],[0,-11],[2,-14],[-1,-9],[-4,-6],[-6,-4],[-5,-3],[-5,-5],[-4,-6],[-2,-7],[-3,-18],[-3,-8],[-3,-6],[-4,-6],[-5,-5],[-21,-17],[-4,-5],[-4,-6],[0,-1],[-1,-3],[0,-7],[1,-8],[7,-24],[3,-20],[3,-10],[6,-7],[12,-9],[8,-1],[8,2],[6,2],[6,2],[7,-2],[5,-5],[3,-11],[-1,-30],[2,-17],[7,-21],[2,-7],[-1,-9],[-2,-7],[-4,-7],[-5,-5],[-10,-8],[-5,-5],[-4,-6],[-2,-7],[2,-9],[5,-9],[13,-10],[10,-5],[27,-6],[7,-4],[6,-6],[4,-11],[-3,-5],[-6,-2],[-69,-9],[-35,-9],[-7,-4],[-5,-8],[-5,-432],[2,-21],[5,-20],[14,-14],[10,-7],[9,-4],[9,-1],[16,-1],[68,10],[8,0],[7,-2],[20,-10],[16,-4],[52,-3],[17,-4],[23,-7],[128,-5],[16,-3],[8,-1],[16,1],[29,6],[66,0],[25,-5],[17,-1],[53,3],[11,2],[40,14],[8,1],[81,0],[6,1],[23,2],[15,3],[26,10],[8,1],[8,0],[8,-1],[7,-3],[13,-6],[24,-8],[18,-2],[478,5],[12,-2],[9,-6],[17,-35],[6,-17],[0,-13],[-6,-16],[-11,-10],[-224,-104],[-70,-19],[-12,-6],[-9,-13],[-1,-27],[75,-373],[5,-17],[7,-17],[11,-11],[8,-5],[16,-7],[9,-10],[10,-15],[27,-51],[5,-13],[0,-13],[-2,-11],[-1,-9],[-4,-8],[-8,-11],[-6,-7],[-3,-7],[-1,-7],[0,-42],[0,-3],[2,-6],[11,-18],[15,-12],[116,-137],[8,-14],[3,-10],[0,-18],[-3,-11],[-28,-49],[6,-11],[160,-168]],[[5118,4290],[-11,-26],[-6,-8],[-13,-10],[-10,-2],[-11,2],[-9,6],[-6,6],[-12,8],[-13,5],[-42,9],[-8,0],[-9,-1],[-8,-2],[-7,-6],[-4,-8],[0,-16],[4,-11],[7,-10],[19,-19],[8,-12],[5,-11],[1,-11],[0,-12],[-5,-23],[-6,-13],[-11,-16],[-57,-54],[-5,-7],[-3,-8],[3,-11],[6,-9],[17,-18],[9,-8],[10,-6],[7,-8],[4,-11],[2,-16],[-2,-59],[-2,-12],[-5,-22],[-10,-28],[-1,-9],[-3,-11],[-9,-12],[-29,-24],[-17,-7],[-15,-4],[-76,16],[-7,0],[-4,-5],[-1,-10],[2,-8],[5,-15],[18,-76],[12,-33],[1,-5],[-1,-6],[-3,-7],[-22,-39],[-15,-14],[-90,-55],[-55,-26],[-6,-3],[-4,-7],[-4,-11],[0,-10],[1,-8],[8,-29],[0,-8],[-4,-10],[-125,-165],[-24,-25],[-21,-17],[-9,-22],[-33,-40],[-18,-2],[-9,2],[-66,58]],[[4321,3185],[85,21],[21,10],[9,8],[7,8],[5,9],[2,8],[0,7],[-2,7],[-5,6],[-25,18],[-5,5],[-4,6],[0,7],[1,6],[1,4],[8,18],[4,10],[2,10],[0,7],[-5,5],[-8,3],[-9,4],[-4,5],[-2,6],[-2,17],[-5,6],[-9,-1],[-17,-9],[-9,-3],[-10,1],[-8,4],[-14,12],[-6,4],[-7,1],[-7,1],[-5,1],[-3,3],[-4,4],[-1,4],[0,4],[2,5],[0,18],[2,7],[4,12],[-1,4],[-4,2],[-8,0],[-25,-9],[-28,-5],[-8,-4],[-16,-15],[-8,-5],[-10,0],[-13,4],[-72,42],[-10,3],[-5,0],[-4,-4],[-2,-7],[1,-18],[13,-53],[-1,-14],[-2,-8],[-5,-14],[-2,-10],[-1,-11],[0,-16],[-4,-9],[-8,-7],[-17,-11],[-4,-6],[1,-7],[6,-7],[16,-5],[10,-2],[16,1],[10,-1],[21,-6],[9,-1],[7,2],[15,7],[10,1],[10,-3],[9,-17],[12,-15],[3,-14],[-16,-41]],[[4193,3195],[-33,-15],[-173,-141],[-8,-2],[-7,8],[-13,29],[-6,22],[-5,15],[-3,6],[-16,23],[-14,16],[-3,6],[-2,8],[-3,7],[-5,4],[-6,4],[-6,4],[-6,5],[-4,5],[-3,6],[-2,9],[-3,6],[-26,24],[-27,31],[-3,7],[-2,17],[-2,7],[-3,7],[-8,12],[-2,7],[-2,9],[-1,7],[-4,6],[-5,5],[-7,4],[-18,8],[-6,5],[-5,5],[-3,6],[-6,15],[-3,5],[-3,4],[-4,0],[-6,-2],[-43,-19],[-13,-2],[-55,-2],[-11,-5],[-47,-26],[-6,0],[-7,4],[-44,77],[-7,8],[-6,-5],[-4,-11],[-18,-59],[-8,-46],[-3,-42],[-3,-15],[-6,-8],[-41,0],[-52,10],[-17,6],[-15,11],[-6,7],[-4,7],[-5,5],[-5,5],[-29,18],[-21,18],[-95,100],[-21,17],[-23,16],[-10,9],[-45,54],[-25,43],[-8,8],[-8,7],[-9,10],[-3,7],[-2,7],[-4,27],[-1,18],[-1,9],[-2,8],[-4,7],[-4,6],[-17,12],[-8,11],[-4,7],[-8,12],[-10,5],[-16,4],[-34,5],[-28,8],[-19,11],[-44,33],[-24,14],[-25,7],[-69,10],[-10,-1],[-9,-2],[-11,-8],[-18,-16],[-9,-3],[-11,-2],[-21,2],[-23,5],[-20,-1],[-14,-3],[-14,3],[-8,5],[-7,4],[-7,3],[-8,2],[-8,0],[-32,6],[-178,-24],[-28,6],[-22,2],[-24,-1],[-250,-66],[-20,-8],[-41,-25],[-23,-14]],[[1863,3701],[-4,5],[-18,11],[-58,19],[-24,11],[-18,20],[-9,33],[-10,28],[-22,25],[-52,36],[-24,11],[-51,13],[-23,10],[-25,25],[-35,59],[-29,17],[-39,8],[-10,5],[-15,11],[0,3],[9,5],[9,18],[9,31],[-3,12],[-13,19],[-10,11],[-12,10],[-14,7],[-69,2],[-57,17],[-50,34],[-32,53],[-122,379],[-30,65],[-38,56],[-32,58],[-10,28],[-5,36],[4,30],[21,55],[5,30],[-1,2],[-34,116],[-160,158],[-46,111],[-8,107],[-15,52],[-32,32],[-49,28],[-37,35],[-60,96],[-18,20],[-43,32],[-84,98],[-17,30],[-6,20],[-12,62],[-11,29],[-41,74],[-41,114],[-27,55],[-39,34],[-43,28],[-35,42],[-52,99],[-37,102],[-9,35],[0,42],[52,126],[9,-10],[23,-12],[39,-34],[25,-13],[13,-2],[40,2],[42,-18],[14,-2],[96,0],[7,-2],[12,-8],[8,-1],[7,3],[11,13],[8,4],[86,18],[67,33],[32,4],[16,-12],[15,-15],[48,-15],[29,-15],[25,-18],[11,-16],[13,-22],[58,-28],[17,-25],[-20,-8],[-2,-21],[9,-24],[13,-17],[78,-41],[55,-2],[14,2],[71,41],[9,-11],[7,18],[21,5],[23,1],[18,6],[2,6],[-3,18],[1,6],[8,3],[22,7],[22,13],[29,6],[12,7],[45,39],[12,6],[11,-5],[9,-12],[8,-14],[6,-9],[12,-5],[59,-7],[12,-6],[10,-9],[8,-9],[10,-2],[47,8],[59,-12],[98,-60],[53,-19],[34,-6],[22,-10],[16,-15],[20,-24],[18,-17],[20,-12],[73,-26],[18,-3],[16,5],[36,37],[17,11],[20,6],[32,4],[120,61],[30,-11],[47,35],[14,6],[60,3],[19,6],[35,21],[38,40],[47,51],[43,59],[-3,35],[-1,36],[2,15],[13,22],[338,390],[131,132],[68,77],[34,74],[26,117],[21,51],[174,291],[51,61],[66,45],[197,94]],[[3583,8155],[4,-11],[21,-107],[-8,-55],[-4,-14],[-1,-8],[0,-2],[0,-1],[5,-6],[21,-12],[7,-9],[1,-14],[-17,-51],[-3,-26],[-1,-7],[2,-6],[5,-6],[10,-7],[18,-8],[7,-6],[5,-9],[6,-17],[4,-11],[6,-8],[9,-3],[8,0],[6,2],[7,1],[7,-1],[14,-6],[6,-4],[3,-6],[0,-10],[-5,-18],[-1,-9],[2,-9],[3,-9],[8,-13],[4,-10],[-1,-15],[-6,-16],[1,-9],[3,-8],[8,-12],[5,-9],[1,-12],[0,-25],[6,-25],[2,-15],[3,-12],[5,-9],[25,-21],[12,-17],[15,-10],[10,-5],[10,-3],[8,-10],[6,-8],[15,-65]],[[6574,5213],[69,-19],[22,-11],[20,-22],[32,-25],[55,-26],[25,-7],[19,-9],[27,-27],[9,-4],[8,-2],[12,-2],[20,-5],[35,0],[27,-4],[9,-5],[11,-6],[8,-4],[9,-3],[-3,-8],[-13,-23],[-2,-6],[1,-9],[4,-14],[26,-50],[31,-45],[6,-13],[4,-11],[2,-10],[1,-9],[-1,-6],[-5,-2],[-5,-1],[-5,-4],[-6,-21],[-1,-6],[0,-4],[0,-4],[1,-4],[1,-4],[1,-3],[1,-3],[-1,-4],[-1,-5],[2,-8],[4,-5],[26,-23],[19,-23],[25,-24],[19,-26],[17,-17],[5,-2],[32,-8],[32,-20]],[[7208,4607],[-178,-160],[-10,-11],[-3,-8],[5,-5],[8,-4],[40,-9],[9,-6],[8,-9],[1,-10],[-6,-12],[-17,-11],[-14,-7],[-8,-7],[-2,-12],[-3,-121],[-13,-78],[4,-24],[5,-21],[2,-15],[-2,-15],[-22,-119],[-1,-12],[1,-36],[-1,-9],[-14,-46],[-4,-28],[1,-19],[2,-16],[1,-6],[2,-4],[4,-5],[4,-3],[2,-6],[-2,-7],[-10,-6],[-9,-4],[-38,-10],[-16,-1],[-16,2],[-38,11],[-35,21],[-10,4],[-12,1],[-109,-4],[-12,-8],[-14,-30],[-1,-7],[1,-4],[2,-4],[1,-6],[1,-2],[1,-2],[2,-2],[1,-3],[1,-4],[0,-8],[2,-5],[2,-4],[2,-3],[1,-3],[1,-3],[-1,-5],[-4,-6],[-7,-10],[-30,-25],[-4,-7],[-2,-14],[0,-6],[1,-5],[1,-2],[1,-4],[-1,-5],[-3,-8],[-1,-5],[0,-3],[2,-2],[4,0],[9,-1],[-6,-7],[-7,-2],[-9,-2],[-199,-9],[-8,-1],[-7,-2],[-96,-51],[-10,-8],[-4,-8],[7,-10],[3,-11],[2,-20],[-9,-52],[-15,-32],[-7,-60],[1,-42],[3,-4],[9,4],[22,16],[21,-2],[21,-7],[17,-12],[7,-10],[6,-19],[4,-24],[2,-29],[-1,-30],[-10,-36],[0,-15],[3,-9],[6,-3],[5,-5],[17,-33],[5,-5],[10,-9],[5,-4],[7,-3],[14,-5],[25,-2],[6,-1],[6,-4],[2,-6],[0,-8],[-1,-8],[1,-8],[2,-8],[3,-7],[8,-11],[5,-5],[6,-4],[7,-3],[15,-3],[7,-2],[5,-5],[3,-6],[3,-7],[3,-8],[3,-7],[5,-5],[5,-5],[28,-21],[5,-5],[3,-6],[3,-8],[1,-18],[2,-7],[2,-8],[1,-1],[53,-64],[2,-8],[-2,-12],[-5,-16],[-2,-13],[0,-10],[5,-15],[2,-8],[1,-9],[-2,-27],[0,-9],[2,-8],[2,-8],[4,-6],[4,-6],[5,-5],[11,-9],[4,-5],[2,-8],[3,-18],[3,-8],[2,-7],[0,-9],[-2,-7],[-17,-32],[-3,-9],[-2,-9],[0,-8],[6,-31],[0,-8],[-2,-9],[-14,-29],[-6,-35],[-4,-9],[-5,-9],[-14,-18],[-4,-8],[-2,-8],[7,-108],[-3,-23],[-10,-16],[-127,-127],[-11,-2],[-9,2],[-8,3],[-9,3],[-24,15],[-7,0],[-4,-1],[-13,-10],[-6,-3],[-6,-3],[-4,-2],[-4,-4],[-7,-3],[-9,0],[-34,6],[-24,0],[-32,5],[-12,3],[-7,4],[-6,4],[-7,7],[-8,10],[-5,5],[-7,4],[-29,10],[-16,10],[-12,12],[-20,29],[-5,5],[-9,5],[-19,8],[-6,4],[-9,7],[-8,8],[-10,9],[-9,6],[-9,8],[-6,7],[-9,6],[-9,3],[-16,1],[-13,-2],[-12,-5],[-17,-10],[-151,-137],[-26,-14],[-15,-2],[-10,-1],[-65,9]],[[5762,2024],[-20,1],[-40,-6],[-89,-22],[-52,1],[-48,13],[-34,2],[-7,1],[-25,9],[-13,7],[-4,5],[-1,6],[17,16],[182,135],[5,8],[4,13],[67,344],[0,10],[-8,0],[-54,-19],[-12,-2],[-7,4],[-5,17],[-5,12],[-8,13],[-12,12],[-4,7],[-1,8],[3,13],[2,8],[4,7],[7,3],[9,7],[9,9],[-1,18],[12,32],[3,16],[0,77],[9,2],[9,-3],[43,-33],[12,-5],[11,6],[9,9],[21,30],[10,21],[10,28],[3,15],[1,12],[-2,48],[0,12],[2,9],[76,201],[2,10],[6,70],[2,8],[85,196],[4,15],[0,14],[-40,74],[-4,1],[-6,-1],[-18,-13],[-5,0],[-5,2],[-8,37],[-9,16],[-18,1],[-90,-24],[-10,4],[-7,18],[-8,44],[-5,16],[-7,2],[-7,-2],[-13,-7],[-7,-2],[-57,-14],[-7,1],[-8,4],[-58,48],[-84,46],[-11,3],[-19,2],[-22,-11],[-22,-7],[-13,4],[-14,29],[-4,16],[-3,14],[0,18],[14,71],[-2,12],[-3,14],[-11,26],[-8,16],[-34,37],[-11,19],[-10,33],[-1,11],[-4,10],[-6,10],[-30,29],[-5,7],[-5,9],[-30,64],[-13,39],[-18,24],[-65,66]],[[3870,7353],[42,-8],[17,4],[16,9],[129,34],[21,3],[19,-2],[29,-8],[8,1],[7,4],[7,5],[7,-1],[6,-5],[6,-6],[11,-8],[7,0],[6,3],[9,15],[7,8],[23,16],[6,6],[50,69],[13,30],[14,27],[50,66],[12,11],[9,5],[10,1],[27,-4],[11,0],[7,4],[5,6],[10,20],[8,9],[11,10],[36,25],[11,5],[59,20],[16,3],[8,0],[35,-6],[11,0],[8,2],[6,4],[39,33],[7,2],[6,-2],[7,-8],[6,-8],[6,-13],[5,-23],[3,-6],[11,-19],[3,-6],[8,-21],[7,-12],[8,-11],[5,-5],[6,-4],[88,-33],[36,-33],[7,-4],[21,-4],[8,-3],[7,-3],[5,-5],[5,-5],[5,-5],[6,-4],[81,-31],[7,-2],[15,-1],[11,3],[13,4],[10,2],[9,-2],[8,-4],[8,-6],[13,-10],[4,-5],[5,-5],[9,-20],[4,-15],[6,-32],[2,-7],[2,-7],[4,-6],[85,-109],[9,-6],[11,-6],[23,-8],[9,-7],[3,-7],[-9,-25],[-3,-6],[-4,-5],[-5,-4],[-22,-16],[-10,-9],[-8,-12],[-3,-7],[-6,-15],[-7,-13],[-10,-9],[-6,-5],[-5,-4],[-4,-6],[-4,-6],[-2,-7],[0,-9],[4,-9],[15,-17],[4,-7],[2,-8],[3,-34],[-5,-36],[-1,-36],[-1,-9],[-3,-8],[-3,-8],[-3,-6],[-4,-6],[-21,-17],[-5,-6],[-1,-7],[2,-9],[12,-15],[6,-9],[3,-10],[-2,-7],[-7,-14],[-8,-11],[-16,-14],[-5,-5],[-4,-6],[-2,-8],[-6,-38],[-3,-8],[-3,-7],[-17,-23],[-3,-7],[-9,-23],[-14,-27],[-34,-92],[-8,-12],[-3,-6],[-2,-8],[-2,-16],[-2,-6],[-2,-4],[-1,-1],[-1,-2],[0,-3],[0,-7],[3,-14],[3,-7],[3,-16],[0,-8],[-1,-17],[1,-8],[2,-7],[3,-7],[3,-7],[3,-16],[4,-8],[6,-9],[18,-20],[5,-8],[1,-8],[0,-9],[1,-8],[2,-7],[4,-6],[34,-35],[4,-6],[3,-7],[6,-16],[6,-9],[32,-39],[10,-8],[28,-15],[8,-7],[6,-7],[11,-19],[12,-15],[10,-6],[20,-6],[14,-5],[175,-125],[48,-24],[7,-7],[4,-9],[1,-8],[-1,-9],[-2,-9],[-14,-39],[-2,-8],[0,-9],[1,-16],[-1,-6],[-2,-4],[-4,-5],[-9,-9],[-4,-6],[-2,-7],[-1,-8],[5,-69],[-3,-28],[0,-9],[0,-9],[3,-11],[5,-12],[9,-18],[9,-7],[8,-4],[13,-4],[16,-7],[49,-33],[13,-6],[7,1],[12,6],[7,0],[32,-6],[8,-1],[10,-3],[11,-4],[16,-10],[9,-9],[10,-12],[7,-5],[7,-1],[6,3],[8,1],[9,-1],[28,-14],[12,-3],[5,-3],[5,-4],[3,-8],[7,-11],[7,-6],[7,-3],[19,-4],[43,-22],[7,-3],[48,-10],[7,0],[6,4],[10,9],[5,4],[21,7],[9,1],[11,-2],[42,-23],[25,-2],[8,-2],[31,-18],[7,-3],[16,-4],[17,-2],[33,2],[8,-1],[44,-12],[17,-7],[17,-11],[10,-10],[27,-32],[9,-7],[10,-5],[19,-6],[30,-15],[29,-7],[17,-7],[9,-5],[11,-10],[45,-47]],[[9905,7565],[-1,0],[-7,-1],[-27,-8],[-95,-42],[-12,-10],[-30,-31],[-86,-69],[-6,-7],[-4,-8],[-38,-84],[-2,-7],[0,-18],[-2,-10],[-7,-13],[-8,-9],[-8,-5],[-19,-10],[-13,-4],[-40,-17],[-8,-7],[-5,-7],[-2,-8],[-2,-27],[-1,-9],[-3,-9],[-4,-8],[-53,-63],[-14,-10],[-11,-7],[-7,-1],[-14,-5],[-12,-6],[-7,-3],[-23,-3],[-45,-22],[-7,-7],[-16,-25],[-19,-23],[-12,-8],[-9,-2],[-14,5],[-7,2],[-9,1],[-11,-2],[-14,-5],[-23,-12],[-20,-15],[-52,-58],[-13,-10],[-29,-18],[-11,-10],[-6,-7],[-7,-12],[-12,-26],[-10,-15],[-7,-8],[-6,-5],[-27,-12],[-27,-16],[-35,-15],[-8,-6],[-6,-6],[-4,-7],[-2,-8],[-9,-56],[-1,-19],[3,-24],[-1,-7],[-5,-8],[-300,-335],[-1,-10],[0,-9],[3,-26],[-5,-15],[-10,-20],[-47,-70],[-3,-8],[-1,-9],[-3,-48],[4,-26],[4,-14],[2,-6],[1,-15],[-18,-41],[-5,-16],[4,-28],[-2,-15],[-9,-7],[-13,-6],[-56,-14],[-12,-5],[-10,-7],[-5,-12],[-2,-14],[-1,-15],[-3,-14],[-3,-13],[-7,-6],[-5,-4],[-4,-4],[-8,-9],[6,-12],[14,-25],[4,-23],[11,-26],[1,-11],[-5,-16],[-7,-19],[0,-11],[3,-8],[3,-6],[3,-16],[2,-7],[12,-18],[12,-26],[4,-6],[4,-6],[14,-15],[11,-19],[12,-17],[3,-6],[3,-9],[6,-29],[5,-17],[3,-6],[5,-6],[4,-4],[7,-4],[7,-2],[23,-1],[9,-2],[7,-2],[6,-4],[5,-5],[4,-6],[28,-78],[23,-127],[2,-8],[3,-6],[5,-6],[5,-4],[12,-8],[4,-6],[2,-7],[2,-8],[2,-7],[4,-6],[12,-18],[6,-12],[6,-14],[1,-7],[1,-7],[-5,-62],[1,-28],[-3,-28],[-1,-20],[6,-36],[-8,-25],[-8,6],[-9,4],[-13,3],[-10,0],[-22,-8],[-12,-2],[-26,7],[-51,27],[-47,13],[-20,17],[-48,55],[-18,12],[-21,8],[-22,-2],[-63,-11],[-24,2],[-43,21],[-28,8],[-12,0],[-5,-5],[3,-6],[8,-11],[3,-6],[2,-7],[-2,-7],[-9,-21],[-9,-31],[-18,-42],[-11,-20],[-8,-11],[-23,-26],[-9,-3],[-8,1],[-6,4],[-6,4],[-6,4],[-9,3],[-14,0],[-10,2],[-7,3],[-3,7],[-1,8],[0,8],[-2,8],[-3,6],[-24,26],[-7,5],[-11,5],[-7,-1],[-6,-4],[-10,-12],[-7,-6],[-8,-2],[-8,1],[-13,6],[-12,7],[-12,3],[-17,1],[-34,-2],[-13,-8],[-6,-8],[-1,-7],[-5,-8],[-1,-59],[-13,-35],[0,-72],[-15,-8],[-125,-16]],[[7642,4642],[-200,-5],[-56,8],[-4,8],[-2,8],[-1,17],[1,19],[4,16],[2,7],[2,3],[2,5],[-1,3],[-1,2],[0,1],[1,1],[4,8],[3,10],[1,11],[-1,7],[-5,3],[-4,1],[-44,4],[-14,-2],[-8,-7],[-14,-23],[-8,-11],[-11,-6],[-19,-3],[-7,-2],[-3,-6],[2,-11],[5,-14],[-2,-31],[-56,-56]],[[6574,5213],[23,24],[9,22],[10,69],[3,12],[55,124],[11,14],[7,2],[6,-4],[3,-6],[3,-6],[14,-44],[3,-6],[3,-5],[3,-4],[20,-53],[7,-2],[10,2],[26,10],[10,7],[5,6],[-1,6],[-4,15],[-1,7],[1,7],[5,3],[7,-1],[28,-10],[5,-4],[11,-10],[7,-4],[9,-1],[14,2],[5,6],[2,4],[-1,6],[-6,23],[0,9],[2,9],[6,2],[7,-1],[29,-8],[4,-2],[4,-4],[5,-9],[2,3],[4,4],[58,111],[55,59],[9,12],[5,12],[3,18],[9,204],[2,12],[4,15],[6,10],[8,7],[13,11],[5,9],[2,8],[-2,7],[-6,14],[-7,12],[-35,43],[-53,54],[-8,11],[-4,6],[-2,7],[-2,8],[-2,49],[1,13],[4,8],[5,5],[12,7],[7,3],[9,10],[12,16],[22,38],[7,18],[3,14],[-3,7],[-1,8],[0,8],[12,47],[6,12],[6,9],[18,13],[3,9],[1,7],[-19,49],[-2,9],[-1,12],[3,18],[3,9],[4,6],[1,1],[1,1],[20,9],[6,4],[7,7],[3,7],[1,8],[-2,8],[-5,14],[-2,10],[-1,12],[3,20],[5,11],[5,2],[4,-1],[10,-5],[35,-15],[17,-11],[7,-5]],[[9600,8386],[1,0],[11,8],[18,8],[20,4],[40,-3],[78,-19],[40,-3],[21,6],[38,27],[21,10],[16,2],[-9,-42],[-36,-155],[-22,-48],[-20,-29],[-91,-99],[1,-10],[73,-142],[53,-106],[33,-85],[17,-90],[2,-55]],[[9188,1632],[-122,85],[-20,29],[1,22],[-45,119],[-9,35],[-7,7],[-90,49],[15,22],[-4,15],[-28,24],[-7,14],[-4,13],[-12,69],[-5,13],[-12,18],[0,12],[18,34],[5,14],[6,32],[46,94],[24,76],[2,30],[5,26],[12,22],[27,38],[13,87],[19,29],[10,71],[7,207],[63,415],[1,147],[-8,13],[-3,14],[-23,16],[-67,36],[-85,72],[-17,7],[-12,4],[-10,1],[-25,-1],[-29,-5],[-8,3],[-8,6],[-11,13],[-8,8],[-10,7],[-14,4],[-11,2],[-14,4],[-16,8],[-28,22],[-19,21],[-10,13],[-10,22],[-6,7],[-8,7],[-34,17],[-7,5],[-7,7],[-10,14],[-4,10],[-4,9],[-12,44],[-7,10],[-9,12],[-40,40],[-30,38],[-4,7],[-2,7],[-9,29],[-4,7],[-8,9],[-16,12],[-59,35],[-8,8],[-11,13],[-6,10],[-3,9],[-1,8],[-2,8],[-2,7],[-5,6],[-39,42],[-7,13],[-3,12],[0,16],[0,5],[-5,5],[-9,4],[-31,5],[-13,4],[-18,8],[-11,7],[-10,9],[-6,4],[-10,1],[-14,-6],[-6,-1],[-8,2],[-8,5],[-8,11],[-5,8],[-7,10],[-11,10],[-33,26],[-13,7],[-24,6],[-8,3],[-6,4],[-14,15],[-5,4],[-7,3],[-14,1],[-9,-2],[-7,-3],[-6,-5],[-6,-2],[-8,1],[-15,8],[-16,12],[-47,43],[-207,139],[-17,23]],[[9905,7565],[0,-15],[5,-32],[13,-30],[12,-10],[28,-17],[9,-14],[1,-23],[-8,-23],[-6,-10],[-18,-31],[-50,-108],[-8,-12],[-12,-8],[-8,-10],[0,-16],[14,-50],[6,-12],[22,-19],[48,-25],[17,-26],[6,-30],[-5,-28],[-21,-55],[-5,-57],[3,-64],[-5,-54],[-32,-24],[-22,-11],[-14,-25],[-8,-30],[-3,-29],[2,-29],[15,-41],[2,-26],[-5,-19],[-10,-10],[-10,-8],[-6,-11],[2,-14],[15,-21],[-1,-12],[-7,-30],[3,-33],[45,-152],[4,-49],[-1,-11],[-11,-31],[-10,-20],[-8,-11],[-2,-12],[6,-22],[19,-31],[60,-54],[23,-28],[10,-28],[-6,-17],[-37,-30],[-27,-43],[-3,1],[1,-15],[17,-21],[4,-15],[-8,-30],[-23,-19],[-28,-15],[-25,-16],[-23,-13],[-24,-8],[-22,-10],[-16,-20],[-3,-25],[4,-30],[17,-53],[38,-84],[10,-40],[-3,-49],[-9,-39],[-13,-32],[-22,-20],[-34,-3],[-52,4],[-39,-6],[-123,-63],[-2,-13],[9,-80],[8,-22],[16,-11],[-14,-12],[-16,-10],[-12,-12],[-2,-18],[9,-33],[2,-16],[-2,-19],[3,-20],[11,-11],[14,-6],[17,-1],[80,13],[22,-2],[14,-7],[7,-6],[4,-10],[3,-18],[6,-18],[10,-11],[12,-11],[11,-14],[8,-51],[-37,-182],[-1,-37],[-5,-26],[-10,-25],[-18,-32],[-48,-60],[-3,-14],[2,-43],[-8,-60],[2,-31],[13,-17],[25,-1],[23,3],[18,-7],[9,-32],[0,-27],[-9,-107],[1,-13],[3,-15],[2,-19],[-6,-14],[-7,-13],[-4,-15],[4,-33],[14,-16],[24,-5],[29,-2],[29,9],[38,42],[24,9],[22,-14],[2,-30],[-10,-57],[10,-26],[22,-23],[27,-19],[28,-13],[13,-17],[-4,-28],[-8,-35],[-2,-60],[-25,-87],[-5,-109],[8,-35],[4,-11],[-69,3],[-17,-17],[-8,-45],[-10,-21],[-20,-7],[-21,-4],[-11,-14],[-10,-71],[-6,-23],[-18,-35],[-2,-14],[1,-11],[9,-19],[1,-12],[-10,-45],[-7,-21],[-9,-19],[-57,-77],[-83,-111],[-40,-85],[-42,-89],[-33,-38],[-54,-10],[-60,8],[-56,-8],[-40,-57],[-14,-62],[-2,-61],[18,-159],[18,-153],[-8,-56],[-30,-65],[-65,-89],[-98,-138],[7,-13],[18,-12],[12,-17],[5,-1],[6,0],[4,-3],[0,-10],[-5,-9],[-5,-8],[-2,-6],[94,-172],[1,-7],[2,-6],[-50,34]],[[5762,2024],[20,-70],[9,-21],[58,-73],[6,-5],[10,-5],[31,-19],[5,-5],[1,-4],[-3,-3],[0,-8],[3,-13],[13,-31],[7,-13],[6,-7],[11,-2],[7,-3],[13,-9],[5,-7],[2,-11],[2,-40],[3,-10],[3,-4],[5,-1],[7,-1],[10,-5],[4,-6],[3,-7],[0,-8],[2,-10],[4,-5],[5,-4],[8,-3],[3,-3],[3,-4],[19,-50],[7,-13],[6,-9],[6,-4],[13,-7],[11,-9],[5,-5],[5,-5],[15,-9],[6,-5],[14,-15],[21,-40],[6,-7],[14,-9],[23,-23],[10,-19],[8,-10],[7,-7],[8,-3],[10,-7],[5,-8],[6,-13],[5,-4],[5,-1],[3,1],[2,0],[5,1],[5,-1],[17,-5],[8,-2],[17,0],[11,-5],[5,-9],[5,-20],[5,-6],[7,-4],[11,-3],[26,-16],[9,-4],[11,-3],[6,-5],[4,-6],[2,-7],[1,-9],[-3,-19],[4,-6],[6,-5],[8,-2],[103,-14],[15,-5],[7,-1],[6,1],[7,4],[6,2],[8,1],[30,-16],[31,-24],[28,-14],[10,-10],[39,-16],[26,-2],[10,-4],[4,-5],[0,-7],[-8,-11],[-2,-6],[1,-5],[11,-17],[26,-31],[7,-10],[10,-20],[6,-2],[7,-1],[7,1],[7,-2],[16,-10],[29,-13],[8,0],[7,2],[13,6],[8,-2],[5,-5],[0,-7],[-1,-8],[-1,-9],[5,-6],[18,-9],[4,-7],[2,-9],[-1,-8],[1,-8],[9,-32],[4,-10],[5,-7],[32,-20],[8,-8],[5,-9],[4,-9],[58,-79],[2,-6],[-2,-17],[1,-10],[9,-16],[9,-9],[10,-6],[13,-7],[3,-7],[1,-7],[-3,-7],[0,-8],[0,-14],[-2,-4],[-1,-2],[-1,-1],[-1,-2],[-3,-4],[-1,-7],[3,-4],[7,-1],[8,0],[10,-3],[12,-5],[18,-13],[9,-9],[8,-13],[7,-9],[14,-11],[6,-10],[7,-21],[5,-5],[7,-2],[17,3],[12,-1],[5,-4],[4,-8],[0,-17],[2,-7],[4,-8],[11,-14],[4,-7],[2,-8],[3,-20],[5,-14],[6,-7],[6,-5],[20,-4],[13,-5],[6,-6],[2,-7],[-2,-17],[5,-4],[7,-1],[16,1],[9,-1],[10,-4],[5,-7],[1,-8],[1,-11],[3,-11],[9,-18],[4,-10],[1,-18],[2,-10],[15,-23],[3,-9],[3,-19],[3,-10],[7,-6],[9,-4],[8,-1],[7,1],[8,-1],[5,-7],[18,-37]],[[7512,92],[-12,-3],[-22,5],[-44,21],[-139,35],[-77,9],[-37,11],[-42,-18],[-142,-13],[-25,-8],[-34,-26],[-20,-7],[-8,3],[-20,15],[-12,3],[-37,0],[-82,10],[-25,-1],[-24,-7],[-48,-23],[-24,-9],[-52,-10],[-48,-1],[-44,11],[-40,30],[-18,18],[-19,12],[-24,8],[-31,3],[-57,-9],[-22,2],[-31,17],[-36,28],[-19,9],[-38,5],[-3,4],[-2,7],[-24,28],[-13,7],[-28,7],[-12,5],[-35,23],[-19,6],[-46,5],[-31,17],[-44,11],[-74,53],[-26,8],[-86,-5],[-15,-6],[-24,17],[-26,-4],[-47,-23],[-43,5],[-25,-6],[-11,-25],[-13,-14],[-32,3],[-64,17],[-27,-7],[-46,-28],[-28,-16],[-19,1],[-8,2],[-9,7],[-97,90],[-8,14],[-10,29],[-7,13],[-13,17],[-6,5],[-121,-4],[-47,9],[-48,27],[-38,44],[-24,56],[-10,63],[5,62],[14,32],[21,35],[16,35],[-3,28],[-22,18],[-51,17],[-22,17],[-37,9],[-78,5],[-39,11],[-187,95],[-59,20],[-49,42],[-18,6],[-38,4],[-41,12],[-14,-3],[-14,-7],[-44,-13],[-21,-8],[-21,-4],[-28,6],[-104,58],[-51,19],[-47,10],[-152,3],[-96,20],[-74,5],[-21,7],[-18,13],[-15,18],[-8,14],[-11,30],[-7,12],[-8,5],[-8,-1],[-6,1],[-5,15],[7,19],[-5,8],[-10,4],[-4,2],[3,14],[10,18],[4,12],[-4,15],[-38,84],[-21,24],[-8,14],[-2,11],[1,23],[-3,12],[-12,21],[-46,59],[-33,56],[-38,51],[-88,70],[-20,23],[-44,65],[-10,28],[0,26],[16,78],[1,31],[-9,83],[-1,14],[4,33],[-1,17],[2,20],[7,13],[9,13],[7,16],[20,120],[-3,59],[-32,117],[10,53],[16,52],[4,58],[-10,26],[-18,19],[-23,10],[-51,1],[-45,22],[-73,-14],[-102,14],[-145,1],[-44,-6],[-48,-28],[20,213],[-23,173],[-66,182],[-16,26],[-23,16],[-27,8],[-27,5],[-15,1],[-13,-2],[-13,1],[-16,7],[-14,12],[-22,34],[-11,15],[-43,25],[-41,5],[-43,0],[-46,9],[-145,80],[-47,10],[-31,0],[-25,6],[-22,12],[-19,22],[-18,27],[-10,11]],[[4193,3195],[22,-28],[6,-1],[7,1],[41,37],[5,1],[6,-2],[9,-5],[15,-4],[17,-9]],[[9188,1632],[-45,-55],[-62,-75],[-67,-80],[-67,-80],[-67,-80],[-67,-80],[-67,-80],[-67,-81],[-67,-80],[-67,-80],[-67,-80],[-67,-80],[-67,-80],[-67,-81],[-67,-80],[-67,-80],[-67,-80],[-67,-80],[-66,-80],[-84,-63],[-102,-77],[-29,47],[-13,11],[-13,1],[-20,-10],[-11,-1],[-10,4],[-20,14],[-9,3],[-9,7],[-26,34],[-14,9],[-19,-3],[-42,-22],[-10,-2]],[[3583,8155],[117,56],[126,117],[86,62],[464,203],[61,12],[36,0],[18,3],[10,11],[26,27],[10,26],[51,42],[17,23],[9,53],[5,12],[31,57],[-1,33],[-21,62],[-5,26],[5,31],[30,79],[-21,42],[6,59],[17,61],[7,51],[-3,7],[-6,8],[-6,11],[-2,13],[3,16],[18,30],[4,11],[28,39],[43,47],[18,9],[6,3],[27,6],[58,1],[31,6],[16,18],[28,57],[12,16],[21,20],[25,18],[25,7],[12,8],[45,53],[282,145],[19,5],[111,11],[23,16],[47,45],[31,10],[27,-4],[25,-8],[26,-4],[31,5],[73,27],[55,10],[53,27],[29,7],[57,-6],[110,-33],[55,-7],[50,9],[51,16],[51,8],[51,-13],[33,-25],[15,-6],[20,6],[10,7],[20,19],[11,4],[32,-5],[21,-10]]],"transform":{"scale":[0.0007824180856085748,0.0006783210059005959],"translate":[25.219369751000045,-22.39733978299992]}};

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
