/**
 * react-native-svg mock — renders SVG elements as inert host tags so LucyOrb (and anything else SVG)
 * can mount in the render smoke test. The gradient-id correctness fix is still exercised: the id we
 * pass into <RadialGradient id> / fill="url(#id)" flows through as plain props on the rendered tree,
 * so a test can assert it contains no ':'.
 */
import React from 'react';

const svgHost = (tag: string) =>
  React.forwardRef(function SvgHost(props: any, ref: any) {
    return React.createElement(tag, { ...props, ref });
  });

export const Svg = svgHost('Svg');
export const Circle = svgHost('Circle');
export const Rect = svgHost('Rect');
export const Path = svgHost('Path');
export const Defs = svgHost('Defs');
export const RadialGradient = svgHost('RadialGradient');
export const LinearGradient = svgHost('LinearGradient');
export const Stop = svgHost('Stop');
export const G = svgHost('G');
export const Line = svgHost('Line');
export const Text = svgHost('SvgText');

export default Svg;
