/**
 * EyeIcon — open eye indicating content is visible.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './CopyIcon';

export function EyeIcon({ size = 18, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
