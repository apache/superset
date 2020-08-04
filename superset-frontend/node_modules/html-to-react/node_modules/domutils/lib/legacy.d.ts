import { Node, Element } from "domhandler";
import { ElementType } from "domelementtype";
interface TestElementOpts {
    tag_name?: string | ((name: string) => boolean);
    tag_type?: string | ((name: string) => boolean);
    tag_contains?: string | ((data?: string) => boolean);
    [attributeName: string]: undefined | string | ((attributeValue: string) => boolean);
}
export declare function testElement(options: TestElementOpts, element: Node): boolean;
export declare function getElements(options: TestElementOpts, element: Node | Node[], recurse: boolean, limit?: number): Node[];
export declare function getElementById(id: string | ((id: string) => boolean), element: Node | Node[], recurse?: boolean): Element | null;
export declare function getElementsByTagName(name: string | ((name: string) => boolean), element: Node | Node[], recurse: boolean, limit?: number): Element[];
export declare function getElementsByTagType(type: ElementType | ((type: ElementType) => boolean), element: Node | Node[], recurse?: boolean, limit?: number): Node[];
export {};
//# sourceMappingURL=legacy.d.ts.map