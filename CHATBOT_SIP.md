Chatbot extensions
Author: Enzo Martellucci
Team: Preset
Status: Draft | Under Review | Completed
Day: May, 2026

1. Introduction
   This SIP proposes a new extension point that enables third-party chatbot integrations to be embedded directly into the Superset user interface through the existing extension framework.
   The goal is to provide a stable, supported mechanism for chatbot providers to integrate with Superset without requiring direct access to internal application state, Redux stores, or implementation-specific frontend modules. Chatbot extensions should interact with Superset through the same extension-oriented principles already established for other extension surfaces, such as SQL Lab.
   The proposal focuses on three core concerns:
   • Defining how chatbot extensions are registered and rendered.
   • Defining how chatbot extensions receive contextual information about the currently active application surface.
   • Defining how administrators manage chatbot availability and select the active chatbot when multiple chatbot extensions are installed.
   This SIP intentionally does not prescribe any specific chatbot implementation, user experience, LLM provider, or backend architecture.
   1.1 Motivation
   AI-powered assistants are becoming a common way for users to interact with analytical applications. Superset should provide a standardized extension mechanism that allows community-built chatbot integrations to participate in the platform without depending on internal frontend implementation details.
   Today, chatbot integrations must either be embedded through custom application modifications or rely on unsupported access to internal application state. Both approaches create maintenance challenges and make integrations fragile when frontend architecture evolves.

This SIP introduces a stable extension contract that:
• Enables chatbot integrations to be distributed as standard Superset extensions.
• Preserves separation between host and extension responsibilities.
• Allows chatbot implementations to access contextual information about the current page and entity being viewed.
• Keeps authorization and permission enforcement aligned with existing Superset APIs.
• Remains compatible with future frontend architecture changes.
1.2 Goals
The goals of this SIP are:
Introduce a dedicated chatbot extension point within the Superset application shell.
Provide chatbot extensions with host-managed, permission-aligned page context.
Establish stable extension-facing APIs for dashboard, explore, dataset, and navigation context.
Support deployment-wide administration of chatbot availability and selection.
Maintain isolation between chatbot implementations and Superset internals.
Preserve compatibility with future extension capabilities and AI-related initiatives.
1.3 Out of Scope
The following capabilities are explicitly out of scope for this SIP.
Client Actions and Agentic UI Manipulation
This SIP defines how chatbot extensions are mounted and how they receive context from the host application.
It does not define how a chatbot performs actions within the user interface, such as:
• Modifying chart configuration.
• Updating dashboard layouts.
• Editing SQL queries.
• Triggering frontend workflows.
These capabilities are deferred to the proposed Client Actions SIP.
Chatbot User Experience
The chatbot user interface remains entirely owned by the extension.
This SIP does not prescribe:
• Visual design.
• Conversation experience.
• Streaming behavior.
• Message persistence.
• Prompting strategy.
• Accessibility implementation details.
• Branding or styling.
LLM and Backend Infrastructure
The following concerns remain extension-specific:
• Model providers.
• MCP implementations.
• Agent frameworks.
• Tool execution systems.
• Prompt orchestration.
• Backend services.
Superset acts only as the host application and context provider.

2. Requirements

  2.1 Functional Requirements
  Registration and Rendering
  The platform must allow extensions to register chatbot providers through the standard extension system.
  The host must:
    • Support registration of chatbot extensions.
    • Render a chatbot UI contributed by an extension.
    • Maintain a single active chatbot instance at any given time.
    • Make the chatbot available across supported application surfaces.
    • Support fully custom chatbot user interfaces.

