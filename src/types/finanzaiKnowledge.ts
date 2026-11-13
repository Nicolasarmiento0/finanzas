import type { QueryIntent } from '@/lib/queryEngine';

export interface SlangMultiplierRule {
  tokens: string[];
  factor: number;
}

export interface SlangIdiomRule {
  meaning: string;
  hintIntents?: QueryIntent[];
  category?: string;
  paymentMode?: 'cash' | 'installments';
}

export interface IntentKnowledgeRule {
  priority: number;
  matchMode?: 'includes' | 'boundary';
  requiresAmount?: boolean;
  requiresAmountBoost?: number;
  requiresHorizonBoost?: number;
  strongPhrases: string[];
  keywords: string[];
  negativeKeywords?: string[];
}

export interface CategoryKnowledgeRule {
  aliases: string[];
  merchants: string[];
  subtypes?: Record<string, string[]>;
}

export interface FollowUpPatternRule {
  pattern: string;
  updates: Record<string, string | number | undefined>;
  inheritIntentIfMissing: QueryIntent[];
}

export interface FinanzAIKnowledge {
  version: string;
  locale: string;
  currency: {
    code: string;
    symbol: string;
    decimals: number;
  };
  slangAndUnits: {
    multipliers: SlangMultiplierRule[];
    idioms: Record<string, SlangIdiomRule>;
  };
  intents: Partial<Record<QueryIntent, IntentKnowledgeRule>>;
  entities: {
    categories: Record<string, CategoryKnowledgeRule>;
    cardBrands: Record<'santander' | 'falabella' | 'other', string[]>;
    paymentModes: {
      cash: string[];
      installments: string[];
    };
  };
  followUpPatterns: FollowUpPatternRule[];
  domainContext: {
    glossary: Record<string, string>;
    responseRules: string[];
  };
}
