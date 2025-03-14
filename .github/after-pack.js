const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  const sandboxPath = path.join(context.appOutDir, 'chrome-sandbox');
  if (fs.existsSync(sandboxPath)) {
    fs.chmodSync(sandboxPath, '4755'); // Устанавливаем права 4755
    fs.chownSync(sandboxPath, 0, 0);   // Устанавливаем владельца root
  }

  console.log(`Права на chrome-sandbox: ${fs.statSync(sandboxPath).mode.toString(8)}`);
  console.log(`Владелец chrome-sandbox: ${fs.statSync(sandboxPath).uid}`);
};