Context Sharing
The platform must provide chatbot extensions with contextual information about the user's current application state.
At minimum, the host must expose:
• Current page type (`home`, `dashboard`, `explore`, `sqllab`, `dataset`, `other`).
• Dashboard context.
• Explore/chart context.
• Dataset identity context.
• SQL Lab context.
• Navigation events.
The chatbot must be notified of relevant context changes without polling.
Examples include:
• Route changes.
• Dashboard changes.
• Chart changes.
• Dataset changes.
• Title changes.
• Filter changes.
Host-Owned Context
Context exposed to extensions must be computed by the host application.
Extensions must not be required to:
• Read Redux state.
• Access internal application modules.
• Depend on component-level implementation details.
• Reconstruct semantic context from frontend internals.
Instead, extensions consume stable namespace APIs provided by the host.
Conversation State
The conversation state remains entirely owned by the chatbot extension.
This includes:
• Message history.
• Tool execution state.
• Streaming buffers.
• Conversation persistence.
• Session management.
The host is responsible only for exposing contextual information.
2.2 Non-Functional Requirements
Security and Authorization
Context shared with chatbot extensions must remain aligned with Superset's existing authorization model.
The host must not expose:
• Entities the current user cannot access.
• Metadata outside the user's permission scope.
• Datasource-derived information unavailable through existing APIs.
Authorization remains enforced by backend APIs. The extension-facing APIs defined by this SIP operate on data that has already been scoped to the current user.
Stable Extension Contracts
Extension-facing APIs must remain independent of frontend implementation details.
Extensions should rely on documented namespace contracts rather than:
• Redux slices.
• Internal selectors.
• Component state.
• Routing implementation details.
This allows frontend architecture to evolve without breaking extensions.
Performance
The architecture must minimize impact on existing application performance.
In particular:
• Context APIs must avoid unnecessary application re-renders.
• Context change notifications must not rely on polling.
• Chatbot integrations should not introduce additional work for unrelated surfaces.
Fault Isolation
Failures within chatbot extensions must not affect the stability of the host application.
Errors originating from third-party chatbot implementations should be isolated to the chatbot mount boundary.
Extensibility
The architecture should support future:
• Application surfaces.
• AI-related capabilities.
• Extension APIs.
• Context providers.
without requiring redesign of the chatbot extension model.
Vendor Neutrality
The architecture must remain independent of any specific:
• LLM provider.
• AI platform.
• Agent framework.
• Backend implementation.

3. Administration
   3.1 Overview
   Administrators can manage chatbot availability and select the active chatbot when multiple chatbot extensions are installed.
   Administration is exposed through the existing Extensions management interface.
   For chatbot extensions, administrators can:
   • Enable or disable individual chatbot extensions.
   • Select the default chatbot when multiple chatbot providers are available.
   Only one chatbot may be active at a time.
   3.2 Default Chatbot Selection
   Extensions that contribute a chatbot view participate in a deployment-wide chatbot selection process.
   The host discovers available chatbot candidates from the chatbot contribution location and allows administrators to designate a single active chatbot.

When multiple chatbot extensions are installed:
Administrators select the preferred chatbot.
The host resolves the active chatbot using the configured selection.
Only the selected chatbot is rendered.
Changes are applied dynamically without requiring a page reload.
3.3 Scope of Administration
The administration model introduced by this SIP is deployment-wide.
Administrative settings answer the question:
"Which chatbot integrations are available within this Superset deployment?"
They do not answer:
"Which chatbot integrations does a specific user prefer to use?"
This distinction is intentional.
Deployment administrators determine which integrations are available across the environment, while user-specific preferences remain a separate concern.
3.4 Future User Preferences
Per-user chatbot preferences are considered an important future capability but are intentionally out of scope for this SIP.
This proposal does not introduce user-scoped extension availability.
Instead, future user preferences should be layered on top of deployment availability using the following model:
Effective Availability = Deployment Availability AND User Preference
The recommended persistence layer for future user preferences is the Extension Storage API, which provides user-scoped extension storage and aligns with the architecture established by SIP-127 (User Preferences).
This separation preserves a clear distinction between:
• Deployment configuration.
• User customization.
and avoids introducing multiple ownership models for extension availability.
Consequently, this SIP focuses exclusively on deployment-wide administration and active chatbot selection. 4. Proposed Extension Point
4.1 Overview
This SIP introduces a single extension point that allows chatbot providers to integrate directly into the Superset application shell.
Extension Point
Contribution Location
Registration API
Cardinality
Chatbot Bubble
superset.chatbot
views.registerView()
Singleton

