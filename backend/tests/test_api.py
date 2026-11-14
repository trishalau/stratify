import unittest

from app import create_app
from app.database import Base, get_engine


class StratifyApiTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE_URL": "sqlite+pysqlite:///:memory:",
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


if __name__ == "__main__":
    unittest.main()
