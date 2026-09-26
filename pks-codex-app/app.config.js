// Completa o app.json: o push (FCM) precisa do google-services.json do Firebase.
// Enquanto o arquivo não existir, o app compila normalmente, só sem notificações com o app fechado.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(googleServices)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } };
};
