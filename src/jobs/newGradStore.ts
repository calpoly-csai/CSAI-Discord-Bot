import {
  OpportunityPosting,
  OpportunitySection,
} from './opportunityParser';

export type NewGradType = 'SWE' | 'AI' | 'PM' | 'QUANT' | 'HWE' | 'OTHER';
export type NewGradRequestType = NewGradType | 'ALL';
export type NewGradPosting = OpportunityPosting;

export type NewGradStore = {
  lastUpdatedAt: string | null;
  sourceRepoPath: string;
  sourceReadmePath: string;
  newGradsByType: Record<NewGradType, NewGradPosting[]>;
};

export const NEW_GRAD_SECTIONS: OpportunitySection<NewGradType>[] = [
  { name: 'SWE', header: '## 💻 Software Engineering New Grad Roles' },
  { name: 'AI', header: '## 🤖 Data Science, AI & Machine Learning New Grad Roles' },
  { name: 'PM', header: '## 📱 Product Management New Grad Roles' },
  { name: 'QUANT', header: '## 📈 Quantitative Finance New Grad Roles' },
  { name: 'HWE', header: '## 🔧 Hardware Engineering New Grad Roles' },
  { name: 'OTHER', header: '## 💼 Other New Grad Roles' },
];

const createEmptyNewGradsByType = (): Record<NewGradType, NewGradPosting[]> => ({
  SWE: [],
  AI: [],
  PM: [],
  QUANT: [],
  HWE: [],
  OTHER: [],
});

const newGradStore: NewGradStore = {
  lastUpdatedAt: null,
  sourceRepoPath: '',
  sourceReadmePath: '',
  newGradsByType: createEmptyNewGradsByType(),
};

export function createEmptyNewGradStore(
  sourceRepoPath = '',
  sourceReadmePath = '',
): NewGradStore {
  return {
    lastUpdatedAt: null,
    sourceRepoPath,
    sourceReadmePath,
    newGradsByType: createEmptyNewGradsByType(),
  };
}

export function getNewGradStore(): NewGradStore {
  return {
    ...newGradStore,
    newGradsByType: {
      SWE: [...newGradStore.newGradsByType.SWE],
      AI: [...newGradStore.newGradsByType.AI],
      PM: [...newGradStore.newGradsByType.PM],
      QUANT: [...newGradStore.newGradsByType.QUANT],
      HWE: [...newGradStore.newGradsByType.HWE],
      OTHER: [...newGradStore.newGradsByType.OTHER],
    },
  };
}

export function updateNewGradStore(store: NewGradStore): NewGradStore {
  newGradStore.lastUpdatedAt = store.lastUpdatedAt;
  newGradStore.sourceRepoPath = store.sourceRepoPath;
  newGradStore.sourceReadmePath = store.sourceReadmePath;
  newGradStore.newGradsByType = {
    SWE: [...store.newGradsByType.SWE],
    AI: [...store.newGradsByType.AI],
    PM: [...store.newGradsByType.PM],
    QUANT: [...store.newGradsByType.QUANT],
    HWE: [...store.newGradsByType.HWE],
    OTHER: [...store.newGradsByType.OTHER],
  };

  return getNewGradStore();
}

export function isNewGradType(value: string): value is NewGradType {
  return NEW_GRAD_SECTIONS.some((section) => section.name === value);
}

export function getNewGradTypesForCategory(
  category: NewGradRequestType,
): NewGradType[] {
  if (category === 'ALL') {
    return NEW_GRAD_SECTIONS.map((section) => section.name);
  }

  return isNewGradType(category) ? [category] : [];
}

export function getNewGradsForCategory(
  category: NewGradRequestType,
  store: NewGradStore = getNewGradStore(),
): NewGradPosting[] {
  return getNewGradTypesForCategory(category).flatMap(
    (type) => store.newGradsByType[type],
  );
}
