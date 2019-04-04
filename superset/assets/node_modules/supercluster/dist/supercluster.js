(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
typeof define === 'function' && define.amd ? define(factory) :
(global.supercluster = factory());
}(this, (function () { 'use strict';

function sortKD(ids, coords, nodeSize, left, right, depth) {
    if (right - left <= nodeSize) return;

    var m = Math.floor((left + right) / 2);

    select(ids, coords, m, left, right, depth % 2);

    sortKD(ids, coords, nodeSize, left, m - 1, depth + 1);
    sortKD(ids, coords, nodeSize, m + 1, right, depth + 1);
}

function select(ids, coords, k, left, right, inc) {

    while (right > left) {
        if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            select(ids, coords, k, newLeft, newRight, inc);
        }

        var t = coords[2 * k + inc];
        var i = left;
        var j = right;

        swapItem(ids, coords, left, k);
        if (coords[2 * right + inc] > t) swapItem(ids, coords, left, right);

        while (i < j) {
            swapItem(ids, coords, i, j);
            i++;
            j--;
            while (coords[2 * i + inc] < t) i++;
            while (coords[2 * j + inc] > t) j--;
        }

        if (coords[2 * left + inc] === t) swapItem(ids, coords, left, j);
        else {
            j++;
            swapItem(ids, coords, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swapItem(ids, coords, i, j) {
    swap(ids, i, j);
    swap(coords, 2 * i, 2 * j);
    swap(coords, 2 * i + 1, 2 * j + 1);
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

function range(ids, coords, minX, minY, maxX, maxY, nodeSize) {
    var stack = [0, ids.length - 1, 0];
    var result = [];
    var x, y;

    while (stack.length) {
        var axis = stack.pop();
        var right = stack.pop();
        var left = stack.pop();

        if (right - left <= nodeSize) {
            for (var i = left; i <= right; i++) {
                x = coords[2 * i];
                y = coords[2 * i + 1];
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[i]);
            }
            continue;
        }

        var m = Math.floor((left + right) / 2);

        x = coords[2 * m];
        y = coords[2 * m + 1];

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[m]);

        var nextAxis = (axis + 1) % 2;

        if (axis === 0 ? minX <= x : minY <= y) {
            stack.push(left);
            stack.push(m - 1);
            stack.push(nextAxis);
        }
        if (axis === 0 ? maxX >= x : maxY >= y) {
            stack.push(m + 1);
            stack.push(right);
            stack.push(nextAxis);
        }
    }

    return result;
}

function within(ids, coords, qx, qy, r, nodeSize) {
    var stack = [0, ids.length - 1, 0];
    var result = [];
    var r2 = r * r;

    while (stack.length) {
        var axis = stack.pop();
        var right = stack.pop();
        var left = stack.pop();

        if (right - left <= nodeSize) {
            for (var i = left; i <= right; i++) {
                if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2) result.push(ids[i]);
            }
            continue;
        }

        var m = Math.floor((left + right) / 2);

        var x = coords[2 * m];
        var y = coords[2 * m + 1];

        if (sqDist(x, y, qx, qy) <= r2) result.push(ids[m]);

        var nextAxis = (axis + 1) % 2;

        if (axis === 0 ? qx - r <= x : qy - r <= y) {
            stack.push(left);
            stack.push(m - 1);
            stack.push(nextAxis);
        }
        if (axis === 0 ? qx + r >= x : qy + r >= y) {
            stack.push(m + 1);
            stack.push(right);
            stack.push(nextAxis);
        }
    }

    return result;
}

function sqDist(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
}

function kdbush(points, getX, getY, nodeSize, ArrayType) {
    return new KDBush(points, getX, getY, nodeSize, ArrayType);
}

function KDBush(points, getX, getY, nodeSize, ArrayType) {
    getX = getX || defaultGetX;
    getY = getY || defaultGetY;
    ArrayType = ArrayType || Array;

    this.nodeSize = nodeSize || 64;
    this.points = points;

    this.ids = new ArrayType(points.length);
    this.coords = new ArrayType(points.length * 2);

    for (var i = 0; i < points.length; i++) {
        this.ids[i] = i;
        this.coords[2 * i] = getX(points[i]);
        this.coords[2 * i + 1] = getY(points[i]);
    }

    sortKD(this.ids, this.coords, this.nodeSize, 0, this.ids.length - 1, 0);
}

KDBush.prototype = {
    range: function (minX, minY, maxX, maxY) {
        return range(this.ids, this.coords, minX, minY, maxX, maxY, this.nodeSize);
    },

    within: function (x, y, r) {
        return within(this.ids, this.coords, x, y, r, this.nodeSize);
    }
};

function defaultGetX(p) { return p[0]; }
function defaultGetY(p) { return p[1]; }

function supercluster(options) {
    return new SuperCluster(options);
}

function SuperCluster(options) {
    this.options = extend(Object.create(this.options), options);
    this.trees = new Array(this.options.maxZoom + 1);
}

SuperCluster.prototype = {
    options: {
        minZoom: 0,   // min zoom to generate clusters on
        maxZoom: 16,  // max zoom level to cluster the points on
        radius: 40,   // cluster radius in pixels
        extent: 512,  // tile extent (radius is calculated relative to it)
        nodeSize: 64, // size of the KD-tree leaf node, affects performance
        log: false,   // whether to log timing info

        // a reduce function for calculating custom cluster properties
        reduce: null, // function (accumulated, props) { accumulated.sum += props.sum; }

        // initial properties of a cluster (before running the reducer)
        initial: function () { return {}; }, // function () { return {sum: 0}; },

        // properties to use for individual points when running the reducer
        map: function (props) { return props; } // function (props) { return {sum: props.my_value}; },
    },

    load: function (points) {
        var log = this.options.log;

        if (log) console.time('total time');

        var timerId = 'prepare ' + points.length + ' points';
        if (log) console.time(timerId);

        this.points = points;

        // generate a cluster object for each point and index input points into a KD-tree
        var clusters = [];
        for (var i = 0; i < points.length; i++) {
            if (!points[i].geometry) {
                continue;
            }
            clusters.push(createPointCluster(points[i], i));
        }
        this.trees[this.options.maxZoom + 1] = kdbush(clusters, getX, getY, this.options.nodeSize, Float32Array);

        if (log) console.timeEnd(timerId);

        // cluster points on max zoom, then cluster the results on previous zoom, etc.;
        // results in a cluster hierarchy across zoom levels
        for (var z = this.options.maxZoom; z >= this.options.minZoom; z--) {
            var now = +Date.now();

            // create a new set of clusters for the zoom and index them with a KD-tree
            clusters = this._cluster(clusters, z);
            this.trees[z] = kdbush(clusters, getX, getY, this.options.nodeSize, Float32Array);

            if (log) console.log('z%d: %d clusters in %dms', z, clusters.length, +Date.now() - now);
        }

        if (log) console.timeEnd('total time');

        return this;
    },

    getClusters: function (bbox, zoom) {
        var minLng = ((bbox[0] + 180) % 360 + 360) % 360 - 180;
        var minLat = Math.max(-90, Math.min(90, bbox[1]));
        var maxLng = bbox[2] === 180 ? 180 : ((bbox[2] + 180) % 360 + 360) % 360 - 180;
        var maxLat = Math.max(-90, Math.min(90, bbox[3]));

        if (bbox[2] - bbox[0] >= 360) {
            minLng = -180;
            maxLng = 180;
        } else if (minLng > maxLng) {
            var easternHem = this.getClusters([minLng, minLat, 180, maxLat], zoom);
            var westernHem = this.getClusters([-180, minLat, maxLng, maxLat], zoom);
            return easternHem.concat(westernHem);
        }

        var tree = this.trees[this._limitZoom(zoom)];
        var ids = tree.range(lngX(minLng), latY(maxLat), lngX(maxLng), latY(minLat));
        var clusters = [];
        for (var i = 0; i < ids.length; i++) {
            var c = tree.points[ids[i]];
            clusters.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
        }
        return clusters;
    },

    getChildren: function (clusterId) {
        var originId = clusterId >> 5;
        var originZoom = clusterId % 32;
        var errorMsg = 'No cluster with the specified id.';

        var index = this.trees[originZoom];
        if (!index) throw new Error(errorMsg);

        var origin = index.points[originId];
        if (!origin) throw new Error(errorMsg);

        var r = this.options.radius / (this.options.extent * Math.pow(2, originZoom - 1));
        var ids = index.within(origin.x, origin.y, r);
        var children = [];
        for (var i = 0; i < ids.length; i++) {
            var c = index.points[ids[i]];
            if (c.parentId === clusterId) {
                children.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
            }
        }

        if (children.length === 0) throw new Error(errorMsg);

        return children;
    },

    getLeaves: function (clusterId, limit, offset) {
        limit = limit || 10;
        offset = offset || 0;

        var leaves = [];
        this._appendLeaves(leaves, clusterId, limit, offset, 0);

        return leaves;
    },

    getTile: function (z, x, y) {
        var tree = this.trees[this._limitZoom(z)];
        var z2 = Math.pow(2, z);
        var extent = this.options.extent;
        var r = this.options.radius;
        var p = r / extent;
        var top = (y - p) / z2;
        var bottom = (y + 1 + p) / z2;

        var tile = {
            features: []
        };

        this._addTileFeatures(
            tree.range((x - p) / z2, top, (x + 1 + p) / z2, bottom),
            tree.points, x, y, z2, tile);

        if (x === 0) {
            this._addTileFeatures(
                tree.range(1 - p / z2, top, 1, bottom),
                tree.points, z2, y, z2, tile);
        }
        if (x === z2 - 1) {
            this._addTileFeatures(
                tree.range(0, top, p / z2, bottom),
                tree.points, -1, y, z2, tile);
        }

        return tile.features.length ? tile : null;
    },

    getClusterExpansionZoom: function (clusterId) {
        var clusterZoom = (clusterId % 32) - 1;
        while (clusterZoom < this.options.maxZoom) {
            var children = this.getChildren(clusterId);
            clusterZoom++;
            if (children.length !== 1) break;
            clusterId = children[0].properties.cluster_id;
        }
        return clusterZoom;
    },

    _appendLeaves: function (result, clusterId, limit, offset, skipped) {
        var children = this.getChildren(clusterId);

        for (var i = 0; i < children.length; i++) {
            var props = children[i].properties;

            if (props && props.cluster) {
                if (skipped + props.point_count <= offset) {
                    // skip the whole cluster
                    skipped += props.point_count;
                } else {
                    // enter the cluster
                    skipped = this._appendLeaves(result, props.cluster_id, limit, offset, skipped);
                    // exit the cluster
                }
            } else if (skipped < offset) {
                // skip a single point
                skipped++;
            } else {
                // add a single point
                result.push(children[i]);
            }
            if (result.length === limit) break;
        }

        return skipped;
    },

    _addTileFeatures: function (ids, points, x, y, z2, tile) {
        for (var i = 0; i < ids.length; i++) {
            var c = points[ids[i]];
            var f = {
                type: 1,
                geometry: [[
                    Math.round(this.options.extent * (c.x * z2 - x)),
                    Math.round(this.options.extent * (c.y * z2 - y))
                ]],
                tags: c.numPoints ? getClusterProperties(c) : this.points[c.index].properties
            };
            var id = c.numPoints ? c.id : this.points[c.index].id;
            if (id !== undefined) {
                f.id = id;
            }
            tile.features.push(f);
        }
    },

    _limitZoom: function (z) {
        return Math.max(this.options.minZoom, Math.min(z, this.options.maxZoom + 1));
    },

    _cluster: function (points, zoom) {
        var clusters = [];
        var r = this.options.radius / (this.options.extent * Math.pow(2, zoom));

        // loop through each point
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            // if we've already visited the point at this zoom level, skip it
            if (p.zoom <= zoom) continue;
            p.zoom = zoom;

            // find all nearby points
            var tree = this.trees[zoom + 1];
            var neighborIds = tree.within(p.x, p.y, r);

            var numPoints = p.numPoints || 1;
            var wx = p.x * numPoints;
            var wy = p.y * numPoints;

            var clusterProperties = null;

            if (this.options.reduce) {
                clusterProperties = this.options.initial();
                this._accumulate(clusterProperties, p);
            }

            // encode both zoom and point index on which the cluster originated
            var id = (i << 5) + (zoom + 1);

            for (var j = 0; j < neighborIds.length; j++) {
                var b = tree.points[neighborIds[j]];
                // filter out neighbors that are already processed
                if (b.zoom <= zoom) continue;
                b.zoom = zoom; // save the zoom (so it doesn't get processed twice)

                var numPoints2 = b.numPoints || 1;
                wx += b.x * numPoints2; // accumulate coordinates for calculating weighted center
                wy += b.y * numPoints2;

                numPoints += numPoints2;
                b.parentId = id;

                if (this.options.reduce) {
                    this._accumulate(clusterProperties, b);
                }
            }

            if (numPoints === 1) {
                clusters.push(p);
            } else {
                p.parentId = id;
                clusters.push(createCluster(wx / numPoints, wy / numPoints, id, numPoints, clusterProperties));
            }
        }

        return clusters;
    },

    _accumulate: function (clusterProperties, point) {
        var properties = point.numPoints ?
            point.properties :
            this.options.map(this.points[point.index].properties);

        this.options.reduce(clusterProperties, properties);
    }
};

function createCluster(x, y, id, numPoints, properties) {
    return {
        x: x, // weighted cluster center
        y: y,
        zoom: Infinity, // the last zoom the cluster was processed at
        id: id, // encodes index of the first child of the cluster and its zoom level
        parentId: -1, // parent cluster id
        numPoints: numPoints,
        properties: properties
    };
}

function createPointCluster(p, id) {
    var coords = p.geometry.coordinates;
    return {
        x: lngX(coords[0]), // projected point coordinates
        y: latY(coords[1]),
        zoom: Infinity, // the last zoom the point was processed at
        index: id, // index of the source feature in the original input array,
        parentId: -1 // parent cluster id
    };
}

function getClusterJSON(cluster) {
    return {
        type: 'Feature',
        id: cluster.id,
        properties: getClusterProperties(cluster),
        geometry: {
            type: 'Point',
            coordinates: [xLng(cluster.x), yLat(cluster.y)]
        }
    };
}

function getClusterProperties(cluster) {
    var count = cluster.numPoints;
    var abbrev =
        count >= 10000 ? Math.round(count / 1000) + 'k' :
        count >= 1000 ? (Math.round(count / 100) / 10) + 'k' : count;
    return extend(extend({}, cluster.properties), {
        cluster: true,
        cluster_id: cluster.id,
        point_count: count,
        point_count_abbreviated: abbrev
    });
}

// longitude/latitude to spherical mercator in [0..1] range
function lngX(lng) {
    return lng / 360 + 0.5;
}
function latY(lat) {
    var sin = Math.sin(lat * Math.PI / 180),
        y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return y < 0 ? 0 : y > 1 ? 1 : y;
}

// spherical mercator to longitude/latitude
function xLng(x) {
    return (x - 0.5) * 360;
}
function yLat(y) {
    var y2 = (180 - y * 360) * Math.PI / 180;
    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;
}

function extend(dest, src) {
    for (var id in src) dest[id] = src[id];
    return dest;
}

function getX(p) {
    return p.x;
}
function getY(p) {
    return p.y;
}

return supercluster;

})));
