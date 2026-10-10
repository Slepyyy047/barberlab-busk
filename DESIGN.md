# BARBERLAB — чорний / мідний

Остання вказівка користувача замінює попередню палітру й формат. Вигаданий етюд інтер’єру та MaterialScene повністю видалені. Жодних створених або сторонніх фотографій. Справжній наданий логотип — основа першого екрану; п’ять наданих портретів розміщені нижче. Фото стрижок з’являться тільки після завантаження до CMS.

Палітра: майже чорний #090909, темні поверхні #101010 / #171717, теплий помаранчевий #d88756 у кнопках і вибраній типографіці. Світлий текст. Жодних синіх або тілесних блоків.

Нова композиція: великий автентичний логотип, короткий текст і запис; рухома типографічна стрічка; послуги з виїздом з різних боків; маскований текст про реальні послуги й каву; надані портрети; реальні відгуки; адреса та великий фінальний запис.

Рух: логотип відсувається й масштабується при скролі; типографічна стрічка рухається відповідно до положення секції; послуги виїжджають з різних боків; заголовки й портрети розкриваються маскою; меню каскадно виїжджає, стрілки/кнопки/портрети реагують на наведення. Галерея з CMS має каскад і плавні зміни кадру. Прокручування природне. Без JavaScript і при reduced-motion все читається одразу.

CMS, послуги, ціни, облікові записи, контактні та Altegio посилання збережені. Нових залежностей немає.


Мобільне уточнення: остання непарна картка майстра центрована на головній та /team. Мобільні відступи компактніші. За прямою вказівкою користувача додані ненав’язливі контури ножиць і гребінця та згенерована чиста версія наданого логотипа public/logo-hd.png (1983×793). Оригінал збережено. Промпт і спосіб генерації: assets/logo-generation.md.

## Reference-inspired iteration · 10.10.2026

Reference reviewed: https://topor-nine.vercel.app/ . Used as motion and typography direction, without copying assets or business facts.

Near-black atmosphere with restrained copper accents. Hero combines an outlined headline, generated blurred background and drifting transparent objects. Fifteen distinct barber tools are distributed across the homepage; matching objects also appear on services, team and contacts pages. CSS animations and passive scroll updates use existing dependencies. Ambient loops pause offscreen and in hidden tabs; reduced-motion disables movement.

Header remains sticky, with links to homepage sections and a closing mobile menu. Order: hero, continuous marquee, experience, team, services, reviews, contacts. Gallery and About are temporarily removed; /gallery redirects to /#team and /about to /#experience. CMS content is retained.

Generated objects/background are decorative illustrations, not salon photographs. Real staff portraits and existing business content remain unchanged. Prompts and generator mode are recorded in assets/tool-generation.md and assets/background-generation.md.
