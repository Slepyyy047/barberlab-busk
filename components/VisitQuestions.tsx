import Link from 'next/link';
import type { Settings } from '@/lib/types';

export default function VisitQuestions({ settings }: { settings: Settings }) {
  return <section className="section visit-questions" aria-labelledby="visit-questions-title"><div className="container questions-grid">
    <div><h2 id="visit-questions-title">Поширені питання</h2><a className="text-link" href={settings.phoneLink}>{settings.phone} <span aria-hidden="true">↗</span></a></div>
    <div className="question-list">
      <details><summary>Як обрати стрижку?</summary><p>Покажи фото, яке подобається. Якщо не визначився — обговори форму й довжину з майстром.</p></details>
      <details><summary>Скільки коштує стрижка?</summary><p>Ціни й тривалість є в <Link href="/services">меню</Link>. Остаточну ціну та вільний час уточнюй під час запису.</p></details>
      <details><summary>Як записатися до конкретного майстра?</summary><p>У меню запису обери послугу, майстра та час. Або <a href={settings.phoneLink}>зателефонуй нам</a>.</p></details>

    </div>
  </div></section>;
}
