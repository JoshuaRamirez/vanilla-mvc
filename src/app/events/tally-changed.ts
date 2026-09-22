/** The tally and the step it moves by. */
export interface TallyChanged {
  readonly type: 'TallyChanged';
  readonly count: number;
  readonly step: number | null;
}
