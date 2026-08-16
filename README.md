# YBIT Certificate Verification Portal

This project is a production-ready Next.js website for verifying Yashwantrao Bhonsale Institute of Technology e-certificates. A visitor chooses an eCertificate category, enters the final Certificate ID number, the server checks the mapped private Google Sheet tab, and the browser receives only the matching verification result.

## Technology Used

- Next.js App Router
- TypeScript
- Plain CSS
- Vercel serverless API route through `app/api/verify/route.ts`
- Google Sheets API with Google service-account authentication
- Google Sheets as the only certificate register

## Google Sheet Format

Use one private Google Sheet for the whole portal.

- `Events` is the master tab. Each published row becomes one public verification link.
- Each event has its own certificate-data tab, such as `Certificates`.

The current Youth Festival 2026 volunteer eCertificates use the first certificate-data tab named `Certificates`.

Required headings:

| Column | Heading |
| --- | --- |
| A | Letter ID |
| B | Student Name |
| C | Class |

Optional heading:

| Column | Heading |
| --- | --- |
| D | Branch |
| E | Status |
| F | Rank / Position / Prize |
| G | Event/Category |

Blank Status or `Valid` is treated as valid. `Revoked` is treated as revoked.
If `Branch` is present, the public verification document displays `Class` and `Branch` together, such as `T.E. Computer Science Engineering`.
For Certificate of Merit events, add a rank/result column such as `Rank`, `Position`, `Prize`, `Award`, or `Result`, and a category column such as `Event/Category`, `Category`, `Competition`, or `Event`.

Example row:

| Letter ID | Student Name | Class | Branch | Status |
| --- | --- | --- | --- | --- |
| YBIT/CulturalDept/YF/V/001 | Saee Manish Dhande | T.E. | Computer Science Engineering | Valid |

### Events Tab

The `Events` tab has these columns:

| Column | Heading |
| --- | --- |
| A | Event Name |
| B | Slug |
| C | Home Link Label |
| D | Page Title |
| E | Page Description |
| F | Sheet Tab Name |
| G | Certificate Prefix |
| H | ID Digits |
| I | Certificate ID Example |
| J | Event Date |
| K | Issue Date |
| L | Letter Title |
| M | Letter Body |
| N | Signatory 1 Name |
| O | Signatory 1 Designation |
| P | Signatory 2 Name |
| Q | Signatory 2 Designation |
| R | QR Instructions |
| S | Status |
| T | Verify Button Label |
| U | Signatory 1 Signature Image |
| V | Signatory 2 Signature Image |
| W | Certificate Type |
| X | Merit Award Term |

Only rows with `Status` set to `Published` appear on the public homepage. `Draft` and `Archived` rows stay hidden.
`Certificate Type` can be `Appreciation`, `Participation`, or `Merit`. For Merit certificates, `Merit Award Term` can be `Rank`, `Position`, or `Prize`.

For editable letter text, use placeholders:

```text
{{studentName}}
{{className}}
{{eventName}}
{{eventDate}}
{{issueDate}}
{{certificateId}}
{{meritRank}}
{{meritAwardTerm}}
{{meritCategory}}
```

## Enable Google Sheets API

1. Open Google Cloud Console.
2. Create or select a Google Cloud project.
3. Go to APIs and Services.
4. Enable the Google Sheets API for that project.

## Create a Service Account

1. In Google Cloud Console, open IAM and Admin, then Service Accounts.
2. Create a service account for certificate verification.
3. Create a JSON key for the service account.
4. Keep the JSON file private and do not commit it.

## Share the Sheet

Open the Google Sheet and share it with the service-account email. Viewer access is enough for verification only. Editor access is required for the `/admin` event/template editor.

## Find the Spreadsheet ID

In a Google Sheet URL like:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

copy the value between `/d/` and `/edit`.

## Configure Local Environment

Create `.env.local` from `.env.example`:

