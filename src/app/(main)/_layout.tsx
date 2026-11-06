import React from 'react';
import { Slot } from 'expo-router';
import { AdaptiveNavigation } from '@/components/layout/AdaptiveNavigation';

export default function MainLayout() {
  return (
    <AdaptiveNavigation>
      <Slot />
    </AdaptiveNavigation>
  );
}
