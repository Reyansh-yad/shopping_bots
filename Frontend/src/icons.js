// Icon utility functions
// Provides icon generation and hydration for UI components

// Simple icon map - in a real implementation, this would contain SVG paths for each icon
// For now, we'll use a basic approach that generates simple shapes or uses unicode fallbacks
const ICON_MAP = {
  // Common UI icons
  'menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
  'chart': '<path d="M9 17l5-5 5 5"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'bell': '<path d="M12 22s8-4 8-10V5l-4-3-4 3v7c0 6 8 10 8 10z"/>',
  'settings': '<path d="M12 15v2m-4 0h2m4-4v2m2-4h-2m-4 4H7m10 0h-3m-6 0H5m12 0v-3M12 9l-3 3m0 0l3 3m-3 3m3-3V3"/>',
  'plus': '<path d="M12 8v8m8-4h-8"/>',
  'logout': '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l-5 5v11z"/>',
  'account': '<circle cx="12" cy="10" r="7"/><path d="M8 21.5c-6 0-8-5-8-10s2-10 8-10 8 5 8 10-2 10-8 10z"/>',
  'shopping-bag': '<path d="M6 8L3 3h18l-3 5H7L4 3 1 8h5z"/>',
  'download': '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4l5-5 5 5z"/>',
  'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'link': '<path d="M10 13a5 5 0 007.54.5l1-3a5 5 0 11-5.76 4.86L13 13h-4zm-5-6a5 5 0 007.54.5l1-3A5 5 0 015 8l-1 3z"/>',
  'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1"/>',
  'trash': '<path d="M3 6h18M4 5h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"/>',
  'arrow-down': '<path d="M5 12l7 7 7-7"/>',
  'arrow-up': '<path d="M5 12l7-7 7 7"/>',
  'arrow-right': '<path d="M12 5l7 7-7 7"/>',
  'arrow-left': '<path d="M12 19l-7-7 7-7"/>',
  'filter': '<path d="M3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>',
  // Add more icons as needed
};

/**
 * Generate SVG HTML for an icon
 * @param {string} name - Icon name (key from ICON_MAP)
 * @param {number|string} size - Size in pixels (default: 16)
 * @returns {string} SVG HTML string
 */
export function icon(name, size = 16) {
  const pathData = ICON_MAP[name] || ICON_MAP['circle']; // fallback to circle
  const sizeNum = parseInt(size) || 16;

  return `<svg width="${sizeNum}" height="${sizeNum}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${pathData}
  </svg>`;
}

/**
 * Hydrate icons in the DOM by replacing elements with data-icon attributes
 * @param {Element|Document} root - Root element to search within (default: document)
 */
export function hydrateIcons(root = document) {
  // Find all elements with data-icon attribute
  const elements = root.querySelectorAll('[data-icon]');

  elements.forEach(el => {
    const iconName = el.getAttribute('data-icon');
    const iconSize = el.getAttribute('data-icon-size') || '16';

    // Generate the SVG HTML
    const svgHTML = icon(iconName, iconSize);

    // Replace the element with the SVG
    // We need to be careful to preserve other attributes and classes
    const span = document.createElement('span');
    span.innerHTML = svgHTML;

    // Copy over any existing classes
    if (el.className) {
      span.className = el.className;
    }

    // Copy over any other attributes we want to preserve
    const attrsToCopy = ['title', 'aria-label', 'role'];
    attrsToCopy.forEach(attr => {
      if (el.hasAttribute(attr)) {
        span.setAttribute(attr, el.getAttribute(attr));
      }
    });

    // Replace the element
    el.parentNode.replaceChild(span, el);
  });
}

// Auto-hydrate icons when the module is imported (optional)
// Uncomment the line below if you want automatic hydration on import
// if (typeof document !== 'undefined') {
//   hydrateIcons(document);
// }