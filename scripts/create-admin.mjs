import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { provisionAdmin } from '../lib/auth.ts';

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function askSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Запустіть цю команду в інтерактивному терміналі, щоб пароль не відображався.');
  return new Promise((resolve, reject) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    let answer = '';
    const finish = (value) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      resolve(value);
    };
    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === 3) { stdin.setRawMode(false); stdout.write('\n'); reject(new Error('Створення адміністратора скасовано.')); return; }
        if (byte === 13 || byte === 10) { finish(answer); return; }
        if (byte === 8 || byte === 127) answer = answer.slice(0, -1);
        else if (byte >= 32 && byte <= 126 && answer.length < 256) answer += String.fromCharCode(byte);
      }
    };
    stdin.on('data', onData);
  });
}

try {
  let username;
  let password;
  if (process.env.BARBERLAB_ADMIN_USER || process.env.BARBERLAB_ADMIN_PASSWORD) {
    if (!process.env.BARBERLAB_ADMIN_USER || !process.env.BARBERLAB_ADMIN_PASSWORD) throw new Error('Для автоматизованого створення задайте обидві змінні BARBERLAB_ADMIN_USER і BARBERLAB_ADMIN_PASSWORD.');
    username = process.env.BARBERLAB_ADMIN_USER;
    password = process.env.BARBERLAB_ADMIN_PASSWORD;
  } else {
    username = (await ask('Ім’я адміністратора: ')).trim();
    password = await askSecret('Пароль (від 12 символів, введення приховано): ');
    const confirmation = await askSecret('Повторіть пароль: ');
    if (password !== confirmation) throw new Error('Паролі не збігаються.');
  }
  provisionAdmin(username, password);
  stdout.write('Обліковий запис адміністратора збережено в базі даних. Пароль не виводився.\n');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Не вдалося створити адміністратора.');
  process.exitCode = 1;
}
