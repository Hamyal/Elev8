CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  interest text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a contact request"
ON public.contact_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can read submissions"
ON public.contact_submissions FOR SELECT
TO authenticated
USING (true);

CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text,
  donor_email text NOT NULL,
  amount numeric(10,2) NOT NULL,
  frequency text NOT NULL DEFAULT 'one-time',
  stripe_session_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.donations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a donation record"
ON public.donations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated staff can read donations"
ON public.donations FOR SELECT
TO authenticated
USING (true);

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'CA',
  zip text NOT NULL,
  phone text,
  service_type text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view locations"
ON public.locations FOR SELECT
TO anon, authenticated
USING (true);

CREATE TABLE public.impact_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  image_url text,
  category text NOT NULL DEFAULT 'story',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.impact_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impact_stories TO authenticated;
GRANT ALL ON public.impact_stories TO service_role;

ALTER TABLE public.impact_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view impact stories"
ON public.impact_stories FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO public.locations (name, address, city, state, zip, phone, service_type, description, image_url) VALUES
('ARFSD Residential Home – Spring Valley', '1234 Meadow Lane', 'Spring Valley', 'CA', '91977', '(619) 555-0101', 'Residential', 'A warm, family-style adult residential facility offering 24-hour care in a quiet neighborhood setting.', 'https://images.unsplash.com/photo-1560518883-ce590e8864d8?w=800&q=80'),
('ARFSD Supported Living – La Mesa', '456 Maple Avenue', 'La Mesa', 'CA', '91941', '(619) 555-0102', 'SLS', 'Supported Living Services helping individuals live independently in their own homes with tailored support.', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80'),
('ARFSD Day Program – El Cajon', '789 Oak Street', 'El Cajon', 'CA', '91920', '(619) 555-0103', 'Day Program', 'A vibrant day program offering life skills, community integration, and meaningful activities for adults with developmental disabilities.', 'https://images.unsplash.com/photo-1573497491208-8b8f5b4f4a7e?w=800&q=80'),
('ARFSD Residential Home – Chula Vista', '321 Sunset Drive', 'Chula Vista', 'CA', '91910', '(619) 555-0104', 'Residential', 'A six-bed residential home with spacious common areas and an accessible garden for residents to enjoy.', 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80');

INSERT INTO public.impact_stories (person_name, title, summary, image_url, category) VALUES
('Maria', 'Finding Her Voice', 'After joining our Day Program, Maria discovered a love for painting and now leads weekly art sessions for her peers. Her confidence has blossomed beyond what her family ever imagined.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80', 'Day Program'),
('James', 'A Place to Call Home', 'James moved into one of our residential homes after years of instability. Today he has a circle of friends, a garden he tends daily, and a renewed sense of belonging.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80', 'Residential'),
('Aisha', 'Living on Her Own Terms', 'With Supported Living Services, Aisha manages her own apartment, holds a part-time job, and navigates her community with independence and pride.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80', 'SLS'),
('David', 'Building Connections', 'David struggled with social isolation until our Day Program helped him find a community. He now volunteers weekly at a local food bank.', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80', 'Day Program');