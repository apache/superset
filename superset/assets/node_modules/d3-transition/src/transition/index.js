import {selection} from "d3-selection";
import transition_attr from "./attr";
import transition_attrTween from "./attrTween";
import transition_delay from "./delay";
import transition_duration from "./duration";
import transition_ease from "./ease";
import transition_filter from "./filter";
import transition_merge from "./merge";
import transition_on from "./on";
import transition_remove from "./remove";
import transition_select from "./select";
import transition_selectAll from "./selectAll";
import transition_selection from "./selection";
import transition_style from "./style";
import transition_styleTween from "./styleTween";
import transition_text from "./text";
import transition_transition from "./transition";
import transition_tween from "./tween";
import transition_end from "./end";

var id = 0;

export function Transition(groups, parents, name, id) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id;
}

export default function transition(name) {
  return selection().transition(name);
}

export function newId() {
  return ++id;
}

var selection_prototype = selection.prototype;

Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: transition_select,
  selectAll: transition_selectAll,
  filter: transition_filter,
  merge: transition_merge,
  selection: transition_selection,
  transition: transition_transition,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: transition_on,
  attr: transition_attr,
  attrTween: transition_attrTween,
  style: transition_style,
  styleTween: transition_styleTween,
  text: transition_text,
  remove: transition_remove,
  tween: transition_tween,
  delay: transition_delay,
  duration: transition_duration,
  ease: transition_ease,
  end: transition_end
};
