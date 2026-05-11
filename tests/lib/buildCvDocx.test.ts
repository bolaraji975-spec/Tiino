import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Packer } from "docx";
import { buildCvDocument, buildCoverLetterDocument } from "../../convex/applications/buildCvDocx";
import type { GeneratedCv } from "../../convex/applications/generate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(__dirname, "../../tickets/fixtures/cvs");

const SAMPLE_CV = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "sample-generated-cv.json"), "utf-8"),
) as GeneratedCv;

// ---------------------------------------------------------------------------
// buildCvDocument
// ---------------------------------------------------------------------------

describe("buildCvDocument", () => {
  it("produces a non-empty DOCX buffer for the sample CV", async () => {
    const doc = buildCvDocument(SAMPLE_CV);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(4000);
  });

  it("produces a valid DOCX ZIP signature (PK header)", async () => {
    const doc = buildCvDocument(SAMPLE_CV);
    const buffer = await Packer.toBuffer(doc);
    // DOCX is a ZIP — first two bytes are 0x50 0x4B ("PK")
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("does not throw when phone is absent", async () => {
    const { phone: _p, ...noPhone } = SAMPLE_CV;
    const doc = buildCvDocument(noPhone as GeneratedCv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("does not throw when experience is empty", async () => {
    const doc = buildCvDocument({ ...SAMPLE_CV, experience: [] });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("does not throw when skills is empty", async () => {
    const doc = buildCvDocument({ ...SAMPLE_CV, skills: [] });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("does not throw when education is empty", async () => {
    const doc = buildCvDocument({ ...SAMPLE_CV, education: [] });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("does not throw when all optional sections are empty", async () => {
    const minimal: GeneratedCv = {
      name: "Test User",
      email: "test@example.com",
      summary: "",
      experience: [],
      skills: [],
      education: [],
      coverLetter: "",
    };
    const doc = buildCvDocument(minimal);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles experience with maximum 5 bullets", async () => {
    const cv: GeneratedCv = {
      ...SAMPLE_CV,
      experience: [
        {
          ...SAMPLE_CV.experience[0],
          bullets: ["a", "b", "c", "d", "e"],
        },
      ],
    };
    const doc = buildCvDocument(cv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles experience with no bullets gracefully", async () => {
    const cv: GeneratedCv = {
      ...SAMPLE_CV,
      experience: [{ ...SAMPLE_CV.experience[0], bullets: [] }],
    };
    const doc = buildCvDocument(cv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("CV buffer is larger than cover letter buffer (CV has more content)", async () => {
    const cvBuffer = await Packer.toBuffer(buildCvDocument(SAMPLE_CV));
    const clBuffer = await Packer.toBuffer(buildCoverLetterDocument(SAMPLE_CV));
    expect(cvBuffer.length).toBeGreaterThan(clBuffer.length);
  });
});

// ---------------------------------------------------------------------------
// buildCoverLetterDocument
// ---------------------------------------------------------------------------

describe("buildCoverLetterDocument", () => {
  it("produces a non-empty DOCX buffer", async () => {
    const doc = buildCoverLetterDocument(SAMPLE_CV);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it("produces a valid DOCX ZIP signature", async () => {
    const doc = buildCoverLetterDocument(SAMPLE_CV);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("does not throw when phone is absent", async () => {
    const { phone: _p, ...noPhone } = SAMPLE_CV;
    const doc = buildCoverLetterDocument(noPhone as GeneratedCv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles cover letter with single paragraph (no double newline)", async () => {
    const cv = { ...SAMPLE_CV, coverLetter: "Single paragraph with no breaks." };
    const doc = buildCoverLetterDocument(cv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles empty cover letter gracefully", async () => {
    const cv = { ...SAMPLE_CV, coverLetter: "" };
    const doc = buildCoverLetterDocument(cv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles cover letter with multiple blank lines between paragraphs", async () => {
    const cv = {
      ...SAMPLE_CV,
      coverLetter: "Paragraph one.\n\n\n\nParagraph two.\n\nParagraph three.",
    };
    const doc = buildCoverLetterDocument(cv);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
