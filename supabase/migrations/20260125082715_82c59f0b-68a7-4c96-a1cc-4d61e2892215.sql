-- Create app_role enum for RBAC
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'admin', 
  'project_manager',
  'procurement',
  'storekeeper',
  'site_lead',
  'viewer'
);

-- Create order_status enum
CREATE TYPE public.order_status AS ENUM (
  'draft',
  'for_approval',
  'approved',
  'ordered',
  'in_transit',
  'delivered',
  'partially_received',
  'fully_received',
  'closed',
  'cancelled'
);

-- Create project_status enum
CREATE TYPE public.project_status AS ENUM (
  'active',
  'on_hold',
  'completed',
  'cancelled'
);

-- Create transaction_type enum
CREATE TYPE public.transaction_type AS ENUM (
  'stock_in',
  'stock_out',
  'transfer_in',
  'transfer_out',
  'adjustment',
  'receiving'
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  sms_opt_in BOOLEAN DEFAULT false,
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  location TEXT,
  description TEXT,
  status project_status DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  project_manager_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Project members (user-project assignments)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, user_id)
);

-- SKU catalog (global)
CREATE TABLE public.skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'EA',
  brand TEXT,
  specifications JSONB,
  default_min_threshold INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Project inventory (per-project stock levels)
CREATE TABLE public.project_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  sku_id UUID REFERENCES public.skus(id) ON DELETE CASCADE NOT NULL,
  on_hand INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  min_threshold INTEGER,
  location_in_site TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, sku_id)
);

-- Inventory transactions (audit trail)
CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  sku_id UUID REFERENCES public.skus(id) NOT NULL,
  transaction_type transaction_type NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  transfer_project_id UUID REFERENCES public.projects(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Orders (PR/PO)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  order_type TEXT DEFAULT 'PO',
  status order_status DEFAULT 'draft',
  supplier_name TEXT,
  supplier_contact TEXT,
  expected_delivery_date DATE,
  notes TEXT,
  total_amount DECIMAL(12,2),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  sku_id UUID REFERENCES public.skus(id) NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Deliveries
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  delivery_number TEXT NOT NULL,
  delivery_date DATE,
  received_date TIMESTAMPTZ,
  carrier TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  received_by UUID REFERENCES auth.users(id)
);

-- Delivery items
CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  order_item_id UUID REFERENCES public.order_items(id) NOT NULL,
  quantity_received INTEGER NOT NULL,
  condition TEXT DEFAULT 'good',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SMS logs
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES auth.users(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  error_message TEXT,
  event_type TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SMS settings
CREATE TABLE public.sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_sender_number TEXT,
  is_enabled BOOLEAN DEFAULT false,
  event_rules JSONB DEFAULT '{
    "order_status_change": ["admin", "project_manager", "procurement"],
    "low_stock": ["admin", "project_manager", "storekeeper"],
    "delivery_received": ["admin", "project_manager"]
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Check if user has access to a project
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_user_id) 
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE user_id = _user_id
        AND project_id = _project_id
    )
$$;

-- Get user's role in a project
CREATE OR REPLACE FUNCTION public.get_project_role(_user_id UUID, _project_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.project_members
  WHERE user_id = _user_id
    AND project_id = _project_id
  LIMIT 1
$$;

-- RLS Policies

-- Profiles: Users can view all profiles, update own
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- User roles: Only admins can manage, users can view own
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Projects: Admins see all, members see assigned
CREATE POLICY "Users can view accessible projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), id));

CREATE POLICY "Admins can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Project members: Admins manage, members view own project
CREATE POLICY "Users can view project members"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Admins can manage project members"
  ON public.project_members FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- SKUs: All authenticated users can view, admins can manage
CREATE POLICY "Users can view skus"
  ON public.skus FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage skus"
  ON public.skus FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Project inventory: Project members can view/manage
CREATE POLICY "Users can view project inventory"
  ON public.project_inventory FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Project members can manage inventory"
  ON public.project_inventory FOR ALL
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

-- Inventory transactions: Project members can view/create
CREATE POLICY "Users can view inventory transactions"
  ON public.inventory_transactions FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Project members can create transactions"
  ON public.inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id));

-- Orders: Project members can view/manage
CREATE POLICY "Users can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Project members can manage orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

-- Order items: Same as orders
CREATE POLICY "Users can view order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND public.has_project_access(auth.uid(), o.project_id)
  ));

CREATE POLICY "Project members can manage order items"
  ON public.order_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND public.has_project_access(auth.uid(), o.project_id)
  ));

-- Deliveries & delivery items
CREATE POLICY "Users can view deliveries"
  ON public.deliveries FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND public.has_project_access(auth.uid(), o.project_id)
  ));

CREATE POLICY "Project members can manage deliveries"
  ON public.deliveries FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND public.has_project_access(auth.uid(), o.project_id)
  ));

CREATE POLICY "Users can view delivery items"
  ON public.delivery_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id
    WHERE d.id = delivery_id 
    AND public.has_project_access(auth.uid(), o.project_id)
  ));

CREATE POLICY "Project members can manage delivery items"
  ON public.delivery_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id
    WHERE d.id = delivery_id 
    AND public.has_project_access(auth.uid(), o.project_id)
  ));

-- Notifications: Users see own
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SMS logs: Admins only
CREATE POLICY "Admins can view sms logs"
  ON public.sms_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert sms logs"
  ON public.sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SMS settings: Admins only
CREATE POLICY "Admins can view sms settings"
  ON public.sms_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage sms settings"
  ON public.sms_settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Audit logs: Admins only
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_skus_updated_at
  BEFORE UPDATE ON public.skus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_inventory_updated_at
  BEFORE UPDATE ON public.project_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_settings_updated_at
  BEFORE UPDATE ON public.sms_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || 
      lpad((SELECT count(*) + 1 FROM public.orders WHERE created_at::date = now()::date)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Function to generate SKU codes
CREATE OR REPLACE FUNCTION public.generate_sku_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku_code IS NULL OR NEW.sku_code = '' THEN
    NEW.sku_code := 'SKU-' || lpad((SELECT count(*) + 1 FROM public.skus)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_sku_code_trigger
  BEFORE INSERT ON public.skus
  FOR EACH ROW EXECUTE FUNCTION public.generate_sku_code();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_inventory;