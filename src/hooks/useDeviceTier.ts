import { useEffect, useState } from 'react';
import { useAppStore, type QualityTier } from '../state/store';
import { useReducedMotion } from './useReducedMotion';

const COARSE_POINTER_QUERY = '(pointer: coarse)';
const SMALL_VIEWPORT_QUERY = '(max-width: 820px)';

function getInitialMobile(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (
    window.matchMedia(COARSE_POINTER_QUERY).matches ||
    window.matchMedia(SMALL_VIEWPORT_QUERY).matches
  );
}

function resolveTier(reducedMotion: boolean, mobile: boolean): QualityTier {
  if (reducedMotion) return 'reduced';
  if (mobile) return 'mobile';
  return 'high';
}

/**
 * Combines prefers-reduced-motion with a coarse mobile heuristic
 * (pointer: coarse OR small viewport) into a single quality tier, and
 * keeps the store's qualityTier in sync as the signals change.
 * 'reduced' wins over 'mobile' when both apply.
 */
export function useDeviceTier(): QualityTier {
  const reducedMotion = useReducedMotion();
  const [mobile, setMobile] = useState<boolean>(getInitialMobile);
  const setQualityTier = useAppStore((s) => s.setQualityTier);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const pointerMql = window.matchMedia(COARSE_POINTER_QUERY);
    const viewportMql = window.matchMedia(SMALL_VIEWPORT_QUERY);
    const onChange = () =>
      setMobile(pointerMql.matches || viewportMql.matches);
    onChange();
    pointerMql.addEventListener('change', onChange);
    viewportMql.addEventListener('change', onChange);
    return () => {
      pointerMql.removeEventListener('change', onChange);
      viewportMql.removeEventListener('change', onChange);
    };
  }, []);

  const tier = resolveTier(reducedMotion, mobile);

  useEffect(() => {
    setQualityTier(tier);
  }, [tier, setQualityTier]);

  return tier;
}
