export default class LazyFactory<T extends HTMLElement | SVGElement> {
    private activeNodes;
    private factoryFn;
    constructor(factoryFn: () => T);
    createInContainer(container?: HTMLElement | SVGElement): T;
    removeFromContainer(container?: HTMLElement | SVGElement): void;
}
//# sourceMappingURL=LazyFactory.d.ts.map