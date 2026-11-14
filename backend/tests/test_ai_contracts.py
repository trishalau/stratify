import unittest

from app.ai_contracts import AIOutputValidationError, validate_explanation, validate_interpretation


class AIContractTests(unittest.TestCase):
    def interpretation(self, **overrides):
        value = {
            "event_type": "supplier_price_increase",
            "title": "Supplier price increase",
            "summary": "You described a supplier price change.",
            "affected_variables": ["supplier_costs"],
            "assumptions": [
                {
                    "name": "supplier_cost_increase_percent",
                    "value": 20,
                    "unit": "percent",
                    "evidence": "20%",
                }
            ],
            "missing_information": [],
            "follow_up_questions": [],
        }
        value.update(overrides)
        return value

    def test_explicit_assumption_is_extracted_without_calculation(self):
        result = validate_interpretation(self.interpretation(), "Our supplier prices rise by 20% next month.")
        self.assertEqual(result["assumptions"]["supplier_cost_increase_percent"], "20")
        self.assertTrue(result["ready_for_confirmation"])
        self.assertEqual(result["missing_information"], [])

    def test_numeric_assumption_string_is_accepted_only_when_evidence_matches(self):
        raw = self.interpretation(assumptions=[{
            "name": "supplier_cost_increase_percent",
            "value": "20",
            "unit": "percent",
            "evidence": "20%",
        }])
        result = validate_interpretation(raw, "Our supplier prices rise by 20% next month.")
        self.assertEqual(result["assumptions"]["supplier_cost_increase_percent"], "20")

    def test_bare_number_without_percent_unit_becomes_a_question(self):
        raw = self.interpretation(assumptions=[{
            "name": "supplier_cost_increase_percent",
            "value": 20,
            "unit": "percent",
            "evidence": "20",
        }])
        result = validate_interpretation(raw, "Supplier costs increase by 20.")
        self.assertNotIn("supplier_cost_increase_percent", result["assumptions"])
        self.assertFalse(result["ready_for_confirmation"])
        self.assertTrue(any("explicit percent unit" in item for item in result["follow_up_questions"]))

    def test_percentage_points_are_not_treated_as_percent(self):
        raw = self.interpretation(assumptions=[{
            "name": "supplier_cost_increase_percent",
            "value": 2,
            "unit": "percent",
            "evidence": "2 percentage points",
        }])
        result = validate_interpretation(raw, "Supplier costs increase by 2 percentage points.")
        self.assertNotIn("supplier_cost_increase_percent", result["assumptions"])
        self.assertFalse(result["ready_for_confirmation"])

    def test_numeric_assumption_string_cannot_use_unparseable_text(self):
        raw = self.interpretation(assumptions=[{
            "name": "supplier_cost_increase_percent",
            "value": "twenty",
            "unit": "percent",
            "evidence": "20%",
        }])
        with self.assertRaisesRegex(AIOutputValidationError, "plain numeric values"):
            validate_interpretation(raw, "Our supplier prices rise by 20% next month.")

    def test_out_of_range_assumption_becomes_a_clarification_not_a_runnable_value(self):
        raw = self.interpretation(assumptions=[{
            "name": "supplier_cost_increase_percent",
            "value": 1200,
            "unit": "percent",
            "evidence": "1200%",
        }])
        result = validate_interpretation(raw, "Supplier prices rise by 1200%.")
        self.assertNotIn("supplier_cost_increase_percent", result["assumptions"])
        self.assertFalse(result["ready_for_confirmation"])
        self.assertTrue(any("must be between" in item for item in result["missing_information"]))

    def test_missing_explicit_value_generates_a_follow_up(self):
        result = validate_interpretation(
            self.interpretation(assumptions=[{
                "name": "supplier_cost_increase_percent",
                "value": None,
                "unit": "percent",
                "evidence": "",
            }]),
            "Our supplier prices are going up.",
        )
        self.assertFalse(result["ready_for_confirmation"])
        self.assertTrue(result["missing_information"])
        self.assertTrue(result["follow_up_questions"])

    def test_assumption_requires_matching_user_evidence(self):
        with self.assertRaises(AIOutputValidationError):
            validate_interpretation(self.interpretation(), "Supplier prices may go up.")

    def test_range_assumptions_must_be_ordered_before_confirmation(self):
        raw = self.interpretation(assumptions=[
            {"name": "supplier_cost_increase_percent", "value": 20, "unit": "percent", "evidence": "20%"},
            {"name": "optimistic_supplier_cost_increase_percent", "value": 30, "unit": "percent", "evidence": "30%"},
            {"name": "pessimistic_supplier_cost_increase_percent", "value": 10, "unit": "percent", "evidence": "10%"},
        ])
        result = validate_interpretation(raw, "Supplier prices rise by 20%, could be 30% optimistically and 10% pessimistically.")
        self.assertFalse(result["ready_for_confirmation"])
        self.assertTrue(result["missing_information"])

    def test_summary_cannot_introduce_an_unstated_number(self):
        with self.assertRaises(AIOutputValidationError):
            validate_interpretation(
                self.interpretation(summary="Supplier costs could rise 30%."),
                "Supplier costs could change.",
            )

    def test_assumptions_for_another_event_are_rejected(self):
        with self.assertRaises(AIOutputValidationError):
            validate_interpretation(
                self.interpretation(assumptions=[{
                    "name": "sales_decrease_percent",
                    "value": 20,
                    "unit": "percent",
                    "evidence": "20%",
                }]),
                "Our supplier prices rise by 20%.",
            )

    def test_expense_category_must_be_named_by_user(self):
        raw = self.interpretation(
            event_type="expense_change",
            affected_variables=["rent"],
            assumptions=[
                {"name": "expense_category", "value": "rent", "unit": "category", "evidence": "rent"},
                {"name": "expense_change_percent", "value": -10, "unit": "percent", "evidence": "Reduce rent by 10%"},
            ],
        )
        result = validate_interpretation(raw, "Reduce rent by 10%.")
        self.assertEqual(result["assumptions"]["expense_category"], "rent")
        self.assertEqual(result["assumptions"]["expense_change_percent"], "-10")
        self.assertTrue(result["ready_for_confirmation"])

    def test_expense_decrease_can_quote_number_separately_from_direction(self):
        raw = self.interpretation(
            event_type="expense_change",
            affected_variables=["rent"],
            assumptions=[
                {"name": "expense_category", "value": "rent", "unit": "category", "evidence": "rent"},
                {"name": "expense_change_percent", "value": -10, "unit": "percent", "evidence": "10%"},
            ],
        )
        result = validate_interpretation(raw, "Reduce rent by 10%.")
        self.assertEqual(result["assumptions"]["expense_change_percent"], "-10")
        self.assertTrue(result["ready_for_confirmation"])

    def test_common_expense_synonym_maps_only_to_matching_saved_line(self):
        raw = self.interpretation(
            event_type="expense_change",
            affected_variables=["staff_salaries"],
            assumptions=[
                {"name": "expense_category", "value": "staff_salaries", "unit": "category", "evidence": "payroll"},
                {"name": "expense_change_percent", "value": 10, "unit": "percent", "evidence": "10%"},
            ],
        )
        result = validate_interpretation(raw, "Payroll expenses rise by 10%.")
        self.assertEqual(result["assumptions"]["expense_category"], "staff_salaries")
        self.assertTrue(result["ready_for_confirmation"])

    def test_unmodeled_expense_category_becomes_a_question(self):
        raw = self.interpretation(
            event_type="expense_change",
            affected_variables=["other_expenses"],
            assumptions=[
                {"name": "expense_category", "value": "marketing", "unit": "category", "evidence": "marketing"},
                {"name": "expense_change_percent", "value": 10, "unit": "percent", "evidence": "10%"},
            ],
        )
        result = validate_interpretation(raw, "Marketing costs rise by 10%.")
        self.assertNotIn("expense_category", result["assumptions"])
        self.assertFalse(result["ready_for_confirmation"])
        self.assertTrue(any("Which saved expense line" in item for item in result["follow_up_questions"]))

    def test_explanation_is_qualitative_and_cannot_repeat_numbers(self):
        valid = {
            "summary": "Higher supplier costs reduce the estimated monthly profit.",
            "drivers": [{"metric": "expenses", "direction": "negative", "explanation": "The supplier expense line increases."}],
            "limitations": ["Cash flow is unavailable with current timing information."],
        }
        self.assertEqual(validate_explanation(valid)["summary"], valid["summary"])
        with self.assertRaises(AIOutputValidationError):
            validate_explanation({**valid, "summary": "Profit decreases by RM8,000."})

    def test_explanation_direction_must_match_calculation(self):
        calculation = {
            "baseline": {"monthly_revenue": "100.00", "total_expenses": "50.00", "net_profit": "50.00"},
            "estimate": {"monthly_revenue": "100.00", "total_expenses": "60.00", "net_profit": "40.00"},
            "cash_flow": {"available": False},
        }
        explanation = {
            "summary": "Higher costs put pressure on profit.",
            "drivers": [{"metric": "expenses", "direction": "negative", "explanation": "The expense change is not well represented."}],
            "limitations": [],
        }
        with self.assertRaises(AIOutputValidationError):
            validate_explanation(explanation, calculation)


if __name__ == "__main__":
    unittest.main()