```text
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=certificate-verifier@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_SITE_URL=https://ybit-certificate-verification.vercel.app
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
AUTH_SECRET=generate_a_long_random_secret
ADMIN_EMAILS=bpsharaon@ybit.ac.in
```

For `GOOGLE_PRIVATE_KEY`, keep newline characters escaped as `\n` when placing the value in Vercel or `.env.local`. The application converts those escaped newlines before signing the service-account request.

## Add Certificate Events

Events are managed from the Google Sheet, not by editing code.

To add another event:

1. Open `/admin` and click `Add Event`.
2. Fill the event form and choose the certificate type.
3. Set `Status` to `Published` when the public link should appear.
4. Click `Save Event`.

On save, the portal writes the row in the `Events` tab and automatically creates or updates the matching certificate-data tab. Appreciation and Participation tabs get `Letter ID`, `Student Name`, `Class`, `Branch`, and `Status`. Merit tabs also get the selected `Rank` / `Position` / `Prize` column and `Event/Category`.

If you manage the sheet manually, the same headings can still be edited directly in Google Sheets. Existing certificate-data rows are preserved when `/admin` updates the header row.

The QR code is generated dynamically at `/api/qr/<event-slug>`.

## Admin Editor

The admin editor is available at:

```text
https://ybit-certificate-verification.vercel.app/admin
```

Admin access uses Google sign-in. Only emails listed in `ADMIN_EMAILS` are allowed.

The editor can upload a custom signature image for each signatory. Uploads are processed in the browser before saving: the image is cropped to the signature ink, light paper background is made transparent, and the result is compressed before being stored in the `Events` tab. The public certificate renders the cleaned signature with transparent/multiply styling so it does not look like a pasted photo.

Each event also has a `Certificate Type` dropdown. `Appreciation` and `Participation` use the same editable fields. `Merit` switches the default title/body to a merit certificate and uses per-student rank/category values from the certificate-data tab.

Create a Google OAuth web client in the same Google Cloud project and add this authorized redirect URI:

```text
https://ybit-certificate-verification.vercel.app/api/auth/google/callback
```

For local testing, also add:

```text
http://localhost:3000/api/auth/google/callback
```

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## Required Images

Place official image assets at these paths when available:

```text
public/ybit-logo.png
public/mumbai-university-logo.png
public/signatures/bpsharaon.png
public/signatures/principal.png
```

If the logo files are missing, the header shows restrained text placeholders. If signature files are missing, the signatory names still appear without fabricated signatures.

## Deploy to Vercel

1. Push this project to a Git repository.
2. Create a new Vercel project from that repository.
3. Use the default Next.js framework settings.
4. Add the same environment variables from `.env.local` in Vercel Project Settings.
5. Deploy.

Required Vercel environment variables:

```text
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
NEXT_PUBLIC_SITE_URL
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
AUTH_SECRET
ADMIN_EMAILS
```

Do not prefix private variables with `NEXT_PUBLIC_`. Only `NEXT_PUBLIC_SITE_URL` is intentionally public.

## Test the Portal

Use these cases after the Sheet and environment variables are configured:

- Valid ID: choose the event page and enter the final ID number that exists with blank Status or `Valid`.
- Invalid ID: enter a malformed value such as `0A1`.
- Nonexistent ID: enter a correctly formatted ID that is not in the Sheet.
- Revoked ID: set Status to `Revoked` for an existing row and verify the revoked message appears.

Local project checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check:client-bundle
npm run check:forbidden-features
```

## College Website Link

Add this link to the official college website after deployment:

```html
<a href="https://YOUR-VERCEL-DOMAIN.vercel.app">
  Certificate Verification
</a>
```

## Optional Custom Domain

For a future custom domain such as `verify.ybit.ac.in`, add the domain in Vercel Project Settings, follow Vercel's DNS instructions, and verify that the domain points to the deployed project before replacing the college website link.
