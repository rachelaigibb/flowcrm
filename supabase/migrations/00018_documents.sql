-- Documents: files attached to contacts, deals and outbound emails.
-- Storage lives in the private "documents" bucket; every object path starts
-- with the workspace id so storage RLS can reuse get_user_sub_account_ids().

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_sub_account_ids()));

CREATE TABLE public.documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  contact_id     uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id        uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_id    uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  name           text NOT NULL,
  path           text NOT NULL UNIQUE,
  size           integer NOT NULL,
  mime_type      text,
  created_by     uuid REFERENCES auth.users,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_contact_idx ON public.documents (contact_id, created_at DESC);
CREATE INDEX documents_deal_idx ON public.documents (deal_id, created_at DESC);
CREATE INDEX documents_activity_idx ON public.documents (activity_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
