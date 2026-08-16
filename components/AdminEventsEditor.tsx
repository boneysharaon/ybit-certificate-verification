"use client";

import { useMemo, useState } from "react";
import {
  getDefaultCertificateEvent,
  slugifyEventName,
  type CertificateEvent,
} from "@/lib/certificateEvents";

type AdminEventsEditorProps = {
  initialEvents: CertificateEvent[];
  adminEmail: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

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
  return {
    ...base,
    eventName: "New Event",
    slug: `new-event-${stamp}`,
    homeLinkLabel: "Verify New Event eCertificates",
    pageTitle: "New Event eCertificate Verification",
    pageDescription: `Enter only the final ID printed after ${base.certificateIdPrefix}.`,
    sheetTabName: "New Event",
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
    replaceSelected({
      ...selectedEvent,
      eventName: value,
      slug: wasDefaultNewSlug ? slugifyEventName(value) : selectedEvent.slug,
    });
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
    replaceSelected({
      ...selectedEvent,
      signatories,
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
      setMessage("Saved to Google Sheets.");
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
            <label>
              <span>Event Date</span>
              <input
                value={selectedEvent.eventDate}
                onChange={(event) => updateField("eventDate", event.target.value)}
              />
            </label>
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
