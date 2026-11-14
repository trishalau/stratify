import unittest

from stratify_engine import FinancialEngineError, UnconfirmedScenarioError, simulate_scenario


class FinancialEngineTests(unittest.TestCase):
    def setUp(self):
        self.business = {
            "currency": "MYR",
            "monthly_revenue": "120000.00",
            "supplier_costs": "40000.00",
            "rent": "10000.00",
            "staff_salaries": "20000.00",
            "other_expenses": "12000.00",
            "cash_balance": "160000.00",
            "inventory_value": None,
            "liabilities": None,
        }

    def scenario(self, event_type, assumptions, **overrides):
        return {
            "id": 7,
            "title": "Test scenario",
            "event_type": event_type,
            "assumptions": assumptions,
            "missing_information": [],
            "status": "confirmed",
            **overrides,
        }

    def test_supplier_increase_calculates_expenses_and_profit(self):
        result = simulate_scenario(
            self.business,
            self.scenario("supplier_price_increase", {"supplier_cost_increase_percent": "20"}),
        )
        self.assertEqual(result["baseline"]["net_profit"], "38000.00")
        self.assertEqual(result["estimate"]["expenses"]["supplier_costs"], "48000.00")
        self.assertEqual(result["estimate"]["total_expenses"], "90000.00")
        self.assertEqual(result["estimate"]["net_profit"], "30000.00")

    def test_sales_decrease_changes_revenue_and_profit(self):
        result = simulate_scenario(
            self.business,
            self.scenario("sales_decrease", {"sales_decrease_percent": "15"}),
        )
        self.assertEqual(result["estimate"]["monthly_revenue"], "102000.00")
        self.assertEqual(result["estimate"]["total_expenses"], "82000.00")
        self.assertEqual(result["estimate"]["net_profit"], "20000.00")

    def test_expense_change_can_model_a_specific_category(self):
        result = simulate_scenario(
            self.business,
            self.scenario(
                "expense_change",
                {"expense_category": "rent", "expense_change_percent": "10"},
            ),
        )
        self.assertEqual(result["estimate"]["expenses"]["rent"], "11000.00")
        self.assertEqual(result["estimate"]["net_profit"], "37000.00")

    def test_comparison_range_uses_explicit_alternative_assumptions(self):
        result = simulate_scenario(
            self.business,
            self.scenario(
                "supplier_price_increase",
                {
                    "supplier_cost_increase_percent": "20",
                    "optimistic_supplier_cost_increase_percent": "15",
                    "pessimistic_supplier_cost_increase_percent": "25",
                },
            ),
        )
        comparison = result["comparison"]
        self.assertTrue(comparison["range_available"])
        self.assertEqual(comparison["optimistic"]["net_profit"], "32000.00")
        self.assertEqual(comparison["central"]["net_profit"], "30000.00")
        self.assertEqual(comparison["pessimistic"]["net_profit"], "28000.00")

    def test_engine_does_not_invent_comparison_range(self):
        result = simulate_scenario(
            self.business,
            self.scenario("sales_decrease", {"sales_decrease_percent": "15"}),
        )
        self.assertFalse(result["comparison"]["range_available"])
        self.assertIsNone(result["comparison"]["optimistic"])
        self.assertIsNone(result["comparison"]["pessimistic"])

    def test_cash_flow_is_explicitly_unavailable_without_timing_data(self):
        result = simulate_scenario(
            self.business,
            self.scenario("supplier_price_increase", {"supplier_cost_increase_percent": "20"}),
        )
        self.assertFalse(result["cash_flow"]["available"])
        self.assertEqual(result["cash_flow"]["current_cash_balance"], "160000.00")
        self.assertIsNone(result["cash_flow"]["estimated_closing_balance"])
        self.assertIn("timing", result["cash_flow"]["reason"])

    def test_draft_or_incomplete_scenario_is_rejected(self):
        with self.assertRaises(UnconfirmedScenarioError):
            simulate_scenario(
                self.business,
                self.scenario("supplier_price_increase", {"supplier_cost_increase_percent": "20"}, status="draft"),
            )
        with self.assertRaises(UnconfirmedScenarioError):
            simulate_scenario(
                self.business,
                self.scenario(
                    "supplier_price_increase",
                    {"supplier_cost_increase_percent": "20"},
                    missing_information=["Confirm timing"],
                ),
            )

    def test_invalid_percentages_and_incomplete_range_are_rejected(self):
        with self.assertRaises(FinancialEngineError):
            simulate_scenario(self.business, self.scenario("sales_decrease", {"sales_decrease_percent": "101"}))
        with self.assertRaises(FinancialEngineError):
            simulate_scenario(
                self.business,
                self.scenario(
                    "supplier_price_increase",
                    {
                        "supplier_cost_increase_percent": "20",
                        "optimistic_supplier_cost_increase_percent": "15",
                    },
                ),
            )


if __name__ == "__main__":
    unittest.main()
