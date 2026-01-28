-- 1. Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  client TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- HOST/GF can manage projects
CREATE POLICY "HOST/GF can manage projects"
  ON public.projects FOR ALL
  USING (is_host_or_gf(auth.uid()));

-- All authenticated users can view projects
CREATE POLICY "All authenticated can view projects"
  ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Add project_id to lvs table (nullable foreign key)
ALTER TABLE public.lvs 
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Extend leistungsmeldung_tags with plan fields for employees and hours
ALTER TABLE public.leistungsmeldung_tags 
  ADD COLUMN employees_plan INTEGER DEFAULT 0,
  ADD COLUMN hours_plan NUMERIC DEFAULT 0,
  ADD COLUMN has_entries BOOLEAN DEFAULT false,
  ADD COLUMN lv_snapshot_id UUID REFERENCES public.lvs(id);

-- 4. Add valid_from/valid_to to kolonne_lv_assignments for assignment history
ALTER TABLE public.kolonne_lv_assignments
  ADD COLUMN valid_from DATE,
  ADD COLUMN valid_to DATE;

-- 5. Backfill existing leistungsmeldung_tags: set has_entries based on actual data
UPDATE public.leistungsmeldung_tags
SET has_entries = (
  COALESCE(planned_revenue, 0) > 0 OR 
  COALESCE(actual_revenue, 0) > 0 OR 
  COALESCE(employees_count, 0) > 0
);

-- 6. Backfill existing kolonne_lv_assignments: set valid_from from assigned_at
UPDATE public.kolonne_lv_assignments
SET valid_from = COALESCE(assigned_at::date, CURRENT_DATE)
WHERE valid_from IS NULL;

-- 7. Create trigger for projects updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();