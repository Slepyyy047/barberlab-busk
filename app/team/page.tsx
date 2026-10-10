import type { Metadata } from 'next';
import Image from 'next/image';
import ToolField from '@/components/ToolField';
import { getContent } from '@/lib/store';
import { PageHeading, Closing } from '@/components/Shared';

export const metadata: Metadata = {
  ...(process.env.BARBERLAB_PUBLIC_URL ? { alternates: { canonical: '/team' } } : {}),
  title: 'Команда',
  description: 'Команда BARBERLAB у Буську: майстри та онлайн-запис.',
};

export default function Team() {
  const { staff, settings } = getContent();
  const visibleStaff = staff.filter((person) => person.visible).sort((a, b) => a.order - b.order);

  return (
    <>
      <PageHeading
        number="02 / КОМАНДА"
        title="Майстри BARBERLAB."
        description="Обери майстра та зручний час для візиту."
      />
      <section className="section paper decorated-section" aria-label="Майстри барбершопу">
        <ToolField variant="team" />
        <div className="container team-list">
          {visibleStaff.length === 0 ? (
            <p className="team-empty" role="status">
              Інформація про майстрів поки недоступна. Обрати майстра можна під час запису.
            </p>
          ) : visibleStaff.map((person, index) => (
            <article
              className={`team-card${person.portrait ? '' : ' team-card--no-portrait'}`}
              key={person.id}
              data-reveal
              data-motion="mask"
              data-delay={Math.min(index * 90, 360)}
            >
              <div className="team-portrait">
                {person.portrait ? (
                  <Image
                    src={person.portrait}
                    alt={person.name}
                    width={700}
                    height={875}
                    unoptimized
                  />
                ) : (
                  <span>Портрет не додано</span>
                )}
              </div>
              <div className="team-card-copy">
                <span className="person-index">МАЙСТЕР / {String(index + 1).padStart(2, '0')}</span>
                <h2 className="team-name">{person.name}</h2>
                <p className="team-level">{person.level}</p>
                <a
                  className="text-link"
                  href={settings.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Записатися <span className="link-arrow" aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Closing settings={settings} />
    </>
  );
}
