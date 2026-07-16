/**
 * CopyIcon — two overlapping rectangles representing clipboard copy.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface IconProps {
  /** Icon size in points (width and height). Default: 18 */
  size?: number;
  /** Icon stroke color. Default: currentColor-equivalent (#8E8E93) */
  color?: string;
}

export function CopyIcon({ size = 18, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
