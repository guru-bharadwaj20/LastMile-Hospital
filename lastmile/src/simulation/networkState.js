/**
 * networkState.js — Simulation State (Layer 2 placeholder)
 * 
 * This file will contain the full network simulation logic in Layer 2.
 * For now, it exports mock/hardcoded state used by all UI components.
 */

// Department definitions with positions, colors, and network info
export const DEPARTMENTS = [
  { id: 'icu',       label: 'ICU',        priority: 1, color: '#ff2d2d', x: 80,  y: 20,  w: 160, h: 90 },
  { id: 'emergency', label: 'ER',         priority: 1, color: '#ff6b2d', x: 320, y: 20,  w: 160, h: 90 },
  { id: 'surgery',   label: 'SURGERY',    priority: 2, color: '#ff6b2d', x: 560, y: 20,  w: 160, h: 90 },
  { id: 'radiology', label: 'RADIOLOGY',  priority: 3, color: '#fbbf24', x: 80,  y: 160, w: 160, h: 90 },
  { id: 'pharmacy',  label: 'PHARMACY',   priority: 4, color: '#34d399', x: 560, y: 160, w: 160, h: 90 },
  { id: 'admin',     label: 'ADMIN',      priority: 5, color: '#4b5563', x: 80,  y: 300, w: 160, h: 90 },
  { id: 'staff',     label: 'STAFF',      priority: 5, color: '#4b5563', x: 560, y: 300, w: 160, h: 90 },
  { id: 'server',    label: 'SERVER',     priority: 0, color: '#38bdf8', x: 300, y: 155, w: 200, h: 100, isServer: true },
];

// Mock network load (Layer 1: fixed at 45%)
export const MOCK_NETWORK_LOAD = 45;

// Mock active alerts
export const MOCK_ALERTS = [
  {
    id: 'a1',
    priority: 1,
    label: 'CRITICAL',
    description: 'Cardiac monitor alert — ICU Bed 4',
    elapsed: '2m 14s',
    deliveryMs: 11,
  },
  {
    id: 'a2',
    priority: 2,
    label: 'URGENT',
    description: 'Ventilator pressure alarm — ICU Bed 7',
    elapsed: '5m 02s',
    deliveryMs: 24,
  },
  {
    id: 'a3',
    priority: 3,
    label: 'MODERATE',
    description: 'Crash cart request — Surgery Block B',
    elapsed: '8m 45s',
    deliveryMs: 68,
  },
];

// Mock event log entries
export const MOCK_EVENTS = [
  {
    id: 'e1',
    time: '14:32:07',
    priority: 1,
    priorityLabel: 'CRITICAL',
    color: '#ff2d2d',
    description: 'Cardiac alert ICU Bed 4 → Server',
    latency: '11ms',
    status: 'delivered',
  },
  {
    id: 'e2',
    time: '14:32:06',
    priority: 5,
    priorityLabel: 'BACKGROUND',
    color: '#4b5563',
    description: 'Staff-Lounge WiFi → Server',
    latency: '—',
    status: 'dropped',
  },
  {
    id: 'e3',
    time: '14:32:05',
    priority: 4,
    priorityLabel: 'LOW',
    color: '#34d399',
    description: 'Admin report upload → Server',
    latency: '340ms',
    status: 'delivered',
  },
];

// Priority config table data
export const PRIORITY_CONFIG = [
  { type: 'Cardiac / Code Blue Alerts', level: 'P1', color: '#ff2d2d' },
  { type: 'Ventilator / Vitals Alarms', level: 'P2', color: '#ff6b2d' },
  { type: 'Lab Results / Imaging',      level: 'P3', color: '#fbbf24' },
  { type: 'Admin / Reports',            level: 'P4', color: '#34d399' },
  { type: 'WiFi / Streaming / Browsers', level: 'P5', color: '#4b5563' },
];

// Priority bandwidth shares (for load meter breakdown)
export const MOCK_BANDWIDTH = [
  { level: 'P1', color: '#ff2d2d', share: 25 },
  { level: 'P2', color: '#ff6b2d', share: 20 },
  { level: 'P3', color: '#fbbf24', share: 25 },
  { level: 'P4', color: '#34d399', share: 18 },
  { level: 'P5', color: '#4b5563', share: 12 },
];