The chatbot contribution point is application-wide and persists across supported Superset surfaces, including dashboards, Explore, SQL Lab, and dataset-related pages.
Unlike most contribution locations, which allow multiple contributions to be rendered simultaneously, the chatbot location is intentionally exclusive and renders a single active provider.

4.2 Chatbot Contribution Location
Contribution Area
The contribution location introduced by this SIP is:
superset.chatbot
The host provides a fixed mount point within the application shell and renders the active chatbot provider at that location.
The mount point persists across route changes, allowing chatbot conversations and UI state to remain available while users navigate between application surfaces.
The chatbot extension contributes a single React component representing the entire chatbot experience.
Manifest Support
The current contribution manifest schema is focused on SQL Lab contribution locations and does not provide an application-shell-level contribution scope.
To support chatbot integrations, the manifest schema must be extended with an application-level contribution scope capable of declaring:
{
"views": {
"app": [
{
"location": "superset.chatbot"
}
]
}
}
This is a schema-level change and requires updates to both:
• Manifest validation.
• Runtime registration infrastructure.
The runtime registration API alone is not sufficient because chatbot contributions must also be discoverable through extension manifests.
4.3 Singleton Rendering Model
The chatbot location is intentionally exclusive.
Only one chatbot may be active at a time.
This differs from other contribution locations that allow multiple views to be rendered simultaneously.
Motivation
Chatbot interactions are inherently conversational and user-focused.
Rendering multiple chatbot providers simultaneously would:
• Create competing user experiences.
• Introduce ambiguity regarding which chatbot should respond.
• Increase UI complexity.
• Reduce discoverability.
For these reasons, chatbot rendering is treated as a deployment-level selection rather than a multi-provider composition model.
Resolution Rules
The host applies the following behavior:
Installed Chatbots
Behavior
None
No chatbot is rendered
One
The chatbot is rendered automatically
Multiple
The administrator-selected chatbot is rendered

The singleton policy is implemented entirely by the host.
Extensions continue to register normally through the existing view registry.
4.4 Provider Isolation
A key architectural principle of this SIP is that extensions may discover registrations but may not invoke another extension's rendering logic.
Public View Discovery
The existing registry exposes:
getViews(location);
This API returns metadata describing registered views:
interface View {
id: string;
name: string;
description?: string;
icon?: string;
}
The returned descriptors are intentionally passive metadata.
They allow extensions and host components to:
• Discover available contributions.
• Display contribution information.
• Populate administration interfaces.
They do not allow rendering.
Why Providers Are Not Exposed
The view provider is executable rendering logic.
If providers were exposed through the public registry:
• Extensions could render another extension's UI.
• Extensions could bypass host lifecycle management.
• Extensions could circumvent fault-isolation boundaries.
• Rendering ownership would become ambiguous.
This would violate the separation between extension discovery and extension execution.
For this reason:
"Extensions may discover registered views, but only the host may render registered views."
Host-Managed Resolution
The host uses internal APIs to resolve the active chatbot provider.
These APIs are not exposed through the public extension surface.
Conceptually:
const provider = getViewProvider("superset.chatbot", selectedId);
The active chatbot is determined through a host-managed resolution policy:
const chatbot = getActiveChatbot(adminSelectedId, enabledMap);
This policy considers:
• Enabled state.
• Administrative selection.
• Runtime settings.
• Registration state.

before rendering any provider.
As a result, chatbot selection is implemented as a host-side rendering policy rather than a new registration primitive.
4.5 Chatbot Lifecycle
Host Responsibilities
The host is responsible for:
• Providing the chatbot mount point.
• Resolving the active chatbot provider.
• Loading chatbot extensions.
• Managing chatbot lifecycle integration.
• Handling activation and deactivation.
• Maintaining fault isolation boundaries.
• Preserving chatbot availability across route changes.
• Providing context APIs defined by this SIP.
The host also provides fixed positioning and layering behavior to ensure chatbot visibility remains consistent throughout the application.
Fault Isolation
Chatbot providers execute within a host-managed boundary.
Failures originating from a chatbot extension must not affect the rest of the application.
Examples include:
• Module Federation loading failures.
• Runtime exceptions.
• Provider initialization errors.
If a chatbot fails to load, the host logs the failure, surfaces an appropriate notification, and continues operating normally.
The application shell remains functional even when the chatbot provider is unavailable.

