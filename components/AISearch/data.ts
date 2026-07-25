export const SCROLL_QUESTIONS = [
  "How much does assisted living cost near you?",
  "Which facilities near Boston have memory care?",
  "Which communities have the best reviews?",
  "Which facilities have the most experienced staff?",
  "What should I ask on a tour?",
];

export type JourneyStage = 'starting' | 'comparing' | 'contacting';

export interface JourneyOption {
  id: JourneyStage;
  title: string;
  subtitle: string;
  exampleQuestions: string[];
}

export const JOURNEY_OPTIONS: JourneyOption[] = [
  {
    id: 'starting',
    title: "I'm just starting",
    subtitle: "Learn the basics and understand your options",
    exampleQuestions: [
      "What is assisted living?",
      "How much does it cost in Massachusetts?",
      "What's included in the monthly fee?",
      "How do I know if my parent needs assisted living?",
    ],
  },
  {
    id: 'comparing',
    title: "I'm comparing options",
    subtitle: "Evaluate facilities side by side",
    exampleQuestions: [
      "Which facilities near Boston have memory care?",
      "Which communities have the best reviews?",
      "Which facilities have the most experienced staff?",
      "What's the difference between assisted living and memory care?",
    ],
  },
  {
    id: 'contacting',
    title: "I'm ready to contact places",
    subtitle: "Take the next step with confidence",
    exampleQuestions: [
      "What should I ask on a tour?",
      "How do I schedule a visit?",
      "What should I bring to the tour?",
      "How do I compare final pricing?",
    ],
  },
];

export const SUGGESTED_PROMPTS: Record<JourneyStage, string[]> = {
  starting: [
    "How much does assisted living cost in Massachusetts?",
    "What's included in the monthly fee?",
    "How do I know if my parent needs assisted living?",
    "What types of care are available?",
    "Is there financial assistance available?",
  ],
  comparing: [
    "Which facilities near Boston have memory care?",
    "Which communities have the best reviews?",
    "Which facilities have the most experienced staff?",
    "What's the difference between assisted living and memory care?",
    "How do I compare amenities between facilities?",
  ],
  contacting: [
    "What should I ask on a tour?",
    "How do I schedule a visit?",
    "What should I bring to the tour?",
    "How do I compare final pricing?",
    "What contracts should I review?",
  ],
};

export interface KeyQuestion {
  stage: JourneyStage;
  question: string;
  answerPreview: string;
}

export const KEY_QUESTIONS: KeyQuestion[] = [
  { stage: 'starting', question: "How much does assisted living cost in Massachusetts?", answerPreview: "Costs range from $4,500 to $8,500+ per month depending on location, care needs, and amenities." },
  { stage: 'starting', question: "What's included in the monthly fee?", answerPreview: "Typically room, meals, housekeeping, basic care, activities, and transportation are included." },
  { stage: 'starting', question: "Is there financial assistance available?", answerPreview: "MassHealth may cover some costs. Veterans benefits and long-term care insurance are also options." },
  { stage: 'comparing', question: "Which communities have the best reviews?", answerPreview: "Top-rated communities often have responsive staff, engaging activities, and well-maintained facilities." },
  { stage: 'comparing', question: "Which facilities have the most experienced staff?", answerPreview: "Look for low turnover, high CNA-to-resident ratios, and specialized dementia training." },
  { stage: 'comparing', question: "What's the difference between assisted living and memory care?", answerPreview: "Memory care provides specialized security, structured routines, and staff trained in dementia care." },
  { stage: 'contacting', question: "What should I ask on a tour?", answerPreview: "Ask about staff turnover, resident satisfaction, emergency protocols, and sample activity schedules." },
  { stage: 'contacting', question: "How do I compare final pricing?", answerPreview: "Request an all-in estimate including care levels, move-in fees, and any a-la-carte charges." },
];

export interface Facility {
  id: string;
  name: string;
  city: string;
  state: string;
  monthlyCostMin: number;
  monthlyCostMax: number;
  rating: number;
  reviewCount: number;
  careTypes: string[];
  staffYears: number;
  distanceMiles: number;
  highlights: string[];
}

export const DUMMY_FACILITIES: Facility[] = [
  {
    id: 'f1',
    name: 'Sunrise of Newton',
    city: 'Newton',
    state: 'MA',
    monthlyCostMin: 6500,
    monthlyCostMax: 8400,
    rating: 4.6,
    reviewCount: 42,
    careTypes: ['Assisted Living', 'Memory Care'],
    staffYears: 5.2,
    distanceMiles: 8,
    highlights: ['Pet-friendly', 'Garden courtyard', 'Physical therapy on-site'],
  },
  {
    id: 'f2',
    name: 'Atria Longmeadow Place',
    city: 'Burlington',
    state: 'MA',
    monthlyCostMin: 5800,
    monthlyCostMax: 7600,
    rating: 4.4,
    reviewCount: 36,
    careTypes: ['Assisted Living', 'Independent Living'],
    staffYears: 4.8,
    distanceMiles: 12,
    highlights: ['Resident garden', 'Chef-prepared meals', 'Art studio'],
  },
  {
    id: 'f3',
    name: 'The Residence at Watertown',
    city: 'Watertown',
    state: 'MA',
    monthlyCostMin: 6200,
    monthlyCostMax: 8900,
    rating: 4.7,
    reviewCount: 28,
    careTypes: ['Assisted Living', 'Memory Care', 'Respite'],
    staffYears: 6.1,
    distanceMiles: 6,
    highlights: ['Premier memory care', 'All-day dining', 'Concierge services'],
  },
  {
    id: 'f4',
    name: 'Brightview Concord River',
    city: 'Bedford',
    state: 'MA',
    monthlyCostMin: 5400,
    monthlyCostMax: 7200,
    rating: 4.3,
    reviewCount: 51,
    careTypes: ['Assisted Living'],
    staffYears: 3.9,
    distanceMiles: 15,
    highlights: ['Walking trails', 'Movie theater', 'Transportation'],
  },
];

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "How much does assisted living cost?",
    answer: "In Massachusetts, assisted living typically costs between $4,500 and $8,500 per month. Costs vary by location, room size, care needs, and amenities. Memory care usually adds $1,000–$2,000 per month.",
  },
  {
    question: "What's the difference between assisted living and memory care?",
    answer: "Assisted living helps with daily activities like bathing, meals, and medication. Memory care is a specialized form of assisted living for people with Alzheimer's or dementia, offering secure environments, structured routines, and staff with dementia training.",
  },
  {
    question: "How do I know if a community is trustworthy?",
    answer: "Look for state licensing, recent inspection reports, online reviews, staff tenure, and accreditation. Visiting in person and talking to current residents' families is one of the best ways to gauge trustworthiness.",
  },
  {
    question: "What should I ask during a tour?",
    answer: "Key questions: What's the staff-to-resident ratio? How do you handle medical emergencies? What activities are offered? Can residents personalize their space? What are all the costs beyond the base rate? Can I speak with a current resident's family?",
  },
  {
    question: "Is financial help available?",
    answer: "Yes. MassHealth may cover some assisted living costs for eligible residents. Veterans and surviving spouses may qualify for Aid & Attendance benefits. Long-term care insurance and life settlement policies are also options.",
  },
];
