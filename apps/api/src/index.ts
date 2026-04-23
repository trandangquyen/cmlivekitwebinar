import {createApp} from './app.js';
import {config, validateDeploymentConfig} from './config.js';
import {runAutoMigrations} from './migrations.js';

validateDeploymentConfig();
await runAutoMigrations();

const app = createApp();

app.listen(config.api.port, () => {
  console.log(`Classroom API listening on http://localhost:${config.api.port}`);
  console.log(`LiveKit target: ${config.livekit.wsUrl}`);
  console.log(`Data store: ${config.database.provider}`);
});