4.6 Extension Responsibilities
The registered chatbot component owns the complete chatbot experience.
The extension is responsible for:
User Interface
• Collapsed bubble UI.
• Expanded panel UI.
• Branding.
• Icons and badges.
• Layout.
• Responsiveness.
Interaction Model
• Open and close behavior.
• Keyboard shortcuts.
• Focus management.
• Accessibility behavior.
• Conversation navigation.
Conversation Runtime
• Message history.
• Streaming state.
• Tool execution.
• Persistence.
• Session management.
Backend Integration
• LLM communication.
• MCP integration.
• Agent orchestration.
• Tool invocation.
The host does not manage any chatbot-specific runtime state.

4.7 Registration Example
Chatbot extensions register a single provider through the existing view registration API.
import { views, type ExtensionContext } from '@apache-superset/core';
import { ChatbotApp } from './ChatbotApp';

export function activate(context: ExtensionContext) {
const disposable = views.registerView(
{
id: 'acme.chatbot',
name: 'Acme Chatbot',
icon: 'Bubble',
},
'superset.chatbot',
() => <ChatbotApp />,
);
context.subscriptions.push(disposable);
}
The registration process remains consistent with existing extension contribution patterns.
The only difference is that the host applies singleton resolution before selecting the provider to render.

4.8 Chatbot Descriptor Metadata
Chatbot registrations may include an optional icon descriptor.
{
id: 'acme.chatbot',
name: 'Acme Chatbot',
icon: 'Bubble',
}
This metadata is used by:
• Extension administration interfaces.
• Chatbot selection interfaces.
• Extension discovery surfaces.
Design Decision
The icon descriptor is treated as static registration metadata.
Runtime UI state such as:
• Notification indicators.
• Unread counts.
• Loading states.
• Thinking indicators.
belongs to the chatbot component itself rather than the registration descriptor.
This keeps the registry simple while allowing chatbot implementations complete control over their user experience.
If future requirements emerge for host-visible dynamic icon updates, that capability can be introduced independently without expanding the registration model defined by this SIP. 5. Context and Namespace Model
5.1 Overview
Chatbot extensions require access to contextual information about the user's current activity within Superset. This SIP introduces a namespace-based context model that allows extensions to consume stable, host-managed APIs rather than depending on internal frontend implementation details.
The host exposes context through a set of surface-specific namespaces. Each namespace owns the context for a particular application surface and provides:
• Synchronous state getters.
• Event-based change notifications.
• Stable extension-facing contracts.
• Context aligned with the current user's authorized application view.
Extensions consume these namespaces and compose them into higher-level context models tailored to their own use cases.
5.2 Design Principles
The namespace model is guided by the following principles.
Stable Extension Contracts
Extensions must depend on documented APIs rather than frontend implementation details.
In particular, extensions must not depend on:
• Redux slices.
• Store shape.
• Selectors.
• Component-local state.
• Routing implementation details.
This allows Superset to evolve its frontend architecture without breaking extension integrations.
Host-Owned Context Normalization
The host is responsible for transforming application state into semantic extension-facing contracts.
Extensions consume normalized context rather than deriving it from raw frontend state.
Backend-Authorized Context
Authorization remains a backend responsibility.
Namespaces expose context that has already been scoped by backend APIs according to the current user's permissions.
Namespaces do not implement authorization logic themselves and should not be considered security boundaries.
Event-Driven Updates
Context changes are propagated through events rather than polling.
Extensions can subscribe to context updates and react immediately when relevant application state changes.
5.3 Available Namespaces
The following namespaces are available to chatbot extensions.
Namespace
Status
Purpose
sqlLab
Existing
SQL Lab context and events
authentication
Existing
Current user and session context
commands
Existing
Host actions and commands
dashboard
New
Dashboard context
explore
New
Explore/chart context
dataset
New
Dataset identity context
navigation
New
Routing and page context

