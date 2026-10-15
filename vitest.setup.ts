import '@testing-library/jest-dom';

// JSDOM / Node 20+ compatibility fix:
// Node's undici-backed `Request` throws if `init.signal` is an instance of JSDOM's `AbortSignal`.
// Wrap `Request` to safely sanitize incompatible JSDOM signals in test environments.
if (typeof globalThis.Request !== 'undefined') {
  const OriginalRequest = globalThis.Request;
  globalThis.Request = class Request extends OriginalRequest {
    constructor(...args: ConstructorParameters<typeof OriginalRequest>) {
      const [input, init] = args;
      if (init && 'signal' in init) {
        const sanitizedInit = { ...init };
        delete sanitizedInit.signal;
        super(input, sanitizedInit);
      } else {
        super(input, init);
      }
    }
  };
}

