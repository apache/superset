# MCP Prompts and Resources Implementation Plan

## Executive Summary

This document outlines a plan to enhance the Superset MCP service by adding **Prompts** and **Resources** - two powerful MCP features that would transform how users interact with Superset through LLMs.

**Current State**: 16 individual tools requiring users to know exact names and parameters
**Proposed State**: Intelligent prompts guiding workflows + resources providing rich context

## What Are Prompts and Resources?

### 🎯 Prompts
- **Definition**: Pre-built conversation starters that guide users through complex workflows
- **Purpose**: Provide interactive, context-aware guidance for common Superset tasks
- **Benefit**: Users don't need to know tool names or sequence - the prompt guides them

### 📚 Resources
- **Definition**: Direct data/document access that gives LLMs contextual information
- **Purpose**: Expose Superset templates, configurations, and live state to the LLM
- **Benefit**: LLM has rich context to make better decisions and provide accurate guidance

## Implementation Architecture

### 1. Prompt Categories

```python
# Example prompt structure
@mcp.prompt("create_executive_dashboard")
async def create_executive_dashboard_prompt():
    """Guide user through creating a comprehensive executive dashboard"""
    return PromptResponse(
        prompt_text="""I'll help you create an executive dashboard. I'll:
        1. Identify your key business metrics
        2. Create appropriate visualizations
        3. Design an optimal layout
        4. Set up automated refresh

        What's your primary business area? (sales/marketing/operations/finance)""",

        # Suggested follow-up tools based on response
        suggested_tools=["list_datasets", "generate_chart", "generate_dashboard"]
    )
```

#### Proposed Prompt Categories:

**📊 Dashboard Creation Prompts**
- `create_executive_dashboard` - C-suite dashboard with KPIs
- `create_sales_dashboard` - Sales performance tracking
- `create_marketing_dashboard` - Campaign and funnel analytics
- `create_operational_dashboard` - Operational metrics and alerts

**🔍 Data Exploration Prompts**
- `explore_new_dataset` - Guided dataset exploration
- `find_data_insights` - Automated insight discovery
- `analyze_time_series` - Time-based pattern analysis
- `compare_segments` - Segment comparison analysis

**🛠️ Administration Prompts**
- `optimize_slow_dashboard` - Performance troubleshooting
- `migrate_dashboards` - Dashboard migration assistant
- `setup_alerts` - Alert configuration guide
- `audit_permissions` - Security audit workflow

**🎓 Learning Prompts**
- `superset_quickstart` - New user onboarding
- `advanced_features` - Advanced feature discovery
- `sql_query_help` - SQL query assistance
- `chart_best_practices` - Visualization guidance

### 2. Resource Types

```python
# Example resource structure
@mcp.resource("chart_templates/{chart_type}")
async def get_chart_templates(chart_type: str):
    """Provide chart configuration templates"""
    return ResourceResponse(
        data={
            "name": f"{chart_type}_template",
            "config": {...},
            "sql_examples": [...],
            "best_practices": {...}
        },
        content_type="application/json",
        cache_ttl=3600  # Cache for 1 hour
    )
```

#### Proposed Resource Categories:

**📋 Template Resources**
- `sql_templates/` - Common SQL query patterns
- `chart_templates/` - Pre-configured chart settings
- `dashboard_layouts/` - Layout templates by use case
- `color_schemes/` - Approved color palettes

**📊 Configuration Resources**
- `chart_type_matrix` - Which chart for which data
- `performance_guidelines` - Query optimization rules
- `data_modeling_patterns` - Best practice schemas
- `calculation_library` - Common calculated fields

**📈 Live State Resources**
- `instance_metadata` - Current Superset configuration
- `usage_statistics` - Popular dashboards/charts
- `performance_metrics` - Current system performance
- `user_preferences` - Saved preferences/bookmarks

**📚 Documentation Resources**
- `feature_changelog` - Recent Superset updates
- `api_documentation` - Dynamic API docs
- `example_workflows` - Step-by-step guides
- `troubleshooting_guide` - Common issues/solutions

### 3. Integration with Existing Tools

Prompts and resources enhance rather than replace existing tools:

```python
# Prompt uses multiple tools in sequence
@mcp.prompt("quarterly_report")
async def quarterly_report_prompt():
    workflow = PromptWorkflow()

    # Step 1: Gather available data
    workflow.add_step("list_datasets", {"filters": [{"col": "schema", "opr": "eq", "value": "sales"}]})

    # Step 2: Create visualizations
    workflow.add_step("generate_chart", templates_from="resource:chart_templates/quarterly_metrics")

    # Step 3: Assemble dashboard
    workflow.add_step("generate_dashboard", layout_from="resource:dashboard_layouts/executive")

    return workflow
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Add prompt and resource decorators to MCP service
2. Create base classes: `PromptResponse`, `ResourceResponse`
3. Implement resource caching system
4. Add prompt workflow engine

### Phase 2: Core Prompts (Week 3-4)
1. Implement 4-5 essential prompts:
   - `explore_new_dataset`
   - `create_executive_dashboard`
   - `optimize_slow_dashboard`
   - `superset_quickstart`
2. Create user feedback collection

### Phase 3: Template Resources (Week 5-6)
1. Build SQL template library
2. Create chart configuration templates
3. Design dashboard layout templates
4. Implement template versioning

### Phase 4: Live Resources (Week 7-8)
1. Add instance metadata resources
2. Implement usage statistics collection
3. Create performance metrics resources
4. Add caching with appropriate TTLs

### Phase 5: Advanced Features (Week 9-10)
1. Multi-step workflow prompts
2. Conditional prompt paths
3. Resource subscriptions (live updates)
4. Prompt analytics

## Technical Implementation Details

### 1. Prompt Registration

```python
# In mcp_app.py (after mcp instance creation)
from superset.mcp_service.prompts import register_all_prompts
from superset.mcp_service.resources import register_all_resources

