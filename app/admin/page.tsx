import Link from "next/link";
import AdminEventsEditor from "@/components/AdminEventsEditor";
import InstitutionalHeader from "@/components/InstitutionalHeader";
import { getAdminSession, getOAuthConfig } from "@/lib/auth";
import {
  getDefaultCertificateEvent,
  type CertificateEvent,
} from "@/lib/certificateEvents";
import {
  ensureEventsSheet,
  getCertificateEvents,
  SheetsConfigurationError,
} from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function errorMessage(error?: string) {
  if (error === "not_authorized") {
    return "This Google account is not listed as an admin.";
  }

  if (error === "auth_failed") {
    return "Google sign-in could not be completed.";
  }

  if (error === "auth_setup") {
    return "Google sign-in is not configured yet.";
  }

  return "";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { error } = await searchParams;
  const config = getOAuthConfig();
  const session = await getAdminSession();
  const authError = errorMessage(error);

  let events: CertificateEvent[] = [getDefaultCertificateEvent()];
  let sheetError = "";

  if (session) {
    try {
      await ensureEventsSheet();
      const sheetEvents = await getCertificateEvents({
        includeDraft: true,
        fallbackToStatic: false,
      });
      events = sheetEvents.length > 0 ? sheetEvents : events;
    } catch (caughtError) {
      sheetError =
        caughtError instanceof SheetsConfigurationError
          ? "Google Sheets is not configured."
          : "Events could not be loaded from Google Sheets.";
    }
  }

  return (
    <main className="site-shell">
      <InstitutionalHeader />

      <section className="verification-intro admin-intro" aria-labelledby="admin-title">
        <p className="section-kicker">Admin</p>
        <h1 id="admin-title">eCertificate Events</h1>
        <p>
          <Link className="back-link" href="/">
            Public verification portal
          </Link>
        </p>
      </section>

      {!config ? (
        <section className="admin-state-panel">
          <h2>Google sign-in setup required</h2>
          <p>
            Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
            `AUTH_SECRET`, and `ADMIN_EMAILS` in Vercel to enable admin access.
          </p>
        </section>
      ) : null}

      {config && !session ? (
        <section className="admin-state-panel">
          <h2>Sign in with Google</h2>
          {authError ? <p className="form-message form-message-error">{authError}</p> : null}
          <Link className="verify-button admin-sign-in-link" href="/api/auth/google/start">
            Continue with Google
          </Link>
        </section>
      ) : null}

      {config && session && sheetError ? (
        <section className="admin-state-panel">
          <h2>Google Sheets setup required</h2>
          <p>{sheetError}</p>
        </section>
      ) : null}

      {config && session && !sheetError ? (
        <AdminEventsEditor initialEvents={events} adminEmail={session.email} />
      ) : null}
    </main>
  );
}
