-- Data-only update: store_role_definitions.name/description were seeded in English by migration
-- 019. Per the approved Store module naming review, these are user-facing text (rendered
-- directly as Role badges/checkboxes), not code identifiers, so they follow the same
-- UI-language rule as everything else in the module.

update store_role_definitions set
  name = 'Restaurante',
  description = 'Restaurante de cara al público que vende directamente a los clientes.'
where key = 'retail_store';

update store_role_definitions set
  name = 'Producción Central',
  description = 'Cocina central que abastece a otros locales.'
where key = 'production_center';
