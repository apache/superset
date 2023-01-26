export interface ChartPost {
	slice_name: string;
	description: string;
	viz_type: string;
	owners: any[];
	params: string;
	query_context: string;
	query_context_generation: boolean;
	cache_timeout: number;
	datasource_id: number;
	datasource_type: string;
	datasource_name: string;
	dashboards: any[];
	certified_by: string;
	certification_details: string;
	is_managed_externally: boolean;
	external_url: string;
}

