const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  // Пример: изменить права для файла chrome-sandbox внутри распакованного пакета
  // Обратите внимание: путь может отличаться в зависимости от структуры вашего пакета.
  const sandboxPath = path.join(context.appOutDir, 'chrome-sandbox');
  try {
    fs.chmodSync(sandboxPath, 0o4755);
    console.log('Права для chrome-sandbox успешно изменены');
  } catch (error) {
    console.error('Не удалось изменить права для chrome-sandbox:', error);
  }
};