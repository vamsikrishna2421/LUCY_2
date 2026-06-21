/**
 * @expo/vector-icons mock. Icons render as inert host tags. `glyphMap` is a permissive proxy so the
 * `keyof typeof Ionicons.glyphMap` icon-name types (erased at runtime by ts-jest) never blow up if
 * something reads a glyph at runtime.
 */
import React from 'react';

const iconHost = (tag: string) => {
  const Comp = React.forwardRef(function IconHost(props: any, ref: any) {
    return React.createElement(tag, { ...props, ref });
  }) as any;
  Comp.glyphMap = new Proxy({}, { get: () => 0 });
  return Comp;
};

export const Ionicons = iconHost('Ionicons');
export const MaterialCommunityIcons = iconHost('MaterialCommunityIcons');
export const MaterialIcons = iconHost('MaterialIcons');
export const FontAwesome = iconHost('FontAwesome');
export const Feather = iconHost('Feather');
export const AntDesign = iconHost('AntDesign');

export default { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome, Feather, AntDesign };
