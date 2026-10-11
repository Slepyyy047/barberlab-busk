import type { Metadata } from 'next';
import { PageHeading } from '@/components/Shared';
import { getPublicContent } from '@/lib/public-content';
import { createPageMetadata } from '@/lib/seo';

export function generateMetadata(): Metadata {
  const { settings } = getPublicContent();
  return createPageMetadata({ settings, path: '/cookies', title: 'Cookie та сховище браузера', description: 'Які cookie і записи локального сховища використовує сайт BARBERLAB.' });
}

export default function Cookies() {
  const { settings } = getPublicContent();
  return <>
    <PageHeading number="08 / COOKIE" title="Ти обираєш." description="Пояснюємо обов’язкову cookie панелі та налаштування зовнішніх медіа." />
    <section className="section legal-page"><article className="container legal-content">
      <p className="eyebrow">BARBERLAB / COOKIE ТА ЛОКАЛЬНЕ СХОВИЩЕ</p>
      <h2>Обов’язкова cookie панелі</h2>
      <p>Для авторизації в панелі керування сайт використовує cookie <code>barberlab_admin</code>. Вона HttpOnly, має SameSite=Strict і строк дії до 12 годин; у HTTPS-з’єднанні також отримує прапорець Secure. Cookie потрібна для входу адміністратора та не використовується для аналітики чи реклами. Відвідувачам публічних сторінок ця cookie не встановлюється.
      </p>

      <h2>Налаштування згоди у браузері</h2>
      <p>Ваш вибір зберігається не в cookie, а у localStorage браузера під назвою <code>barberlab_cookie_preferences</code>. Формат версії 1 містить <code>necessary: true</code> та вибір <code>externalMedia</code>. Параметр необхідних функцій завжди ввімкнений; зовнішні медіа вимкнені, доки ви їх не дозволите. Запис має спливати через 180 днів. Ці налаштування не надсилаються серверу BARBERLAB.
      </p>
      <p>Якщо очистити дані сайту або localStorage у браузері, збережений вибір буде видалено й сайт знову попросить обрати налаштування. Якщо браузер заборонив localStorage, вибір може діяти лише до закриття вкладки. Коли зовнішні медіа заборонені, вбудована карта Google не завантажується.
      </p>

      <h2>Google Maps та зовнішні посилання</h2>
      <p>Дозвіл на зовнішні медіа потрібен для вбудованої карти Google. Після натискання «Показати карту» браузер звертається до Google; цей запит може передати Google IP-адресу та технічні дані браузера, а Google може використовувати власні cookie або подібне сховище за своїми правилами. Щоб змінити вибір, відкрий «Налаштування cookie» внизу сторінки. Щоб не завантажувати карту, залиш налаштування вимкненим.
      </p>
      <p>Посилання на онлайн-запис Altegio, Google Maps і соціальні мережі ведуть на зовнішні сайти, які не вбудовані в сторінку. Коли ви переходите за ними, дані обробляються відповідним сервісом згідно з його налаштуваннями й політикою. На сайті BARBERLAB не встановлено аналітичних або рекламних cookie та сторонніх аналітичних SDK.
      </p>

      <h2>Питання</h2>
      <p>Якщо маєте запитання щодо цих налаштувань, звертайтеся до BARBERLAB за телефоном <a href={settings.phoneLink}>{settings.phone}</a> або за адресою {settings.address}. Більше про дані сайту — у <a href="/privacy">Політиці приватності</a>. Загальні рекомендації щодо cookie можна прочитати в <a href="https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/" target="_blank" rel="noopener noreferrer">настановах британського ICO</a>; вони наведені як довідкове джерело, а не як підтвердження застосовності права Великої Британії до BARBERLAB.
      </p>
      <p className="small-note">Опис відповідає поточному задуму налаштувань сайту. Він потребує повторної перевірки, якщо зміняться cookie, зовнішні вбудовування чи спосіб зберігання вибору.</p>
    </article></section>
  </>;
}
