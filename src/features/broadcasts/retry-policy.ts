export function isRetryableRateFailure(row: {status: string; provider_id: string | null; sent_at: string | null; error: string | null}) {
  return row.status === 'failed' && !row.provider_id && !row.sent_at && /^Too many requests\. You can only make \d+ requests per second\./.test(row.error ?? '')
}
