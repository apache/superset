import { ReactNode } from 'react';
import { GroupType, OptionTypeBase } from './types';

export type formatGroupLabel<OptionType extends OptionTypeBase = any> = (group: GroupType<OptionType>) => ReactNode;
export function formatGroupLabel(group: GroupType<any>): ReactNode;

export type getOptionLabel<OptionType extends OptionTypeBase = any> = (option: OptionType) => string;
export function getOptionLabel(option: any): string;

export type getOptionValue<OptionType extends OptionTypeBase = any> = (option: OptionType) => string;
export function getOptionValue(option: any): string;

export type isOptionDisabled<OptionType extends OptionTypeBase = any> = (option: OptionType) => boolean;
export function isOptionDisabled(option: any): boolean;
