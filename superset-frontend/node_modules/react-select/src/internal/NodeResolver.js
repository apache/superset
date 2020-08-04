// @flow

import { Component, type Element, type ElementRef } from 'react';
import { findDOMNode } from 'react-dom';

type Props = {
  children: Element<*>,
  innerRef: ElementRef<*>,
};

export default class NodeResolver extends Component<Props> {
  componentDidMount() {
    this.props.innerRef(findDOMNode(this));
  }
  componentWillUnmount() {
    this.props.innerRef(null);
  }
  render() {
    return this.props.children;
  }
}
