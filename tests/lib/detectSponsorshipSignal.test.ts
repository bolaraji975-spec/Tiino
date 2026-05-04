import { describe, it, expect } from "vitest";
import { detectSponsorshipSignal } from "../../convex/lib/detectSponsorshipSignal";

describe("detectSponsorshipSignal", () => {
  // -------------------------------------------------------------------------
  // No signal
  // -------------------------------------------------------------------------

  it("returns no signal for empty string", () => {
    const result = detectSponsorshipSignal("");
    expect(result).toEqual({ explicit: false, negative: false, confidence: 0 });
  });

  it("returns no signal for generic description with no sponsorship mention", () => {
    const result = detectSponsorshipSignal(
      "We are looking for a talented software engineer to join our team. You will work on exciting projects.",
    );
    expect(result).toEqual({ explicit: false, negative: false, confidence: 0 });
  });

  // -------------------------------------------------------------------------
  // Positive patterns
  // -------------------------------------------------------------------------

  it("detects visa_sponsorship_available", () => {
    const result = detectSponsorshipSignal(
      "Visa sponsorship is available for this role.",
    );
    expect(result.explicit).toBe(true);
    expect(result.negative).toBe(false);
    expect(result.confidence).toBe(0.9);
    expect(result.matchedPattern).toBe("visa_sponsorship_available");
  });

  it("detects visa_sponsorship_available — provided variant", () => {
    const result = detectSponsorshipSignal("Visa sponsorship provided for the right candidate.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("visa_sponsorship_available");
  });

  it("detects certificate_of_sponsorship", () => {
    const result = detectSponsorshipSignal(
      "We will issue a Certificate of Sponsorship to the successful applicant.",
    );
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("certificate_of_sponsorship");
  });

  it("detects we_can_sponsor", () => {
    const result = detectSponsorshipSignal("We can sponsor the right candidate.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("we_can_sponsor");
  });

  it("detects we_can_sponsor — will variant", () => {
    const result = detectSponsorshipSignal("We will sponsor a skilled worker visa.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("we_can_sponsor");
  });

  it("detects happy_to_sponsor", () => {
    const result = detectSponsorshipSignal("We are happy to sponsor the successful candidate.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("happy_to_sponsor");
  });

  it("detects able_to_provide_sponsorship", () => {
    const result = detectSponsorshipSignal("We are able to provide visa sponsorship.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("able_to_provide_sponsorship");
  });

  it("detects sponsorship_provided", () => {
    const result = detectSponsorshipSignal("Sponsorship is available for this position.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("sponsorship_provided");
  });

  it("detects sponsor_visa", () => {
    const result = detectSponsorshipSignal("The company can sponsor your visa.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("sponsor_visa");
  });

  it("detects skilled_worker_sponsorship", () => {
    const result = detectSponsorshipSignal("We offer skilled worker visa sponsorship.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("skilled_worker_sponsorship");
  });

  it("detects tier_2_sponsor", () => {
    const result = detectSponsorshipSignal("This role has a Tier 2 sponsor licence.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("tier_2_sponsor");
  });

  it("detects we_offer_sponsorship", () => {
    const result = detectSponsorshipSignal("We offer visa sponsorship for non-UK nationals.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("we_offer_sponsorship");
  });

  it("detects cos_available", () => {
    const result = detectSponsorshipSignal("A CoS is available for the successful candidate.");
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("cos_available");
  });

  it("detects relocation_and_sponsorship", () => {
    const result = detectSponsorshipSignal(
      "We offer relocation and sponsorship packages.",
    );
    expect(result.explicit).toBe(true);
    expect(result.matchedPattern).toBe("relocation_and_sponsorship");
  });

  // -------------------------------------------------------------------------
  // Negative patterns
  // -------------------------------------------------------------------------

  it("detects cannot_sponsor", () => {
    const result = detectSponsorshipSignal(
      "Unfortunately we cannot sponsor overseas applicants.",
    );
    expect(result.explicit).toBe(false);
    expect(result.negative).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.matchedPattern).toBe("cannot_sponsor");
  });

  it("detects cant_sponsor — apostrophe variant", () => {
    const result = detectSponsorshipSignal("We can't sponsor overseas applicants.");
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("cant_sponsor");
  });

  it("detects unable_to_sponsor", () => {
    const result = detectSponsorshipSignal("We are unable to sponsor work visas.");
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("unable_to_sponsor");
  });

  it("detects does_not_sponsor", () => {
    const result = detectSponsorshipSignal("This company does not sponsor visa applications.");
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("does_not_sponsor");
  });

  it("detects no_visa_sponsorship", () => {
    const result = detectSponsorshipSignal("No visa sponsorship is available for this post.");
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("no_visa_sponsorship");
  });

  it("detects sponsorship_not_available", () => {
    const result = detectSponsorshipSignal("Sponsorship is not available for this role.");
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("sponsorship_not_available");
  });

  it("detects must_have_right_to_work", () => {
    const result = detectSponsorshipSignal(
      "Applicants must have the right to work in the UK.",
    );
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("must_have_right_to_work");
  });

  it("detects right_to_work_required", () => {
    const result = detectSponsorshipSignal(
      "The right to work in the UK is required.",
    );
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("right_to_work_required");
  });

  it("detects must_be_eligible_to_work", () => {
    const result = detectSponsorshipSignal(
      "You must be eligible to work in the UK without restriction.",
    );
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("must_be_eligible_to_work");
  });

  it("detects no_work_permit", () => {
    const result = detectSponsorshipSignal(
      "We are not able to provide a work permit for this role.",
    );
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("no_work_permit");
  });

  it("detects we_do_not_sponsor (matched via does_not_sponsor which fires first)", () => {
    // "we do not sponsor" contains "do not sponsor" — does_not_sponsor pattern
    // comes first in the array and matches the same text, so it is returned.
    const result = detectSponsorshipSignal("We do not sponsor visa applications.");
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("does_not_sponsor");
  });

  it("detects not_eligible_to_sponsor", () => {
    const result = detectSponsorshipSignal(
      "We are not a licensed sponsoring employer at this time.",
    );
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("not_eligible_to_sponsor");
  });

  // -------------------------------------------------------------------------
  // Contradictory signals — negative wins
  // -------------------------------------------------------------------------

  it("negative wins when both positive and negative patterns match", () => {
    const result = detectSponsorshipSignal(
      "Visa sponsorship is available. However, we cannot sponsor overseas applicants for this particular vacancy.",
    );
    expect(result.explicit).toBe(false);
    expect(result.negative).toBe(true);
    expect(result.confidence).toBe(0.70);
  });

  it("contradictory signal confidence is 0.70", () => {
    const result = detectSponsorshipSignal(
      "We can sponsor the right candidate. Note: we do not sponsor for junior positions.",
    );
    expect(result.confidence).toBe(0.70);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it("is case-insensitive for positive patterns", () => {
    const result = detectSponsorshipSignal("VISA SPONSORSHIP IS AVAILABLE.");
    expect(result.explicit).toBe(true);
  });

  it("is case-insensitive for negative patterns", () => {
    const result = detectSponsorshipSignal("WE CANNOT SPONSOR VISA APPLICATIONS.");
    expect(result.negative).toBe(true);
  });

  it("does not match 'sponsor' in unrelated context (e.g. event sponsor)", () => {
    // "We are proud to be a sponsor of the local sports club" — no visa context
    const result = detectSponsorshipSignal(
      "We are proud to be a sponsor of the local community sports club.",
    );
    // should NOT match — sponsor here is not about visa sponsorship
    // Note: our patterns require context words so this should return no signal
    expect(result.explicit).toBe(false);
    expect(result.negative).toBe(false);
  });

  it("handles description with only whitespace as no signal", () => {
    const result = detectSponsorshipSignal("   \n\t  ");
    expect(result.explicit).toBe(false);
    expect(result.negative).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("returns first positive match (stops after first)", () => {
    const result = detectSponsorshipSignal(
      "Certificate of Sponsorship issued. We can sponsor your visa. Happy to sponsor.",
    );
    expect(result.explicit).toBe(true);
    // First matched pattern should be certificate_of_sponsorship
    expect(result.matchedPattern).toBe("certificate_of_sponsorship");
  });

  it("returns first negative match (stops after first)", () => {
    const result = detectSponsorshipSignal(
      "We cannot sponsor. We do not sponsor. No visa sponsorship.",
    );
    expect(result.negative).toBe(true);
    expect(result.matchedPattern).toBe("cannot_sponsor");
  });
});
