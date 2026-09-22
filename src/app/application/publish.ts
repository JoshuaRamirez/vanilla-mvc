import type { BusEvent } from '../../framework/index.ts';

/** How a publisher sends: the owning capability's publish, handed over. */
export type Publish = <E extends BusEvent>(event: E) => void;
