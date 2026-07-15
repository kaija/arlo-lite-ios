/**
 * Animation constants for Arlo Lite.
 *
 * Defines timing and easing values used across the UI
 * for consistent, expressive motion matching the prototype.
 */

/**
 * Sidebar page-turn transition easing curve.
 * Used for non-drag sidebar open/close and other overlay transitions.
 * cubic-bezier(0.32, 0.72, 0, 1)
 */
export const SIDEBAR_EASING = [0.32, 0.72, 0, 1] as const;

/**
 * Dialog and overlay easing curve.
 * Used for rename dialog, model picker, and toast animations.
 * Same curve as sidebar for consistency.
 * cubic-bezier(0.32, 0.72, 0, 1)
 */
export const DIALOG_EASING = [0.32, 0.72, 0, 1] as const;

/**
 * Default transition duration in milliseconds.
 * Applied to sidebar reveal, settings sheet, model picker, and dialog transitions.
 */
export const TRANSITION_DURATION = 350;

/**
 * Settings screen slide-from-right duration in milliseconds.
 */
export const SETTINGS_SLIDE_DURATION = 400;

/**
 * Model picker fade-in/out duration in milliseconds.
 */
export const MODEL_PICKER_FADE_DURATION = 280;

/**
 * Sidebar page-turn transition duration in milliseconds.
 * Used for button-triggered (non-drag) open/close.
 */
export const SIDEBAR_TRANSITION_DURATION = 500;

/**
 * Toast slide-up + fade-in animation duration in milliseconds.
 */
export const TOAST_ENTER_DURATION = 250;

/**
 * Toast fade-out animation duration in milliseconds.
 */
export const TOAST_EXIT_DURATION = 200;

/**
 * Toast auto-dismiss display time in milliseconds.
 */
export const TOAST_DISPLAY_DURATION = 1800;

/**
 * Rename dialog fade-up animation duration in milliseconds.
 */
export const RENAME_DIALOG_DURATION = 250;
