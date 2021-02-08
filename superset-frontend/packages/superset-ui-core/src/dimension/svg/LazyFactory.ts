export default class LazyFactory<T extends HTMLElement | SVGElement> {
  private activeNodes = new Map<
    HTMLElement | SVGElement,
    {
      counter: number;
      node: T;
    }
  >();

  private factoryFn: () => T;

  constructor(factoryFn: () => T) {
    this.factoryFn = factoryFn;
  }

  createInContainer(container: HTMLElement | SVGElement = document.body) {
    if (this.activeNodes.has(container)) {
      const entry = this.activeNodes.get(container)!;
      entry.counter += 1;

      return entry.node;
    }

    const node = this.factoryFn();
    container.append(node);
    this.activeNodes.set(container, { counter: 1, node });

    return node;
  }

  removeFromContainer(container: HTMLElement | SVGElement = document.body) {
    if (this.activeNodes.has(container)) {
      const entry = this.activeNodes.get(container)!;
      entry.counter -= 1;
      if (entry.counter === 0) {
        container.removeChild(entry.node);
        this.activeNodes.delete(container);
      }
    }
  }
}
