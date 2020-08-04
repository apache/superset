import {path} from "d3-path";
import circle from "./symbol/circle";
import cross from "./symbol/cross";
import diamond from "./symbol/diamond";
import star from "./symbol/star";
import square from "./symbol/square";
import triangle from "./symbol/triangle";
import wye from "./symbol/wye";
import constant from "./constant";

export var symbols = [
  circle,
  cross,
  diamond,
  square,
  star,
  triangle,
  wye
];

export default function() {
  var type = constant(circle),
      size = constant(64),
      context = null;

  function symbol() {
    var buffer;
    if (!context) context = buffer = path();
    type.apply(this, arguments).draw(context, +size.apply(this, arguments));
    if (buffer) return context = null, buffer + "" || null;
  }

  symbol.type = function(_) {
    return arguments.length ? (type = typeof _ === "function" ? _ : constant(_), symbol) : type;
  };

  symbol.size = function(_) {
    return arguments.length ? (size = typeof _ === "function" ? _ : constant(+_), symbol) : size;
  };

  symbol.context = function(_) {
    return arguments.length ? (context = _ == null ? null : _, symbol) : context;
  };

  return symbol;
}
