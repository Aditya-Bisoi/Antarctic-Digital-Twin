"""
predict.py — ML Model Inference & Versioned Failure Prediction
Antarctic Digital Twin — SIH26060
"""

import os
import json
from typing import Dict, Any, Optional, List
import numpy as np

from .features import extract_features_from_equipment, FeatureScaler, NORMAL_THRESHOLDS
from .train import LogisticRegressionModel, RidgeRegressionModel, train_and_persist_models

_CACHED_MODEL: Optional[Dict[str, Any]] = None


def load_active_model() -> Optional[Dict[str, Any]]:
    """Loads and caches the active ML model artifact."""
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL

    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    model_path = os.path.join(models_dir, 'degradation_model.json')

    if not os.path.exists(model_path):
        try:
            train_and_persist_models(models_dir)
        except Exception as e:
            return None

    if os.path.exists(model_path):
        with open(model_path, 'r', encoding='utf-8') as f:
            _CACHED_MODEL = json.load(f)
        return _CACHED_MODEL

    return None


def get_equipment_ml_prediction(eq_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Performs ML inference on equipment telemetry to estimate failure probability within 48h
    and Remaining Useful Life (RUL). Falls back to audited heuristic physics if model artifact is unavailable.
    """
    model = load_active_model()
    name = eq_data.get('name') or eq_data.get('equipment_name') or eq_data.get('id', 'Equipment')
    health = float(eq_data.get('health', 100.0))
    temperature = float(eq_data.get('temperature', 60.0))
    vibration = float(eq_data.get('vibration', 10.0))
    category = eq_data.get('category', 'generator').lower()

    normals = NORMAL_THRESHOLDS.get(category, NORMAL_THRESHOLDS['default'])

    # Determine abnormal factors
    factors = []
    if temperature > normals['temp_max']:
        dev = ((temperature - normals['temp_max']) / normals['temp_max']) * 100
        factors.append({
            'name': 'temperature',
            'effect': 'elevated' if dev < 30 else 'critical',
            'value': round(temperature, 1),
            'threshold': normals['temp_max'],
        })

    if vibration > normals['vib_max']:
        dev = ((vibration - normals['vib_max']) / normals['vib_max']) * 100
        factors.append({
            'name': 'vibration',
            'effect': 'elevated' if dev < 50 else 'critical',
            'value': round(vibration, 1),
            'threshold': normals['vib_max'],
        })

    if health < 50:
        factors.append({
            'name': 'health',
            'effect': 'degraded',
            'value': round(health, 1),
            'threshold': 50.0,
        })

    # Recommended maintenance
    maintenance = "Routine polar maintenance inspection"
    if any(f['name'] == 'vibration' for f in factors):
        maintenance = "Inspect rotor dynamic alignment, bearing tolerances, and foundation dampeners"
    elif any(f['name'] == 'temperature' for f in factors):
        maintenance = "Check coolant glycol circulation, heat exchangers, and air filtration flow"
    elif health < 50:
        maintenance = "Schedule preventive overhaul and commission standby auxiliary subsystem"

    # Trend determination
    if health < 40 or len(factors) >= 2:
        trend = "degrading"
    elif health < 75 or len(factors) == 1:
        trend = "unstable"
    else:
        trend = "stable"

    if model:
        try:
            scaler = FeatureScaler.from_dict(model['scaler'])
            raw_feats = extract_features_from_equipment(eq_data).reshape(1, -1)
            scaled_feats = scaler.transform(raw_feats)

            clf = LogisticRegressionModel()
            clf.weights = np.array(model['classifier_weights'], dtype=np.float32)
            clf.bias = model['classifier_bias']
            fail_prob = float(clf.predict_proba(scaled_feats)[0])

            reg = RidgeRegressionModel()
            reg.weights = np.array(model['regressor_weights'], dtype=np.float32)
            reg.bias = model['regressor_bias']
            rul_hours = float(reg.predict(scaled_feats)[0])

            return {
                'equipment': name,
                'failure_probability': round(fail_prob, 2),
                'prediction_window_hours': 48,
                'estimated_rul_hours': round(rul_hours, 1),
                'trend': trend,
                'factors': factors,
                'recommended_maintenance': maintenance,
                'model_version': model.get('model_version', 'ml-degradation-v1.0'),
                'model_type': 'trained_ml',
            }
        except Exception:
            pass

    # Audited Heuristic fallback
    fail_prob = max(0.05, (100.0 - health) / 100.0)
    if factors:
        fail_prob = min(0.95, fail_prob + 0.25 * len(factors))

    return {
        'equipment': name,
        'failure_probability': round(fail_prob, 2),
        'prediction_window_hours': 48,
        'estimated_rul_hours': round(health / 0.5, 1),
        'trend': trend,
        'factors': factors,
        'recommended_maintenance': maintenance,
        'model_version': 'heuristic-v1.0',
        'model_type': 'statistical_heuristic',
    }
