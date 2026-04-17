export const debounce = (fn, delay = 300) => {
  let timeoutId = null;
  
  return function(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

export const debounceLeading = (fn, delay = 300) => {
  let timeoutId = null;
  let shouldCall = true;
  
  return function(...args) {
    if (shouldCall) {
      fn.apply(this, args);
      shouldCall = false;
    }
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      shouldCall = true;
    }, delay);
  };
};

export const throttle = (fn, limit = 300) => {
  let inThrottle = false;
  
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const throttleLeading = (fn, limit = 300) => {
  let lastTime = 0;
  
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= limit) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
};

export const throttleTrailing = (fn, limit = 300) => {
  let timeoutId = null;
  let lastArgs = null;
  
  return function(...args) {
    lastArgs = args;
    
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        fn.apply(this, lastArgs);
        timeoutId = null;
        lastArgs = null;
      }, limit);
    }
  };
};

export const throttleLeadingAndTrailing = (fn, limit = 300) => {
  let lastTime = 0;
  let timeoutId = null;
  let lastArgs = null;
  
  return function(...args) {
    const now = Date.now();
    lastArgs = args;
    
    if (now - lastTime >= limit) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      fn.apply(this, args);
      lastTime = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        fn.apply(this, lastArgs);
        timeoutId = null;
        lastTime = Date.now();
      }, limit - (now - lastTime));
    }
  };
};

export default debounce;