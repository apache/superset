'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var regionRole = {
  abstract: false,
  accessibleNameRequired: true,
  baseConcepts: [],
  childrenPresentational: false,
  nameFrom: ['author'],
  props: {},
  relatedConcepts: [{
    module: 'HTML',
    concept: {
      name: 'frame'
    }
  }, {
    concept: {
      name: 'Device Independence Glossart perceivable unit'
    }
  }, {
    module: 'ARIA',
    concept: {
      name: 'section'
    }
  }],
  requireContextRole: [],
  requiredOwnedElements: [],
  requiredProps: {},
  superClass: [['roletype', 'structure', 'section', 'landmark']]
};

exports.default = regionRole;