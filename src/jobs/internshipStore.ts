export type InternshipType = 'SWE' | 'AI' | 'PM' | 'QUANT' | 'HWE';
export type InternshipRequestType = InternshipType | 'ALL';

export type InternshipPosting = {
  company: string;
  jobTitle: string;
  link: string;
};

export type InternshipStore = {
  lastUpdatedAt: string | null;
  sourceRepoPath: string;
  sourceReadmePath: string;
  internshipsByType: Record<InternshipType, InternshipPosting[]>;
};

export const INTERNSHIP_SECTIONS: { name: InternshipType; header: string }[] = [
  { name: 'SWE', header: '## 💻 Software Engineering Internship Roles' },
  { name: 'AI', header: '## 🤖 Data Science, AI & Machine Learning Internship Roles' },
  { name: 'PM', header: '## 📱 Product Management Internship Roles' },
  { name: 'QUANT', header: '## 📈 Quantitative Finance Internship Roles' },
  { name: 'HWE', header: '## 🔧 Hardware Engineering Internship Roles' },
];

const createEmptyInternshipsByType = (): Record<InternshipType, InternshipPosting[]> => ({
  SWE: [],
  AI: [],
  PM: [],
  QUANT: [],
  HWE: [],
});

const internshipStore: InternshipStore = {
  lastUpdatedAt: null,
  sourceRepoPath: '',
  sourceReadmePath: '',
  internshipsByType: createEmptyInternshipsByType(),
};

export function createEmptyInternshipStore(
  sourceRepoPath = '',
  sourceReadmePath = '',
): InternshipStore {
  return {
    lastUpdatedAt: null,
    sourceRepoPath,
    sourceReadmePath,
    internshipsByType: createEmptyInternshipsByType(),
  };
}

export function getInternshipStore(): InternshipStore {
  return {
    ...internshipStore,
    internshipsByType: {
      SWE: [...internshipStore.internshipsByType.SWE],
      AI: [...internshipStore.internshipsByType.AI],
      PM: [...internshipStore.internshipsByType.PM],
      QUANT: [...internshipStore.internshipsByType.QUANT],
      HWE: [...internshipStore.internshipsByType.HWE],
    },
  };
}

export function updateInternshipStore(store: InternshipStore): InternshipStore {
  internshipStore.lastUpdatedAt = store.lastUpdatedAt;
  internshipStore.sourceRepoPath = store.sourceRepoPath;
  internshipStore.sourceReadmePath = store.sourceReadmePath;
  internshipStore.internshipsByType = {
    SWE: [...store.internshipsByType.SWE],
    AI: [...store.internshipsByType.AI],
    PM: [...store.internshipsByType.PM],
    QUANT: [...store.internshipsByType.QUANT],
    HWE: [...store.internshipsByType.HWE],
  };

  return getInternshipStore();
}

export function isInternshipType(value: string): value is InternshipType {
  return INTERNSHIP_SECTIONS.some((section) => section.name === value);
}

export function getInternshipTypesForCategory(
  category: InternshipRequestType,
): InternshipType[] {
  if (category === 'ALL') {
    return INTERNSHIP_SECTIONS.map((section) => section.name);
  }

  return isInternshipType(category) ? [category] : [];
}

export function getInternshipsForCategory(
  category: InternshipRequestType,
  store: InternshipStore = getInternshipStore(),
): InternshipPosting[] {
  return getInternshipTypesForCategory(category).flatMap(
    (type) => store.internshipsByType[type],
  );
}
