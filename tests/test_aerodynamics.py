import math
import unittest

from aerodynamics import calculate


class AerodynamicsTests(unittest.TestCase):
    def assert_close(self, actual, expected, tolerance=1e-5):
        self.assertTrue(math.isclose(actual, expected, rel_tol=tolerance, abs_tol=tolerance), (actual, expected))

    def test_isentropic_reference(self):
        result = calculate("isentropic", {"mach": 2.0, "gamma": 1.4})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["t0_t"], 1.8)
        self.assert_close(result["values"]["p0_p"], 7.824449)
        self.assert_close(result["values"]["rho0_rho"], 4.346916)
        self.assert_close(result["values"]["area_ratio"], 1.6875)

    def test_normal_shock_reference(self):
        result = calculate("normal-shock", {"mach": 2.0, "gamma": 1.4})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["mach_2"], 0.5773503)
        self.assert_close(result["values"]["p2_p1"], 4.5)
        self.assert_close(result["values"]["rho2_rho1"], 2.6666667)

    def test_oblique_shock_reports_two_branches(self):
        result = calculate("oblique-shock", {"mach": 2.5, "theta_deg": 15.0, "gamma": 1.4})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["beta_weak_deg"], 36.9449, 2e-4)
        self.assertGreater(result["values"]["beta_strong_deg"], 70)
        self.assertLess(result["values"]["mach_2_weak"], 2.5)

    def test_oblique_shock_detects_detachment(self):
        result = calculate("oblique-shock", {"mach": 2.0, "theta_deg": 35.0, "gamma": 1.4})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "detached_shock")

    def test_prandtl_meyer_reference(self):
        result = calculate("prandtl-meyer", {"mach": 2.0, "theta_deg": 10.0, "gamma": 1.4})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["mach_2"], 2.384887, 2e-5)

    def test_fanno_reference_and_choking_limit(self):
        result = calculate("fanno", {"mach": 0.5, "friction_factor": 0.005, "length_m": 5.0, "diameter_m": 0.4, "gamma": 1.4})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["mach_2"], 0.53476025)
        self.assert_close(result["values"]["friction_consumed"], 0.25)
        choked = calculate("fanno", {"mach": 0.5, "friction_factor": 0.5, "length_m": 50.0, "diameter_m": 0.1, "gamma": 1.4})
        self.assertFalse(choked["ok"])
        self.assertEqual(choked["error"]["code"], "choked")

    def test_rayleigh_heat_removal(self):
        result = calculate("rayleigh", {"mach": 1.4, "temperature_k": 300.0, "gamma": 1.4, "cp_j_kgk": 1005.0, "heat_j_kg": -63277.0})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["mach_2"], 1.99996764)
        self.assert_close(result["values"]["p2_p1"], 0.56728830)
        self.assert_close(result["values"]["t2_t1"], 0.65674613)

    def test_natural_convection_reference(self):
        result = calculate("natural-convection", {"surface_temperature_k": 363.15, "ambient_temperature_k": 303.15, "thermal_diffusivity_m2_s": 2.808e-5, "kinematic_viscosity_m2_s": 1.895e-5, "characteristic_length_m": 0.3125})
        self.assertTrue(result["ok"])
        self.assert_close(result["values"]["rayleigh"], 1.012921654e8)
        self.assert_close(result["values"]["grashof"], 1.500941428e8)

    def test_invalid_gamma_returns_structured_error(self):
        result = calculate("isentropic", {"mach": 2.0, "gamma": 1.0})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "invalid_input")

    def test_unknown_calculator_is_rejected(self):
        result = calculate("not-a-calculator", {})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "unknown_calculator")


if __name__ == "__main__":
    unittest.main()
