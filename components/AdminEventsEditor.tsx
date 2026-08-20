"use client";

import Image from "next/image";
import { type ChangeEvent, useMemo, useState } from "react";
import VerificationCertificate, {
  type TemplateOffsetTarget,
} from "@/components/VerificationCertificate";
import {
  DEFAULT_LEFT_LOGO_SRC,
  DEFAULT_RIGHT_LOGO_SRC,
  REMOVED_IMAGE_SOURCE,
  certificateOrientations,
  certificateThemes,
  getDefaultCertificateEvent,
  getDefaultLetterBodyForCertificateType,
  getDefaultLetterTitleForCertificateType,
  slugifyEventName,
  type CertificateEvent,
  type CertificateOrientation,
  type CertificateTheme,
  type CertificateType,
  type MeritAwardTerm,
} from "@/lib/certificateEvents";
import type { CertificateRecord } from "@/lib/types";

type AdminEventsEditorProps = {
  initialEvents: CertificateEvent[];
  adminEmail: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const MAX_SIGNATURE_FILE_BYTES = 6 * 1024 * 1024;
const MAX_SIGNATURE_DATA_URL_LENGTH = 45_000;
const SIGNATURE_OUTPUT_WIDTH = 520;
const SIGNATURE_OUTPUT_HEIGHT = 190;
const LOGO_OUTPUT_SIZE = 260;
const LOGO_OUTPUT_MAX_LENGTH = 45_000;

function sheetTabNameFromEventName(value: string) {
  return (
    value
      .trim()
      .replace(/[:\\/?*\[\]]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^'+|'+$/g, "")
      .slice(0, 90)
      .trim() || "New Event"
  );
}

function cloneEvent(event: CertificateEvent): CertificateEvent {
  return {
    ...event,
    letterBody: [...event.letterBody],
    qrInstructions: [...event.qrInstructions],
    signatories: [
      { ...event.signatories[0] },
      { ...event.signatories[1] },
    ],
  };
}

function newDraftEvent() {
  const base = cloneEvent(getDefaultCertificateEvent());
  const stamp = Date.now().toString().slice(-5);
  const eventName = "New Event";
  return {
    ...base,
    eventName,
    slug: `new-event-${stamp}`,
    homeLinkLabel: "Verify New Event eCertificates",
    pageTitle: "New Event eCertificate Verification",
    pageDescription: `Enter only the final ID printed after ${base.certificateIdPrefix}.`,
    sheetTabName: `${sheetTabNameFromEventName(eventName)} ${stamp}`,
    eventDate: "",
    issueDate: "",
    status: "Draft",
  } satisfies CertificateEvent;
}

function splitParagraphs(value: string) {
  return value
    .split(/\n\s*\n|\r\n\s*\r\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the selected image."));
    };
    image.src = objectUrl;
  });
}

function get2dContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Your browser could not process this signature image.");
  }

  return context;
}

function isInkPixel(data: Uint8ClampedArray, index: number) {
  const red = data[index] ?? 255;
  const green = data[index + 1] ?? 255;
  const blue = data[index + 2] ?? 255;
  const alpha = data[index + 3] ?? 0;
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  const minChannel = Math.min(red, green, blue);
  const maxChannel = Math.max(red, green, blue);
  const saturation = maxChannel - minChannel;
  const blueDominance = blue - Math.max(red, green) * 0.82;
  const blueInk =
    luminance < 170 &&
    saturation > 12 &&
    (blue > red + 8 || blue > green + 4 || blueDominance > 12);
  const darkInk = luminance < 105 && minChannel < 110 && maxChannel < 150;

  return alpha > 18 && minChannel < 185 && (blueInk || darkInk);
}

function findInkBounds(imageData: ImageData) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;

      if (isInkPixel(data, index)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    throw new Error("No clear signature ink was found in this image.");
  }

  const padding = 10;
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(width - 1, maxX + padding),
    maxY: Math.min(height - 1, maxY + padding),
  };
}

