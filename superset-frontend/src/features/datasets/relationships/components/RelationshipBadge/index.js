"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipBadge = void 0;
/**
 * A small badge/tag shown next to a column name in the Explore datasource panel.
 * Indicates that this column is connected to another dataset via a relationship.
 *
 * Clicking the badge toggles the JOIN on/off.
 * Active badge -> JOIN is enabled -> column is part of an active cross-dataset query.
 */
function RelationshipBadge(_a) {
    var _b;
    var relationship = _a.relationship, joinActive = _a.joinActive, onToggleJoin = _a.onToggleJoin;
    var targetLabel = (_b = relationship.name) !== null && _b !== void 0 ? _b : "#".concat(relationship.target_dataset_id);
    return (<span role="button" tabIndex={0} title={"".concat(relationship.relationship_type, " -> ").concat(targetLabel, " (").concat(relationship.join_type, " JOIN)")} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 9,
            fontWeight: 600,
            padding: '1px 4px',
            borderRadius: 3,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.15s ease',
            backgroundColor: joinActive ? '#059669' : 'rgba(220, 38, 38, 0.08)',
            color: joinActive ? '#fff' : '#dc2626',
            border: joinActive ? '1px solid #059669' : '1px solid #dc2626',
            marginLeft: 4,
            verticalAlign: 'middle',
            lineHeight: 1,
        }} onClick={function (e) {
            e.stopPropagation();
            onToggleJoin(relationship.id);
        }} onKeyDown={function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleJoin(relationship.id);
            }
        }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3"/>
        <circle cx="6" cy="19" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="12" y1="8" x2="12" y2="14"/>
        <line x1="8" y1="17" x2="6" y2="16"/>
        <line x1="16" y1="17" x2="18" y2="16"/>
      </svg>
      {targetLabel}
    </span>);
}
exports.RelationshipBadge = RelationshipBadge;
