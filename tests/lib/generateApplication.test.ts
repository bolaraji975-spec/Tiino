import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseGeneratedCvResponse,
  detectHallucinations,
  buildTailoringPrompt,
  type GeneratedCv,
} from "../../convex/applications/generate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(__dirname, "../../tickets/fixtures/cvs");

const JOB_1 = JSON.parse(readFileSync(join(FIXTURE_DIR, "sample-job-1.json"), "utf-8")) as {
  title: string;
  company: string;
  description: string;
};

const JOB_2 = JSON.parse(readFileSync(join(FIXTURE_DIR, "sample-job-2.json"), "utf-8")) as {
  title: string;
  company: string;
  description: string;
};

const SAMPLE_CV = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "sample-generated-cv.json"), "utf-8"),
) as GeneratedCv;

// Minimal profile used across tests
const PROFILE = {
  skills: ["Python", "TypeScript", "React", "Node.js", "PostgreSQL", "Redis"],
  qualifications: ["BSc Computer Science - University of Birmingham (2018)"],
  currentRoleTitle: "Senior Software Engineer",
};

// PDF text that would be extracted from sample-cv.pdf
const PDF_TEXT =
  "Amara Osei Software Engineer amara.osei@email.com London " +
  "Senior Software Engineer FinTech Solutions Ltd London 2021-Present " +
  "Software Engineer Digital Agency Co London 2018-2021 " +
  "BSc Computer Science University of Birmingham 2014-2018 " +
  "Python TypeScript React Node.js PostgreSQL Redis Docker Kubernetes AWS GCP";

// ---------------------------------------------------------------------------
// parseGeneratedCvResponse
// ---------------------------------------------------------------------------

