/**
 * EyeIcon — open padlock indicating the API key is revealed.
 * Monochrome stroke-only design.
 */

import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import type { IconProps } from './CopyIcon';

export function EyeIcon({ size = 18, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lock body */}
      <Rect
        x={5}
        y={11}
        width={14}
        height={10}
        rx={2}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Open shackle */}
      <Path
        d="M8 11V7a4 4 0 0 1 8 0"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Keyhole */}
      <Path
        d="M12 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 0v2"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}
