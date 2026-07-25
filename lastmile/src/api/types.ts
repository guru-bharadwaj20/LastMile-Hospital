/**
 * Wire types for the controller REST API.
 *
 * Mirrors SDN_files/api_model.py. Kept in a separate file from the
 * simulation's own types so it stays obvious which shapes cross the network
 * boundary and therefore cannot be trusted without validation.
 */
import type { Priority } from '../simulation';

export interface PolicyClass {
  priority: Priority;
  queueId: number;
  dscp: number;
  dscpName: string;
  minShare: number;
  maxShare: number;
  htbPriority: number;
  description: string;
}

export interface QueueStat {
  priority: Priority;
  queueId: number;
  dscp: number;
  txBytes: number;
  txPackets: number;
  txErrors: number;
  minShare: number;
  txBytesDelta?: number;
  bitsPerSecond?: number;
}

export interface ControllerStatus {
  version: string;
  timestamp: number;
  source: 'controller';
  qosActive: boolean;
  connectedSwitches: number[];
  expectedSwitches: number[];
  networkLoad: number;
  queues: QueueStat[];
  observedShares: Record<string, number>;
}

export interface ControllerEvent {
  version: string;
  timestamp: number;
  seq: number;
  kind: string;
  priority: Priority | null;
  label: string;
}

export interface DepartmentMapping {
  name: string;
  represented: boolean;
}

export interface TopologyPayload {
  version: string;
  switches: { name: string; dpid: number; ports: Record<string, number> }[];
  hosts: { name: string; ip: string; switch: string; department: string | null }[];
  departments: DepartmentMapping[];
}

/** How the dashboard is currently being driven. */
export type DataSourceMode = 'demo' | 'live';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'unavailable';
