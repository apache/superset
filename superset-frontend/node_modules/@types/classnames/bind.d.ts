import { ClassNamesFn } from './types';

interface ClassNamesBind extends ClassNamesFn {
    bind(styles: Record<string, string>): ClassNamesFn;
}
type ClassNamesBindExport = ClassNamesBind & {
    default: ClassNamesBind;
};
declare const classNamesBind: ClassNamesBindExport;

export = classNamesBind;
