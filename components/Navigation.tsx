'use client';

import ArrowIcon from '@/components/ArrowIcon';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const links = [
  ['/#experience', 'Атмосфера'],
  ['/#team', 'Команда'],
  ['/#services', 'Послуги'],
  ['/#contacts', 'Контакти'],
] as const;

const MOBILE_QUERY = '(max-width: 780px)';

export default function Navigation({ bookingUrl }: { bookingUrl: string }) {
  const path = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const open = openPath === path;
  const menuIsClosed = mobile && !open;

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpenPath(null);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const closeAndFocusToggle = useCallback(() => {
    setOpenPath(null);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open || !mobile) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        navRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [mobile, open]);

  useEffect(() => {
    if (!open || !mobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndFocusToggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeAndFocusToggle, mobile, open]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      if (path !== '/') return;
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 84;
      const current = links.find(([href]) => {
        const bounds = document.getElementById(href.split('#')[1])?.getBoundingClientRect();
        return bounds && bounds.top <= headerBottom + 40 && bounds.bottom > headerBottom + 40;
      });
      setActiveSection(current?.[0].split('#')[1] ?? '');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive:true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [path]);

  const closeMenu = () => setOpenPath(null);

  return (
    <>
      <header className="site-header" data-scrolled={scrolled}>
        <Link
          href="/"
          className="wordmark"
          aria-label="BARBERLAB — головна"
          onClick={closeMenu}
        >
          <span className="logo-crop">
            <Image src="/logo-hd.png" alt="BARBERLAB" width={1983} height={793} unoptimized />
          </span>
          <small>БАРБЕРШОП У БУСЬКУ</small>
        </Link>
        <nav
          ref={navRef}
          id="primary-nav"
          aria-label="Основна навігація"
          aria-hidden={menuIsClosed}
          inert={menuIsClosed}
          data-open={open ? 'true' : 'false'}
          className="nav-links nav-links--mobile"
        >
          {links.map(([href, label], index) => (
            <Link
              key={href}
              href={href}
              aria-current={path === '/' && activeSection === href.split('#')[1] ? 'location' : undefined}
              tabIndex={menuIsClosed ? -1 : undefined}
              style={{ '--nav-delay': `${index * 45}ms` } as React.CSSProperties}
              onClick={closeMenu}
            >
              {label}
            </Link>
          ))}
        </nav>
        <a className="button header-book" href={bookingUrl} target="_blank" rel="noopener noreferrer">
          Записатися
        </a>
        <button
          ref={toggleRef}
          className="menu-toggle"
          type="button"
          aria-controls="primary-nav"
          aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
          aria-expanded={open}
          onClick={() => setOpenPath((current) => current === path ? null : path)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) closeAndFocusToggle();
          }}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
      </header>
      <a className="mobile-book button" href={bookingUrl} target="_blank" rel="noopener noreferrer">
        Записатися <ArrowIcon/>
      </a>
    </>
  );
}
