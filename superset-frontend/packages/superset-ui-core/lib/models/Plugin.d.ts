interface PlainObject {
    [key: string]: any;
}
export default class Plugin {
    config: PlainObject;
    constructor();
    resetConfig(): this;
    configure(config: PlainObject, replace?: boolean): this;
    register(): this;
    unregister(): this;
}
export {};
//# sourceMappingURL=Plugin.d.ts.map