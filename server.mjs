// Compatibility entry point. The real backend lives in server.js.
import server from './server.js';
server.start().catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
