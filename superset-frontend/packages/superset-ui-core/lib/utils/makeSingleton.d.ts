interface ClassInterface<T, Args extends unknown[]> {
    new (...args: Args): T;
}
export default function makeSingleton<T, Args extends unknown[]>(BaseClass: ClassInterface<T, Args>, ...args: Args): () => T;
export {};
//# sourceMappingURL=makeSingleton.d.ts.map