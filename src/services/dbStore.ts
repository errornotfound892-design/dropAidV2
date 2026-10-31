import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Booking, AuditEvent } from '../types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../../data/dropaid_database.json');

interface DatabaseSchema {
  version: number;
  lastUpdated: string;
  bookings: Booking[];
  auditEvents: AuditEvent[];
  telegramLinks: Record<string, { chatId: string; linkedAt: string; username?: string }>;
}

let inMemoryDb: DatabaseSchema = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  bookings: [],
  auditEvents: [],
  telegramLinks: {},
};

// Safe atomic file write
function persistToFile(): void {
  try {
    inMemoryDb.lastUpdated = new Date().toISOString();
    const data = JSON.stringify(inMemoryDb, null, 2);
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(tempFile, data, 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.warn('[dbStore] Failed to write to disk, keeping in-memory:', err);
  }
}

// Initial load
export function initDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.bookings)) {
        inMemoryDb = {
          version: parsed.version || 1,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          bookings: parsed.bookings || [],
          auditEvents: parsed.auditEvents || [],
          telegramLinks: parsed.telegramLinks || {},
        };
        console.log(`[dbStore] Loaded ${inMemoryDb.bookings.length} bookings and ${inMemoryDb.auditEvents.length} audit records from disk.`);
        return inMemoryDb;
      }
    }
  } catch (err) {
    console.warn('[dbStore] Could not read existing DB file, initializing fresh store:', err);
  }

  persistToFile();
  return inMemoryDb;
}

export function getAllBookings(): Booking[] {
  return inMemoryDb.bookings;
}

export function getBookingById(id: string): Booking | undefined {
  return inMemoryDb.bookings.find((b) => b.id === id || b.trackingCode === id);
}

export function saveBooking(booking: Booking): Booking {
  const index = inMemoryDb.bookings.findIndex((b) => b.id === booking.id);
  if (index >= 0) {
    inMemoryDb.bookings[index] = { ...inMemoryDb.bookings[index], ...booking };
  } else {
    inMemoryDb.bookings.unshift(booking);
  }
  persistToFile();
  return booking;
}

export function updateBooking(id: string, updates: Partial<Booking>): Booking | null {
  const index = inMemoryDb.bookings.findIndex((b) => b.id === id || b.trackingCode === id);
  if (index === -1) return null;
  inMemoryDb.bookings[index] = { ...inMemoryDb.bookings[index], ...updates };
  persistToFile();
  return inMemoryDb.bookings[index];
}

export function deleteBooking(id: string): boolean {
  const len = inMemoryDb.bookings.length;
  inMemoryDb.bookings = inMemoryDb.bookings.filter((b) => b.id !== id && b.trackingCode !== id);
  if (inMemoryDb.bookings.length !== len) {
    persistToFile();
    return true;
  }
  return false;
}

export function logAuditEvent(
  action: string,
  actor: 'patient' | 'system' | 'operator' | 'hospital',
  details: string,
  bookingId?: string,
  metadata?: Record<string, any>
): AuditEvent {
  const event: AuditEvent = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    bookingId,
    action,
    actor,
    details,
    metadata,
  };
  inMemoryDb.auditEvents.unshift(event);
  if (inMemoryDb.auditEvents.length > 500) {
    inMemoryDb.auditEvents = inMemoryDb.auditEvents.slice(0, 500);
  }
  persistToFile();
  return event;
}

export function getAuditEvents(bookingId?: string): AuditEvent[] {
  if (bookingId) {
    return inMemoryDb.auditEvents.filter((e) => e.bookingId === bookingId);
  }
  return inMemoryDb.auditEvents;
}

export function linkTelegramChat(key: string, chatId: string, username?: string): void {
  inMemoryDb.telegramLinks[key] = {
    chatId,
    linkedAt: new Date().toISOString(),
    username,
  };
  persistToFile();
}

export function getLinkedTelegramChat(key: string): string | undefined {
  return inMemoryDb.telegramLinks[key]?.chatId;
}
