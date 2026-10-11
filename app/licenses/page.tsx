import type { Metadata } from 'next';
import { PageHeading } from '@/components/Shared';
import { getPublicContent } from '@/lib/public-content';
import { createPageMetadata } from '@/lib/seo';

export function generateMetadata(): Metadata {
  const { settings } = getPublicContent();
  return createPageMetadata({ settings, path: '/licenses', title: 'Ліцензії та авторство', description: 'Ліцензійні повідомлення для шрифтів, фотографій, логотипа та зображень BARBERLAB.' });
}

export default function Licenses() {
  const { settings } = getPublicContent();
  return <>
    <PageHeading number="09 / ЛІЦЕНЗІЇ" title="Авторство без здогадок." description="Що відомо про матеріали й умови їх повторного використання." />
    <section className="section legal-page"><article className="container legal-content">
      <p className="eyebrow">BARBERLAB / ЛІЦЕНЗІЇ ТА АКТИВИ</p>
      <h2>Шрифти</h2>
      <p>Локальні файли шрифтів Manrope і Oswald поширюються за <a href="https://openfontlicense.org/" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a>. Разом зі шрифтами збережені копії ліцензії: <a href="/fonts/Manrope-OFL.txt">Manrope-OFL.txt</a> та <a href="/fonts/Oswald-OFL.txt">Oswald-OFL.txt</a>. Файли шрифтів містяться у каталозі <code>public/fonts/</code>.
      </p>
      <p>Зазначені у файлах ліцензії відомості: © 2018 The Manrope Project Authors (<a href="https://github.com/googlefonts/manrope" target="_blank" rel="noopener noreferrer">проєкт Manrope</a>) та © 2016 The Oswald Project Authors (<a href="https://github.com/googlefonts/OswaldFont" target="_blank" rel="noopener noreferrer">проєкт Oswald</a>). Умови OFL дозволяють вбудовувати та поширювати шрифти разом із програмним забезпеченням за умови дотримання ліцензії; її текст треба зберігати.
      </p>

      <h2 id="assets">Логотип і графічні зображення</h2>
      <p>Початкове зображення логотипа було надане власником проєкту. Файл <code>public/logo-hd.png</code> — згенероване відновлення логотипа на основі цього зразка; <code>public/generated-background.png</code> — згенерований декоративний фон, який не є фотографією реального інтер’єру; файли <code>public/generated-tools/*.png</code> — згенеровані зображення окремих перукарських інструментів.
      </p>
      <p>Ці відомості фіксують походження матеріалів у проєкті, але не визначають наперед обсяг авторських прав та не надають ліцензії Creative Commons, CC0 чи іншої ліцензії для повторного використання. Правовласник логотипа та умови використання згенерованих матеріалів мають бути підтверджені окремо.
      </p>

      <h2>Фотографії команди</h2>
      <p>Фотографії, які зараз є у каталозі <code>assets/team/</code>, були надані власником проєкту для профілів Ігоря Павліва, Романа Падуса, Андрія, Наді та Іллі. До публічного використання потрібно підтвердити право BARBERLAB на їх публікацію та згоду зображених людей. Цей список не є дозволом третім особам копіювати фотографії.
      </p>

      <h2>Код і сторонні матеріали</h2>
      <p>У репозиторії немає загальної ліцензії на повторне використання вихідного коду або власних активів BARBERLAB. Текст і дизайн сторінок, фотографії, логотип та згенерована графіка не переходять під OFL ліцензію шрифтів. Використання стороннього сервісу за посиланням чи у карті регулюється умовами його постачальника.
      </p>
      <p>Повний опис матеріалів також збережено у файлі <code>ASSET-LICENSES.md</code> в репозиторії. З питанням про конкретний актив звертайтеся до BARBERLAB: <a href={settings.phoneLink}>{settings.phone}</a>, {settings.address}.
      </p>
      <p className="small-note">Походження й умови наведені настільки, наскільки це підтверджують файли та відомості про цей проєкт. Ця сторінка не є правовим висновком або гарантією ліцензійного статусу.</p>
    </article></section>
  </>;
}
