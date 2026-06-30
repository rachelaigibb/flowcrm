-- Add task_id column to activities table so activities can be linked to tasks
-- (notes, status changes, etc.)
ALTER TABLE public.activities
  ADD COLUMN task_id uuid REFERENCES public.tasks ON DELETE SET NULL;

CREATE INDEX idx_activities_task_id ON public.activities (task_id);
