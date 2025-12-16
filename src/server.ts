import app from './app';
import env from './env';

const PORT = process.env.PORT ?? 8080;

app.listen(env.PORT || 8080, () =>
  // eslint-disable-next-line no-console
  console.log(`🥏 API running on port ${PORT}`),
);
