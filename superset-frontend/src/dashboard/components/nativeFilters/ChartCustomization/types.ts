export interface GroupByCustomization {
  name: string;
  dataset: string | null;
  description?: string;
  sortFilter?: boolean;
  sortAscending?: boolean;
  sortMetric?: string;
  hasDefaultValue?: boolean;
  defaultValue?: string;
  isRequired?: boolean;
  selectFirst?: boolean;
  defaultDataMask?: {
    filterState?: {
      value?: any;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface ChartCustomizationItem {
  id: string;
  title?: string;
  removed?: boolean;
  dataset?: string | null;
  description?: string;
  removeTimerId?: number;
  settings?: {
    sortFilter: boolean;
    hasDefaultValue: boolean;
    isRequired: boolean;
    selectFirstByDefault: boolean;
  };
  customization: GroupByCustomization;
}
