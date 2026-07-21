-- G1 ledger integrity.
--
-- The ledger is the authority for balances (ADR 0001), so it enforces its own
-- invariants rather than trusting callers. Three defects are closed here.
--
-- D-04  The available-balance constraint added in 001 was a tautology:
--       `CHECK (balance_minor - hold_minor >= 0 OR account_id IS NOT NULL)`.
--       account_id is the primary key and is never null, so the disjunct was
--       always true and the constraint never fired. Reproduced 2026-07-21: a
--       customer wallet was driven to -30000 through the public API.
--
-- D-05  Nothing enforced that debits equal credits within a journal entry.
--       Reproduced 2026-07-21: a one-legged entry was accepted by the database.
--
-- D-03  Postings accepted negative amounts, which inverted transfer direction.
--       The sign belongs to `direction`; `amount_minor` carries magnitude only.

-- 1. Magnitude in amount_minor, sign in direction.
ALTER TABLE postings DROP CONSTRAINT postings_amount_nonzero;
ALTER TABLE postings ADD CONSTRAINT postings_amount_positive
    CHECK (amount_minor > 0);

-- 2. Real balance floors.
--
-- Customer-facing accounts must never go negative. System accounts (clearing,
-- fee, fx, suspense) carry the platform's own position and legitimately do --
-- the sandbox opening balance in 003 debits clearing to fund a wallet. The
-- floor therefore depends on account type, which a column CHECK cannot read,
-- so it is a row trigger.
ALTER TABLE account_balances DROP CONSTRAINT account_balances_nonneg_available;
ALTER TABLE account_balances ADD CONSTRAINT account_balances_nonneg_hold
    CHECK (hold_minor >= 0);

CREATE OR REPLACE FUNCTION assert_balance_floor() RETURNS trigger AS $$
DECLARE
    a_type TEXT;
BEGIN
    SELECT account_type INTO a_type FROM accounts WHERE id = NEW.account_id;
    IF a_type IS NULL THEN
        RAISE EXCEPTION 'balance row for unknown account %', NEW.account_id;
    END IF;
    IF a_type IN ('user_wallet', 'merchant')
       AND (NEW.balance_minor - NEW.hold_minor) < 0 THEN
        RAISE EXCEPTION
            'available balance would go negative on % account % (balance %, hold %)',
            a_type, NEW.account_id, NEW.balance_minor, NEW.hold_minor
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_balances_floor
    BEFORE INSERT OR UPDATE ON account_balances
    FOR EACH ROW EXECUTE FUNCTION assert_balance_floor();

-- 3. Double entry, enforced at commit.
--
-- Postings are inserted one leg at a time, so the check must be deferred to
-- the end of the transaction rather than evaluated per statement.
CREATE OR REPLACE FUNCTION assert_journal_balanced() RETURNS trigger AS $$
DECLARE
    je   UUID := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
    legs INT;
    bad  RECORD;
BEGIN
    SELECT count(*) INTO legs FROM postings WHERE journal_entry_id = je;
    IF legs < 2 THEN
        RAISE EXCEPTION
            'journal entry % has % posting(s); double entry requires at least two',
            je, legs
            USING ERRCODE = 'check_violation';
    END IF;

    FOR bad IN
        SELECT currency,
               sum(CASE WHEN direction = 'credit'
                        THEN amount_minor ELSE -amount_minor END) AS net
        FROM postings
        WHERE journal_entry_id = je
        GROUP BY currency
        HAVING sum(CASE WHEN direction = 'credit'
                        THEN amount_minor ELSE -amount_minor END) <> 0
    LOOP
        RAISE EXCEPTION
            'journal entry % is unbalanced for %: net %', je, bad.currency, bad.net
            USING ERRCODE = 'check_violation';
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER postings_balanced
    AFTER INSERT OR UPDATE OR DELETE ON postings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();

-- A journal entry with no postings at all never fires the trigger above, so it
-- is checked from the entry side as well.
CREATE OR REPLACE FUNCTION assert_journal_has_postings() RETURNS trigger AS $$
DECLARE
    legs INT;
BEGIN
    SELECT count(*) INTO legs FROM postings WHERE journal_entry_id = NEW.id;
    IF legs < 2 THEN
        RAISE EXCEPTION
            'journal entry % committed with % posting(s)', NEW.id, legs
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_entries_have_postings
    AFTER INSERT ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_journal_has_postings();
