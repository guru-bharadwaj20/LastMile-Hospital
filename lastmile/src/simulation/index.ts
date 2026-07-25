/**
 * Public surface of the simulation module.
 *
 *   constants.js              static description of the network
 *   engine.js                 pure reducer and derivations
 *   useNetworkSimulation.js   React adapter: timers, clock, state
 */
export {
  DEPARTMENTS,
  DEPARTMENT_NODES,
  SERVER,
  MAP_VIEWBOX,
  PRIORITY_COLORS,
  PRIORITY_LEVELS,
  PRIORITY_RANK,
  SERVER_COLOR,
  DEFAULT_PRIORITY_CONFIG,
  departmentColor,
  getRoomCenter,
  getNodeCenter,
} from './constants';

export {
  createInitialState,
  createSimulationContext,
  reduce,
  baseMode,
  isStressEngaged,
  offlineNodeNames,
  activeRatio,
  withNodeAvailability,
  calculateDeliveryTime,
  calculateUntriagedTime,
  targetLoad,
} from './engine';

export { useNetworkSimulation } from './useNetworkSimulation';

export type {
  Action,
  Alert,
  AlertType,
  BandwidthAllocation,
  Department,
  EventKind,
  EventStatus,
  LogEntry,
  Mode,
  NodeMap,
  NodeState,
  Point,
  Priority,
  PriorityRow,
  SimulationActions,
  SimulationContext,
  SimulationState,
  Stream,
} from './types';
