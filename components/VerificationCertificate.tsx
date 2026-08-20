"use client";

import Image from "next/image";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useRef, useState } from "react";
import InstitutionalHeader from "@/components/InstitutionalHeader";
import {
  REMOVED_IMAGE_SOURCE,
  type CertificateEvent,
} from "@/lib/certificateEvents";
import type { CertificateRecord } from "@/lib/types";

export type TemplateOffsetTarget = "title" | "body" | "qr";

type VerificationCertificateProps = {
  certificate: CertificateRecord;
  event: CertificateEvent;
  showActions?: boolean;
  templateEdit?: {
    onOffsetChange: (
      target: TemplateOffsetTarget,
      nextX: number,
      nextY: number,
    ) => void;
  };
};

type SignatureImageProps = {
  src: string;
  alt: string;
};

function SignatureImage({ src, alt }: SignatureImageProps) {
  if (!src || src === REMOVED_IMAGE_SOURCE) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={280}
      height={118}
      className="signature-image"
      unoptimized
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function certificatePdfFileName(certificate: CertificateRecord) {
  const certificateId = sanitizeFileNamePart(certificate.letterId);
  const studentName = sanitizeFileNamePart(certificate.studentName);
  return `${certificateId}-${studentName}.pdf`;
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function clampTemplateOffset(value: number) {
  return Math.min(180, Math.max(-180, Math.round(value)));
}

function clampSignatureScale(value: number, max: number) {
  return Math.min(max, Math.max(0.4, value));
}

type TemplateMoveSectionProps = {
  target: TemplateOffsetTarget;
  offsetX: number;
  offsetY: number;
  className: string;
  children: ReactNode;
  templateEdit?: VerificationCertificateProps["templateEdit"];
};

function TemplateMoveSection({
  target,
  offsetX,
  offsetY,
  className,
  children,
  templateEdit,
}: TemplateMoveSectionProps) {
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const classNames = [
    className,
    "template-move-section",
    templateEdit ? "template-move-section-editable" : "",
    isDragging ? "template-move-section-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = {
    transform: `translate(${offsetX}px, ${offsetY}px)`,
  } satisfies CSSProperties;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!templateEdit) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragStart = dragRef.current;

    if (!templateEdit || !dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    templateEdit.onOffsetChange(
      target,
      clampTemplateOffset(
        dragStart.startOffsetX + event.clientX - dragStart.startClientX,
      ),
      clampTemplateOffset(
        dragStart.startOffsetY + event.clientY - dragStart.startClientY,
      ),
    );
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      className={classNames}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {children}
      {templateEdit ? (
        <span className="template-drag-handle no-print" aria-hidden="true">
          Drag
        </span>
      ) : null}
    </div>
  );
}

function lowerTrimmed(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getRecipientContext(certificate: CertificateRecord) {
  const recipientType = lowerTrimmed(certificate.recipientType);

  if (recipientType.includes("faculty")) {
    return "a faculty member";
  }

  if (certificate.className) {
    return (
      <>
        a student of <strong>{certificate.className}</strong>
      </>
    );
  }

  if (recipientType.includes("student")) {
    return "a student";
  }

  return "a recognised recipient";
}

function combineRecognitionBody(certificate: CertificateRecord) {
  return [
    certificate.recognitionBodyName,
    certificate.recognitionBodyType,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}

function renderTemplateText(
  template: string,
  certificate: CertificateRecord,
  event: CertificateEvent,
) {
  const meritRank = certificate.meritRank || "the recorded";
  const meritCategory = certificate.meritCategory || event.eventName;
  const recognitionTermText = certificate.recognitionTerm
    ? ` (${certificate.recognitionTerm})`
    : "";
  const replacements: Record<string, ReactNode> = {
    certificateId: certificate.letterId,
    recipientName: <strong>{certificate.studentName}</strong>,
    recipientType: certificate.recipientType || "Recipient",
    recipientContext: getRecipientContext(certificate),
    studentName: <strong>{certificate.studentName}</strong>,
    className: <strong>{certificate.className}</strong>,
    eventName: event.eventName,
    eventDate: event.eventDate,
    issueDate: event.issueDate,
    meritRank: <strong>{meritRank}</strong>,
    meritAwardTerm: event.meritAwardTerm,
    meritCategory: <strong>{meritCategory}</strong>,
    recognitionRole: (
      <strong>{certificate.recognitionRole || "the assigned role"}</strong>
    ),
    recognitionBodyType: certificate.recognitionBodyType || "body",
    recognitionBodyName: certificate.recognitionBodyName || "the concerned",
    recognitionAcademicYear:
      certificate.recognitionAcademicYear || "the stated academic year",
    recognitionTerm: certificate.recognitionTerm || "",
    recognitionTermText,
  };

  return template
    .split(/(\{\{[a-zA-Z0-9_]+\}\})/g)
    .map((part, index) => {
      const key = part.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/)?.[1];

      if (!key) {
        return part;
      }

      return <span key={`${key}-${index}`}>{replacements[key] ?? part}</span>;
    });
}

export default function VerificationCertificate({
  certificate,
  event,
  showActions = true,
  templateEdit,
}: VerificationCertificateProps) {
  const certificateRef = useRef<HTMLElement>(null);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const isMerit = event.certificateType === "Merit";
  const isRecognition = event.certificateType === "Recognition";
  const recognitionBody = combineRecognitionBody(certificate);
  const isLandscape = event.certificateOrientation === "Landscape";
  const documentClassName = [
    "verification-document",
    isLandscape
      ? "verification-document-landscape"
      : "verification-document-portrait",
    `certificate-theme-${event.certificateTheme.toLowerCase()}`,
  ].join(" ");
  const documentStyle = {
    "--signatory-one-scale": String(event.signatoryOneScale),
    "--signatory-two-scale": String(event.signatoryTwoScale),
    "--signatory-one-export-scale": String(
      clampSignatureScale(event.signatoryOneScale, 0.95),
    ),
    "--signatory-two-export-scale": String(
      clampSignatureScale(event.signatoryTwoScale, 0.9),
    ),
  } as CSSProperties;

  const pdfFileName = certificatePdfFileName(certificate);

  function handlePrint() {
    const previousTitle = document.title;
    const printClass = isLandscape
      ? "certificate-print-landscape"
      : "certificate-print-portrait";

    document.title = pdfFileName.replace(/\.pdf$/i, "");
    document.body.classList.add(printClass);
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
      document.body.classList.remove(printClass);
    }, 500);
  }

  async function handleSavePdf() {
    const certificateNode = certificateRef.current;
    if (!certificateNode || isSavingPdf) {
      return;
    }

    setIsSavingPdf(true);
    document.body.classList.add("pdf-export-mode");

    try {
      await document.fonts.ready;
      await waitForNextFrame();

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(certificateNode, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: 2,
        useCORS: true,
      });

      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageRatio = canvas.height / canvas.width;
      let imageWidth = pageWidth;
      let imageHeight = imageWidth * imageRatio;

      if (imageHeight > pageHeight) {
        imageHeight = pageHeight;
        imageWidth = imageHeight / imageRatio;
      }

      const imageX = (pageWidth - imageWidth) / 2;
      const imageY = (pageHeight - imageHeight) / 2;
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        imageX,
        imageY,
        imageWidth,
        imageHeight,
      );
      pdf.save(pdfFileName);
    } finally {
      document.body.classList.remove("pdf-export-mode");
      setIsSavingPdf(false);
    }
  }

  return (
    <div className="certificate-output">
      {showActions ? (
        <div className="certificate-actions no-print" aria-label="Certificate actions">
          <button type="button" className="secondary-action-button" onClick={handlePrint}>
            Print Certificate
          </button>
          <button
            type="button"
            className="secondary-action-button"
            disabled={isSavingPdf}
            onClick={handleSavePdf}
          >
            {isSavingPdf ? "Preparing PDF..." : "Save to PDF"}
          </button>
        </div>
      ) : null}

      <article
        ref={certificateRef}
        className={documentClassName}
        style={documentStyle}
        aria-labelledby="authentic-title"
      >
        <InstitutionalHeader
          leftLogoSrc={event.leftLogoSrc}
          rightLogoSrc={event.rightLogoSrc}
        />

        <div className="document-status document-status-valid online-only">
          <span aria-hidden="true" />
          <h2 id="authentic-title">THIS IS AN AUTHENTIC ECERTIFICATE</h2>
        </div>

        <div className="document-meta-grid" aria-label="Certificate details">
          <div>
            <span>Certificate ID</span>
            <strong>{certificate.letterId}</strong>
          </div>
          <div>
            <span>{isRecognition ? "Recipient Name" : "Student Name"}</span>
            <strong>{certificate.studentName}</strong>
          </div>
          {certificate.className ? (
            <div>
              <span>Class</span>
              <strong>{certificate.className}</strong>
            </div>
          ) : null}
          <div>
            <span>{isRecognition ? "Certificate" : "Event"}</span>
            <strong>{event.eventName}</strong>
          </div>
          {isMerit ? (
            <div>
              <span>Achievement</span>
              <strong>
                {certificate.meritRank || "Recorded"} {event.meritAwardTerm}
              </strong>
            </div>
          ) : null}
          {isMerit ? (
            <div>
              <span>Category</span>
              <strong>{certificate.meritCategory || event.eventName}</strong>
            </div>
          ) : null}
          {isRecognition && certificate.recognitionRole ? (
            <div>
              <span>Role</span>
              <strong>{certificate.recognitionRole}</strong>
            </div>
          ) : null}
          {isRecognition && recognitionBody ? (
            <div>
              <span>Body</span>
              <strong>{recognitionBody}</strong>
            </div>
          ) : null}
          {isRecognition && certificate.recognitionAcademicYear ? (
            <div>
              <span>Academic Year</span>
              <strong>{certificate.recognitionAcademicYear}</strong>
            </div>
          ) : null}
          {isRecognition && certificate.recognitionTerm ? (
            <div>
              <span>Term</span>
              <strong>{certificate.recognitionTerm}</strong>
            </div>
          ) : null}
          {!isRecognition ? (
            <div>
              <span>Event Date</span>
              <strong>{event.eventDate}</strong>
            </div>
          ) : null}
          <div>
            <span>Issue Date</span>
            <strong>{event.issueDate}</strong>
          </div>
        </div>

        <div className="letter-body">
          <TemplateMoveSection
            target="title"
            offsetX={event.titleOffsetX}
            offsetY={event.titleOffsetY}
            className="letter-title-block"
            templateEdit={templateEdit}
          >
            <p className="letter-title">{event.letterTitle}</p>
            <p className="concern-line">TO WHOMSOEVER IT MAY CONCERN</p>
          </TemplateMoveSection>

          <TemplateMoveSection
            target="body"
            offsetX={event.bodyOffsetX}
            offsetY={event.bodyOffsetY}
            className="letter-body-paragraphs"
            templateEdit={templateEdit}
          >
            {event.letterBody.map((paragraph) => (
              <p key={paragraph}>
                {renderTemplateText(paragraph, certificate, event)}
              </p>
            ))}
          </TemplateMoveSection>
        </div>

        <TemplateMoveSection
          target="qr"
          offsetX={event.qrOffsetX}
          offsetY={event.qrOffsetY}
          className="certificate-verification-qr"
          templateEdit={templateEdit}
        >
          <div className="qr-frame">
            <Image
              src={`/api/qr/${event.slug}`}
              alt={`QR code to open ${event.pageTitle}`}
              width={138}
              height={138}
              className="qr-code-image"
              unoptimized
            />
          </div>
          <div className="qr-instructions">
            <strong>Verify This Certificate</strong>
            <ol>
              {event.qrInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </div>
        </TemplateMoveSection>

        <div className="signatory-row">
          {event.signatories.map((signatory, index) => (
            <div
              key={`${index}-${signatory.name}-${signatory.designation}`}
              className={[
                "signatory",
                index === 0 ? "signatory-one" : "signatory-two",
                index === 1 ? "signatory-right" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <SignatureImage
                src={signatory.signatureSrc}
                alt={signatory.signatureAlt}
              />
              <strong>{signatory.name}</strong>
              <span>{signatory.designation}</span>
            </div>
          ))}
        </div>

        <p className="verification-footnote">
          Scan the QR code or visit the official YBIT Certificate Verification
          Portal to verify this certificate.
        </p>
      </article>
    </div>
  );
}
