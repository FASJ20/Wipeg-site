-- ============================================================================
--  WIPEG — seed data
--
--  Run:  psql "$DATABASE_URL" -f db/seed.sql     (after db/schema.sql)
--
--  Everything here is taken from src/data/site.ts, which is taken from WIPEG's
--  own fliers and posters. Re-runnable: every insert is ON CONFLICT DO NOTHING,
--  so applying it twice changes nothing.
--
--  THREE THINGS IN HERE ARE PROVISIONAL AND MARKED AS SUCH:
--
--    1. Department codes (MED, CEN, MGT …). Readable abbreviations, not
--       codes the ministry issued. Replace if WIPEG has official ones.
--    2. Specialisation codes (CEN-01, CEN-02 …). Deliberately ugly so that
--       nobody mistakes them for real codes. The registry has not supplied
--       the real ones. Replace before a matricule is ever printed.
--    3. The level-to-award mapping (1-2 HND, 3 Bachelor, 4-5 Master). This
--       matches the fliers but has not been confirmed department by
--       department. See db/DESIGN.md, open questions.
--
--  The specialisation NAMES are real — every one is quoted verbatim from the
--  flier. Only the codes are made up.
-- ============================================================================

BEGIN;

-- Campuses. Garoua is the main campus; the other four are branches.
INSERT INTO campuses (code, name, region, phone, is_main) VALUES
  ('GRA', 'Garoua', 'North Region', '+237677487127', true),
  ('YDE', 'Yaoundé', 'Centre Region', '+237682832207', false),
  ('MRA', 'Maroua', 'Far North Region', '+237655596057', false),
  ('BDA', 'Bamenda', 'North West Region', '+237675979319', false),
  ('TBO', 'Touboro', 'North Region', '+237656894203', false)
ON CONFLICT (code) DO NOTHING;

-- Awards, lowest first. `rank` is what orders them in a dropdown.
INSERT INTO awards (code, name, name_fr, rank) VALUES
  ('HND',      'HND / BTS', 'HND / BTS', 1),
  ('BACHELOR', 'Bachelor',  'Licence',   2),
  ('MASTER',   'Master',    'Master',    3)
ON CONFLICT (code) DO NOTHING;

-- PROVISIONAL mapping — see the header.
INSERT INTO levels (level, award_id, name) VALUES
  (1, (SELECT id FROM awards WHERE code = 'HND'),      'Level 1'),
  (2, (SELECT id FROM awards WHERE code = 'HND'),      'Level 2'),
  (3, (SELECT id FROM awards WHERE code = 'BACHELOR'), 'Level 3'),
  (4, (SELECT id FROM awards WHERE code = 'MASTER'),   'Level 4'),
  (5, (SELECT id FROM awards WHERE code = 'MASTER'),   'Level 5')
ON CONFLICT (level) DO NOTHING;

-- The ten departments. Codes are PROVISIONAL; names are from the flier.
INSERT INTO departments (slug, code, name) VALUES
  ('medical-biomedical-sciences', 'MED', 'Medical & Biomedical Sciences'),
  ('computer-engineering', 'CEN', 'Computer Engineering'),
  ('management', 'MGT', 'Management'),
  ('legal-careers', 'LAW', 'Legal Careers'),
  ('it-programs', 'ITP', 'IT Programs'),
  ('education', 'EDU', 'Education'),
  ('home-economics', 'HEC', 'Home Economics'),
  ('agricultural-food-sciences', 'AGR', 'Agricultural and Food Sciences'),
  ('business-and-finance', 'BUF', 'Business and Finance'),
  ('mining-petroleum-engineering', 'MPE', 'Mining and Petroleum Engineering')
ON CONFLICT (slug) DO NOTHING;

