"use client";

import { FormEvent, useState } from "react";
import VerificationCertificate from "@/components/VerificationCertificate";
import type { CertificateEvent } from "@/lib/certificateEvents";
import {
  certificateIdPartMaxLength,
  validateAndNormalizeCertificateIdPart,
} from "@/lib/letterId";
import type { VerifyApiResponse } from "@/lib/types";

type RequestState = "idle" | "loading" | "complete" | "error";

type CertificateVerificationFormProps = {
  event: CertificateEvent;
};

export default function CertificateVerificationForm({
  event,
}: CertificateVerificationFormProps) {
  const [idPart, setIdPart] = useState("");
  const [message, setMessage] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [result, setResult] = useState<VerifyApiResponse | null>(null);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setResult(null);
    setMessage("");

    const validation = validateAndNormalizeCertificateIdPart(idPart, {
      prefix: event.certificateIdPrefix,
      digits: event.certificateIdDigits,
      example: event.certificateIdExample,
    });

    if (!validation.ok) {
      setRequestState("error");
      setMessage(validation.message);
      return;
    }

    setRequestState("loading");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventSlug: event.slug,
          idPart,
        }),
        cache: "no-store",
      });
      const data = (await response.json()) as VerifyApiResponse;

      setResult(data);

      if (!response.ok && "message" in data && data.message) {
        setMessage(data.message);
      }

      setRequestState(response.ok || response.status === 404 ? "complete" : "error");
    } catch {
      setRequestState("error");
      setMessage("We could not complete verification right now. Please try again later.");
    }
  }

  const isLoading = requestState === "loading";
  const showMessage = message.length > 0;
  const maxIdPartLength = certificateIdPartMaxLength(
    event.certificateIdDigits,
    event.certificateIdExample,
  );

  return (
    <section className="verification-workspace" aria-label={`${event.eventName} certificate lookup`}>
      <form className="verification-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="letter-id">Certificate ID</label>
          <div className="prefixed-id-field">
            <span className="id-prefix" aria-hidden="true">
              {event.certificateIdPrefix}
            </span>
            <input
              id="letter-id"
              name="idPart"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={idPart}
              placeholder={event.certificateIdExample}
              aria-describedby={showMessage ? "verification-message" : "id-prefix-help"}
              aria-invalid={requestState === "error" ? "true" : "false"}
              maxLength={maxIdPartLength}
              onChange={(changeEvent) =>
                setIdPart(changeEvent.target.value.toUpperCase())
              }
            />
          </div>
          <p id="id-prefix-help" className="field-help">
            {event.certificateIdPrefix} is fixed. Enter only the final ID.
          </p>
        </div>

        <button className="verify-button" type="submit" disabled={isLoading}>
          {isLoading ? "Verifying..." : event.verifyButtonLabel}
        </button>

        <div aria-live="polite" aria-atomic="true">
          {showMessage ? (
            <p id="verification-message" className="form-message form-message-error">
              {message}
            </p>
          ) : null}
          {isLoading ? (
            <p className="form-message form-message-neutral">
              Checking the official certificate register...
            </p>
          ) : null}
        </div>
      </form>

      {result?.status === "valid" ? (
        <VerificationCertificate
          certificate={result.certificate}
          event={result.event ?? event}
        />
      ) : null}

      {result?.status === "revoked" ? (
        <article className="result-panel result-panel-revoked" role="status">
          <h2>CERTIFICATE REVOKED</h2>
          <p>
            This Certificate ID exists in the YBIT register but is no longer valid.
            Please contact the Cultural Committee of YBIT for clarification.
          </p>
        </article>
      ) : null}

      {result?.status === "not_found" ? (
        <article className="result-panel result-panel-not-found" role="status">
          <h2>No authentic eCertificate was found against the entered ID.</h2>
          <p>Please check the final ID number and enter it exactly as printed.</p>
        </article>
      ) : null}
    </section>
  );
}
