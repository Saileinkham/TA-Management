const { onRequest } = require('firebase-functions/v2/https');
const { app, initFirebase } = require('../server/index.js');

exports.api = onRequest(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 300,
    memory: '512MiB',
    invoker: 'public',
  },
  async (req, res) => {
    try {
      await initFirebase();
      return app(req, res);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }
);
