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
            }
        )
        Base.metadata.create_all(get_engine(self.app))
        self.client = self.app.test_client()

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
