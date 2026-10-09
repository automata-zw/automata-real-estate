ALTER TABLE leads
ADD CONSTRAINT leads_agency_phone_unique
UNIQUE (agency_id, phone);