# Register after tool registration
register_all_prompts(mcp)
register_all_resources(mcp)
```

### 2. Prompt Structure

```python
# superset/mcp_service/prompts/base.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class PromptStep(BaseModel):
    tool_name: str
    params: Dict[str, Any]
    condition: Optional[str] = None  # JavaScript expression

class PromptResponse(BaseModel):
    prompt_text: str
    suggested_tools: List[str]
    workflow: Optional[List[PromptStep]] = None
    context_resources: List[str] = []  # Resources to preload

class PromptContext(BaseModel):
    user_response: str
    previous_steps: List[Dict[str, Any]]
    available_resources: List[str]
```

### 3. Resource Structure

```python
# superset/mcp_service/resources/base.py
from typing import Any, Optional
from pydantic import BaseModel

class ResourceResponse(BaseModel):
    data: Any
    content_type: str = "application/json"
    cache_ttl: Optional[int] = 300  # seconds
    version: str = "1.0"
    last_modified: Optional[str] = None

class ResourceSubscription(BaseModel):
    resource_path: str
    update_frequency: int  # seconds
    filter_expression: Optional[str] = None
```

### 4. Caching Strategy

```python
# Use Redis for resource caching
class ResourceCache:
    def __init__(self, redis_client):
        self.redis = redis_client

    async def get(self, resource_path: str) -> Optional[Any]:
        cached = await self.redis.get(f"mcp:resource:{resource_path}")
        if cached:
            return json.loads(cached)
        return None

    async def set(self, resource_path: str, data: Any, ttl: int):
        await self.redis.setex(
            f"mcp:resource:{resource_path}",
            ttl,
            json.dumps(data)
        )
```

## Example Use Cases

### Use Case 1: New User Onboarding

```
User: "I'm new to Superset, help me get started"
LLM: *Activates superset_quickstart prompt*

"Welcome! I'll guide you through Superset step by step. Let me check what's available in your instance..."

*Uses resources: instance_metadata, example_workflows*
*Guides through: list_datasets → explore dataset → create first chart → view in dashboard*
```

### Use Case 2: Performance Optimization

```
User: "My dashboard is loading slowly"
LLM: *Activates optimize_slow_dashboard prompt*

"I'll help diagnose and fix your slow dashboard. First, let me analyze its current state..."

*Uses resources: performance_metrics, performance_guidelines*
*Executes: get_dashboard_info → analyze queries → suggest optimizations → implement caching*
```

### Use Case 3: Executive Reporting

```
User: "Create a quarterly sales report"
LLM: *Activates quarterly_report prompt*

"I'll create a comprehensive quarterly sales report. Let me gather your sales data..."

*Uses resources: sql_templates/quarterly_metrics, dashboard_layouts/executive*
*Executes: find sales datasets → create KPI charts → design dashboard → set up refresh*
```

## Success Metrics

1. **User Experience**
   - Reduction in average steps to complete workflows (target: 50%)
   - Increase in successful dashboard creation (target: 30%)
   - Decrease in support tickets (target: 25%)

2. **Technical Metrics**
   - Resource cache hit rate >80%
   - Prompt completion rate >90%
   - Average prompt response time <2s

3. **Adoption Metrics**
   - % of users using prompts vs direct tools
   - Most popular prompts and resources
   - User feedback ratings

## Migration Strategy

1. **Backward Compatibility**: All existing tools remain functional
2. **Gradual Adoption**: Prompts introduced alongside tools
3. **User Choice**: Users can use either approach
4. **Analytics**: Track which approach users prefer

## Future Enhancements

1. **AI-Generated Prompts**: LLM suggests new prompts based on usage patterns
2. **Personalized Resources**: Resources tailored to user's role/history
3. **Collaborative Prompts**: Multi-user workflow support
4. **Voice Integration**: Audio prompts for accessibility

## Next Steps

1. **Stakeholder Review**: Present plan to Superset core team
2. **Prototype Development**: Build POC with 2-3 prompts
3. **User Testing**: Validate approach with target users
4. **Implementation**: Follow phased approach above

---

## Appendix: Technical Specifications

### FastMCP Prompt API
```python
@mcp.prompt(name: str, description: str)
async def prompt_function() -> PromptResponse | str
```

### FastMCP Resource API
```python
@mcp.resource(path: str, description: str)
async def resource_function(**kwargs) -> ResourceResponse | Any
```

### Required Dependencies
- FastMCP >= 1.0.0 (with prompt/resource support)
- Redis (for caching)
- Pydantic >= 2.0
- AsyncIO support

---

*This plan provides a comprehensive approach to enhancing Superset's MCP service with prompts and resources, making it more intuitive and powerful for LLM-assisted analytics workflows.*
