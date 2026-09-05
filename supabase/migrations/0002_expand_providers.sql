-- Expand supported providers from the initial bkash/nagad/rocket set to
-- all common Bangladeshi mobile wallet MFS platforms. Card/net-banking
-- are intentionally NOT included here — see README for why.

alter table merchant_numbers drop constraint merchant_numbers_provider_check;
alter table merchant_numbers add constraint merchant_numbers_provider_check
  check (provider in ('bkash','nagad','rocket','upay','tap','cellfin','surecash','okwallet','mcash','meghnapay'));

alter table payment_requests drop constraint payment_requests_provider_check;
alter table payment_requests add constraint payment_requests_provider_check
  check (provider in ('bkash','nagad','rocket','upay','tap','cellfin','surecash','okwallet','mcash','meghnapay'));

alter table sms_events drop constraint sms_events_provider_check;
alter table sms_events add constraint sms_events_provider_check
  check (provider in ('bkash','nagad','rocket','upay','tap','cellfin','surecash','okwallet','mcash','meghnapay'));
