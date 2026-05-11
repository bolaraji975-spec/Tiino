/**
 * applications/buildCvDocx.ts — "use node" action
 *
 * buildCvDocx: takes a stored application's generatedCvData, builds a Word
 * document for the CV and a separate Word document for the cover letter,
 * stores both in Convex file storage, and writes the IDs back to the
 * application record.
 *
 * Pure helpers (buildCvDocument, buildCoverLetterDocument) are exported for
 * unit testing.
 */

"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  BorderStyle,
  AlignmentType,
} from "docx";
import type { GeneratedCv } from "./generate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// docx sizes are in half-points (1pt = 2 units)
const pt = (n: number) => n * 2;

const FONT = "Calibri";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit tests
// ---------------------------------------------------------------------------

/** Build the main CV Document from structured CV data. */
export function buildCvDocument(cv: GeneratedCv): Document {
  const children: Paragraph[] = [];

  // --- Name ---
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: cv.name, bold: true, size: pt(18), font: FONT }),
      ],
      spacing: { after: 80 },
    }),
  );

  // --- Contact line ---
  const contactParts = [cv.email, cv.phone].filter(Boolean).join("   |   ");
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: contactParts, size: pt(11), font: FONT, color: "555555" }),
      ],
      spacing: { after: 180 },
    }),
  );

  // --- Horizontal rule ---
  children.push(
    new Paragraph({
      thematicBreak: true,
      spacing: { after: 200 },
    }),
  );

  // --- Professional Summary ---
  if (cv.summary) {
    children.push(sectionHeading("PROFESSIONAL SUMMARY"));
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: cv.summary, size: pt(11), font: FONT }),
        ],
        spacing: { after: 240 },
      }),
    );
  }

  // --- Experience ---
  if (cv.experience.length > 0) {
    children.push(sectionHeading("EXPERIENCE"));
    for (const role of cv.experience) {
      const dates = [role.startDate, role.endDate].filter(Boolean).join(" – ");

      // Title · Company on one line
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: role.title, bold: true, size: pt(12), font: FONT }),
            new TextRun({
              text: `   ·   ${role.company}`,
              size: pt(11),
              font: FONT,
              color: "444444",
            }),
          ],
          spacing: { before: 180, after: 40 },
        }),
      );

      // Dates
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: dates, size: pt(10), font: FONT, color: "777777" }),
          ],
          spacing: { after: 80 },
        }),
      );

      // Bullet points
      for (const bullet of role.bullets) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `•  ${bullet}`, size: pt(11), font: FONT }),
            ],
            indent: { left: 360 },
            spacing: { after: 60 },
          }),
        );
      }
    }
    // spacer after experience block
    children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
  }

  // --- Skills ---
  if (cv.skills.length > 0) {
    children.push(sectionHeading("SKILLS"));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: cv.skills.join("   ·   "),
            size: pt(11),
            font: FONT,
          }),
        ],
        spacing: { after: 240 },
      }),
    );
  }

  // --- Education ---
  if (cv.education.length > 0) {
    children.push(sectionHeading("EDUCATION"));
    for (const edu of cv.education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.degree, bold: true, size: pt(11), font: FONT }),
          ],
          spacing: { before: 120, after: 40 },
        }),
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${edu.institution}   ·   ${edu.year}`,
              size: pt(10),
              font: FONT,
              color: "777777",
            }),
          ],
          spacing: { after: 120 },
        }),
      );
    }
  }

  return new Document({ sections: [{ children }] });
}

/** Build a single-page cover letter Document from the CV's coverLetter field. */
export function buildCoverLetterDocument(cv: GeneratedCv): Document {
  const children: Paragraph[] = [];

  // --- Sender header ---
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: cv.name, bold: true, size: pt(13), font: FONT }),
      ],
      spacing: { after: 60 },
    }),
  );

  const contact = [cv.email, cv.phone].filter(Boolean).join("   |   ");
  if (contact) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: contact, size: pt(11), font: FONT, color: "555555" }),
        ],
        spacing: { after: 400 },
      }),
    );
  }

  // --- Cover letter body (split on blank lines) ---
  const paras = cv.coverLetter
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  for (const para of paras) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: para, size: pt(11), font: FONT })],
        spacing: { before: 0, after: 220 },
      }),
    );
  }

  return new Document({ sections: [{ children }] });
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: pt(13),
        font: FONT,
        color: "1BAAC1",
      }),
    ],
    border: {
      bottom: {
        color: "1BAAC1",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { before: 280, after: 120 },
  });
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

export const buildCvDocx = action({
  args: { applicationId: v.id("applications") },
  handler: async (
    ctx,
    { applicationId },
  ): Promise<{ cvFileId: string; coverLetterFileId: string }> => {
    // --- 1. Auth ---
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    // --- 2. Load application ---
    const application = await ctx.runQuery(
      internal.applications.mutations._getApplicationById,
      { applicationId },
    );
    if (!application || application.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Application not found." });
    }
    if (!application.generatedCvData) {
      throw new ConvexError({
        code: "PRECONDITION",
        message: "No generated CV data. Run generateApplication first.",
      });
    }

    const cv = application.generatedCvData as GeneratedCv;

    // --- 3. Build + store CV DOCX ---
    const cvBuffer = await Packer.toBuffer(buildCvDocument(cv));
    const cvFileId = await ctx.storage.store(
      new Blob([new Uint8Array(cvBuffer)], { type: DOCX_MIME }),
    );

    // --- 4. Build + store cover letter DOCX ---
    const clBuffer = await Packer.toBuffer(buildCoverLetterDocument(cv));
    const coverLetterFileId = await ctx.storage.store(
      new Blob([new Uint8Array(clBuffer)], { type: DOCX_MIME }),
    );

    // --- 5. Persist IDs on the application record ---
    await ctx.runMutation(internal.applications.mutations._setDocxFileIds, {
      applicationId,
      cvFileId,
      coverLetterFileId,
    });

    return { cvFileId, coverLetterFileId };
  },
});
