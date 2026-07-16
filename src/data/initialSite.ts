import type { SiteZone, TelemetryReading } from '../types/site';

export const siteZones: SiteZone[] = [
  {
    id: 'north-gate',
    name: 'North Gate',
    asset: 'Access Control',
    x: 7,
    y: 13,
    width: 18,
    height: 21
  },
  {
    id: 'assembly',
    name: 'Assembly Line',
    asset: 'Production Cell A',
    x: 31,
    y: 14,
    width: 36,
    height: 29
  },
  {
    id: 'storage',
    name: 'Storage',
    asset: 'Raw Material Racks',
    x: 72,
    y: 13,
    width: 20,
    height: 31
  },
  {
    id: 'generator',
    name: 'Generator',
    asset: 'Backup Power',
    x: 10,
    y: 57,
    width: 25,
    height: 25
  },
  {
    id: 'dock',
    name: 'Loading Dock',
    asset: 'Outbound Bay',
    x: 45,
    y: 59,
    width: 43,
    height: 24
  }
];

export const initialTelemetry: TelemetryReading[] = [
  {
    zoneId: 'north-gate',
    temperature: 31,
    vibration: 1.4,
    humidity: 58,
    occupancy: 18,
    smokePpm: 0,
    updatedAt: new Date().toISOString()
  },
  {
    zoneId: 'assembly',
    temperature: 38,
    vibration: 4.8,
    humidity: 51,
    occupancy: 72,
    smokePpm: 3,
    updatedAt: new Date().toISOString()
  },
  {
    zoneId: 'storage',
    temperature: 34,
    vibration: 1.8,
    humidity: 76,
    occupancy: 26,
    smokePpm: 2,
    updatedAt: new Date().toISOString()
  },
  {
    zoneId: 'generator',
    temperature: 44,
    vibration: 6.9,
    humidity: 46,
    occupancy: 6,
    smokePpm: 7,
    updatedAt: new Date().toISOString()
  },
  {
    zoneId: 'dock',
    temperature: 35,
    vibration: 3.2,
    humidity: 63,
    occupancy: 49,
    smokePpm: 1,
    updatedAt: new Date().toISOString()
  }
];
