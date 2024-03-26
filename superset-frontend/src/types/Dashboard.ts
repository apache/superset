// DODO was here
import Owner from './Owner';
import Role from './Role';

export interface Dashboard {
  id: number;
  slug?: string | null;
  url: string;
  dashboard_title: string;
  // DODO added
  dashboard_title_RU: string;
  thumbnail_url: string;
  published: boolean;
  css?: string | null;
  json_metadata?: string | null;
  position_json?: string | null;
  changed_by_name: string;
  changed_by: Owner;
  changed_on: string;
  charts: string[]; // just chart names, unfortunately...
  owners: Owner[];
  roles: Role[];
}
