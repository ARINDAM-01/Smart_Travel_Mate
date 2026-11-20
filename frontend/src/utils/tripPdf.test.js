import { describe, expect, it } from 'vitest';
import { createTripPdf } from './tripPdf';

describe('createTripPdf', () => {
  it('creates a PDF when a trip has no scheduled itinerary days', () => {
    const pdf = createTripPdf({ title: 'Weekend Trip', itineraryDays: [] });
    const bytes = new Uint8Array(pdf.output('arraybuffer'));

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(pdf.internal.getNumberOfPages()).toBe(1);
  });

  it('paginates long itineraries across multiple PDF pages', () => {
    const activities = Array.from({ length: 40 }, (_, index) => ({
      name: `Activity ${index + 1}`,
      description: 'Detailed itinerary information '.repeat(8),
      timeOfDay: 'morning',
    }));
    const pdf = createTripPdf({
      title: 'Multi-day Trip',
      itineraryDays: [{ dayNumber: 1, location: 'Jaipur', activities }],
    });

    expect(pdf.internal.getNumberOfPages()).toBeGreaterThan(1);
  });
});
