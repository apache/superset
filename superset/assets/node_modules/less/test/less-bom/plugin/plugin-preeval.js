module.exports = {
    install({ tree: { Quoted }, visitors }, manager) {
        class Visitor {
            constructor() {
                this.native = new visitors.Visitor(this);

                this.isPreEvalVisitor = true;
                this.isReplacing = true;
            }

            run(root) {
                return this.native.visit(root);
            }

            visitVariable(node) {
                if (node.name === '@replace') {
                    return new Quoted(`'`, 'bar', true);
                }
                return node;
            }
        }

        manager.addVisitor(new Visitor());
        // console.log(manager);
    },
    minVersion: [2,0,0]
};
