-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('HOST', 'GF', 'BAULEITER');

-- Create profiles table for user data (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role app_role NOT NULL DEFAULT 'BAULEITER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table for role management (separate from profiles per security best practices)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Create kolonnen (work crews) table
CREATE TABLE public.kolonnen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT UNIQUE NOT NULL,
    project TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lvs (Leistungsverzeichnis - performance specifications) table
CREATE TABLE public.lvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    project TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    valid_from DATE,
    valid_to DATE,
    upload_file_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lv_items (line items within an LV)
CREATE TABLE public.lv_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lv_id UUID REFERENCES public.lvs(id) ON DELETE CASCADE NOT NULL,
    position_code TEXT NOT NULL,
    short_text TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price > 0),
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (lv_id, position_code)
);

-- Create kolonne_lv_assignments (which LV is assigned to which crew)
CREATE TABLE public.kolonne_lv_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kolonne_id UUID REFERENCES public.kolonnen(id) ON DELETE CASCADE NOT NULL,
    lv_id UUID REFERENCES public.lvs(id) ON DELETE CASCADE NOT NULL,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE (kolonne_id, is_active) -- Only one active assignment per kolonne
);

-- Create bauleiter_kolonne_assignments (which BAULEITER is assigned to which kolonne)
CREATE TABLE public.bauleiter_kolonne_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    kolonne_id UUID REFERENCES public.kolonnen(id) ON DELETE CASCADE NOT NULL,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, kolonne_id)
);

-- Create leistungsmeldung_tags (daily performance reports)
CREATE TABLE public.leistungsmeldung_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    kolonne_id UUID REFERENCES public.kolonnen(id) ON DELETE CASCADE NOT NULL,
    foreman_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    employees_count INT NOT NULL CHECK (employees_count >= 0),
    hours_per_employee DECIMAL(5,2) NOT NULL CHECK (hours_per_employee >= 0),
    planned_revenue DECIMAL(12,2) DEFAULT 0,
    actual_revenue DECIMAL(12,2) DEFAULT 0,
    rev_per_employee DECIMAL(12,2),
    rev_per_hour DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (kolonne_id, date)
);

-- Create leistungsmeldung_items (line items within a daily report)
CREATE TABLE public.leistungsmeldung_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leistungsmeldung_tag_id UUID REFERENCES public.leistungsmeldung_tags(id) ON DELETE CASCADE NOT NULL,
    lv_item_id UUID REFERENCES public.lv_items(id) ON DELETE CASCADE NOT NULL,
    qty_plan DECIMAL(12,3) DEFAULT 0,
    qty_actual DECIMAL(12,3) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_kolonne_lv_assignments_kolonne ON public.kolonne_lv_assignments(kolonne_id);
CREATE INDEX idx_kolonne_lv_assignments_lv ON public.kolonne_lv_assignments(lv_id);
CREATE INDEX idx_lv_items_lv ON public.lv_items(lv_id);
CREATE INDEX idx_lv_items_position ON public.lv_items(position_code);
CREATE INDEX idx_leistungsmeldung_tags_kolonne_date ON public.leistungsmeldung_tags(kolonne_id, date);
CREATE INDEX idx_leistungsmeldung_items_tag ON public.leistungsmeldung_items(leistungsmeldung_tag_id);
CREATE INDEX idx_bauleiter_assignments_user ON public.bauleiter_kolonne_assignments(user_id);
CREATE INDEX idx_bauleiter_assignments_kolonne ON public.bauleiter_kolonne_assignments(kolonne_id);

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user is HOST or GF
CREATE OR REPLACE FUNCTION public.is_host_or_gf(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('HOST', 'GF')
  )
$$;

-- Check if user is BAULEITER for a specific kolonne
CREATE OR REPLACE FUNCTION public.is_bauleiter_for_kolonne(_user_id UUID, _kolonne_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bauleiter_kolonne_assignments
    WHERE user_id = _user_id AND kolonne_id = _kolonne_id
  )
$$;

-- Check if user can access a kolonne (HOST/GF or assigned BAULEITER)
CREATE OR REPLACE FUNCTION public.can_access_kolonne(_user_id UUID, _kolonne_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_host_or_gf(_user_id) OR public.is_bauleiter_for_kolonne(_user_id, _kolonne_id)
$$;

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_kolonnen_updated_at BEFORE UPDATE ON public.kolonnen FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_lvs_updated_at BEFORE UPDATE ON public.lvs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_leistungsmeldung_tags_updated_at BEFORE UPDATE ON public.leistungsmeldung_tags FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Handle new user registration - create profile and role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, 'BAULEITER');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'BAULEITER');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolonnen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lv_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolonne_lv_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bauleiter_kolonne_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leistungsmeldung_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leistungsmeldung_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "HOST/GF can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_host_or_gf(auth.uid()));
CREATE POLICY "HOST can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));

