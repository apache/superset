import * as React from "react";
import {
  Transition,
  TransitionFunction,
  PlainObject,
  PlainObjectFunction,
} from '../core';

export interface IAnimateProps {
  /**
   * Boolean value that determines if the child should be rendered or not.
   */
  show?: boolean;
  /**
  * An object or function that returns an obejct to be used as the starting state. 
  */
  start: PlainObjectFunction | PlainObject;
  /**
   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on enter.
   */
  enter?: TransitionFunction | Transition | Array<Transition>
  /**
   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on update. ***Note:*** although not required, in most cases it make sense to specify an update prop to handle interrupted enter and leave transitions.
   */
  update?: TransitionFunction | Transition | Array<Transition>
  /**
   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on leave.
   */
  leave?: TransitionFunction | Transition | Array<Transition>
  /**
   * A function that renders the node.  The function is passed the data and state.
   */
  children: (state: PlainObject) => React.ReactElement<any>;
}

declare class Animate extends React.Component<IAnimateProps> { }

export default Animate;
