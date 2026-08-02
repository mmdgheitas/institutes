import { describe, expect, it } from 'vitest';
import { LEAD_STATUS_ORDER, LEAD_TRANSITIONS, LeadStatus } from '@shared/enums';
import { LEAD_STATUS_FA, LEAD_COLORS } from '@/lib/constants';

describe('Kanban lead transitions (server contract)', () => {
  it('contains exactly the five statuses in the canonical order', () => {
    expect(LEAD_STATUS_ORDER).toEqual(['NEW', 'CONTACTED', 'INTERVIEWED', 'ENROLLED', 'CANCELLED']);
  });

  it('every status has a persian label and colour', () => {
    for (const status of LEAD_STATUS_ORDER) {
      expect(LEAD_STATUS_FA[status]).toBeTruthy();
      expect(LEAD_COLORS[status]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('NEW can only advance to CONTACTED or be cancelled', () => {
    expect(LEAD_TRANSITIONS[LeadStatus.NEW]).toEqual([LeadStatus.CONTACTED, LeadStatus.CANCELLED]);
  });

  it('ENROLLED is terminal except for cancellation', () => {
    expect(LEAD_TRANSITIONS[LeadStatus.ENROLLED]).toEqual([LeadStatus.CANCELLED]);
  });

  it('CANCELLED can only restart at NEW', () => {
    expect(LEAD_TRANSITIONS[LeadStatus.CANCELLED]).toEqual([LeadStatus.NEW]);
  });

  it('CONTACTED may move forward, back to NEW, or cancel', () => {
    const allowed = LEAD_TRANSITIONS[LeadStatus.CONTACTED];
    expect(allowed).toContain(LeadStatus.INTERVIEWED);
    expect(allowed).toContain(LeadStatus.ENROLLED);
    expect(allowed).toContain(LeadStatus.NEW);
    expect(allowed).toContain(LeadStatus.CANCELLED);
  });

  it('INTERVIEWED may move forward to ENROLLED or back to CONTACTED', () => {
    const allowed = LEAD_TRANSITIONS[LeadStatus.INTERVIEWED];
    expect(allowed).toContain(LeadStatus.ENROLLED);
    expect(allowed).toContain(LeadStatus.CONTACTED);
    expect(allowed).toContain(LeadStatus.CANCELLED);
    expect(allowed).not.toContain(LeadStatus.NEW);
  });

  it('every target in every transition map is a valid status', () => {
    for (const from of LEAD_STATUS_ORDER) {
      for (const to of LEAD_TRANSITIONS[from]) {
        expect(LEAD_STATUS_ORDER).toContain(to);
      }
    }
  });
});