The new namespaces introduced by this SIP follow the same high-level contract pattern established by the existing sqlLab namespace.
5.4 Namespace API Shape
Each namespace follows a common structure:
const current = namespace.getCurrent();
const disposable = namespace.onDidChange((next) => {
// react to updates
});
The exact contracts differ by surface, but every namespace provides:
• One or more synchronous getters.
• Event-based change notifications.
• Stable semantic contracts.
This pattern allows extensions to remain synchronized with application state without polling.

5.5 Dashboard Namespace
The dashboard namespace provides contextual information about the currently active dashboard.
API
dashboard.getCurrentDashboard();
Contract
interface DashboardContext {
dashboardId: number;
title: string;
filters: FilterValue[];
charts: ChartSummary[];
}

interface ChartSummary {
chartId: number;
chartName: string;
vizType: string;
datasourceId: number | null;
datasourceName: string | null;
isVisible: boolean;}
The context includes:
• Dashboard identity.
• Active filter state.
• Dashboard charts.
• Per-chart visibility information.
Returning all charts while exposing visibility allows chatbot implementations to answer both:
• "Which charts are currently visible?"
• "Find the chart named Revenue by Region."
without requiring additional lookups.
Normalization Requirements
The namespace must expose semantic dashboard context rather than raw application state.
For example:
dashboard.getCurrentDashboard();
returns a normalized contract rather than Redux slices or internal entities.
This abstraction layer preserves compatibility as frontend implementation details evolve.
Page-Type Guarding
The getter returns undefined when the current page is not a dashboard.
Conceptually:
if (navigation.getPageType() !== "dashboard") {
return undefined;
}
This prevents stale dashboard state from leaking across application surfaces.
5.6 Explore Namespace
The explore namespace provides context for the currently active Explore session.
API
explore.getCurrentChart();
Contract
interface ChartContext {
chartId: number | null;
chartName: string | null;
datasourceId: number | null;
datasourceName: string | null;
vizType: string;
}

The namespace exposes:
• Chart identity. `chartId` and `chartName` are null for a new, unsaved chart that has not yet been persisted.
• Saved chart metadata (name, datasource, viz type)
• Current Explore context: `vizType` reflects the type currently selected in the editor, so the value tracks the live session rather than only the last saved state.
The contract is intentionally focused on chart-specific information relevant to chatbot integrations.
Reflecting the live editing session — rather than reconstructing chart state from
the route alone — is the primary reason this SIP exposes frontend context
directly (see §6.2, Option C).

Page-Type Guarding
The getter returns undefined when the current page is not an Explore surface.
Conceptually:
if (navigation.getPageType() !== "explore") {
return undefined;
}
This ensures the namespace reflects only active Explore context.
5.7 Dataset Namespace
The dataset namespace exposes the dataset currently being viewed or edited.
API
dataset.getCurrentDataset();
Contract
interface DatasetContext {
datasetId: number;
datasetName: string;
schema: string | null;
catalog: string | null;
databaseName: string | null;
isVirtual: boolean;}
This contract is intentionally identity-focused.
It answers:
• Which dataset is currently in focus?
• Is the dataset virtual or physical?
• Which database and schema does it belong to?
It does not expose:
• Column definitions.
• Lineage information.
• Dataset dependencies.
Those concerns are expected to be resolved by backend services using the dataset identifier.
Producer-Backed Context
Unlike dashboard and explore namespaces, dataset pages do not currently expose a shared source of truth suitable for namespace consumption.
For this reason, dataset context is published by dataset pages through a host-managed producer mechanism.
Dataset pages publish the active dataset as it loads, and:
dataset.getCurrentDataset();
returns the most recently published value.
Until dataset information has been published, the getter returns:
undefined;
This design keeps the public contract stable without requiring the introduction of a dedicated Redux slice.

