import unittest

from app import create_app
from app.database import Base, get_engine


class FakeScenarioAI:
    def interpret(self, messages, available_profile_fields):
        latest = messages[-1]["content"]
        if "marketing costs" in latest.casefold():
            return {
                "event_type": "expense_change",
                "title": "Marketing costs increase",
                "summary": "You described an expense increase.",
                "affected_variables": ["other_expenses"],
                "assumptions": [
                    {"name": "expense_category", "value": "marketing", "unit": "category", "evidence": "marketing"},
                    {"name": "expense_change_percent", "value": 10, "unit": "percent", "evidence": "10%"},
                ],
                "missing_information": [],
                "follow_up_questions": [],
            }
        if "untrusted test output" in latest:
            return {
                "event_type": "supplier_price_increase",
                "title": "Supplier price increase",
                "summary": "Costs change by 90%.",
                "affected_variables": ["supplier_costs"],
                "assumptions": [{
                    "name": "supplier_cost_increase_percent",
                    "value": 90,
                    "unit": "percent",
                    "evidence": "90%",
                }],
                "missing_information": [],
                "follow_up_questions": [],
            }
        return {
            "event_type": "supplier_price_increase",
            "title": "Supplier prices rise",
            "summary": "You described a supplier price increase.",
            "affected_variables": ["supplier_costs"],
            "assumptions": [{
                "name": "supplier_cost_increase_percent",
                "value": 20,
                "unit": "percent",
                "evidence": "20%",
            }],
            "missing_information": [],
            "follow_up_questions": [],
        }

    def explain(self, calculation):
        return {
            "summary": "Higher supplier costs reduce estimated monthly profit.",
            "drivers": [
                {"metric": "expenses", "direction": "positive", "explanation": "The supplier expense line increases."},
                {"metric": "profit", "direction": "negative", "explanation": "The increased expense lowers profit."},
                {"metric": "cash_flow", "direction": "unavailable", "explanation": "Cash flow cannot be projected from current timing information."},
            ],
            "limitations": ["This is a hypothetical estimate based on confirmed assumptions."],
        }


class StratifyApiTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE_URL": "sqlite+pysqlite:///:memory:",
                "SCENARIO_AI": FakeScenarioAI(),
                "SECRET_KEY": "test-only-session-secret",
                "STRATIFY_DEMO_MODE": False,
            }
        )
        Base.metadata.create_all(get_engine(self.app))
        self.client = self.app.test_client()
        self.client.post("/api/auth/register", json={"username": "owner", "password": "ownpass1234"})

    def business_payload(self):
        return {
            "name": "KL Electronics Sdn. Bhd.",
            "industry": "Consumer electronics retail",
            "location": "Kuala Lumpur, Malaysia",
            "monthly_revenue": "120000.00",
            "supplier_costs": "40000.00",
            "rent": "10000.00",
            "staff_salaries": "20000.00",
            "other_expenses": "12000.00",
            "cash_balance": "160000.00",
        }

    def create_business(self):
        response = self.client.post("/api/businesses", json=self.business_payload())
        self.assertEqual(response.status_code, 201)
        return response.get_json()["data"]

    def test_owner_login_logout_and_protected_api(self):
        client = self.app.test_client()
        denied = client.get("/api/businesses")
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(client.get("/api/health").status_code, 200)

        bad_login = client.post("/api/auth/login", json={"username": "owner", "password": "wrong12"})
        self.assertEqual(bad_login.status_code, 401)
        self.assertNotIn("wrong12", bad_login.get_data(as_text=True))

        client.post("/api/auth/register", json={"username": "owner", "password": "ownpass1234"})
        good_login = client.post("/api/auth/login", json={"username": "owner", "password": "ownpass1234"})
        self.assertEqual(good_login.status_code, 200)
        cookie = client.get_cookie("session")
        self.assertIsNotNone(cookie)
        self.assertTrue(cookie.http_only)
        self.assertEqual(cookie.same_site, "Lax")
        self.assertFalse(cookie.secure)
        self.assertEqual(client.get("/api/businesses").status_code, 200)

        logout = client.post("/api/auth/logout")
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(client.get("/api/businesses").status_code, 401)

    def test_registration_hashes_password_and_rejects_duplicate_or_weak_credentials(self):
        client = self.app.test_client()
        bad = client.post("/api/auth/register", json={"username": "xy", "password": "tiny"})
        self.assertEqual(bad.status_code, 422)
        created = client.post("/api/auth/register", json={"username": "new_owner", "password": "newpass1234"})
        self.assertEqual(created.status_code, 201)
        self.assertNotIn("password", created.get_data(as_text=True).lower())
        duplicate = self.app.test_client().post("/api/auth/register", json={"username": "new_owner", "password": "otherpass12"})
        self.assertEqual(duplicate.status_code, 409)
        from app.models import User
        user = self.client.application.extensions["stratify_session_factory"]().query(User).filter_by(username="new_owner").one()
        self.assertNotEqual(user.password_hash, "newpass1234")

    def test_users_cannot_access_other_users_businesses_or_scenarios(self):
        user_b = self.app.test_client()
        registration = user_b.post("/api/auth/register", json={"username": "owner_b", "password": "ownerb123"})
        self.assertEqual(registration.status_code, 201)
        business_response = user_b.post("/api/businesses", json=self.business_payload())
        self.assertEqual(business_response.status_code, 201)
        business_b = business_response.get_json()["data"]
        scenario_response = user_b.post(f"/api/businesses/{business_b['id']}/scenarios", json={
            "title": "Supplier costs rise", "event_type": "supplier_price_increase",
            "assumptions": {"supplier_cost_increase_percent": 10}, "missing_information": [],
        })
        self.assertEqual(scenario_response.status_code, 201)
        scenario_id = scenario_response.get_json()["data"]["id"]

        self.assertEqual(self.client.get(f"/api/businesses/{business_b['id']}").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/businesses/{business_b['id']}", json={"name": "Hijacked"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/businesses/{business_b['id']}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/businesses/{business_b['id']}/scenarios").status_code, 404)
        for method, path, kwargs in (
            (self.client.get, f"/api/scenarios/{scenario_id}", {}),
            (self.client.delete, f"/api/scenarios/{scenario_id}", {}),
            (self.client.patch, f"/api/scenarios/{scenario_id}", {"json": {"title": "Hijacked"}}),
            (self.client.post, f"/api/scenarios/{scenario_id}/confirm", {"json": {"confirmed": True}}),
            (self.client.post, f"/api/scenarios/{scenario_id}/simulate", {}),
            (self.client.post, f"/api/scenarios/{scenario_id}/explain", {}),
        ):
            with self.subTest(path=path):
                self.assertEqual(method(path, **kwargs).status_code, 404)

        still_owned = user_b.get(f"/api/businesses/{business_b['id']}")
        self.assertEqual(still_owned.status_code, 200)
        self.assertEqual(still_owned.get_json()["data"]["name"], "KL Electronics Sdn. Bhd.")

    def test_client_cannot_set_business_owner_id(self):
        payload = self.business_payload()
        payload["owner_id"] = 999
        response = self.client.post("/api/businesses", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_demo_mode_skips_login_but_scopes_requests_to_demo_owner(self):
        business = self.create_business()
        self.app.config["STRATIFY_DEMO_MODE"] = True
        reviewer = self.app.test_client()
        status = reviewer.get("/api/auth/session")
        self.assertEqual(status.status_code, 200)
        self.assertTrue(status.get_json()["authenticated"])
        self.assertTrue(status.get_json()["demo_mode"])
        self.assertEqual(reviewer.get("/api/businesses").get_json()["data"][0]["id"], business["id"])
        self.assertEqual(reviewer.post("/api/auth/login", json={"username": "owner", "password": "ownpass1234"}).status_code, 404)
        self.assertEqual(reviewer.post("/api/auth/register", json={"username": "reviewer", "password": "reviewer1"}).status_code, 404)

    def test_demo_simulation_uses_frontend_snapshot_without_persisting_profile_edits(self):
        business = self.create_business()
        scenario_response = self.client.post(f"/api/businesses/{business['id']}/scenarios", json={
            "title": "Supplier prices rise", "event_type": "supplier_price_increase",
            "assumptions": {"supplier_cost_increase_percent": 10}, "missing_information": [],
        })
        scenario_id = scenario_response.get_json()["data"]["id"]
        self.client.post(f"/api/scenarios/{scenario_id}/confirm", json={"confirmed": True})
        self.app.config["STRATIFY_DEMO_MODE"] = True
        snapshot = {**self.business_payload(), "monthly_revenue": "150000", "supplier_costs": "50000"}
        result = self.client.post(f"/api/scenarios/{scenario_id}/simulate", json={"business_snapshot": snapshot})
        self.assertEqual(result.status_code, 200)
        data = result.get_json()["data"]
        self.assertEqual(data["baseline"]["monthly_revenue"], "150000.00")
        self.assertEqual(data["baseline"]["expenses"]["supplier_costs"], "50000.00")
        saved = self.client.get(f"/api/businesses/{business['id']}").get_json()["data"]
        self.assertEqual(saved["monthly_revenue"], "120000.00")
        self.assertEqual(saved["supplier_costs"], "40000.00")

    def test_business_edits_are_blocked_from_postgresql_in_demo_mode(self):
        business = self.create_business()
        self.app.config["STRATIFY_DEMO_MODE"] = True
        response = self.client.patch(f"/api/businesses/{business['id']}", json={"monthly_revenue": "999999"})
        self.assertEqual(response.status_code, 403)
        unchanged = self.client.get(f"/api/businesses/{business['id']}").get_json()["data"]
        self.assertEqual(unchanged["monthly_revenue"], "120000.00")

    def test_business_create_and_patch(self):
        created = self.create_business()
        self.assertEqual(created["currency"], "MYR")
        self.assertEqual(created["monthly_revenue"], "120000.00")
        self.assertIsNone(created["inventory_value"])

        response = self.client.patch(
            f"/api/businesses/{created['id']}",
            json={"monthly_revenue": "125500.50", "inventory_value": None},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["monthly_revenue"], "125500.50")

    def test_business_rejects_negative_amount(self):
        payload = self.business_payload()
        payload["cash_balance"] = "-1"
        response = self.client.post("/api/businesses", json=payload)
        self.assertEqual(response.status_code, 422)
        self.assertIn("cash_balance", response.get_json()["fields"])

    def test_custom_monthly_variables_can_be_saved_and_retrieved(self):
        business = self.create_business()
        variables = [
            {"name": "Utilities", "value": "850.5"},
            {"name": "Marketing", "value": "1200"},
        ]
        updated = self.client.patch(
            f"/api/businesses/{business['id']}",
            json={"custom_monthly_variables": variables},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(
            updated.get_json()["data"]["custom_monthly_variables"],
            [
                {"name": "Utilities", "value": "850.50"},
                {"name": "Marketing", "value": "1200.00"},
            ],
        )

        retrieved = self.client.get(f"/api/businesses/{business['id']}")
        self.assertEqual(retrieved.status_code, 200)
        self.assertEqual(retrieved.get_json()["data"]["custom_monthly_variables"], updated.get_json()["data"]["custom_monthly_variables"])

    def test_custom_monthly_variables_reject_invalid_or_duplicate_entries(self):
        business = self.create_business()
        for variables in (
            [{"name": "Utilities", "value": "-1"}],
            [{"name": "Utilities", "value": "10"}, {"name": "utilities", "value": "15"}],
            [{"name": "", "value": "10"}],
        ):
            with self.subTest(variables=variables):
                response = self.client.patch(
                    f"/api/businesses/{business['id']}",
                    json={"custom_monthly_variables": variables},
                )
                self.assertEqual(response.status_code, 422)

    def test_scenario_requires_review_and_confirmation(self):
        business = self.create_business()
        response = self.client.post(
            f"/api/businesses/{business['id']}/scenarios",
            json={
                "title": "Supplier prices rise by 20%",
                "event_type": "supplier_price_increase",
                "assumptions": {"supplier_cost_increase_percent": 20},
                "missing_information": ["Confirm how long the increase applies"],
            },
        )
        self.assertEqual(response.status_code, 201)
        scenario = response.get_json()["data"]
        self.assertEqual(scenario["status"], "draft")

        blocked = self.client.post(
            f"/api/scenarios/{scenario['id']}/confirm", json={"confirmed": True}
        )
        self.assertEqual(blocked.status_code, 422)

        updated = self.client.patch(
            f"/api/scenarios/{scenario['id']}",
            json={"missing_information": []},
        )
        self.assertEqual(updated.status_code, 200)
        confirmed = self.client.post(
            f"/api/scenarios/{scenario['id']}/confirm", json={"confirmed": True}
        )
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.get_json()["data"]["status"], "confirmed")

        locked = self.client.patch(
            f"/api/scenarios/{scenario['id']}", json={"title": "Changed after confirm"}
        )
        self.assertEqual(locked.status_code, 409)

    def test_unconfirmed_assumptions_cannot_be_confirmed(self):
        business = self.create_business()
        response = self.client.post(
            f"/api/businesses/{business['id']}/scenarios",
            json={"title": "Sales decrease", "event_type": "sales_decrease"},
        )
        scenario_id = response.get_json()["data"]["id"]
        confirmation = self.client.post(
            f"/api/scenarios/{scenario_id}/confirm", json={"confirmed": True}
        )
        self.assertEqual(confirmation.status_code, 422)

    def test_simulation_requires_confirmation_and_returns_deterministic_result(self):
        business = self.create_business()
        draft_response = self.client.post(
            f"/api/businesses/{business['id']}/scenarios",
            json={
                "title": "Supplier prices rise by 20%",
                "event_type": "supplier_price_increase",
                "assumptions": {"supplier_cost_increase_percent": 20},
            },
        )
        scenario_id = draft_response.get_json()["data"]["id"]

        blocked = self.client.post(f"/api/scenarios/{scenario_id}/simulate")
        self.assertEqual(blocked.status_code, 409)

        confirmed = self.client.post(
            f"/api/scenarios/{scenario_id}/confirm", json={"confirmed": True}
        )
        self.assertEqual(confirmed.status_code, 200)
        result = self.client.post(f"/api/scenarios/{scenario_id}/simulate")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.get_json()["data"]["estimate"]["net_profit"], "30000.00")

    def test_interpretation_returns_validated_assumptions_and_never_calculates(self):
        business = self.create_business()
        response = self.client.post(
            f"/api/businesses/{business['id']}/scenarios/interpret",
            json={"messages": [{"role": "user", "content": "Supplier prices rise by 20%."}]},
        )
        self.assertEqual(response.status_code, 200)
        result = response.get_json()["data"]
        self.assertEqual(result["assumptions"]["supplier_cost_increase_percent"], "20")
        self.assertEqual(result["assumption_evidence"]["supplier_cost_increase_percent"], "20%")
        self.assertTrue(result["ready_for_confirmation"])
        self.assertNotIn("estimate", result)

    def test_invalid_model_output_returns_conversational_clarification(self):
        business = self.create_business()
        response = self.client.post(
            f"/api/businesses/{business['id']}/scenarios/interpret",
            json={"messages": [{"role": "user", "content": "untrusted test output"}]},
        )
        self.assertEqual(response.status_code, 200)
        interpretation = response.get_json()["data"]
        self.assertTrue(interpretation["clarification_only"])
        self.assertFalse(interpretation["ready_for_confirmation"])
        self.assertEqual(interpretation["assumptions"], {})

    def test_unmodeled_expense_category_returns_question_not_rejection(self):
        business = self.create_business()
        response = self.client.post(
            f"/api/businesses/{business['id']}/scenarios/interpret",
            json={"messages": [{"role": "user", "content": "Marketing costs rise by 10%."}]},
        )
        self.assertEqual(response.status_code, 200)
        interpretation = response.get_json()["data"]
        self.assertFalse(interpretation["ready_for_confirmation"])
        self.assertNotIn("expense_category", interpretation["assumptions"])
        self.assertTrue(any("Which saved expense line" in item for item in interpretation["follow_up_questions"]))

    def test_explanation_requires_confirmation_and_preserves_engine_result(self):
        business = self.create_business()
        draft = self.client.post(
            f"/api/businesses/{business['id']}/scenarios",
            json={
                "title": "Supplier prices rise by 20%",
                "event_type": "supplier_price_increase",
                "assumptions": {"supplier_cost_increase_percent": 20},
            },
        ).get_json()["data"]
        blocked = self.client.post(f"/api/scenarios/{draft['id']}/explain")
        self.assertEqual(blocked.status_code, 409)

        self.client.post(f"/api/scenarios/{draft['id']}/confirm", json={"confirmed": True})
        explained = self.client.post(f"/api/scenarios/{draft['id']}/explain")
        self.assertEqual(explained.status_code, 200)
        payload = explained.get_json()["data"]
        self.assertEqual(payload["calculation"]["estimate"]["net_profit"], "30000.00")
        self.assertEqual(payload["explanation"]["summary"], "Higher supplier costs reduce estimated monthly profit.")


if __name__ == "__main__":
    unittest.main()
