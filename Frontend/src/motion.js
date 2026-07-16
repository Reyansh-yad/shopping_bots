// Motion initialization utilities
// This module provides functions to initialize or refresh motion/animation effects

/**
 * Initialize motion effects
 * This function can be called to ensure animations are properly initialized
 * In our case, since animations are initialized in dom-animations.js via main.js,
 * this function serves as a placeholder or can be used to reset/restart animations if needed
 */
export function initMotion() {
  // Animations are already initialized by dom-animations.js (imported in main.js)
  // This function exists for compatibility with components that expect to call it

  // Optionally, we could dispatch an event to notify other components that
  // motion/animation initialization has occurred
  const event = new CustomEvent('motion:init', {
    bubbles: true,
    cancelable: true
  });
  window.dispatchEvent(event);

  // Return true to indicate successful initialization
  return true;
}

/**
 * Optional: Function to reset or re-initialize animations
 * Useful if DOM elements are dynamically added after initial load
 */
export function resetMotion() {
  // In a more complex implementation, we might re-initialize certain animations
  // For now, we'll just dispatch an event
  const event = new CustomEvent('motion:reset', {
    bubbles: true,
    cancelable: true
  });
  window.dispatchEvent(event);
}