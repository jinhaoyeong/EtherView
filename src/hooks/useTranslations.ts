import { translations } from '@/lib/translations';

export function useTranslations() {
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations.en;

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };

  return { t };
}