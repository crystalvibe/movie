export const detectDevTools = () => {
  // Function to detect Firebug
  const isFirebug = () => {
    return (window as any).Firebug && (window as any).Firebug.chrome && (window as any).Firebug.chrome.isInitialized;
  };

  // Function to detect if dev tools are open
  const isDevToolsOpen = () => {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    return widthThreshold || heightThreshold || isFirebug();
  };

  // Function to handle dev tools detection
  const handleDevTools = () => {
    if (isDevToolsOpen()) {
      // Redirect to a blank page or show an error
      window.location.href = 'about:blank';
      
      // Or alternatively, you could disable the page:
      // document.body.innerHTML = 'Developer Tools detected. Access denied.';
      // document.head.innerHTML = '';
    }
  };

  // Check periodically
  setInterval(handleDevTools, 1000);

  // Prevent right-click
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // Prevent keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Prevent F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }

    // Prevent Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
      e.preventDefault();
      return false;
    }

    // Prevent Ctrl+U (view source)
    if (e.ctrlKey && e.key === 'U') {
      e.preventDefault();
      return false;
    }
  });

  // Disable console
  const disableConsole = () => {
    Object.defineProperty(window, 'console', {
      value: {
        log: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      },
      writable: false,
      configurable: false
    });
  };

  // Call on load
  disableConsole();
}; 