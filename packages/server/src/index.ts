import { DEFAULT_PORT } from '@phasewise/shared';
import { createServer } from './server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
const { httpServer } = createServer();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Phasewise Server running on port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/health`);
});
