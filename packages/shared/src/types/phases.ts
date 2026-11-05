import { MeldType } from './cards.js';

export interface MeldRequirement {
  type: MeldType;
  count: number;
  description: string;
}

export interface PhaseDefinition {
  number: number;
  title: string;
  description: string;
  requirements: MeldRequirement[];
}

export const PHASES: PhaseDefinition[] = [
  {
    number: 1,
    title: 'Phase 1',
    description: '2 sets of 3',
    requirements: [
      { type: 'set', count: 3, description: 'Set of 3' },
      { type: 'set', count: 3, description: 'Set of 3' }
    ]
  },
  {
    number: 2,
    title: 'Phase 2',
    description: '1 set of 3 + 1 run of 4',
    requirements: [
      { type: 'set', count: 3, description: 'Set of 3' },
      { type: 'run', count: 4, description: 'Run of 4' }
    ]
  },
  {
    number: 3,
    title: 'Phase 3',
    description: '1 set of 4 + 1 run of 4',
    requirements: [
      { type: 'set', count: 4, description: 'Set of 4' },
      { type: 'run', count: 4, description: 'Run of 4' }
    ]
  },
  {
    number: 4,
    title: 'Phase 4',
    description: '1 run of 7',
    requirements: [
      { type: 'run', count: 7, description: 'Run of 7' }
    ]
  },
  {
    number: 5,
    title: 'Phase 5',
    description: '1 run of 8',
    requirements: [
      { type: 'run', count: 8, description: 'Run of 8' }
    ]
  },
  {
    number: 6,
    title: 'Phase 6',
    description: '1 run of 9',
    requirements: [
      { type: 'run', count: 9, description: 'Run of 9' }
    ]
  },
  {
    number: 7,
    title: 'Phase 7',
    description: '2 sets of 4',
    requirements: [
      { type: 'set', count: 4, description: 'Set of 4' },
      { type: 'set', count: 4, description: 'Set of 4' }
    ]
  },
  {
    number: 8,
    title: 'Phase 8',
    description: '7 cards of one color',
    requirements: [
      { type: 'color_group', count: 7, description: '7 cards of one color' }
    ]
  },
  {
    number: 9,
    title: 'Phase 9',
    description: '1 set of 5 + 1 set of 2',
    requirements: [
      { type: 'set', count: 5, description: 'Set of 5' },
      { type: 'set', count: 2, description: 'Set of 2' }
    ]
  },
  {
    number: 10,
    title: 'Phase 10',
    description: '1 set of 5 + 1 set of 3',
    requirements: [
      { type: 'set', count: 5, description: 'Set of 5' },
      { type: 'set', count: 3, description: 'Set of 3' }
    ]
  }
];

export function getPhaseDefinition(phaseNumber: number): PhaseDefinition | undefined {
  return PHASES.find(p => p.number === phaseNumber);
}