-- 51 specialisations, every name verbatim from the flier.
-- Codes are PROVISIONAL. `online_available` is inherited from the
-- department, which is how the website already presents it.
INSERT INTO specialisations (department_id, code, name, online_available) VALUES
  ((SELECT id FROM departments WHERE slug = 'medical-biomedical-sciences'), 'MED-01', 'Nursing', false),
  ((SELECT id FROM departments WHERE slug = 'medical-biomedical-sciences'), 'MED-02', 'Laboratory Technician', false),
  ((SELECT id FROM departments WHERE slug = 'medical-biomedical-sciences'), 'MED-03', 'Midwifery', false),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-01', 'Software Engineering', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-02', 'Network and Security', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-03', 'Computer Science and Networks', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-04', 'Computer Engineering', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-05', 'Data Base Management', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-06', 'Computer Hardware Maintenance', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-07', 'Computer Graphics and Web Design', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-08', 'E-commerce and Digital Marketing', true),
  ((SELECT id FROM departments WHERE slug = 'computer-engineering'), 'CEN-09', 'Industrial Computing and Automation', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-01', 'Assistant Manager', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-02', 'Project Management', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-03', 'Quality Management', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-04', 'Human Resource Management', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-05', 'Logistics and Transport Management', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-06', 'Operation of Air Transport', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-07', 'Sport Management', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-08', 'Management of Non-Governmental Organisations (NGOs)', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-09', 'Information Systems Management', true),
  ((SELECT id FROM departments WHERE slug = 'management'), 'MGT-10', 'Local Government Management', true),
  ((SELECT id FROM departments WHERE slug = 'legal-careers'), 'LAW-01', 'Legal Assistant', true),
  ((SELECT id FROM departments WHERE slug = 'legal-careers'), 'LAW-02', 'Business Law', true),
  ((SELECT id FROM departments WHERE slug = 'legal-careers'), 'LAW-03', 'Land Law', true),
  ((SELECT id FROM departments WHERE slug = 'legal-careers'), 'LAW-04', 'Tax Management', true),
  ((SELECT id FROM departments WHERE slug = 'legal-careers'), 'LAW-05', 'Custom and Transit', true),
  ((SELECT id FROM departments WHERE slug = 'it-programs'), 'ITP-01', 'Full Stack Development', true),
  ((SELECT id FROM departments WHERE slug = 'it-programs'), 'ITP-02', 'DevOps Engineering', true),
  ((SELECT id FROM departments WHERE slug = 'it-programs'), 'ITP-03', 'Backend Development', true),
  ((SELECT id FROM departments WHERE slug = 'it-programs'), 'ITP-04', 'Frontend Development', true),
  ((SELECT id FROM departments WHERE slug = 'it-programs'), 'ITP-05', 'Basic IT', true),
  ((SELECT id FROM departments WHERE slug = 'education'), 'EDU-01', 'Didactics, Curriculum Development and Teaching', true),
  ((SELECT id FROM departments WHERE slug = 'education'), 'EDU-02', 'Education Management and Administration', true),
  ((SELECT id FROM departments WHERE slug = 'education'), 'EDU-03', 'Special Needs', true),
  ((SELECT id FROM departments WHERE slug = 'home-economics'), 'HEC-01', 'Bakery and Food Processing', false),
  ((SELECT id FROM departments WHERE slug = 'home-economics'), 'HEC-02', 'Fashion Clothing and Textile', false),
  ((SELECT id FROM departments WHERE slug = 'home-economics'), 'HEC-03', 'Beauty-Esthetics', false),
  ((SELECT id FROM departments WHERE slug = 'agricultural-food-sciences'), 'AGR-01', 'Food Technology', false),
  ((SELECT id FROM departments WHERE slug = 'agricultural-food-sciences'), 'AGR-02', 'Animal Production', false),
  ((SELECT id FROM departments WHERE slug = 'agricultural-food-sciences'), 'AGR-03', 'Crop Production', false),
  ((SELECT id FROM departments WHERE slug = 'agricultural-food-sciences'), 'AGR-04', 'Agropastoral Entrepreneurship', false),
  ((SELECT id FROM departments WHERE slug = 'agricultural-food-sciences'), 'AGR-05', 'Agropastoral Adviser', false),
  ((SELECT id FROM departments WHERE slug = 'business-and-finance'), 'BUF-01', 'Accounting', true),
  ((SELECT id FROM departments WHERE slug = 'business-and-finance'), 'BUF-02', 'Marketing', true),
  ((SELECT id FROM departments WHERE slug = 'business-and-finance'), 'BUF-03', 'Trade-Sale', true),
  ((SELECT id FROM departments WHERE slug = 'business-and-finance'), 'BUF-04', 'Banking and Finance', true),
  ((SELECT id FROM departments WHERE slug = 'business-and-finance'), 'BUF-05', 'Insurance', true),
  ((SELECT id FROM departments WHERE slug = 'mining-petroleum-engineering'), 'MPE-01', 'Mining Engineering', false),
  ((SELECT id FROM departments WHERE slug = 'mining-petroleum-engineering'), 'MPE-02', 'Petroleum Engineering', false),
  ((SELECT id FROM departments WHERE slug = 'mining-petroleum-engineering'), 'MPE-03', 'Health, Safety and Environment', false)
ON CONFLICT (code) DO NOTHING;

COMMIT;
