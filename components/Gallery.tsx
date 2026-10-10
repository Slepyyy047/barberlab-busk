'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { GalleryImage } from '@/lib/types';

export default function Gallery({ images }: { images: GalleryImage[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const [category, setCategory] = useState('Усі фото');
  const [opened, setOpened] = useState(false);
  const categories = ['Усі фото', ...new Set(images.map((image) => image.category).filter(Boolean))];
  const activeCategory = categories.includes(category) ? category : 'Усі фото';
  const shown = activeCategory === 'Усі фото' ? images : images.filter((image) => image.category === activeCategory);

  useEffect(() => {
    if (!opened) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [opened]);

  function close() {
    if (dialog.current?.open) dialog.current.close();
    setOpened(false);
  }

  function open(imageIndex: number, button: HTMLButtonElement) {
    const viewer = dialog.current;
    if (!viewer || viewer.open) return;
    setIndex(imageIndex);
    trigger.current = button;
    viewer.showModal();
    setOpened(true);
  }

  function move(direction: number) {
    if (!shown.length) return;
    setIndex((current) => (current + direction + shown.length) % shown.length);
  }

  return (
    <>
      {categories.length > 2 && (
        <div className="filter-buttons" role="group" aria-label="Категорії фотографій">
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={item === activeCategory}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      <div className="gallery-grid">
        {shown.map((image, imageIndex) => (
          <button
            className="gallery-item"
            type="button"
            key={image.id}
            data-reveal
            data-delay={Math.min(imageIndex * 70, 280)}
            onClick={(event) => open(imageIndex, event.currentTarget)}
            aria-label={`Відкрити фото: ${image.alt}`}
          >
            <Image src={image.src} alt={image.alt} width={700} height={800} unoptimized />
            <span>
              <span>{image.alt}</span>
              <span className="gallery-arrow" aria-hidden="true">↗</span>
            </span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="viewer"
        aria-label="Перегляд фотографій"
        onClose={() => {
          setOpened(false);
          const returnTarget = trigger.current;
          if (returnTarget?.isConnected) returnTarget.focus();
          trigger.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            move(event.key === 'ArrowRight' ? 1 : -1);
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <button className="viewer-close" type="button" onClick={close} autoFocus>
          Закрити <span aria-hidden="true">✕</span>
        </button>
        <div className="viewer-content" aria-live="polite" aria-atomic="true">
          {shown[index] && (
            <div className="viewer-image-frame" key={shown[index].id}>
              <Image
                src={shown[index].src}
                alt={shown[index].alt}
                width={2000}
                height={2000}
                unoptimized
              />
            </div>
          )}
          <p>{shown[index]?.alt}</p>
          <div className="viewer-controls">
            <button type="button" onClick={() => move(-1)} aria-label="Попереднє фото">
              Попереднє <span aria-hidden="true">←</span>
            </button>
            <span>{shown.length ? `${index + 1} / ${shown.length}` : '0 / 0'}</span>
            <button type="button" onClick={() => move(1)} aria-label="Наступне фото">
              Наступне <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
