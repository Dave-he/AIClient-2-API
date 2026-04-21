// Jest setup file
jest.setTimeout(30000);

// Suppress console errors in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console.error = jest.fn();
  global.console.warn = jest.fn();
}