describe("parseGeneratedCvResponse", () => {
  it("parses a valid fixture response", () => {
    const result = parseGeneratedCvResponse(JSON.stringify(SAMPLE_CV));
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Amara Osei");
    expect(result!.email).toBe("amara.osei@email.com");
    expect(result!.experience).toHaveLength(2);
    expect(result!.experience[0].bullets.length).toBeGreaterThanOrEqual(3);
    expect(result!.skills).toContain("Python");
    expect(result!.education[0].institution).toBe("University of Birmingham");
    expect(result!.coverLetter.length).toBeGreaterThan(100);
  });

  it("strips markdown code fences", () => {
    const wrapped = "```json\n" + JSON.stringify(SAMPLE_CV) + "\n```";
    const result = parseGeneratedCvResponse(wrapped);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Amara Osei");
  });

  it("returns null for empty string", () => {
    expect(parseGeneratedCvResponse("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseGeneratedCvResponse("{name: no quotes}")).toBeNull();
  });

  it("returns null when name or email is missing", () => {
    const noEmail = { ...SAMPLE_CV, email: "" };
    expect(parseGeneratedCvResponse(JSON.stringify(noEmail))).toBeNull();

    const noName = { ...SAMPLE_CV, name: "" };
    expect(parseGeneratedCvResponse(JSON.stringify(noName))).toBeNull();
  });

  it("caps experience bullets at 5", () => {
    const manyBullets = {
      ...SAMPLE_CV,
      experience: [
        {
          ...SAMPLE_CV.experience[0],
          bullets: ["a", "b", "c", "d", "e", "f", "g"],
        },
      ],
    };
    const result = parseGeneratedCvResponse(JSON.stringify(manyBullets));
    expect(result!.experience[0].bullets).toHaveLength(5);
  });

  it("handles missing optional phone field gracefully", () => {
    const { phone: _p, ...withoutPhone } = SAMPLE_CV;
    const result = parseGeneratedCvResponse(JSON.stringify(withoutPhone));
    expect(result).not.toBeNull();
    expect(result!.phone).toBeUndefined();
  });

  // Fixture pair 1: senior software engineer role
  it("fixture pair 1 — parses a CV tailored to a fintech role", () => {
    const tailored = {
      ...SAMPLE_CV,
      summary: `Experienced backend engineer applying for ${JOB_1.title} at ${JOB_1.company}.`,
    };
    const result = parseGeneratedCvResponse(JSON.stringify(tailored));
    expect(result).not.toBeNull();
    expect(result!.summary).toContain(JOB_1.company);
  });

  // Fixture pair 2: data engineer role
  it("fixture pair 2 — parses a CV tailored to a data engineering role", () => {
    const tailored = {
      ...SAMPLE_CV,
      summary: `Data engineer with 7 years experience applying for ${JOB_2.title} at ${JOB_2.company}.`,
    };
    const result = parseGeneratedCvResponse(JSON.stringify(tailored));
    expect(result).not.toBeNull();
    expect(result!.summary).toContain(JOB_2.company);
  });
});

// ---------------------------------------------------------------------------
// detectHallucinations
// ---------------------------------------------------------------------------

describe("detectHallucinations", () => {
  it("returns empty array when all employers are in the PDF text", () => {
    const suspects = detectHallucinations(SAMPLE_CV, PDF_TEXT, PROFILE.qualifications);
    expect(suspects).toHaveLength(0);
  });

  it("flags employer not present in source PDF", () => {
    const hallucinated: GeneratedCv = {
      ...SAMPLE_CV,
      experience: [
        {
          ...SAMPLE_CV.experience[0],
          company: "Totally Invented Corp Ltd",
        },
        ...SAMPLE_CV.experience.slice(1),
      ],
    };
    const suspects = detectHallucinations(hallucinated, PDF_TEXT, PROFILE.qualifications);
    expect(suspects.some((s) => s.includes("Invented"))).toBe(true);
  });

  it("flags institution not present in source PDF or qualifications", () => {
    const hallucinated: GeneratedCv = {
      ...SAMPLE_CV,
      education: [
        {
          degree: "BSc Computer Science",
          institution: "University of Fabrication",
          year: "2018",
        },
      ],
    };
    const suspects = detectHallucinations(hallucinated, PDF_TEXT, PROFILE.qualifications);
    expect(suspects.some((s) => s.includes("Fabrication"))).toBe(true);
  });

  it("accepts institution matched via sourceQualifications even if not in PDF text", () => {
    const limitedPdfText = "Amara Osei amara.osei@email.com FinTech Solutions Digital Agency";
    const suspects = detectHallucinations(SAMPLE_CV, limitedPdfText, PROFILE.qualifications);
    // "Birmingham" appears in sourceQualifications — should not be flagged
    expect(suspects.filter((s) => s.includes("Birmingham"))).toHaveLength(0);
  });

  it("passes employer names with minor abbreviation differences", () => {
    // "FinTech Solutions" anchor word "solutions" is in PDF_TEXT
    const suspects = detectHallucinations(SAMPLE_CV, PDF_TEXT, PROFILE.qualifications);
    expect(suspects).toHaveLength(0);
  });

  it("passes through when PDF text is empty (cannot verify — safe default)", () => {
    // With no PDF text, anchors won't match — but short words are skipped
    const shortNameCv: GeneratedCv = {
      ...SAMPLE_CV,
      experience: [{ ...SAMPLE_CV.experience[0], company: "IBM" }],
    };
    // "IBM" is only 3 chars, anchor selection skips it → passes
    const suspects = detectHallucinations(shortNameCv, "", []);
    expect(suspects.filter((s) => s.includes("IBM"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildTailoringPrompt
// ---------------------------------------------------------------------------

describe("buildTailoringPrompt", () => {
  it("includes the job title and company", () => {
    const prompt = buildTailoringPrompt(PROFILE, JOB_1);
    expect(prompt).toContain(JOB_1.title);
    expect(prompt).toContain(JOB_1.company);
  });

  it("includes a portion of the job description", () => {
    const prompt = buildTailoringPrompt(PROFILE, JOB_1);
    // First 100 chars of description should appear
    expect(prompt).toContain(JOB_1.description.slice(0, 100));
  });

  it("includes candidate skills", () => {
    const prompt = buildTailoringPrompt(PROFILE, JOB_1);
    expect(prompt).toContain("Python");
  });

  it("adds CRITICAL warning in strict mode", () => {
    const strict = buildTailoringPrompt(PROFILE, JOB_1, true);
    expect(strict).toContain("CRITICAL");
    expect(strict).toContain("verbatim");
  });

  it("does NOT include CRITICAL warning in normal mode", () => {
    const normal = buildTailoringPrompt(PROFILE, JOB_1, false);
    expect(normal).not.toContain("CRITICAL");
  });

  it("fixture pair 2 — prompt contains NHS Digital job requirements", () => {
    const prompt = buildTailoringPrompt(PROFILE, JOB_2);
    expect(prompt).toContain("NHS Digital");
    expect(prompt).toContain("Lead Data Engineer");
  });
});
