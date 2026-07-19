/**
 * EyeOffIcon — eye with diagonal slash indicating content is hidden.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './CopyIcon';

export function EyeOffIcon({ size = 18, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.61 6.61C4.62 7.96 3.26 9.81 2 12c0 0 3 7 10 7a9.88 9.88 0 0 0 5.39-1.61"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m2 2 20 20"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
