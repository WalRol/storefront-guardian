import { createApp } from './app';

const port = Number(process.env.PORT ?? 3100);

createApp().listen(port, () => {
  console.log(`storefront-demo escuchando en http://localhost:${port}`);
});