Example Use Cases
The dataset namespace enables chatbot workflows such as:
• Explain this dataset.
• Summarize this dataset's purpose.
• Show lineage for this dataset.
• Which charts depend on this dataset?
The namespace provides the identity required to perform those lookups while avoiding duplication of backend metadata.
5.8 Navigation Namespace
The navigation namespace provides routing-related context.
API
navigation.getPageType();
Events
navigation.onDidChangePage(...)

Contract
type PageType =
| "home"
| "dashboard"
| "explore"
| "sqllab"
| "dataset"
| "other";
The namespace answers a single question:
"Which application surface is currently active?"
It intentionally does not expose entity-specific information.
Entity context remains owned by the corresponding surface namespace.
Examples:
dashboard.getCurrentDashboard();
explore.getCurrentChart();
dataset.getCurrentDataset();
This separation preserves clear ownership boundaries and prevents duplication across namespaces.

5.9 Context Composition
This SIP intentionally does not introduce a host-owned aggregate context object.
Instead, extensions compose the context they require from individual namespaces.
For example:
const pageContext = {
pageType: navigation.getPageType(),
dashboard: dashboard.getCurrentDashboard(),
chart: explore.getCurrentChart(),
dataset: dataset.getCurrentDataset(),
sqlLab: sqlLab.getCurrentTab(),
};
The extension assembles a higher-level context tailored to its own requirements.
The host remains responsible for:
• Context ownership.
• Context normalization.
• Authorization alignment.
The extension remains responsible for:
• Context composition.
• Prompt construction.
• Application-specific interpretation.
This separation avoids introducing a centralized context abstraction while allowing new surfaces to be added incrementally over time.

5.10 Compatibility and Evolution
Namespace contracts are part of the public Superset extension API surface.
Breaking changes require standard compatibility and deprecation processes.
Extensions should depend only on documented namespace contracts and must not rely on implementation details behind those contracts.
As new application surfaces become extension-aware, additional namespaces may be introduced without affecting existing integrations.
This additive model allows the extension ecosystem to evolve while preserving backward compatibility.

6. Design Decisions
   This section consolidates the key architectural decisions made by this SIP and summarizes the alternatives that were evaluated.
   The goal is to capture the rationale behind the extension model so that future contributors can understand not only what was selected, but why alternative approaches were rejected.
   6.1 Decision Summary
   Decision
   Topic
   Selected Approach
   D1
   Page Context Model
   Extension-composed context from host-provided namespaces
   D2
   Chatbot Resolution
   Host-managed singleton resolution
   D3
   Descriptor Metadata
   Static icon metadata
   D4
   Administration Scope
   Deployment-wide administration
   D5
   Per-Page Visibility
   Deferred - open question, see §8
   D6
   Generalized Floating Slots
   Deferred - open question, see §8

