import { TypedUseSelectorHook, useSelector } from 'react-redux';
import { RootState } from '../views/dvt-store';

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
