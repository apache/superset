import TimeFormatter from '../TimeFormatter';
declare type FormatsByStep = Partial<{
    millisecond: string;
    second: string;
    minute: string;
    hour: string;
    day: string;
    week: string;
    month: string;
    year: string;
}>;
export default function createMultiFormatter({ id, label, description, formats, useLocalTime, }: {
    id: string;
    label?: string;
    description?: string;
    formats?: FormatsByStep;
    useLocalTime?: boolean;
}): TimeFormatter;
export {};
//# sourceMappingURL=createMultiFormatter.d.ts.map