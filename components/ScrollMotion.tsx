'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Progressive, per-element scroll motion with a visible-content fallback. */
export default function ScrollMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tracked = new Set<HTMLElement>();
    let observer: IntersectionObserver | undefined;
    let mutations: MutationObserver | undefined;
    let ambientObserver: IntersectionObserver | undefined;
    const ambientItems = Array.from(document.querySelectorAll<HTMLElement>('[data-ambient-motion]'));
    let frame = 0;
    let active = false;

    const show = (element: HTMLElement) => {
      element.classList.remove('reveal-pending');
      element.classList.add('is-visible');
    };

    const enroll = (element: HTMLElement) => {
      if (tracked.has(element)) return;
      tracked.add(element);
      const delay = Number.parseFloat(element.dataset.delay ?? '0');
      if (Number.isFinite(delay) && delay > 0) {
        element.style.setProperty('--reveal-delay', `${Math.min(delay, 1000)}ms`);
      }
      if (!active || motionQuery.matches || !observer) {
        show(element);
        return;
      }
      element.classList.remove('is-visible');
      element.classList.add('reveal-pending');
      observer.observe(element);
    };

    const visitAddedNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches('[data-reveal]')) enroll(node);
      node.querySelectorAll<HTMLElement>('[data-reveal]').forEach(enroll);
    };

    const visitRemovedNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      const remove = (element: HTMLElement) => {
        observer?.unobserve(element);
        tracked.delete(element);
        element.classList.remove('reveal-pending', 'is-visible');
        element.style.removeProperty('--reveal-delay');
      };
      if (node.matches('[data-reveal]')) remove(node);
      node.querySelectorAll<HTMLElement>('[data-reveal]').forEach(remove);
    };

    const parallaxItems = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
    const heroItems = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-motion]'));
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-scene]'));
    const hasScrollEffects = parallaxItems.length > 0 || heroItems.length > 0 || scenes.length > 0;

    const clearScrollValues = () => {
      parallaxItems.forEach((element) => element.style.removeProperty('--parallax-y'));
      heroItems.forEach((element) => element.style.removeProperty('--hero-progress'));
      scenes.forEach((element) => element.style.removeProperty('--scene-progress'));
    };

    const updateScrollValues = () => {
      frame = 0;
      if (!active || motionQuery.matches || document.hidden) return;
      const viewportHeight = Math.max(window.innerHeight, 1);

      for (const element of parallaxItems) {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom < 0 || bounds.top > viewportHeight) continue;
        const strength = Number.parseFloat(element.dataset.parallax ?? '0');
        if (!Number.isFinite(strength) || strength === 0) continue;
        const centerOffset = (viewportHeight / 2 - (bounds.top + bounds.height / 2)) / viewportHeight;
        const offset = Math.max(-Math.abs(strength), Math.min(Math.abs(strength), centerOffset * strength));
        element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
      }

      scenes.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (viewportHeight - bounds.top) / (viewportHeight + bounds.height)));
        element.style.setProperty('--scene-progress', progress.toFixed(4));
      });

      const progress = Math.max(0, Math.min(1, window.scrollY / viewportHeight));
      heroItems.forEach((element) => {
        element.style.setProperty('--hero-progress', progress.toFixed(4));
      });
    };

    const scheduleScrollUpdate = () => {
      if (hasScrollEffects && !frame && !document.hidden) frame = window.requestAnimationFrame(updateScrollValues);
    };

    const revealAll = () => {
      active = false;
      root.classList.remove('motion-ready');
      ambientItems.forEach(e=>e.classList.remove('ambient-active'));
      tracked.forEach(show);
      clearScrollValues();
    };

    const initialize = () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      observer?.disconnect();
      observer = undefined;
      ambientObserver?.disconnect();
      ambientObserver = undefined;
      ambientItems.forEach(e=>e.classList.remove('ambient-active'));
      mutations?.disconnect();
      mutations = undefined;
      tracked.forEach((element) => {
        element.classList.remove('reveal-pending', 'is-visible');
        element.style.removeProperty('--reveal-delay');
      });
      tracked.clear();
      root.classList.remove('motion-ready');
      clearScrollValues();

      if (motionQuery.matches) {
        revealAll();
        return;
      }

      try {
        if (!('IntersectionObserver' in window)) {
          revealAll();
          return;
        }

        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target as HTMLElement;
            show(element);
            observer?.unobserve(element);
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

        active = true;
        root.classList.add('motion-ready');
        document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(enroll);
        ambientObserver = new IntersectionObserver(entries=>{entries.forEach(entry=>(entry.target as HTMLElement).classList.toggle('ambient-active',entry.isIntersecting));},{rootMargin:'100px',threshold:0});
        ambientItems.forEach(e=>ambientObserver?.observe(e));

        if ('MutationObserver' in window) {
          mutations = new MutationObserver((records) => {
            for (const record of records) {
              record.removedNodes.forEach(visitRemovedNode);
              record.addedNodes.forEach(visitAddedNode);
            }
          });
          mutations.observe(document.body, { childList: true, subtree: true });
        }
        scheduleScrollUpdate();
      } catch {
        observer?.disconnect();
        observer = undefined;
        ambientObserver?.disconnect();
        ambientObserver = undefined;
        mutations?.disconnect();
        mutations = undefined;
        revealAll();
      }
    };

    const onMotionPreferenceChange = () => initialize();
    const onVisibilityChange = () => {
      root.classList.toggle('tab-hidden',document.hidden);
      if (document.hidden && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!document.hidden) {
        scheduleScrollUpdate();
      }
    };

    if (hasScrollEffects) {
      window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
      window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    motionQuery.addEventListener('change', onMotionPreferenceChange);
    initialize();

    return () => {
      active = false;
      if (hasScrollEffects) {
        window.removeEventListener('scroll', scheduleScrollUpdate);
        window.removeEventListener('resize', scheduleScrollUpdate);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      motionQuery.removeEventListener('change', onMotionPreferenceChange);
      observer?.disconnect();
      ambientObserver?.disconnect();
      ambientItems.forEach(e=>e.classList.remove('ambient-active'));
      root.classList.remove('tab-hidden');
      mutations?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      tracked.forEach((element) => {
        element.classList.remove('reveal-pending', 'is-visible');
        element.style.removeProperty('--reveal-delay');
      });
      tracked.clear();
      clearScrollValues();
      root.classList.remove('motion-ready');
    };
  }, [pathname]);

  return null;
}


