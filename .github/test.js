const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  const sandboxPath = path.join(context.appOutDir, 'chrome-sandbox');
    try {
      fs.chmodSync(sandboxPath, '4755'); // Устанавливаем права 4755
      fs.chownSync(sandboxPath, 0, 0);   // Устанавливаем владельца root

      console.log('!!!! Права для chrome-sandbox успешно изменены');
    } catch (error) {
      console.error('Не удалось изменить права для chrome-sandbox:', error);
    }
}