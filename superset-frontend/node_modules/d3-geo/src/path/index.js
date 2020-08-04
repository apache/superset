import identity from "../identity.js";
import stream from "../stream.js";
import pathArea from "./area.js";
import pathBounds from "./bounds.js";
import pathCentroid from "./centroid.js";
import PathContext from "./context.js";
import pathMeasure from "./measure.js";
import PathString from "./string.js";

export default function(projection, context) {
  var pointRadius = 4.5,
      projectionStream,
      contextStream;

  function path(object) {
    if (object) {
      if (typeof pointRadius === "function") contextStream.pointRadius(+pointRadius.apply(this, arguments));
      stream(object, projectionStream(contextStream));
    }
    return contextStream.result();
  }

  path.area = function(object) {
    stream(object, projectionStream(pathArea));
    return pathArea.result();
  };

  path.measure = function(object) {
    stream(object, projectionStream(pathMeasure));
    return pathMeasure.result();
  };

  path.bounds = function(object) {
    stream(object, projectionStream(pathBounds));
    return pathBounds.result();
  };

  path.centroid = function(object) {
    stream(object, projectionStream(pathCentroid));
    return pathCentroid.result();
  };

  path.projection = function(_) {
    return arguments.length ? (projectionStream = _ == null ? (projection = null, identity) : (projection = _).stream, path) : projection;
  };

  path.context = function(_) {
    if (!arguments.length) return context;
    contextStream = _ == null ? (context = null, new PathString) : new PathContext(context = _);
    if (typeof pointRadius !== "function") contextStream.pointRadius(pointRadius);
    return path;
  };

  path.pointRadius = function(_) {
    if (!arguments.length) return pointRadius;
    pointRadius = typeof _ === "function" ? _ : (contextStream.pointRadius(+_), +_);
    return path;
  };

  return path.projection(projection).context(context);
}
