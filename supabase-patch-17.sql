-- supabase-patch-17.sql — Sistema de descontos
-- Cupons de desconto + promocoes diretas em produtos

-- Cupons de desconto
CREATE TABLE IF NOT EXISTS discount_codes (
  id          TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'percent'
                CHECK (type IN ('percent', 'fixed')),
  value       NUMERIC NOT NULL CHECK (value > 0),
  applies_to  TEXT NOT NULL DEFAULT 'all',
  max_uses    INTEGER DEFAULT NULL,
  uses_count  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at   TIMESTAMPTZ DEFAULT NULL,
  expires_at  TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discount_codes: admin gerencia"
  ON discount_codes FOR ALL TO public
  USING (is_admin()) WITH CHECK (is_admin());

-- Promocoes diretas nos produtos (sem codigo)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_type       TEXT    DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_value      NUMERIC DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Rastrear desconto nas compras
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_code   TEXT    DEFAULT NULL;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Rastrear desconto no pagamento pendente
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS discount_code   TEXT    DEFAULT NULL;
ALTER TABLE pending_payments ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Atualizar view sales_with_user para expor desconto
CREATE OR REPLACE VIEW public.sales_with_user AS
SELECT
  pu.id,
  pu.user_id,
  pu.product_id,
  pu.product_title,
  pu.price,
  pu.method,
  pu.created_at,
  pu.discount_code,
  pu.discount_amount,
  pr.name  AS user_name,
  pr.email AS user_email,
  p.area   AS product_area
FROM public.purchases pu
LEFT JOIN public.profiles pr ON pr.id = pu.user_id
LEFT JOIN public.products  p  ON p.id  = pu.product_id;

ALTER VIEW public.sales_with_user SET (security_invoker = on);
