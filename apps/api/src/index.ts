import {createApp} from './app.js';
import {config} from './config.js';
import {runAutoMigrations} from './migrations.js';

await runAutoMigrations();

const app = createApp();

app.listen(config.api.port, () => {
  console.log(`Classroom API listening on http://localhost:${config.api.port}`);
  console.log(`LiveKit target: ${config.livekit.wsUrl}`);
  console.log(`Data store: ${config.database.provider}`);
});
