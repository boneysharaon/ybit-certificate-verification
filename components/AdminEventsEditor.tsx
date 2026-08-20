"use client";

import Image from "next/image";
import { type ChangeEvent, useMemo, useState } from "react";
import {
  getDefaultCertificateEvent,
  getDefaultLetterBodyForCertificateType,
  getDefaultLetterTitleForCertificateType,
  slugifyEventName,
  type CertificateEvent,
  type CertificateType,
  type MeritAwardTerm,
} from "@/lib/certificateEvents";

type AdminEventsEditorProps = {
  initialEvents: CertificateEvent[];
  adminEmail: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const MAX_SIGNATURE_FILE_BYTES = 6 * 1024 * 1024;
const MAX_SIGNATURE_DATA_URL_LENGTH = 45_000;
const SIGNATURE_OUTPUT_WIDTH = 520;
const SIGNATURE_OUTPUT_HEIGHT = 190;

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

function signatureSizeLabel(signatureSrc: string) {
  if (!signatureSrc.startsWith("data:image/")) {
    return "Default image";
  }

  return `${Math.ceil(signatureSrc.length / 1024)} KB compressed`;
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

  const selectedEvent = useMemo(
    () => events.find((event) => event.slug === selectedSlug) ?? events[0],
    [events, selectedSlug],
  );

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
      setMessage("Saved to Google Sheets. Certificate data tab checked.");
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

  if (!selectedEvent) {
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
                <Image
                  src={selectedEvent.signatories[0].signatureSrc}
                  alt={selectedEvent.signatories[0].signatureAlt}
                  width={220}
                  height={92}
                  unoptimized
                />
              </div>
              <div className="admin-signature-details">
                <span>Signatory 1 Signature Image</span>
                <small>{signatureSizeLabel(selectedEvent.signatories[0].signatureSrc)}</small>
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
                <Image
                  src={selectedEvent.signatories[1].signatureSrc}
                  alt={selectedEvent.signatories[1].signatureAlt}
                  width={220}
                  height={92}
                  unoptimized
                />
              </div>
              <div className="admin-signature-details">
                <span>Signatory 2 Signature Image</span>
                <small>{signatureSizeLabel(selectedEvent.signatories[1].signatureSrc)}</small>
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
        </form>
      </div>
    </section>
  );
}
