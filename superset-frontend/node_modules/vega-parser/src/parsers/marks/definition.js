import role from './role';

export default function(spec) {
  return {
    marktype:     spec.type,
    name:         spec.name || undefined,
    role:         spec.role || role(spec),
    zindex:       +spec.zindex || undefined,
    aria:         spec.aria,
    description:  spec.description
  };
}
