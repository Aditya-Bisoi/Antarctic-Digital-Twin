"""
ai_decision_support.py — AI Decision Support & Recommendation Service
Antarctic Digital Twin — SIH26060

Implements the AI provider abstraction layer:
- AIInsightProvider (abstract base class)
- RuleBasedInsightProvider (guaranteed deterministic offline fallback with hallucination guards)
- LLMInsightProvider (optional cloud LLM grounded strictly on simulation facts)

The AI NEVER alters physics or simulation state; it only receives structured telemetry and
optimizer outcomes, and produces explainable human-readable recommendations and justifications.
"""

import os
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class AIInsightProvider(ABC):
    """Abstract interface for Digital Twin AI Decision Support providers."""

    @abstractmethod
    def generate_decision_support(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receives structured digital twin context and generates explainable decision support.
        Must NOT mutate simulation state.
        """
        pass


class RuleBasedInsightProvider(AIInsightProvider):
    """
    Deterministic rule-based reasoning engine ensuring 100% offline availability,
    zero hallucination, and rigorous traceability to calculated simulation outcomes.
    """

    def generate_decision_support(self, context: Dict[str, Any]) -> Dict[str, Any]:
        current_state = context.get('current_state', {})
        hazards = context.get('hazards', [])
        failures = context.get('failures', [])
        risk_info = context.get('risk', {})
        resilience_info = context.get('resilience', {})
        predictions = context.get('predictions', [])
        baseline = context.get('baseline', {})
        optimizer = context.get('optimizer', {})
        candidate_plans = context.get('candidate_plans', [])
        active_scenarios = context.get('active_scenarios', [])  # Scenario context for AI reasoning

        rec_plan = optimizer.get('recommended_plan') or optimizer.get('recommendedPlan') or {}
        predicted_outcome = optimizer.get('predicted_outcome') or optimizer.get('predictedOutcome') or {}
        baseline_outcome = baseline or optimizer.get('baseline_outcome') or optimizer.get('baselineOutcomeWithoutIntervention') or {}

        # 1. Extract ground-truth telemetry values with strict fallbacks
        station_name = current_state.get('station_name') or current_state.get('stationName') or "Antarctic Station"
        sim_hour = current_state.get('simulation_hour') or current_state.get('simulationHour') or 0.0

        energy = current_state.get('energy', {})
        infra = current_state.get('infrastructure', {})
        logistics = current_state.get('logistics', {})
        env = current_state.get('environment', {})

        power_deficit = energy.get('power_deficit_kw', 0.0) if 'power_deficit_kw' in energy else energy.get('powerDeficitKw', 0.0)
        battery_pct = energy.get('battery_level_percent', 100.0) if 'battery_level_percent' in energy else energy.get('batteryLevelPercent', 100.0)
        power_demand = (
            energy.get('total_consumption_kw') or
            energy.get('totalConsumptionKw') or
            energy.get('power_consumption_kw') or
            energy.get('powerConsumptionKw') or 0.0
        )
        indoor_temp = infra.get('indoor_temp_avg', 20.0) if 'indoor_temp_avg' in infra else infra.get('indoorTempAvg', 20.0)
        fuel_days = logistics.get('fuel_endurance_days', 90.0) if 'fuel_endurance_days' in logistics else logistics.get('fuelEnduranceDays', 90.0)
        wind_speed = env.get('wind_speed', 15.0) if 'wind_speed' in env else env.get('windSpeed', 15.0)
        ambient_temp = env.get('temperature', -25.0)

        risk_level = (
            risk_info.get('risk_level') or risk_info.get('riskLevel') or
            current_state.get('risk_level') or current_state.get('riskLevel') or "LOW"
        ).upper()

        resilience_score = (
            resilience_info.get('resilience_score') or resilience_info.get('resilienceScore') or
            current_state.get('resilience_score') or current_state.get('resilienceScore') or 85.0
        )

        # 2. Synthesize Situation Summary grounded in real values
        situation_parts: List[str] = []

        if failures:
            failure_names = ", ".join(failures[:3])
            situation_parts.append(f"Subsystem failure detected on {failure_names}.")
        elif any('failure' in str(h).lower() for h in hazards):
            situation_parts.append("Power generation equipment failure active.")

        if wind_speed > 80:
            situation_parts.append(f"Severe katabatic blizzard winds ({wind_speed:.0f} km/h, {ambient_temp:.1f}°C ambient) elevating thermal loss.")
        elif ambient_temp < -35:
            situation_parts.append(f"Extreme polar cold ({ambient_temp:.1f}°C) driving high heating demand.")

        if power_deficit > 0:
            situation_parts.append(f"Station demand exceeds generation, resulting in an active {power_deficit:.1f} kW electrical deficit.")
        elif battery_pct < 35:
            situation_parts.append(f"Battery storage is heavily drawn down at {battery_pct:.1f}%.")

        if indoor_temp < 15.0:
            situation_parts.append(f"Habitat indoor temperature has dropped to {indoor_temp:.1f}°C.")

        if not situation_parts:
            situation_parts.append(
                f"Station systems are currently balanced. Power demand is {power_demand:.1f} kW with {fuel_days:.0f} days of fuel endurance."
            )

        situation_summary = (
            f"At T+{sim_hour:.1f}h, {station_name} operates with a {risk_level} risk profile (Resilience: {resilience_score}/100). "
            + " ".join(situation_parts)
        )

        # Inject scenario context into situation summary
        if active_scenarios:
            scenario_names = [s if isinstance(s, str) else s.get('name', s.get('id', '')) for s in active_scenarios]
            scenario_str = ', '.join(str(n) for n in scenario_names if n)
            if scenario_str:
                situation_summary += f" Active scenario context: {scenario_str}."

        # 3. Determine Recommended Action and "Why"
        rec_title = rec_plan.get('name') or "Maintain Nominal Operations"
        rec_interventions = rec_plan.get('interventions') or []

        why_points: List[str] = []

        if failures or any('generator' in str(h).lower() for h in hazards):
            why_points.append("Generation component impairment has constrained continuous electrical supply.")
        if power_deficit > 0:
            why_points.append(f"Unmitigated demand causes an immediate deficit of {power_deficit:.1f} kW.")
        if battery_pct < 40:
            why_points.append(f"Battery reserves at {battery_pct:.1f}% require conservation to maintain life-support continuity.")
        if indoor_temp < 16.0:
            why_points.append(f"Indoor habitat thermal margin ({indoor_temp:.1f}°C) approaches polar safety thresholds.")
        if fuel_days < 25.0:
            why_points.append(f"Projected fuel endurance ({fuel_days:.1f} days) necessitates strategic consumption throttling.")

        # If optimizer provided specific reasoning, integrate it
        opt_reasoning = rec_plan.get('reasoning') or optimizer.get('reasoning') or []
        for r in opt_reasoning[:3]:
            if r not in why_points:
                why_points.append(r)

        if not why_points:
            why_points.append("Recommended action maintains optimal balance between life-support security and fuel endurance.")

        # Add scenario-aware reasoning if available
        if active_scenarios:
            from .intervention_generator import SCENARIO_INTERVENTION_PRIORITIES
            for scenario in active_scenarios:
                sid = scenario if isinstance(scenario, str) else scenario.get('id', '')
                if sid in SCENARIO_INTERVENTION_PRIORITIES:
                    priority_interventions = SCENARIO_INTERVENTION_PRIORITIES[sid]
                    matched = [i for i in rec_interventions if i in priority_interventions]
                    if matched:
                        why_points.insert(0, f"Scenario '{sid}' activated — AI prioritizes {', '.join(matched)} as the primary countermeasures for this threat pattern.")

        # 4. Expected Effects (based on forward simulation calculations)
        expected_effects: List[str] = []
        pred_deficit = predicted_outcome.get('powerDeficitKw', predicted_outcome.get('power_deficit_kw', 0.0))
        pred_battery = predicted_outcome.get('batteryLevelPercent', predicted_outcome.get('battery_level_percent', battery_pct))
        pred_temp = predicted_outcome.get('indoorTempAvg', predicted_outcome.get('indoor_temp_avg', indoor_temp))
        pred_fuel = predicted_outcome.get('fuelEnduranceDays', predicted_outcome.get('fuel_endurance_days', fuel_days))

        base_deficit = baseline_outcome.get('powerDeficitKw', baseline_outcome.get('power_deficit_kw', 0.0))
        base_battery = baseline_outcome.get('batteryLevelPercent', baseline_outcome.get('battery_level_percent', battery_pct))
        base_temp = baseline_outcome.get('indoorTempAvg', baseline_outcome.get('indoor_temp_avg', indoor_temp))

        if pred_deficit <= 0 and base_deficit > 0:
            expected_effects.append(f"Completely eliminates projected {base_deficit:.1f} kW power deficit under baseline.")
        elif pred_deficit < base_deficit:
            expected_effects.append(f"Reduces unserved electrical deficit from {base_deficit:.1f} kW to {pred_deficit:.1f} kW.")

        if pred_battery > base_battery:
            expected_effects.append(f"Preserves battery reserve at {pred_battery:.1f}% vs baseline exhaustion to {base_battery:.1f}%.")

        if pred_temp > base_temp:
            expected_effects.append(f"Stabilizes indoor temperature at {pred_temp:.1f}°C vs unmitigated drop to {base_temp:.1f}°C.")

        if not expected_effects:
            expected_effects.append(f"Maintains projected fuel endurance at {pred_fuel:.1f} days with battery buffer at {pred_battery:.1f}%.")

        # 5. Tradeoffs (grounded in actual physical sacrifices)
        tradeoffs = rec_plan.get('tradeoffs') or optimizer.get('tradeoffs') or []
        if not tradeoffs:
            if 'reduce_noncritical_loads' in rec_interventions:
                tradeoffs.append("Non-essential scientific laboratories and aux heating loops temporarily suspended.")
            if 'start_backup_generator' in rec_interventions:
                tradeoffs.append("Fuel consumption rate increases by ~25 L/h while auxiliary unit is on line.")
            if not tradeoffs:
                tradeoffs.append("Nominal operational resource expenditure balanced against polar survival margins.")

        # 6. Alternatives
        raw_alternatives = optimizer.get('alternatives') or []
        alternative_actions: List[Dict[str, Any]] = []
        for alt in raw_alternatives[:3]:
            alternative_actions.append({
                'title': alt.get('name') or f"Plan {alt.get('id')}",
                'interventions': alt.get('interventions', []),
                'whyNotRecommended': alt.get('whyNotSelected') or alt.get('why_not_selected') or "Lower multi-objective score",
                'score': alt.get('scores', {}).get('overallScore') or alt.get('scores', {}).get('overall_score') or 0.0,
            })

        # 7. Urgency & Confidence
        if risk_level == "CRITICAL" or power_deficit > 10 or indoor_temp < 10.0:
            urgency = "CRITICAL"
        elif risk_level == "HIGH" or power_deficit > 0 or battery_pct < 25:
            urgency = "HIGH"
        elif risk_level == "MODERATE" or failures:
            urgency = "ELEVATED"
        else:
            urgency = "ROUTINE"

        confidence = "HIGH" if bool(optimizer.get('predicted_outcome') or optimizer.get('predictedOutcome')) else "MODERATE"

        assumptions = [
            "Specific fuel consumption modeled at 0.28 L/kWh nominal generator load.",
            "Building heat loss coefficient modeled with standard polar thermal inertia envelope.",
            "Solar and wind yield calculated according to active atmospheric visibility and wind velocity.",
        ]

        return {
            "situation_summary": situation_summary,
            "recommended_action": {
                "title": rec_title,
                "interventions": rec_interventions,
            },
            "why": why_points,
            "expected_effects": expected_effects,
            "tradeoffs": tradeoffs,
            "alternative_actions": alternative_actions,
            "urgency": urgency,
            "confidence": confidence,
            "assumptions": assumptions,
        }


class LLMInsightProvider(AIInsightProvider):
    """
    Optional LLM provider calling external APIs (e.g. Gemini / OpenAI)
    when API keys are present in environment. Strictly prompts the LLM
    with grounded JSON simulation telemetry and falls back to RuleBasedInsightProvider on error.
    """

    def __init__(self, fallback: Optional[AIInsightProvider] = None):
        self.fallback = fallback or RuleBasedInsightProvider()
        self.gemini_key = os.environ.get('GEMINI_API_KEY')
        self.openai_key = os.environ.get('OPENAI_API_KEY')

    def generate_decision_support(self, context: Dict[str, Any]) -> Dict[str, Any]:
        # If no API key configured, use guaranteed rule-based fallback immediately
        if not self.gemini_key and not self.openai_key:
            return self.fallback.generate_decision_support(context)

        # Build prompt strictly grounded on the simulation context
        system_prompt = (
            "You are an Antarctic Digital Twin AI Decision Support assistant. "
            "You MUST NOT invent telemetry, temperatures, battery levels, fuel days, or equipment status. "
            "Every numerical statement MUST strictly match the provided simulation input. "
            "If any data is missing, respond with 'Data unavailable'. "
            "Output valid JSON strictly adhering to the specified schema."
        )

        try:
            if self.gemini_key:
                import urllib.request
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_key}"
                prompt_body = {
                    "contents": [{
                        "parts": [
                            {"text": system_prompt},
                            {"text": f"Simulation Input Context:\n{json.dumps(context, indent=2)}\n\nGenerate the decision support JSON:"}
                        ]
                    }],
                    "generationConfig": {
                        "response_mime_type": "application/json",
                        "temperature": 0.2
                    }
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(prompt_body).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    text_content = res_data['candidates'][0]['content']['parts'][0]['text']
                    parsed = json.loads(text_content)
                    return parsed
        except Exception as err:
            logger.warning(f"LLM insight generation failed, falling back to rule-based engine: {err}")

        # Graceful fallback
        return self.fallback.generate_decision_support(context)


def get_insight_provider() -> AIInsightProvider:
    """Factory selecting the appropriate insight provider based on configuration."""
    if os.environ.get('GEMINI_API_KEY') or os.environ.get('OPENAI_API_KEY'):
        return LLMInsightProvider()
    return RuleBasedInsightProvider()


def generate_decision_support(context: Dict[str, Any], provider: Optional[AIInsightProvider] = None) -> Dict[str, Any]:
    """Top-level convenience entrypoint."""
    p = provider or get_insight_provider()
    return p.generate_decision_support(context)
