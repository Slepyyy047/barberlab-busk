'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Service, Settings } from '@/lib/types';
import { ServiceRows } from './Shared';

const ALL_SERVICES = 'Усі послуги';

/** Normalize CMS labels into stable keys without restricting custom categories. */
export function normalizeServiceCategory(category: string): string {
  return category.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('uk-UA');
}

type Props = { services: Service[]; settings: Settings; categoryLabels?: string[] };

export default function ServiceFilter({ services, settings, categoryLabels }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number } | null>(null);
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    const labels = [...(categoryLabels ?? []), ...services.map((service) => service.category)];
    for (const source of labels) {
      const label = source.normalize('NFKC').trim().replace(/\s+/gu, ' ');
      const key = normalizeServiceCategory(label);
      if (key && !unique.has(key)) unique.set(key, label);
    }
    return [...unique.entries()];
  }, [categoryLabels, services]);

  // If CMS content changes while a category is selected, fall back to all services.
  const activeCategory = categories.some(([key]) => key === selectedCategory) ? selectedCategory : '';
  const activeKey = activeCategory || ALL_SERVICES;
  const visibleServices = services.filter((service) =>
    service.visible && (!activeCategory || normalizeServiceCategory(service.category) === activeCategory),
  );

  useEffect(() => {
    const container = filterRef.current;
    const activeButton = container?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!container || !activeButton) return;

    const updateIndicator = () => {
      const containerBounds = container.getBoundingClientRect();
      const buttonBounds = activeButton.getBoundingClientRect();
      setIndicator({
        left: buttonBounds.left - containerBounds.left,
        top: buttonBounds.bottom - containerBounds.top - 5,
        width: buttonBounds.width,
      });
    };

    updateIndicator();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateIndicator);
    observer?.observe(container);
    observer?.observe(activeButton);
    window.addEventListener('resize', updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeKey, categories]);

  return (
    <>
      <div className="filter-buttons service-filter-buttons" role="group" aria-label="Категорії послуг" ref={filterRef}>
        {indicator && (
          <span
            className="service-filter-indicator"
            aria-hidden="true"
            style={{ left: indicator.left, top: indicator.top, width: indicator.width }}
          />
        )}
        <button type="button" onClick={() => setSelectedCategory('')} aria-pressed={!activeCategory}>
          {ALL_SERVICES}
        </button>
        {categories.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setSelectedCategory(key)} aria-pressed={activeCategory === key}>
            {label}
          </button>
        ))}
      </div>
      <div className="filter-results" key={activeCategory}>
        {visibleServices.length ? (
          <ServiceRows services={visibleServices} settings={settings} reveal={false} />
        ) : (
          <p className="filter-empty" role="status">
            {activeCategory ? 'У цій категорії поки немає опублікованих послуг.' : 'Опублікованих послуг поки немає.'}
          </p>
        )}
      </div>
    </>
  );
}
