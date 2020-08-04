import { stackOrderAscending, stackOrderDescending, stackOrderInsideOut, stackOrderNone, stackOrderReverse } from 'd3-shape';
export var STACK_ORDERS = {
  ascending: stackOrderAscending,
  descending: stackOrderDescending,
  insideout: stackOrderInsideOut,
  none: stackOrderNone,
  reverse: stackOrderReverse
};
export var STACK_ORDER_NAMES = Object.keys(STACK_ORDERS);
export default function stackOrder(order) {
  return order && STACK_ORDERS[order] || STACK_ORDERS.none;
}