6.2 D1 — Page Context Model
A central design question is how chatbot extensions obtain contextual information about the currently active application surface.
Three approaches were considered.
Option A — Host-Owned Aggregate Context
The host exposes a single API:
context.getPageContext();
which returns a fully assembled context object containing dashboard, chart, dataset, navigation, and SQL Lab information.
Rejected Because
• The host becomes responsible for understanding every application surface.
• The aggregate contract grows whenever a new surface is introduced.
• Changes in any surface can trigger unnecessary recomputation.
• The host becomes coupled to a single canonical context model.
• Ownership boundaries become unclear over time.
Option B — Surface Namespaces Composed by Extensions (Selected)
The host exposes independent namespaces:
• dashboard
• explore
• dataset
• navigation
• sqlLab
Extensions compose these primitives into their own application-specific context.
Advantages
• Clear ownership boundaries.
• Independent evolution of namespaces.
• Additive extensibility.
• Reduced coupling between surfaces.
• Extensions subscribe only to the context they require.
Option C — Route-Only Context
The host exposes only routing information.
Chatbot providers independently reconstruct context through APIs or backend services.
Rejected Because
This approach cannot reliably represent transient frontend state.
Examples include:
• Unsaved chart edits.
• Temporary dashboard filters.
• Active dashboard tabs.
• SQL editor state.
• Draft configuration changes.
As a result, chatbot context would frequently drift from what the user is actually viewing.
Decision
Option B is selected.
The host owns context normalization while extensions own context composition.
This preserves separation of concerns, minimizes coupling, and provides a stable foundation for future extension capabilities.
6.3 D2 — Singleton Chatbot Resolution
When multiple chatbot extensions are installed, the host must determine which chatbot is rendered.
This decision shapes both the rendering model and the extension isolation model.
Option A — Expose Providers Through getViews()
Allow:
getViews(location);
to return both metadata and rendering providers.
Rejected Because
Rendering providers are executable logic.
Exposing providers would allow one extension to:
• Render another extension.
• Bypass host lifecycle management.
• Circumvent fault isolation.
• Assume ownership of another extension's UI.
This violates a deliberate separation between extension discovery and extension execution.
Option B — Host-Managed Provider Resolution (Selected)
The host exposes only metadata publicly while retaining provider resolution internally.
Conceptually:
const provider = getViewProvider("superset.chatbot", selectedId);
Chatbot selection is handled through a host-managed policy:
const chatbot = getActiveChatbot(adminSelectedId, enabledMap);
Advantages
• Preserves extension isolation.
• Preserves host ownership of rendering.
• Supports administrative selection.
• Supports enablement checks.
• Supports future policy evolution.
Option C — Reuse resolveView()
Use the existing rendering helper:
resolveView(id);
to render chatbot providers.
Rejected Because
resolveView() assumes the caller already knows which view should be rendered.
It does not account for:
• Administrative selection.
• Enablement state.
• Settings synchronization.
• Chatbot-specific resolution policy.
Decision
Option B is selected.
The host owns chatbot selection and rendering.
The registry remains a discovery mechanism rather than a rendering mechanism.
Architectural Principle
A core principle established by this SIP is:
"Extensions may discover registered views, but only the host may render registered views."
This preserves extension isolation and prevents cross-extension rendering dependencies.
6.4 D3 — Descriptor Metadata Ownership
Chatbot registrations may include metadata used by administrative and discovery interfaces.
A key question is whether descriptor metadata should be static or runtime-updatable.

Option A — Static Descriptor Metadata (Selected)
Metadata is defined at registration time and remains unchanged for the lifetime of the registration.
Example:
{
id: 'acme.chatbot',
name: 'Acme Chatbot',
icon: 'Bubble',
}
Advantages
• Simpler registry implementation.
• Clear ownership model.
• Consistent administration UI.
• No registry update lifecycle.
Option B — Runtime-Updatable Metadata
Extensions can update descriptor metadata after registration.
Examples:
• Notification badges.
• Thinking indicators.
• Dynamic branding.
Rejected Because
These states belong to the chatbot user interface rather than the registration descriptor.
Supporting dynamic metadata would:
• Increase registry complexity.
• Introduce update synchronization concerns.
• Provide limited benefit for current consumers.
Decision
Option A is selected.
Descriptor metadata remains static.
Dynamic UI state remains the responsibility of the chatbot component.
Future requirements for dynamic metadata can be addressed independently if needed.
6.5 D4 — Administration Scope
This SIP introduces deployment-wide chatbot administration.
A key question is whether availability should be deployment-scoped or user-scoped.
Option A — Deployment-Wide Administration (Selected)
Administrators manage:
• Extension availability.
• Default chatbot selection.
These settings apply to the entire deployment.
Advantages
• Clear administrative ownership.
• Simple operational model.
• Consistent with existing extension administration patterns.
• Avoids introducing multiple configuration layers.
Option B — User-Scoped Availability
Availability and chatbot selection become user-specific settings.
Rejected Because
Administrative availability and user preference represent different concerns.
Administrators answer:
"Which integrations are available in this deployment?"
Users answer:
"Which available integrations do I prefer?"
Combining these concerns into a single model creates unclear ownership and duplicated configuration responsibilities.