function resizeCanvas(source: HTMLCanvasElement, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / source.width, maxHeight / source.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  get2dContext(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encodeCompressedSignature(source: HTMLCanvasElement) {
  const widths = [SIGNATURE_OUTPUT_WIDTH, 450, 380, 320, 260];
  const qualities = [0.88, 0.78, 0.68, 0.58, 0.48];

  for (const width of widths) {
    const canvas = resizeCanvas(source, width, SIGNATURE_OUTPUT_HEIGHT);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/webp", quality);

      if (
        dataUrl.startsWith("data:image/webp") &&
        dataUrl.length <= MAX_SIGNATURE_DATA_URL_LENGTH
      ) {
        return dataUrl;
      }
    }
  }

  throw new Error("The signature image is still too large after compression.");
}

function encodeCompressedLogo(source: HTMLCanvasElement) {
  const sizes = [LOGO_OUTPUT_SIZE, 220, 180, 150, 120];
  const qualities = [0.9, 0.8, 0.68, 0.56, 0.46];

  for (const size of sizes) {
    const canvas = resizeCanvas(source, size, size);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/webp", quality);

      if (dataUrl.length <= LOGO_OUTPUT_MAX_LENGTH) {
        return dataUrl;
      }
    }
  }

  throw new Error("The logo image is still too large after compression.");
}

async function processSignatureImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload a PNG, JPEG or WebP image.");
  }

  if (file.size > MAX_SIGNATURE_FILE_BYTES) {
    throw new Error("Please upload a signature image smaller than 6 MB.");
  }

  const image = await loadImage(file);
  const sourceScale = Math.min(1, 1400 / Math.max(image.width, image.height));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(image.width * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(image.height * sourceScale));

  const sourceContext = get2dContext(sourceCanvas);
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const sourceImageData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  const bounds = findInkBounds(sourceImageData);
  const cropWidth = bounds.maxX - bounds.minX + 1;
  const cropHeight = bounds.maxY - bounds.minY + 1;
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;

  const cropContext = get2dContext(cropCanvas);
  const cleanedImageData = cropContext.createImageData(cropWidth, cropHeight);

  for (let y = 0; y < cropHeight; y += 1) {
    for (let x = 0; x < cropWidth; x += 1) {
      const sourceX = bounds.minX + x;
      const sourceY = bounds.minY + y;
      const sourceIndex = (sourceY * sourceCanvas.width + sourceX) * 4;
      const targetIndex = (y * cropWidth + x) * 4;

      if (!isInkPixel(sourceImageData.data, sourceIndex)) {
        cleanedImageData.data[targetIndex + 3] = 0;
        continue;
      }

      const red = sourceImageData.data[sourceIndex] ?? 0;
      const green = sourceImageData.data[sourceIndex + 1] ?? 0;
      const blue = sourceImageData.data[sourceIndex + 2] ?? 0;
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const saturation = maxChannel - minChannel;
      const alpha = Math.min(
        255,
        Math.max(72, (185 - luminance) * 2.8 + saturation * 0.9),
      );

      cleanedImageData.data[targetIndex] = Math.max(10, Math.min(48, red * 0.7));
      cleanedImageData.data[targetIndex + 1] = Math.max(
        18,
        Math.min(64, green * 0.75),
      );
      cleanedImageData.data[targetIndex + 2] = Math.max(
        82,
        Math.min(152, blue * 1.03),
      );
      cleanedImageData.data[targetIndex + 3] = alpha;
    }
  }

  cropContext.putImageData(cleanedImageData, 0, 0);

  const paddedCanvas = document.createElement("canvas");
  const padding = 14;
  paddedCanvas.width = cropWidth + padding * 2;
  paddedCanvas.height = cropHeight + padding * 2;
  get2dContext(paddedCanvas).drawImage(cropCanvas, padding, padding);

  return encodeCompressedSignature(paddedCanvas);
}

async function processLogoImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload a PNG, JPEG or WebP image.");
  }

  if (file.size > MAX_SIGNATURE_FILE_BYTES) {
    throw new Error("Please upload a logo image smaller than 6 MB.");
  }

  const image = await loadImage(file);
  const sourceScale = Math.min(1, 800 / Math.max(image.width, image.height));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(image.width * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(image.height * sourceScale));
  get2dContext(sourceCanvas).drawImage(
    image,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );

  return encodeCompressedLogo(sourceCanvas);
}

