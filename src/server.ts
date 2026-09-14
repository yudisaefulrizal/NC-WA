import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 8066);
createApp().listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`${new Date().toISOString()} Engine mendengarkan port ${port}`);
});
