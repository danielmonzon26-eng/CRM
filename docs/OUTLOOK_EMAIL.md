# Outlook email and meetings

The **Communication** page (under CRM in the sidebar) connects each team member's
Microsoft 365 mailbox. Once connected:

- Email to and from any saved contact shows on the Communication page and on that
  contact's lead and company pages.
- Outlook meetings with a contact show there too.
- **New email** and **Reply** send from the person's own Outlook, so messages also land
  in their Sent Items. Emails sent from a lead page are logged in its Activity.

Only email and meetings that include a contact's email address are copied into the CRM.
The rest of the mailbox never leaves Outlook. Everyone on the team can see the copied
email, since everyone has the same access.

The first sync reaches back 90 days of email, and meetings from 30 days ago to 90 days
ahead. New mail comes in when someone opens the Communication page or a lead or company
page, at most every 5 minutes, and once a day from a scheduled job. **Sync now** forces
it. Email with someone who becomes a contact later only shows from the next new message
onward.

## One-time setup (a Microsoft 365 admin at Catapult)

### 1. Register the app in Microsoft Entra

1. Go to https://entra.microsoft.com → **Applications → App registrations → New registration**.
2. Name: `Catapult CRM`. Supported account types: **Accounts in this organizational directory only**.
3. Redirect URI: platform **Web**, value `https://crm-two-delta-91.vercel.app/api/outlook/callback`.
   To test locally, also add `http://localhost:3000/api/outlook/callback` under
   **Authentication** afterwards.
4. Click **Register**. From the **Overview** page, copy the **Application (client) ID**
   and **Directory (tenant) ID**.
5. **Certificates & secrets → New client secret**. Copy the secret's **Value** right away
   (it's only shown once). Note its expiry date: connections stop working when it
   expires, so set a reminder to replace it.
6. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, and add:
   `offline_access`, `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.Read`.
   Then click **Grant admin consent for Catapult**.

`Mail.ReadWrite` is needed because replies are created as drafts in the sender's
mailbox and then sent. The CRM never deletes or changes existing email.

### 2. Add the settings in Vercel

In the Vercel project → **Settings → Environment Variables**, add these for Production
(and Preview/Development if you test there), then redeploy:

| Name | Value |
|---|---|
| `MICROSOFT_CLIENT_ID` | Application (client) ID from step 4 |
| `MICROSOFT_TENANT_ID` | Directory (tenant) ID from step 4 |
| `MICROSOFT_CLIENT_SECRET` | Secret value from step 5 |
| `MAIL_TOKEN_KEY` | A new random key: run `openssl rand -base64 32` and paste the output |

`MAIL_TOKEN_KEY` encrypts the stored Microsoft sign-in tokens. Keep it secret, and don't
change it once people have connected, or everyone will need to reconnect.

`NEXT_PUBLIC_SITE_URL` must stay set to the live address, because Microsoft only accepts
the exact redirect URI registered in step 3. Preview deployments can't connect Outlook.

### 3. Connect

Each person opens **Communication** and clicks **Connect Outlook**, signs in with their
Catapult Microsoft account, and approves. Their email starts appearing within a minute.

## Troubleshooting

- **"Needs reconnect"**: Microsoft ended the connection (password change, revoked access,
  or the client secret expired). The person clicks **Reconnect Outlook**.
- **"That mailbox is already connected by someone else"**: each mailbox can be connected
  by one CRM user.
- **Disconnect** removes that person's copied email and meetings from the CRM. Nothing is
  deleted from Outlook.

## Controlling what gets sent

Every email the CRM sends (new emails, replies, event feedback requests) goes through one
function in `lib/outlook/send.ts`, so two Vercel settings control all of it:

| Setting | Effect |
|---|---|
| `OUTBOUND_EMAIL=off` | Stops all sending. People see "Sending email is switched off". Remove it to turn sending back on. |
| `OUTBOUND_TEST_ADDRESS=you@example.com` | Sends everything to that one address instead, with the real recipients named in the subject. |

Outside the live site (preview deploys and local copies) email only goes out when
`OUTBOUND_TEST_ADDRESS` is set, so a test can never reach a real contact.