Decision
Option A is selected.
This SIP introduces only deployment-wide administration.
Future user preferences should be layered on top using the following model:
Effective Availability = Deployment Availability AND User Preference
The recommended persistence mechanism for user-specific preferences is the Extension Storage API.
This approach aligns with SIP-127 and preserves a clear separation between administrative configuration and user customization.

7. Risks and Future Considerations
The selected architecture introduces several tradeoffs.
Namespace Maintenance
As additional application surfaces become extension-aware, new namespaces may be required.
This increases the maintenance burden of the extension API surface.
Contract Evolution
Namespace contracts are intended to be stable.
Over time, extensions may require additional context that is not initially exposed.
Future additions must preserve compatibility and avoid leaking implementation details.
Context Growth
Dashboard and chart context may become increasingly rich over time.
Care must be taken to ensure context APIs remain focused and do not evolve into large aggregate objects.
Extension Expectations
Chatbot vendors may request direct access to internal application state for convenience.
This SIP intentionally rejects that approach in favor of stable semantic contracts.
Maintaining that boundary may require additional namespace evolution over time. 8. Open Questions
D5 — Per-Page Visibility
Should chatbot extensions be able to declare page visibility constraints?
Two approaches remain possible.
Extension-Controlled Visibility
Extensions observe:
navigation.onDidChangePage(...)
and decide whether to render themselves.
Host-Enforced Visibility
Extensions declare supported page types through manifest metadata and the host enforces visibility.
Recommendation
Defer this decision.
The current architecture already supports extension-controlled visibility without requiring additional platform capabilities.

D6 — Generalized Floating Contribution Areas
The current proposal introduces a chatbot-specific contribution location:
superset.chatbot
A future question is whether this should evolve into a more generic floating-widget framework.
Examples might include:
• Chatbots.
• Guided tours.
• Notification centers.
• Productivity assistants.
Recommendation
Keep the contribution area chatbot-specific.
If broader floating-widget requirements emerge, introduce a dedicated abstraction rather than expanding the scope of this SIP.

9. Related Documents
   Contribution types
   Client actions

The following proposals are related to this SIP.
Extension Storage API
Add storage API for extensions (#39171)
Introduces namespace-isolated storage for extensions with support for:
• Local storage.
• Session storage.
• Ephemeral server storage.
• Persistent database-backed storage.
This proposal is complementary to the administration model defined by this SIP and is the recommended foundation for future user-specific extension preferences.

SIP-127 — User Preferences
[SIP-127] User Preferences (#28047)
Establishes the per-user preference model used by Superset core.
The Extension Storage API serves as the extension-scoped equivalent of this pattern and provides the recommended approach for future user-specific chatbot preferences. 10. Migration Plan
Base branch enxdev/chat-prototype
Branch for testing test/chatbot-local
The following capabilities are required to fully realize this SIP.
Core Platform Changes
Implemented
• superset.chatbot contribution location.
• Host-side chatbot resolution.
• Administration UI for chatbot selection.
• Dashboard namespace.
• Explore namespace.
• Navigation namespace.
• Runtime settings synchronization.
Pending
• Dataset namespace implementation.
• Dashboard chart visibility context.
• Permission-scoped dashboard context endpoint.
• Manifest support for application-level contribution scopes.
• Optional descriptor icon support.

11. Implementation Phases
    Phase 1 — Chatbot Mount Point
    • Chatbot contribution location.
    • Host-side rendering.
    • Lifecycle management.
    • Fault isolation.
    Status: Complete
    Phase 2 — Administration
    • Enable/disable support.
    • Default chatbot selection.
    • Runtime synchronization.
    Status: Complete
    Phase 3 — Context APIs
    • Dashboard namespace.
    • Explore namespace.
    • Navigation namespace.
    • Dataset namespace.
    Status: Partially Complete
    Remaining work:
    • Dataset namespace.
    • Dashboard chart visibility context.
    • Dashboard context endpoint.
    Phase 4 — Client Actions
    Client actions and agentic UI interactions remain outside the scope of this SIP and are expected to be addressed through a separate proposal.
