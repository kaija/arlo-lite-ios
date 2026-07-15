import React from 'react';
import RootLayout from '@/app/_layout';

/**
 * App entry point. Delegates to the root layout which handles
 * all initialization (database, i18n, theme) and provider wrapping.
 */
export default function App() {
  return <RootLayout />;
}