-- RLS Policies for kolonnen
CREATE POLICY "HOST/GF can view all kolonnen" ON public.kolonnen FOR SELECT TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can view assigned kolonnen" ON public.kolonnen FOR SELECT TO authenticated USING (public.is_bauleiter_for_kolonne(auth.uid(), id));
CREATE POLICY "HOST/GF can manage kolonnen" ON public.kolonnen FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));

-- RLS Policies for lvs
CREATE POLICY "HOST/GF can view all lvs" ON public.lvs FOR SELECT TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can view lvs for assigned kolonnen" ON public.lvs FOR SELECT TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.kolonne_lv_assignments kla
    JOIN public.bauleiter_kolonne_assignments bka ON kla.kolonne_id = bka.kolonne_id
    WHERE kla.lv_id = lvs.id AND bka.user_id = auth.uid()
  ));
CREATE POLICY "HOST/GF can manage lvs" ON public.lvs FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));

-- RLS Policies for lv_items
CREATE POLICY "HOST/GF can view all lv_items" ON public.lv_items FOR SELECT TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can view lv_items for assigned kolonnen" ON public.lv_items FOR SELECT TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.lvs l
    JOIN public.kolonne_lv_assignments kla ON l.id = kla.lv_id
    JOIN public.bauleiter_kolonne_assignments bka ON kla.kolonne_id = bka.kolonne_id
    WHERE lv_items.lv_id = l.id AND bka.user_id = auth.uid()
  ));
CREATE POLICY "HOST/GF can manage lv_items" ON public.lv_items FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));

-- RLS Policies for kolonne_lv_assignments
CREATE POLICY "HOST/GF can view all assignments" ON public.kolonne_lv_assignments FOR SELECT TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can view assignments for their kolonnen" ON public.kolonne_lv_assignments FOR SELECT TO authenticated 
  USING (public.is_bauleiter_for_kolonne(auth.uid(), kolonne_id));
CREATE POLICY "HOST/GF can manage assignments" ON public.kolonne_lv_assignments FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));

-- RLS Policies for bauleiter_kolonne_assignments
CREATE POLICY "Users can view bauleiter assignments" ON public.bauleiter_kolonne_assignments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_host_or_gf(auth.uid()));
CREATE POLICY "HOST/GF can manage bauleiter assignments" ON public.bauleiter_kolonne_assignments FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));

-- RLS Policies for leistungsmeldung_tags
CREATE POLICY "HOST/GF can view all reports" ON public.leistungsmeldung_tags FOR SELECT TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can view own reports" ON public.leistungsmeldung_tags FOR SELECT TO authenticated USING (foreman_id = auth.uid());
CREATE POLICY "HOST/GF can manage all reports" ON public.leistungsmeldung_tags FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can create reports for assigned kolonnen" ON public.leistungsmeldung_tags FOR INSERT TO authenticated 
  WITH CHECK (foreman_id = auth.uid() AND public.is_bauleiter_for_kolonne(auth.uid(), kolonne_id));
CREATE POLICY "BAULEITER can update own reports" ON public.leistungsmeldung_tags FOR UPDATE TO authenticated 
  USING (foreman_id = auth.uid()) WITH CHECK (foreman_id = auth.uid());
CREATE POLICY "BAULEITER can delete own reports" ON public.leistungsmeldung_tags FOR DELETE TO authenticated USING (foreman_id = auth.uid());

-- RLS Policies for leistungsmeldung_items
CREATE POLICY "HOST/GF can view all report items" ON public.leistungsmeldung_items FOR SELECT TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can view own report items" ON public.leistungsmeldung_items FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.leistungsmeldung_tags WHERE id = leistungsmeldung_tag_id AND foreman_id = auth.uid()));
CREATE POLICY "HOST/GF can manage all report items" ON public.leistungsmeldung_items FOR ALL TO authenticated USING (public.is_host_or_gf(auth.uid()));
CREATE POLICY "BAULEITER can manage own report items" ON public.leistungsmeldung_items FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.leistungsmeldung_tags WHERE id = leistungsmeldung_tag_id AND foreman_id = auth.uid()));

-- Seed data for Kolonnen
INSERT INTO public.kolonnen (number, project) VALUES 
  ('2007', NULL),
  ('1031', NULL),
  ('1036', NULL);