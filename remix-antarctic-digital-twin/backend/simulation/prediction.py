"""
prediction.py — Predictive Failure & Health Analysis Engine
Antarctic Digital Twin — SIH26060

Python port of PredictiveEngine.ts.
Analyzes equipment health trends, anomalous operational parameters (temperature, vibration, efficiency),
calculates failure probability, estimates failure windows, and suggests preventive maintenance actions.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from .state import StationState, EquipmentItem


@dataclass
class AbnormalFactor:
    parameter: str
    current_value: float
    normal_range: str
    deviation_percent: int
    contribution: float  # 0.0 - 1.0 weight towards failure probability

    def to_dict(self) -> Dict[str, Any]:
        return {
            'parameter': self.parameter,
            'currentValue': self.current_value,
            'normalRange': self.normal_range,
            'deviationPercent': self.deviation_percent,
            'contribution': round(self.contribution, 2),
        }


@dataclass
class FailurePrediction:
    equipment_id: str
    equipment_name: str
    current_health: int
    trend: str  # 'stable', 'declining', 'rapidly_declining'
    trend_rate: float  # health % lost per hour
    abnormal_factors: List[AbnormalFactor] = field(default_factory=list)
    failure_probability: int = 0  # 0 - 100%
    estimated_failure_hours: Optional[int] = None
    estimated_failure_window: str = 'No failure expected'
    severity: str = 'low'  # 'low', 'medium', 'high', 'critical'
    recommended_maintenance: List[str] = field(default_factory=list)
    model_version: str = 'ml-degradation-v1.0'
    model_type: str = 'hybrid_ml_physics'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'equipmentId': self.equipment_id,
            'equipmentName': self.equipment_name,
            'currentHealth': self.current_health,
            'trend': self.trend,
            'trendRate': self.trend_rate,
            'abnormalFactors': [f.to_dict() for f in self.abnormal_factors],
            'failureProbability': self.failure_probability,
            'estimatedFailureHours': self.estimated_failure_hours,
            'estimatedFailureWindow': self.estimated_failure_window,
            'severity': self.severity,
            'recommendedMaintenance': self.recommended_maintenance,
            'modelVersion': self.model_version,
            'modelType': self.model_type,
            'model_version': self.model_version,
            'model_type': self.model_type,
        }


NORMAL_RANGES: Dict[str, Dict[str, float]] = {
    'generator': {'temp_max': 90.0, 'vib_max': 30.0, 'eff_min': 0.85},
    'heating': {'temp_max': 75.0, 'vib_max': 15.0, 'eff_min': 0.85},
    'water': {'temp_max': 50.0, 'vib_max': 12.0, 'eff_min': 0.90},
    'solar': {'temp_max': 40.0, 'vib_max': 5.0, 'eff_min': 0.75},
    'comms': {'temp_max': 35.0, 'vib_max': 8.0, 'eff_min': 0.90},
    'science': {'temp_max': 45.0, 'vib_max': 10.0, 'eff_min': 0.85},
    'vehicle': {'temp_max': 95.0, 'vib_max': 40.0, 'eff_min': 0.80},
}


def analyze_trend(health_history: List[float]) -> tuple[str, float]:
    """Analyzes health trend and rate from recent readings."""
    if not health_history or len(health_history) < 3:
        return 'stable', 0.0

    recent = health_history[-5:]
    oldest = recent[0]
    newest = recent[-1]
    rate = (oldest - newest) / max(len(recent) - 1, 1)

    if rate > 1.5:
        return 'rapidly_declining', rate
    if rate > 0.3:
        return 'declining', rate
    return 'stable', max(0.0, rate)


def get_abnormal_factors(eq: EquipmentItem) -> List[AbnormalFactor]:
    """Identifies physical deviations outside normal operating envelopes."""
    normals = NORMAL_RANGES.get(eq.category, NORMAL_RANGES['generator'])
    factors: List[AbnormalFactor] = []

    # Temperature
    if eq.temperature > normals['temp_max']:
        dev = ((eq.temperature - normals['temp_max']) / normals['temp_max']) * 100
        factors.append(AbnormalFactor(
            parameter='Operating Temperature',
            current_value=round(eq.temperature, 1),
            normal_range=f"≤ {normals['temp_max']:.0f}°C",
            deviation_percent=round(dev),
            contribution=min(dev / 100, 0.4),
        ))

    # Vibration
    if eq.vibration > normals['vib_max']:
        dev = ((eq.vibration - normals['vib_max']) / normals['vib_max']) * 100
        factors.append(AbnormalFactor(
            parameter='Vibration Level',
            current_value=round(eq.vibration, 1),
            normal_range=f"≤ {normals['vib_max']:.0f}",
            deviation_percent=round(dev),
            contribution=min(dev / 100, 0.35),
        ))

    # Efficiency
    if eq.efficiency < normals['eff_min']:
        dev = ((normals['eff_min'] - eq.efficiency) / normals['eff_min']) * 100
        factors.append(AbnormalFactor(
            parameter='Operating Efficiency',
            current_value=round(eq.efficiency * 100, 1),
            normal_range=f"≥ {round(normals['eff_min'] * 100)}%",
            deviation_percent=round(dev),
            contribution=min(dev / 100, 0.3),
        ))

    # Health below threshold
    if eq.health < 60:
        dev = ((60 - eq.health) / 60) * 100
        factors.append(AbnormalFactor(
            parameter='Component Health',
            current_value=round(eq.health, 1),
            normal_range='≥ 60%',
            deviation_percent=round(dev),
            contribution=min((60 - eq.health) / 100, 0.5),
        ))

    return factors


def calculate_failure_probability(eq: EquipmentItem, trend_rate: float) -> int:
    """Calculates overall failure probability percentage."""
    factors = get_abnormal_factors(eq)

    if eq.health < 20:
        prob = 85.0
    elif eq.health < 40:
        prob = 55.0
    elif eq.health < 60:
        prob = 30.0
    elif eq.health < 80:
        prob = 10.0
    else:
        prob = 2.0

    factor_contrib = sum(f.contribution for f in factors)
    prob += factor_contrib * 40.0

    if trend_rate > 1.5:
        prob += 15.0
    elif trend_rate > 0.5:
        prob += 8.0

    return min(round(prob), 99)


def estimate_failure_hours(eq: EquipmentItem, trend_rate: float) -> Optional[int]:
    """Estimates time in hours until health degrades to zero."""
    if trend_rate <= 0.01:
        return None
    hours = eq.health / max(trend_rate, 0.01)
    return round(hours)


def get_recommended_maintenance(eq: EquipmentItem, factors: List[AbnormalFactor]) -> List[str]:
    """Generates actionable maintenance recommendations based on active abnormal factors."""
    recommendations: List[str] = []

    has_temp = any(f.parameter == 'Operating Temperature' for f in factors)
    has_vib = any(f.parameter == 'Vibration Level' for f in factors)
    has_eff = any(f.parameter == 'Operating Efficiency' for f in factors)

    if has_temp:
        if eq.category == 'generator':
            recommendations.append('Inspect coolant system and radiator for blockages')
            recommendations.append('Check lubrication oil level and viscosity')
        else:
            recommendations.append('Inspect thermal management and ventilation ducts')

    if has_vib:
        recommendations.append('Inspect mounting bolts and vibration dampeners')
        if eq.category == 'generator':
            recommendations.append('Check crankshaft alignment and bearing wear')
            recommendations.append('Inspect fuel injectors for uneven combustion')

    if has_eff:
        recommendations.append('Perform full diagnostic and calibration check')
        if eq.category == 'generator':
            recommendations.append('Replace air and fuel filters')
            recommendations.append('Check exhaust system for backpressure')

    if eq.health < 50:
        recommendations.append('Schedule preventive component replacement')
        recommendations.append('Prepare backup unit for standby activation')

    if not recommendations:
        recommendations.append('Continue routine monitoring per maintenance schedule')

    return recommendations


def generate_predictions(state: StationState) -> List[FailurePrediction]:
    """
    Generates predictive failure analysis for all station equipment.
    Returns predictions sorted by failure probability descending.
    """
    try:
        from .ml.predict import get_equipment_ml_prediction
        has_ml = True
    except ImportError:
        has_ml = False

    predictions: List[FailurePrediction] = []

    for eq in state.equipment:
        if not eq.is_online and eq.health <= 0:
            continue  # Already failed

        trend, rate = analyze_trend(eq.health_history)
        factors = get_abnormal_factors(eq)
        prob = calculate_failure_probability(eq, rate)
        hours = estimate_failure_hours(eq, rate)

        model_version = 'heuristic-v1.0'
        model_type = 'statistical_heuristic'

        if has_ml:
            try:
                ml_res = get_equipment_ml_prediction({
                    'id': eq.id,
                    'name': eq.name,
                    'category': eq.category,
                    'health': eq.health,
                    'temperature': eq.temperature,
                    'vibration': eq.vibration,
                    'efficiency': eq.efficiency,
                    'load_percent': eq.load_percent,
                    'operating_hours': eq.operating_hours,
                    'maintenance_age_days': eq.maintenance_age_days,
                })
                # Blend ML probability with physical trend probability
                ml_prob_pct = int(round(ml_res['failure_probability'] * 100))
                prob = int(round(0.6 * prob + 0.4 * ml_prob_pct))
                model_version = ml_res.get('model_version', 'ml-degradation-v1.0')
                model_type = 'hybrid_ml_physics'
                if ml_res.get('estimated_rul_hours') and hours is not None:
                    hours = int(round(0.5 * hours + 0.5 * ml_res['estimated_rul_hours']))
            except Exception:
                pass

        if prob > 75:
            severity = 'critical'
        elif prob > 50:
            severity = 'high'
        elif prob > 25:
            severity = 'medium'
        else:
            severity = 'low'

        failure_window = 'No failure expected'
        if hours is not None:
            if hours < 6:
                failure_window = 'Within 6 hours'
            elif hours < 24:
                failure_window = 'Within 24 hours'
            elif hours < 72:
                failure_window = f'Within {round(hours / 24)} days'
            elif hours < 168:
                failure_window = f'Within {round(hours / 24)} days'
            else:
                failure_window = 'Beyond 7 days'

        predictions.append(FailurePrediction(
            equipment_id=eq.id,
            equipment_name=eq.name,
            current_health=round(eq.health),
            trend=trend,
            trend_rate=round(rate, 2),
            abnormal_factors=factors,
            failure_probability=prob,
            estimated_failure_hours=hours,
            estimated_failure_window=failure_window,
            severity=severity,
            recommended_maintenance=get_recommended_maintenance(eq, factors),
            model_version=model_version,
            model_type=model_type,
        ))

    predictions.sort(key=lambda p: p.failure_probability, reverse=True)
    return predictions
