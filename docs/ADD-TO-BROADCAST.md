# Add selected contacts to broadcasts — v0.9.16

Approved October 19, 2026. Implementation stays in FlowCRM; no database migration or schedule definition change.

## Behavior

Contacts retains checkbox picks across filters and exposes Add to broadcast. New email/SMS drafts receive a fixed contact-ID audience. Existing draft/scheduled destinations are scoped to the authenticated org/workspace. The preview rechecks up to 500 selected contacts and shows new additions, existing matches, exclusions and a count from the same recipient-query function used for sending. Matching counts precede final send-time checks. Excluded contacts are never newly added; an existing filter that already matches them is preserved, and final eligibility guards still apply.

Fixed audiences merge unique IDs. Tag/source audiences preserve their fields, including tag_match, and gain additional_contact_ids as OR alternatives. All-contact audiences remain unchanged. Normalization, previews, counts, delivery and editor saves all understand additions. The editor identifies fixed hand-picked audiences and additional counts.

## Concurrency and safeguards

- Server derives org/workspace from authenticated memberships; validates IDs and refuses missing/foreign contacts or destinations.
- Preview hashes target, selected IDs, revision, merged audience, eligibility and count. Confirm recomputes it; stale previews require review again.
- Existing updates change only recipient_filter and updated_at. Conditional status and updated_at predicates reject send claims, reschedules and concurrent writes after the preview read. The database's existing updated_at trigger advances the revision.
- The send claim now checks that same revision after recipient resolution. If an addition commits first, the stale send attempt exits before snapshot/provider calls; a later attempt reads the new audience. If the sender wins, the addition is rejected. Scheduled_at is never changed by adding contacts.
- Broadcast editor saves require their loaded revision, preventing stale tabs from dropping additions. Concurrent updates after the server read are also rejected.
- A new-draft UUID stays stable across retries; duplicate insertion returns the existing scoped draft rather than creating another.
- Consent, method and do-not-contact checks apply to both channels. Selected email contacts additionally pass the existing signed-ledger suppression/consent guard. No provider sends occur in preview/confirmation. Actual delivery rechecks eligibility as before.

## Verification

162 tests pass; 2 existing skips. New tests exercise union/count/delivery semantics; new, empty, fixed, all-contact and scheduled audiences; exclusions and duplicate IDs; workspace boundaries; stale previews; concurrent send/add and stale editor protection; idempotent creation; dialog target invalidation and exact confirmation payloads; and filtered checkbox picks. Query tests use an in-memory Supabase model with predicate evaluation and injected concurrent writes. They do not mutate production.

Isolated real Chromium desktop/mobile checks use synthetic contacts and mocked server actions. They verify filtered selection, new draft confirmation, scheduled duplicate/count/time preview, exact selected IDs and dialog content fitting without horizontal clipping. Existing column/sort/persistence browser checks remain available. The browser fixture never imports a live database action for mutations.

TypeScript and changed-file ESLint pass. Final build and production receipt are recorded in BUILD-STATUS.md. Authenticated live mutation/send testing is deliberately not performed against real campaigns. No claims of live recipient delivery follow from these tests.

Supabase conditional-update API reviewed against [official documentation](https://supabase.com/docs/reference/javascript/update); existing RLS/membership context and updated_at trigger retained.
