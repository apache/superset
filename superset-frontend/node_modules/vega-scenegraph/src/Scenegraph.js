import Bounds from './Bounds';
import GroupItem from './GroupItem';
import {sceneFromJSON, sceneToJSON} from './util/serialize';

export default function Scenegraph(scene) {
  if (arguments.length) {
    this.root = sceneFromJSON(scene);
  } else {
    this.root = createMark({
      marktype: 'group',
      name: 'root',
      role: 'frame'
    });
    this.root.items = [new GroupItem(this.root)];
  }
}

var prototype = Scenegraph.prototype;

prototype.toJSON = function(indent) {
  return sceneToJSON(this.root, indent || 0);
};

prototype.mark = function(markdef, group, index) {
  group = group || this.root.items[0];
  var mark = createMark(markdef, group);
  group.items[index] = mark;
  if (mark.zindex) mark.group.zdirty = true;
  return mark;
};

function createMark(def, group) {
  const mark = {
    bounds:      new Bounds(),
    clip:        !!def.clip,
    group:       group,
    interactive: def.interactive === false ? false : true,
    items:       [],
    marktype:    def.marktype,
    name:        def.name || undefined,
    role:        def.role || undefined,
    zindex:      def.zindex || 0
  };

  // add accessibility properties if defined
  if (def.aria != null) {
    mark.aria = def.aria;
  }
  if (def.description) {
    mark.description = def.description;
  }

  return mark;
}