function imageSizeLabel(imageSrc: string) {
  if (imageSrc === REMOVED_IMAGE_SOURCE) {
    return "Removed from template";
  }

  if (!imageSrc.startsWith("data:image/")) {
    return "Default image";
  }

  return `${Math.ceil(imageSrc.length / 1024)} KB compressed`;
}

function clampSliderNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function offsetValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminEventsEditor({
  initialEvents,
  adminEmail,
}: AdminEventsEditorProps) {
  const [events, setEvents] = useState(() =>
    initialEvents.length > 0
      ? initialEvents.map(cloneEvent)
      : [newDraftEvent()],
  );
  const [selectedSlug, setSelectedSlug] = useState(events[0]?.slug ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [uploadingSignature, setUploadingSignature] = useState<0 | 1 | null>(
    null,
  );
  const [uploadingLogo, setUploadingLogo] = useState<
    "leftLogoSrc" | "rightLogoSrc" | null
  >(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((event) => event.slug === selectedSlug) ?? events[0],
    [events, selectedSlug],
  );
  const previewCertificate = useMemo<CertificateRecord | null>(() => {
    if (!selectedEvent) {
      return null;
    }

    const letterId = `${selectedEvent.certificateIdPrefix}${selectedEvent.certificateIdExample}`;

    if (selectedEvent.certificateType === "Recognition") {
      return {
        letterId,
        studentName: "Prof. Asha Patil",
        className: "",
        recipientType: "Faculty",
        recognitionRole: "Secretary",
        recognitionBodyType: "Club",
        recognitionBodyName: selectedEvent.eventName || "Nature",
        recognitionAcademicYear: "2025-26",
        recognitionTerm: "Term I",
      };
    }

    return {
      letterId,
      studentName: "Rhea Cruz Fernandes",
      className: "FE EE",
      meritRank: "First",
      meritCategory: "Mime",
    };
  }, [selectedEvent]);

  function replaceSelected(nextEvent: CertificateEvent) {
    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.slug === selectedSlug ? cloneEvent(nextEvent) : event,
      ),
    );
    setSelectedSlug(nextEvent.slug);
  }

  function updateField<K extends keyof CertificateEvent>(
    key: K,
    value: CertificateEvent[K],
  ) {
    if (!selectedEvent) {
      return;
    }

    replaceSelected({
      ...selectedEvent,
      [key]: value,
    });
  }

  function updateEventName(value: string) {
    if (!selectedEvent) {
      return;
    }

    const wasDefaultNewSlug = selectedEvent.slug.startsWith("new-event-");
    const shouldUpdateSheetTabName =
      wasDefaultNewSlug && selectedEvent.sheetTabName.startsWith("New Event");
    replaceSelected({
      ...selectedEvent,
      eventName: value,
      slug: wasDefaultNewSlug ? slugifyEventName(value) : selectedEvent.slug,
      sheetTabName: shouldUpdateSheetTabName
        ? sheetTabNameFromEventName(value)
        : selectedEvent.sheetTabName,
    });
  }

  function updateCertificateType(certificateType: CertificateType) {
    if (!selectedEvent) {
      return;
    }

    replaceSelected({
      ...selectedEvent,
      certificateType,
      eventDate:
        certificateType === "Recognition" ? "" : selectedEvent.eventDate,
      letterTitle: getDefaultLetterTitleForCertificateType(certificateType),
      letterBody: getDefaultLetterBodyForCertificateType(certificateType),
    });
    setSaveState("idle");
    setMessage("");
  }

  function updateSignatory(
    index: 0 | 1,
    key: "name" | "designation",
    value: string,
  ) {
    if (!selectedEvent) {
      return;
    }

    const signatories = selectedEvent.signatories.map((signatory) => ({
      ...signatory,
    })) as CertificateEvent["signatories"];
    signatories[index][key] = value;

    if (key === "name" && value.trim()) {
      signatories[index].signatureAlt = `Signature of ${value.trim()}`;
    }

    replaceSelected({
      ...selectedEvent,
      signatories,
    });
  }

  function updateSignatoryImage(index: 0 | 1, signatureSrc: string) {
    if (!selectedEvent) {
      return;
    }

    const signatories = selectedEvent.signatories.map((signatory) => ({
      ...signatory,
    })) as CertificateEvent["signatories"];
    signatories[index].signatureSrc = signatureSrc;
    signatories[index].signatureAlt = `Signature of ${signatories[index].name}`;
    replaceSelected({
      ...selectedEvent,
      signatories,
    });
  }

  async function handleSignatureUpload(
    index: 0 | 1,
    changeEvent: ChangeEvent<HTMLInputElement>,
  ) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";

    if (!file) {
      return;
    }

    setUploadingSignature(index);
    setSaveState("idle");
    setMessage("");

    try {
      const signatureSrc = await processSignatureImage(file);
      updateSignatoryImage(index, signatureSrc);
      setMessage(
        "Signature background removed, cleaned and compressed. Click Save Event to publish this template change.",
      );
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not process this signature image.",
      );
    } finally {
      setUploadingSignature(null);
    }
  }

  function resetSignatoryImage(index: 0 | 1) {
    const defaultSignature = getDefaultCertificateEvent().signatories[index];
    updateSignatoryImage(index, defaultSignature.signatureSrc);
    setSaveState("idle");
    setMessage("Default signature restored. Click Save Event to publish it.");
  }

  function removeSignatoryImage(index: 0 | 1) {
    updateSignatoryImage(index, REMOVED_IMAGE_SOURCE);
    setSaveState("idle");
    setMessage("Signature removed from this template. Click Save Event to publish it.");
  }

  async function handleLogoUpload(
    key: "leftLogoSrc" | "rightLogoSrc",
    changeEvent: ChangeEvent<HTMLInputElement>,
  ) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";

    if (!file) {
      return;
    }

    setUploadingLogo(key);
    setSaveState("idle");
    setMessage("");

    try {
      const logoSrc = await processLogoImage(file);
      updateField(key, logoSrc);
      setMessage("Logo compressed. Click Save Event to publish this template change.");
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not process this logo image.",
      );
    } finally {
      setUploadingLogo(null);
    }
  }

  function resetLogoImage(key: "leftLogoSrc" | "rightLogoSrc") {
    updateField(
      key,
      key === "leftLogoSrc" ? DEFAULT_LEFT_LOGO_SRC : DEFAULT_RIGHT_LOGO_SRC,
    );
    setSaveState("idle");
    setMessage("Default logo restored. Click Save Event to publish it.");
  }

  function removeLogoImage(key: "leftLogoSrc" | "rightLogoSrc") {
    updateField(key, REMOVED_IMAGE_SOURCE);
    setSaveState("idle");
    setMessage("Logo removed from this template. Click Save Event to publish it.");
  }

  function updateTemplateOffset(
    target: TemplateOffsetTarget,
    nextX: number,
    nextY: number,
  ) {
    if (!selectedEvent) {
      return;
    }

    const fieldMap = {
      title: ["titleOffsetX", "titleOffsetY"],
      body: ["bodyOffsetX", "bodyOffsetY"],
      qr: ["qrOffsetX", "qrOffsetY"],
    } as const satisfies Record<
      TemplateOffsetTarget,
      readonly [keyof CertificateEvent, keyof CertificateEvent]
    >;
    const [xKey, yKey] = fieldMap[target];

    replaceSelected({
      ...selectedEvent,
      [xKey]: nextX,
      [yKey]: nextY,
    });
  }

  async function saveEvent() {
    if (!selectedEvent) {
      return;
    }

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedEvent),
      });
      const data = (await response.json()) as {
        event?: CertificateEvent;
        message?: string;
      };

      if (!response.ok || !data.event) {
        throw new Error(data.message || "Could not save the event.");
      }

      const savedEvent = data.event;

      setEvents((currentEvents) => {
        const exists = currentEvents.some((event) => event.slug === savedEvent.slug);
        return exists
          ? currentEvents.map((event) =>
              event.slug === savedEvent.slug ? cloneEvent(savedEvent) : event,
            )
          : [...currentEvents, cloneEvent(savedEvent)];
      });
      setSelectedSlug(savedEvent.slug);
      setSaveState("saved");
      setMessage(
        "Saved to Google Sheets. Public verification will use this template and these signatures on the next Verify eCertificate click.",
      );
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save.");
    }
  }

  function addEvent() {
    const event = newDraftEvent();
    setEvents((currentEvents) => [...currentEvents, event]);
    setSelectedSlug(event.slug);
    setSaveState("idle");
    setMessage("");
  }

  if (!selectedEvent || !previewCertificate) {
    return null;
  }

  return (
    <section className="admin-workspace" aria-label="Event template editor">
      <div className="admin-toolbar">
        <div>
          <p className="admin-eyebrow">Signed in as</p>
          <strong>{adminEmail}</strong>
        </div>
        <div className="admin-toolbar-actions">
          <button type="button" className="secondary-action-button" onClick={addEvent}>
            Add Event
          </button>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="secondary-action-button">
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <div className="admin-layout">
        <aside className="admin-event-list" aria-label="Events">
          {events.map((event) => (
            <button
              key={event.slug}
              type="button"
              className={
                event.slug === selectedEvent.slug
                  ? "admin-event-button admin-event-button-active"
                  : "admin-event-button"
              }
              onClick={() => setSelectedSlug(event.slug)}
            >
              <span>{event.eventName}</span>
              <small>{event.status}</small>
            </button>
          ))}
        </aside>

        <form className="admin-editor" onSubmit={(event) => event.preventDefault()}>
          <div className="admin-editor-heading">
            <div>
              <p className="admin-eyebrow">Template</p>
              <h1>{selectedEvent.eventName}</h1>
            </div>
            <button
              type="button"
              className="verify-button"
              disabled={saveState === "saving"}
              onClick={saveEvent}
            >
              {saveState === "saving" ? "Saving..." : "Save Event"}
            </button>
          </div>

          {message ? (
            <p
              className={
                saveState === "error"
                  ? "form-message form-message-error"
                  : "form-message form-message-neutral"
              }
            >
              {message}
            </p>
          ) : null}

          <div className="admin-grid">
            <label>
              <span>Event Name</span>
              <input
                value={selectedEvent.eventName}
                onChange={(event) => updateEventName(event.target.value)}
              />
            </label>
            <label>
              <span>Slug</span>
              <input
                value={selectedEvent.slug}
                onChange={(event) =>
                  updateField("slug", slugifyEventName(event.target.value))
                }
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={selectedEvent.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value as CertificateEvent["status"],
                  )
                }
              >
                <option>Published</option>
                <option>Draft</option>
                <option>Archived</option>
              </select>
            </label>
            <label>
              <span>Certificate Type</span>
              <select
                value={selectedEvent.certificateType}
                onChange={(event) =>
                  updateCertificateType(event.target.value as CertificateType)
                }
              >
                <option>Appreciation</option>
                <option>Participation</option>
                <option>Merit</option>
                <option>Recognition</option>
              </select>
            </label>
            {selectedEvent.certificateType === "Merit" ? (
              <label>
                <span>Merit Award Term</span>
                <select
                  value={selectedEvent.meritAwardTerm}
                  onChange={(event) =>
                    updateField(
                      "meritAwardTerm",
                      event.target.value as MeritAwardTerm,
                    )
                  }
                >
                  <option>Prize</option>
                  <option>Position</option>
                  <option>Rank</option>
                </select>
              </label>
            ) : null}
            <label>
              <span>Sheet Tab Name</span>
              <input
                value={selectedEvent.sheetTabName}
                onChange={(event) =>
                  updateField("sheetTabName", event.target.value)
                }
              />
            </label>
            <label>
              <span>Certificate Prefix</span>
              <input
                value={selectedEvent.certificateIdPrefix}
                onChange={(event) =>
                  updateField("certificateIdPrefix", event.target.value)
                }
              />
            </label>
            <label>
              <span>ID Digits</span>
              <input
                type="number"
                min="1"
                max="12"
                value={selectedEvent.certificateIdDigits}
                onChange={(event) =>
                  updateField(
                    "certificateIdDigits",
                    Number.parseInt(event.target.value, 10) || 3,
                  )
                }
              />
            </label>
            <label>
              <span>Certificate ID Example</span>
              <input
                value={selectedEvent.certificateIdExample}
                onChange={(event) =>
                  updateField("certificateIdExample", event.target.value)
                }
              />
            </label>
            <label>
              <span>Verify Button Label</span>
              <input
                value={selectedEvent.verifyButtonLabel}
                onChange={(event) =>
                  updateField("verifyButtonLabel", event.target.value)
                }
              />
            </label>
            <label>
              <span>Home Link Label</span>
              <input
                value={selectedEvent.homeLinkLabel}
                onChange={(event) =>
                  updateField("homeLinkLabel", event.target.value)
                }
              />
            </label>
            <label>
              <span>Page Title</span>
              <input
                value={selectedEvent.pageTitle}
                onChange={(event) => updateField("pageTitle", event.target.value)}
              />
            </label>
            <label className="admin-field-wide">
              <span>Page Description</span>
              <input
                value={selectedEvent.pageDescription}
                onChange={(event) =>
                  updateField("pageDescription", event.target.value)
                }
              />
            </label>
            {selectedEvent.certificateType !== "Recognition" ? (
              <label>
                <span>Event Date</span>
                <input
                  value={selectedEvent.eventDate}
                  onChange={(event) =>
                    updateField("eventDate", event.target.value)
                  }
                />
              </label>
            ) : null}
            <label>
              <span>Issue Date</span>
              <input
                value={selectedEvent.issueDate}
                onChange={(event) => updateField("issueDate", event.target.value)}
              />
            </label>
            <label className="admin-field-wide">
              <span>Letter Title</span>
              <input
                value={selectedEvent.letterTitle}
                onChange={(event) => updateField("letterTitle", event.target.value)}
              />
            </label>
            <label className="admin-field-wide">
              <span>Letter Body</span>
              <textarea
                rows={8}
                value={selectedEvent.letterBody.join("\n\n")}
                onChange={(event) =>
                  updateField("letterBody", splitParagraphs(event.target.value))
                }
              />
            </label>
            <label>
              <span>Signatory 1 Name</span>
              <input
                value={selectedEvent.signatories[0].name}
                onChange={(event) =>
                  updateSignatory(0, "name", event.target.value)
                }
              />
            </label>
            <label>
              <span>Signatory 1 Designation</span>
              <input
                value={selectedEvent.signatories[0].designation}
                onChange={(event) =>
                  updateSignatory(0, "designation", event.target.value)
                }
              />
            </label>
            <div className="admin-signature-card">
              <div className="admin-signature-preview">
                {selectedEvent.signatories[0].signatureSrc ===
                REMOVED_IMAGE_SOURCE ? (
                  <span className="admin-empty-preview">Removed</span>
                ) : (
                  <Image
                    src={selectedEvent.signatories[0].signatureSrc}
                    alt={selectedEvent.signatories[0].signatureAlt}
                    width={220}
                    height={92}
                    unoptimized
                  />
                )}
              </div>
              <div className="admin-signature-details">
                <span>Signatory 1 Signature Image</span>
                <small>{imageSizeLabel(selectedEvent.signatories[0].signatureSrc)}</small>
                <div className="admin-signature-actions">
                  <label className="secondary-action-button admin-upload-button">
                    {uploadingSignature === 0 ? "Cleaning..." : "Upload & Clean"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => void handleSignatureUpload(0, event)}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => resetSignatoryImage(0)}
                  >
                    Use Default
                  </button>
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => removeSignatoryImage(0)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
            <label>
              <span>Signatory 2 Name</span>
              <input
                value={selectedEvent.signatories[1].name}
                onChange={(event) =>
                  updateSignatory(1, "name", event.target.value)
                }
              />
            </label>
            <label>
              <span>Signatory 2 Designation</span>
              <input
                value={selectedEvent.signatories[1].designation}
                onChange={(event) =>
                  updateSignatory(1, "designation", event.target.value)
                }
              />
            </label>
            <div className="admin-signature-card">
              <div className="admin-signature-preview">
                {selectedEvent.signatories[1].signatureSrc ===
                REMOVED_IMAGE_SOURCE ? (
                  <span className="admin-empty-preview">Removed</span>
                ) : (
                  <Image
                    src={selectedEvent.signatories[1].signatureSrc}
                    alt={selectedEvent.signatories[1].signatureAlt}
                    width={220}
                    height={92}
                    unoptimized
                  />
                )}
              </div>
              <div className="admin-signature-details">
                <span>Signatory 2 Signature Image</span>
                <small>{imageSizeLabel(selectedEvent.signatories[1].signatureSrc)}</small>
                <div className="admin-signature-actions">
                  <label className="secondary-action-button admin-upload-button">
                    {uploadingSignature === 1 ? "Cleaning..." : "Upload & Clean"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => void handleSignatureUpload(1, event)}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => resetSignatoryImage(1)}
                  >
                    Use Default
                  </button>
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => removeSignatoryImage(1)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
            <label className="admin-field-wide">
              <span>QR Instructions</span>
              <textarea
                rows={4}
                value={selectedEvent.qrInstructions.join("\n")}
                onChange={(event) =>
                  updateField("qrInstructions", splitLines(event.target.value))
                }
              />
            </label>
          </div>

          <section className="advanced-template-panel" aria-label="Advanced template editor">
            <div className="advanced-template-heading">
              <div>
                <p className="admin-eyebrow">Advanced</p>
                <h2>Template Preview & Layout</h2>
                <p>
                  Fine tune the certificate visually while keeping the basic event
                  settings above unchanged.
                </p>
              </div>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setShowAdvanced((isOpen) => !isOpen)}
              >
                {showAdvanced ? "Hide Advanced" : "Open Advanced"}
              </button>
            </div>

            {showAdvanced ? (
              <div className="advanced-template-body">
                <div className="advanced-template-controls">
                  <div className="advanced-control-group">
                    <h3>Layout & Theme</h3>
                    <div className="admin-grid admin-grid-compact">
                      <label>
                        <span>Orientation</span>
                        <select
                          value={selectedEvent.certificateOrientation}
                          onChange={(event) =>
                            updateField(
                              "certificateOrientation",
                              event.target.value as CertificateOrientation,
                            )
                          }
                        >
                          {certificateOrientations.map((orientation) => (
                            <option key={orientation}>{orientation}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Theme</span>
                        <select
                          value={selectedEvent.certificateTheme}
                          onChange={(event) =>
                            updateField(
                              "certificateTheme",
                              event.target.value as CertificateTheme,
                            )
                          }
                        >
                          {certificateThemes.map((theme) => (
                            <option key={theme}>{theme}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="advanced-control-group">
                    <h3>Logos</h3>
                    <div className="admin-template-image-grid">
                      <div className="admin-template-image-card">
                        <div className="admin-logo-preview">
                          {selectedEvent.leftLogoSrc === REMOVED_IMAGE_SOURCE ? (
                            <span className="admin-empty-preview">Removed</span>
                          ) : (
                            <Image
                              src={selectedEvent.leftLogoSrc}
                              alt="Left logo preview"
                              width={90}
                              height={90}
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="admin-signature-details">
                          <span>Left Logo</span>
                          <small>{imageSizeLabel(selectedEvent.leftLogoSrc)}</small>
                          <div className="admin-signature-actions">
                            <label className="secondary-action-button admin-upload-button">
                              {uploadingLogo === "leftLogoSrc"
                                ? "Compressing..."
                                : "Upload"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) =>
                                  void handleLogoUpload("leftLogoSrc", event)
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="secondary-action-button"
                              onClick={() => resetLogoImage("leftLogoSrc")}
                            >
                              Use Default
                            </button>
                            <button
                              type="button"
                              className="secondary-action-button"
                              onClick={() => removeLogoImage("leftLogoSrc")}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="admin-template-image-card">
                        <div className="admin-logo-preview">
                          {selectedEvent.rightLogoSrc === REMOVED_IMAGE_SOURCE ? (
                            <span className="admin-empty-preview">Removed</span>
                          ) : (
                            <Image
                              src={selectedEvent.rightLogoSrc}
                              alt="Right logo preview"
                              width={90}
                              height={90}
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="admin-signature-details">
                          <span>Right Logo</span>
                          <small>{imageSizeLabel(selectedEvent.rightLogoSrc)}</small>
                          <div className="admin-signature-actions">
                            <label className="secondary-action-button admin-upload-button">
                              {uploadingLogo === "rightLogoSrc"
                                ? "Compressing..."
                                : "Upload"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) =>
                                  void handleLogoUpload("rightLogoSrc", event)
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="secondary-action-button"
                              onClick={() => resetLogoImage("rightLogoSrc")}
                            >
                              Use Default
                            </button>
                            <button
                              type="button"
                              className="secondary-action-button"
                              onClick={() => removeLogoImage("rightLogoSrc")}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="advanced-control-group">
                    <h3>Signature Size</h3>
                    <div className="admin-grid admin-grid-compact">
                      <label className="range-field">
                        <span>Signatory 1 Size</span>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.05"
                          value={selectedEvent.signatoryOneScale}
                          onChange={(event) =>
                            updateField(
                              "signatoryOneScale",
                              clampSliderNumber(event.target.value, 1),
                            )
                          }
                        />
                        <output>
                          {Math.round(selectedEvent.signatoryOneScale * 100)}%
                        </output>
                      </label>
                      <label className="range-field">
                        <span>Signatory 2 Size</span>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.05"
                          value={selectedEvent.signatoryTwoScale}
                          onChange={(event) =>
                            updateField(
                              "signatoryTwoScale",
                              clampSliderNumber(event.target.value, 1.22),
                            )
                          }
                        />
                        <output>
                          {Math.round(selectedEvent.signatoryTwoScale * 100)}%
                        </output>
                      </label>
                    </div>
                  </div>

                  <div className="advanced-control-group">
                    <h3>Text & QR Position</h3>
                    <div className="admin-grid admin-grid-compact">
                      <label className="range-field">
                        <span>Title Horizontal</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedEvent.titleOffsetX}
                          onChange={(event) =>
                            updateTemplateOffset(
                              "title",
                              offsetValue(event.target.value),
                              selectedEvent.titleOffsetY,
                            )
                          }
                        />
                        <output>{selectedEvent.titleOffsetX}px</output>
                      </label>
                      <label className="range-field">
                        <span>Title Vertical</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedEvent.titleOffsetY}
                          onChange={(event) =>
                            updateTemplateOffset(
                              "title",
                              selectedEvent.titleOffsetX,
                              offsetValue(event.target.value),
                            )
                          }
                        />
                        <output>{selectedEvent.titleOffsetY}px</output>
                      </label>
                      <label className="range-field">
                        <span>Body Horizontal</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedEvent.bodyOffsetX}
                          onChange={(event) =>
                            updateTemplateOffset(
                              "body",
                              offsetValue(event.target.value),
                              selectedEvent.bodyOffsetY,
                            )
                          }
                        />
                        <output>{selectedEvent.bodyOffsetX}px</output>
                      </label>
                      <label className="range-field">
                        <span>Body Vertical</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedEvent.bodyOffsetY}
                          onChange={(event) =>
                            updateTemplateOffset(
                              "body",
                              selectedEvent.bodyOffsetX,
                              offsetValue(event.target.value),
                            )
                          }
                        />
                        <output>{selectedEvent.bodyOffsetY}px</output>
                      </label>
                      <label className="range-field">
                        <span>QR Horizontal</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedEvent.qrOffsetX}
                          onChange={(event) =>
                            updateTemplateOffset(
                              "qr",
                              offsetValue(event.target.value),
                              selectedEvent.qrOffsetY,
                            )
                          }
                        />
                        <output>{selectedEvent.qrOffsetX}px</output>
                      </label>
                      <label className="range-field">
                        <span>QR Vertical</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedEvent.qrOffsetY}
                          onChange={(event) =>
                            updateTemplateOffset(
                              "qr",
                              selectedEvent.qrOffsetX,
                              offsetValue(event.target.value),
                            )
                          }
                        />
                        <output>{selectedEvent.qrOffsetY}px</output>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="advanced-preview-panel">
                  <div className="advanced-preview-heading">
                    <div>
                      <p className="admin-eyebrow">Live Preview</p>
                      <strong>{selectedEvent.letterTitle}</strong>
                    </div>
                    <small>Drag the title, body or QR area in the preview.</small>
                  </div>
                  <VerificationCertificate
                    certificate={previewCertificate}
                    event={selectedEvent}
                    showActions={false}
                    templateEdit={{ onOffsetChange: updateTemplateOffset }}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </form>
      </div>
    </section>
  );
}
