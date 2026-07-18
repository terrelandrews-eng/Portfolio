import { useEffect, useState } from 'react';

// Module-level memoized probe: creating a throwaway canvas and requesting a
// GL context is only done once per page load, regardless of how many
// components call this hook.
let cachedSupport: boolean | null = null;

function probeWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Returns whether WebGL is available in this browser.
 * - `null`  -> not yet probed (only possible very briefly before mount)
 * - `true`  -> webgl2 or webgl context obtained successfully
 * - `false` -> no GL context could be created
 */
export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(cachedSupport);

  useEffect(() => {
    if (cachedSupport === null) {
      cachedSupport = probeWebGLSupport();
    }
    setSupported(cachedSupport);
  }, []);

  return supported;
}
