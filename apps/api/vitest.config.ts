import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      DATA_STORE: 'memory',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      LIVEKIT_API_KEY: 'devkey',
      LIVEKIT_API_SECRET: 'secret',
      LIVEKIT_WS_URL: 'ws://localhost:7880',
    },
  },
});
