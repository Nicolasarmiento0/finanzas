import { useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 768;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isMobile = width < DESKTOP_BREAKPOINT;

  return {
    width,
    height,
    isDesktop,
    isMobile,
  };
}
