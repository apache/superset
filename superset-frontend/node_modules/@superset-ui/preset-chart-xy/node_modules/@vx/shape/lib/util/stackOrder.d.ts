import { stackOrderAscending, stackOrderDescending, stackOrderInsideOut, stackOrderNone, stackOrderReverse } from 'd3-shape';
export declare const STACK_ORDERS: {
    ascending: typeof stackOrderAscending;
    descending: typeof stackOrderDescending;
    insideout: typeof stackOrderInsideOut;
    none: typeof stackOrderNone;
    reverse: typeof stackOrderReverse;
};
export declare const STACK_ORDER_NAMES: string[];
export default function stackOrder(order?: keyof typeof STACK_ORDERS): typeof stackOrderAscending;
//# sourceMappingURL=stackOrder.d.ts.map