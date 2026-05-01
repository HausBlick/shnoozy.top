-- Migration: 009_create_app_settings.sql
-- Key-value store for shared app settings (WiFi credentials etc.)

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON public.app_settings FOR UPDATE TO authenticated USING (true);

-- Default WiFi values (update these after running the migration)
INSERT INTO public.app_settings (key, value) VALUES
  ('wifi_ssid', 'Your-Network'),
  ('wifi_password', 'your-password'),
  ('wifi_security', 'WPA');
