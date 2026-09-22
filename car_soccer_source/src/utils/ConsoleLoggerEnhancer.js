/**
 * ConsoleLoggerEnhancer.js
 * Enhances console.log to automatically format JavaScript objects into readable,
 * directly copyable indented JSON strings, preventing browser DevTools object truncation.
 */

export function installConsoleJsonFormatter() {
  if (typeof console === 'undefined' || console.__jsonFormatted) {
    return;
  }

  const originalLog = console.log;
  console.log = function(...args) {
    const formattedArgs = args.map(arg => {
      // If object and not null, flatten to indented JSON text
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, (key, value) => {
            if (typeof value === 'function') return undefined; // Filter functions
            return value;
          }, 2);
        } catch (e) {
          return arg; // Fallback on circular reference
        }
      }
      return arg;
    });
    originalLog.apply(console, formattedArgs);
  };

  console.__jsonFormatted = true;
}

// Auto-install on module import
installConsoleJsonFormatter();
