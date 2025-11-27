"use client";

import { useSettings } from './use-settings';
import { useTranslation as useBaseTranslation } from '@/lib/translations';

export function useTranslation() {
  const { settings } = useSettings();
  const language = settings?.appearance.language || 'en';

  return useBaseTranslation(language);
}