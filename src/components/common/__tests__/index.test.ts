/**
 * Tests for common component barrel exports.
 * Verifies all components and types are properly exported.
 */

import {
  Button,
  Card,
  ErrorBanner,
  LoadingSpinner,
  NetworkStatus,
} from '../index';

describe('common components barrel export', () => {
  it('exports Button component', () => {
    expect(Button).toBeDefined();
    expect(typeof Button).toBe('function');
  });

  it('exports Card component', () => {
    expect(Card).toBeDefined();
    expect(typeof Card).toBe('function');
  });

  it('exports ErrorBanner component', () => {
    expect(ErrorBanner).toBeDefined();
    expect(typeof ErrorBanner).toBe('function');
  });

  it('exports LoadingSpinner component', () => {
    expect(LoadingSpinner).toBeDefined();
    expect(typeof LoadingSpinner).toBe('function');
  });

  it('exports NetworkStatus component', () => {
    expect(NetworkStatus).toBeDefined();
    expect(typeof NetworkStatus).toBe('function');
  });
});
