import app from './app';
import env from './env';

const PORT = env.PORT || 8080;

app.listen(PORT, () =>
  // eslint-disable-next-line no-console
  console.log(`🥏 API running on port ${PORT}`),
);
