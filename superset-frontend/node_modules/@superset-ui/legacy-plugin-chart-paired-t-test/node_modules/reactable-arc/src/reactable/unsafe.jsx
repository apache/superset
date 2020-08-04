class Unsafe {
    constructor(content) {
        this.content = content;
    }

    toString() {
        return this.content;
    }
}

export function unsafe(str) {
    return new Unsafe(str);
};

export function isUnsafe(obj) {
    return obj instanceof Unsafe;
};
