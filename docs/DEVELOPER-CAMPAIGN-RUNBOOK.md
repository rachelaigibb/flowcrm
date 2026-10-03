# First developer campaign: 14310 104 Avenue

Prepared October 2, 2026. No broadcast has been sent or scheduled by Codex.

## Import completed

Source: `~/Downloads/2026-10_Vancouver_14310-104Ave_FlowCRM-Import_v2.csv`. It is byte-for-byte identical to the v2 copy in the original campaign folder. Imported into **Vancouver Real Estate only**: 178 new contacts, 75 email contacts and 103 call-only contacts. The CSV consent values were preserved; the source research notes and campaign tags were included. No existing contact matched this import. Database readback confirmed the counts below.

| Audience tag | Contacts | Use |
|---|---:|---|
| `14310-w1-named` | 8 | First wave, named recipients |
| `14310-w1-general` | 22 | First wave, general company inboxes |
| `14310-w2-named` | 10 | Second wave, named recipients |
| `14310-w2-general` | 24 | Second wave, general company inboxes |
| `14310-brokers` | 11 | Separate broker message |
| `14310-call-list` | 103 | Phone outreach; no email address |

The workbook plan starts wave one the week of October 5, wave two the week of October 12, and phone follow-up three business days after the email. Those are suggested timing windows, not scheduled sends.

## Run the campaign

1. **Open FlowCRM and switch to Vancouver Real Estate.** Refresh Contacts. Search for a few companies from the CSV and open their records. Check email, phone, company, tags and the research note. Do not import the CSV again.
2. **Check Settings → Email Settings.** Confirm the From address and Reply-To are your intended Vancouver addresses. Confirm Marketing mailing address reads `eXp Realty, #1500 – 701 West Georgia Street, Vancouver, BC V7Y 1G5`. That address belongs to Vancouver only.
3. **Prepare the message links.** Broadcasts currently send plain text with links; they do not attach PDFs. Use a public brochure/data-room link you have checked in a signed-out browser. Keep appraisals and private material out of the public package. If no package link is ready, link to the property listing and say “Reply if you would like the Development Site Information Package.” Do not say “attached” in a broadcast. To send an actual PDF, open an individual contact → Email → Attach file, wait for upload, then send.
4. **Review the first-wave records before sending.** Some source research is marked partially verified. Confirm the contact address, relevant business role and source information. The imported consent labels are the CSV's labels, not a fresh verification. Respect withdrawn consent and unsubscribe requests.
5. **Go to Broadcasts → New → Email.** Name the draft `14310 104 Ave — Wave 1 — Named`. Choose the tag **14310-w1-named only**. Leave “all contacts” off and avoid selecting the broad developer tags. You should see 8 eligible recipients initially; consent changes can reduce that number.
6. **Write the subject and body.** Start from the workbook's court-ordered-sale email. Suggested subject: `Court-ordered sale: 14310 104 Avenue, Surrey — C-35 corner site`. For this named group, begin `Hi {{first_name}},`. Use exactly two braces on each side. Confirm current price, MLS number, availability, zoning and development statements before sending; the September workbook is a draft, not a live listing check. Include the listing/package link and a clear invitation to reply or arrange a site walk.
7. **Add your signature in the body.** Broadcasts do not add the saved signature automatically. FlowCRM adds the Vancouver identification, mailing address and unsubscribe footer automatically, so do not add a second unsubscribe line.
8. **Save the draft and click Send test to me.** Read the received email on your phone and computer. Check subject, spacing, signature, links and footer. The test uses sample merge values and a preview unsubscribe link. For a real contact-name check, send a separate email to your own contact record with `{{first_name}}`; this does not test the campaign audience. A test is not the developer send.
9. **Review the audience count once more, then click Send now** when you are ready. Alternatively, choose a date/time under Schedule for later and click Schedule. Refresh the broadcast page to check sent/failed results. If a send is uncertain, check its status before retrying. Do not resend a completed broadcast to the same group.
10. **Create the general-inbox first wave separately.** Name it `14310 104 Ave — Wave 1 — General`, select **14310-w1-general only** and expect 22 recipients initially. Begin `Hello,` instead of a first-name field; many company-only records use the company as their display name. Repeat the draft, test, audience review and send steps.
11. **Handle brokers as a separate message.** Select **14310-brokers only** (11 contacts). Use a shorter facts-focused message for cooperating agents. Link to the MLS sheet/package, or use individual contact emails when the actual PDF must be attached. Test before sending.
12. **Follow up after three business days.** Filter Contacts by the relevant first-wave tag. Check replies in Gmail, log important replies as notes in FlowCRM, and create follow-up tasks. Use the call-list tag for phone-only prospects. Record reached, voicemail, interested, declined and next action; stop outreach when someone asks.
13. **Run wave two after reviewing wave one.** Create separate named/general broadcasts for **14310-w2-named** (10) and **14310-w2-general** (24), using the same testing process. The original plan suggests the week of October 12; choose the actual day/time yourself. Update the message if property facts changed.
14. **Record inquiries against the property deal.** Open the 14310 104 Ave deal → People → Log inquiry, select the contact, write what they asked and set a follow-up. This keeps the buyer inquiry and next action connected to the listing.

## Before pressing Send

Correct sub-account; one precise audience tag; current property facts; working links; body signature; readable test; Vancouver footer; reviewed consent/source records. No attachments are included in a broadcast. No campaign sends or schedules were created during this import.
