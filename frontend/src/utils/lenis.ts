import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance: Lenis | null = null;

export function initLenis(): () => void {
  // If Lenis is already running, clean it up
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }

  try {
    lenisInstance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.3,
    });

    // Synchronize Lenis scroll position with GSAP ScrollTrigger
    lenisInstance.on('scroll', () => {
      ScrollTrigger.update();
    });

    const updateTicker = (time: number) => {
      lenisInstance?.raf(time * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    // Initial ScrollTrigger refresh after Lenis is hooked up
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => {
      gsap.ticker.remove(updateTicker);
      lenisInstance?.destroy();
      lenisInstance = null;
    };
  } catch (err) {
    console.warn('Lenis smooth scrolling initialization error:', err);
    return () => {};
  }
}

export function getLenis(): Lenis | null {
  return lenisInstance;
}

export { gsap, ScrollTrigger };
